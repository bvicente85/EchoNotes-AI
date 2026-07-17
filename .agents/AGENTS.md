# EchoNotes-AI Project Rules

## Vercel Backend Serverless Functions (ES Modules)
When editing or adding backend serverless functions inside the `api/` directory:

1. **File Location**:
   - Keep all backend-only utility files (e.g., `geminiBackend.ts`) directly inside the `api/` folder.
   - Do not place backend utility files inside the frontend `src/` folder, as Vercel isolates the `api/` context and will fail to bundle them at runtime.

2. **Explicit Import Extensions**:
   - Because the project runs in ES Modules (ESM) mode, relative imports of other TypeScript/JavaScript files in the backend **must** explicitly specify the `.js` extension.
   - Example: `import { generateMeetingReport } from './geminiBackend.js';` (even if the source file is `geminiBackend.ts`).
   - Omitting the extension will cause immediate runtime `ERR_MODULE_NOT_FOUND` crashes in the production deployment.
