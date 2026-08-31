import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  corsHeaders,
  errorResponse,
  HttpError,
  jsonResponse,
  requireAdmin,
} from '../_shared/admin-auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const { adminClient, adminUser } = await requireAdmin(req)
    const body = (await req.json()) as { userId?: unknown }
    const userId = typeof body.userId === 'string' ? body.userId : ''

    if (!userId) {
      throw new HttpError(400, 'User ID is required')
    }

    if (userId === adminUser.id) {
      throw new HttpError(400, 'Administrators cannot delete their own account')
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      throw new HttpError(400, deleteError.message)
    }

    return jsonResponse({ success: true })
  } catch (error) {
    return errorResponse(error, 'delete-user')
  }
})
