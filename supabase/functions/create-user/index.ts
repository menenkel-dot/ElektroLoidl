import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  corsHeaders,
  errorResponse,
  HttpError,
  jsonResponse,
  requireAdmin,
} from '../_shared/admin-auth.ts'

type CreateUserBody = {
  email?: unknown
  password?: unknown
  firstName?: unknown
  lastName?: unknown
  role?: unknown
  permissions?: unknown
  targetHoursMonthly?: unknown
  vacationTotal?: unknown
}

const allowedRoles = new Set(['admin', 'employee'])

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const { adminClient } = await requireAdmin(req)
    const body = (await req.json()) as CreateUserBody

    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    const role = typeof body.role === 'string' ? body.role : 'employee'
    const targetHoursMonthly = Number(body.targetHoursMonthly ?? 160)
    const vacationTotal = Number(body.vacationTotal ?? 30)

    if (!email || !email.includes('@')) {
      throw new HttpError(400, 'A valid email address is required')
    }

    if (password.length < 8) {
      throw new HttpError(400, 'Password must contain at least 8 characters')
    }

    if (!firstName || !lastName) {
      throw new HttpError(400, 'First and last name are required')
    }

    if (!allowedRoles.has(role)) {
      throw new HttpError(400, 'Invalid role')
    }

    if (!Number.isFinite(targetHoursMonthly) || targetHoursMonthly < 0 || targetHoursMonthly > 744) {
      throw new HttpError(400, 'Invalid monthly target hours')
    }

    if (!Number.isFinite(vacationTotal) || vacationTotal < 0 || vacationTotal > 366) {
      throw new HttpError(400, 'Invalid vacation allowance')
    }

    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    })

    if (authError) {
      throw new HttpError(400, authError.message)
    }

    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: authUser.user.id,
      first_name: firstName,
      last_name: lastName,
      role,
      permissions: body.permissions ?? {},
      target_hours_monthly: targetHoursMonthly,
      vacation_total: vacationTotal,
      updated_at: new Date().toISOString(),
    })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      throw profileError
    }

    return jsonResponse({ user: authUser.user })
  } catch (error) {
    return errorResponse(error, 'create-user')
  }
})
