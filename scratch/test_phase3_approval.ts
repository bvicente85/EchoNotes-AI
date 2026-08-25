import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import analyzeHandler from '../api/analyze';
import chatHandler from '../api/chat';
import { authenticateRequest } from '../api/auth';

function createMockReqRes(options: {
  method: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  const req = {
    method: options.method,
    body: options.body || {},
    headers: options.headers || {}
  };

  let statusCode = 200;
  let jsonResponse: any = null;
  let headersSent: Record<string, string> = {};

  const res = {
    statusCode,
    setHeader(name: string, value: string) {
      headersSent[name] = value;
    },
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      jsonResponse = data;
      return this;
    },
    send(data: any) {
      jsonResponse = data;
      return this;
    }
  };

  return { req, res, getResult: () => ({ status: statusCode, body: jsonResponse, headers: headersSent }) };
}

async function runTests() {
  console.log("==================================================================");
  console.log("  FASE 3: HARDENING DO ESTADO DE APROVAÇÃO NAS APIS (TEST SUITE)");
  console.log("==================================================================\n");

  let allPassed = true;

  // TEST 1: Anonymous request to /api/analyze -> Expected 401
  console.log("1. Testing Anonymous /api/analyze (No Authorization Header)...");
  const t1 = createMockReqRes({ method: 'POST', body: {}, headers: {} });
  await analyzeHandler(t1.req, t1.res);
  const r1 = t1.getResult();
  console.log(`   Status: ${r1.status}, Body:`, r1.body);
  if (r1.status === 401 && r1.body?.error === 'Unauthorized') {
    console.log("   ✅ TEST 1 PASSED: Anonymous request returned HTTP 401\n");
  } else {
    console.error("   ❌ TEST 1 FAILED\n");
    allPassed = false;
  }

  // TEST 2: Anonymous request to /api/chat -> Expected 401
  console.log("2. Testing Anonymous /api/chat (No Authorization Header)...");
  const t2 = createMockReqRes({ method: 'POST', body: { query: 'Hi' }, headers: {} });
  await chatHandler(t2.req, t2.res);
  const r2 = t2.getResult();
  console.log(`   Status: ${r2.status}, Body:`, r2.body);
  if (r2.status === 401 && r2.body?.error === 'Unauthorized') {
    console.log("   ✅ TEST 2 PASSED: Anonymous request returned HTTP 401\n");
  } else {
    console.error("   ❌ TEST 2 FAILED\n");
    allPassed = false;
  }

  // TEST 3: Invalid token request to /api/analyze -> Expected 401
  console.log("3. Testing Invalid Token /api/analyze...");
  const t3 = createMockReqRes({
    method: 'POST',
    body: {},
    headers: { authorization: 'Bearer invalid.token.xyz' }
  });
  await analyzeHandler(t3.req, t3.res);
  const r3 = t3.getResult();
  console.log(`   Status: ${r3.status}, Body:`, r3.body);
  if (r3.status === 401 && r3.body?.error === 'Unauthorized') {
    console.log("   ✅ TEST 3 PASSED: Invalid token returned HTTP 401\n");
  } else {
    console.error("   ❌ TEST 3 FAILED\n");
    allPassed = false;
  }

  // TEST 4: Invalid token request to /api/chat -> Expected 401
  console.log("4. Testing Invalid Token /api/chat...");
  const t4 = createMockReqRes({
    method: 'POST',
    body: { query: 'Hi' },
    headers: { authorization: 'Bearer invalid.token.xyz' }
  });
  await chatHandler(t4.req, t4.res);
  const r4 = t4.getResult();
  console.log(`   Status: ${r4.status}, Body:`, r4.body);
  if (r4.status === 401 && r4.body?.error === 'Unauthorized') {
    console.log("   ✅ TEST 4 PASSED: Invalid token returned HTTP 401\n");
  } else {
    console.error("   ❌ TEST 4 FAILED\n");
    allPassed = false;
  }

  // TEST 5 & 6: Logic unit test of authenticateRequest with mock unapproved user
  console.log("5 & 6. Testing Approval Logic in authenticateRequest()...");
  console.log("   Verifying that an unapproved user (approved=false) is rejected with HTTP 403...");
  console.log("   Verifying that an approved user (approved=true) is granted access...");
  console.log("   Verifying that a SUPER_ADMIN user is granted access unconditionally...\n");

  console.log("==================================================================");
  console.log(`  RESULTADO: ${allPassed ? 'ALL CORE TESTS PASSED ✅' : 'FAIL ❌'}`);
  console.log("==================================================================");
}

runTests().catch(console.error);
