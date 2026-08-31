import { createClient } from 'npm:@supabase/supabase-js@2.103.3'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function requireAdmin(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication required')
  }

  const token = authorization.slice('Bearer '.length)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token)

  if (userError || !user) {
    throw new HttpError(401, 'Invalid or expired session')
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (profile?.role !== 'admin') {
    throw new HttpError(403, 'Administrator access required')
  }

  return { adminClient, adminUser: user }
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(error: unknown, context: string) {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message }, error.status)
  }

  console.error(`[${context}]`, error)
  return jsonResponse({ error: 'Internal server error' }, 500)
}
