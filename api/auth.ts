import { createClient } from '@supabase/supabase-js';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  [key: string]: any;
}

export interface AuthSuccess {
  user: AuthenticatedUser;
  isSuperAdmin?: boolean;
  approved?: boolean;
}

export interface AuthFailure {
  error: string;
  status: number;
}

export async function authenticateRequest(req: any): Promise<AuthSuccess | AuthFailure> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return { error: 'Unauthorized', status: 401 };
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return { error: 'Unauthorized', status: 401 };
  }

  const token = parts[1];
  if (!token) {
    return { error: 'Unauthorized', status: 401 };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Server Configuration Error: Supabase credentials missing in backend environment.');
    return { error: 'Server Configuration Error', status: 500 };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // 1. Validate JWT cryptographic signature and token validity
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return { error: 'Unauthorized', status: 401 };
    }

    // 2. Check if user has SUPER_ADMIN role (global bypass for approval)
    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin');
    if (isSuperAdmin === true) {
      return { user, isSuperAdmin: true, approved: true };
    }

    // 3. For regular users, verify approval status from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('approved')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.approved !== true) {
      return { error: 'Forbidden', status: 403 };
    }

    return { user, isSuperAdmin: false, approved: true };
  } catch (err: any) {
    console.error('Backend Authentication/Authorization verification error:', err);
    return { error: 'Unauthorized', status: 401 };
  }
}

