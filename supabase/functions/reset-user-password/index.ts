import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  corsHeaders,
  errorResponse,
  HttpError,
  jsonResponse,
  requireAdmin,
} from '../_shared/admin-auth.ts'

type ResetPasswordBody = {
  userId?: unknown
  password?: unknown
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const { adminClient } = await requireAdmin(req)
    const body = (await req.json()) as ResetPasswordBody
    const userId = typeof body.userId === 'string' ? body.userId : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!uuidPattern.test(userId)) {
      throw new HttpError(400, 'A valid user ID is required')
    }

    if (password.length < 8 || password.length > 128) {
      throw new HttpError(400, 'Password must contain between 8 and 128 characters')
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, { password })

    if (error) {
      throw new HttpError(400, error.message)
    }

    return jsonResponse({ success: true })
  } catch (error) {
    return errorResponse(error, 'reset-user-password')
  }
})
