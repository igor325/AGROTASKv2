import { handleCors, ok, err } from '../_shared/response.ts'
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const method = req.method
    const route = pathParts[pathParts.length - 1]

    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdminClient()

    // POST /auth/login
    if (method === 'POST' && route === 'login') {
      const body = await req.json()
      const { email, password } = body

      if (!email || !password) {
        return err('Email and password are required', 400)
      }

      // Authenticate with Supabase
      const supabaseClient = createSupabaseClient()
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      })

      if (authError || !authData.user) {
        return err('Invalid credentials', 401)
      }

      // Check if admin account exists
      const { data: adminAccount, error: adminError } = await supabaseAdmin
        .from('AdminAccount')
        .select('id, name, email, temporaryPassword')
        .eq('id', authData.user.id)
        .single()

      if (adminError || !adminAccount) {
        return err('Access denied. Admin privileges required.', 403)
      }

      return ok({
        user: {
          id: adminAccount.id,
          name: adminAccount.name,
          email: adminAccount.email,
          isAdmin: true
        },
        adminAccount: {
          id: adminAccount.id,
          temporaryPassword: adminAccount.temporaryPassword
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at
        }
      })
    }

    // POST /auth/register
    if (method === 'POST' && route === 'register') {
      const body = await req.json()
      const { name, email, password, phone, description } = body

      if (!name || !email || !password) {
        return err('Name, email and password are required', 400)
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      })

      if (authError) {
        return err(authError.message, 400)
      }

      // Create user in database
      const { data: user, error: userError } = await supabaseAdmin
        .from('User')
        .insert({
          id: authData.user.id,
          name,
          email,
          phone: phone || null,
          description: description || null,
          tags: [],
          status: 'active'
        })
        .select('id, name, email, phone, description, status')
        .single()

      if (userError) {
        throw new Error(userError.message)
      }

      return ok({
        user,
        message: 'User created successfully'
      })
    }

    // POST /auth/create-admin
    // Creates a new Supabase Auth user and corresponding AdminAccount record
    if (method === 'POST' && route === 'create-admin') {
      const body = await req.json()
      const { name, email, password, phone } = body

      if (!name || !email || !password) {
        return err('Name, email and password are required', 400)
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      })

      if (authError || !authData?.user) {
        return err(authError?.message || 'Failed to create auth user', 400)
      }

      // Create AdminAccount (do NOT store plain password)
      const { error: adminErr, data: adminAccount } = await supabaseAdmin
        .from('AdminAccount')
        .insert({
          id: authData.user.id,
          name,
          email,
          phone: phone || '',
          // Do not persist the temporary password in plaintext
          temporaryPassword: ''
        })
        .select('id, name, email, phone')
        .single()

      if (adminErr) {
        // Rollback auth user if AdminAccount insert fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return err(adminErr.message, 400)
      }

      return ok({
        user: { id: authData.user.id, name, email },
        adminAccount,
        message: 'Admin created successfully'
      })
    }

    // POST /auth/logout
    if (method === 'POST' && route === 'logout') {
      const authHeader = req.headers.get('Authorization')
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return err('No token provided', 401)
      }

      const token = authHeader.substring(7)
      
      // Sign out from Supabase
      await supabaseAdmin.auth.admin.signOut(token)

      return ok({ message: 'Logged out successfully' })
    }

    // POST /auth/refresh
    if (method === 'POST' && route === 'refresh') {
      const body = await req.json()
      const { refresh_token } = body

      if (!refresh_token) {
        return err('Refresh token is required', 400)
      }

      // Refresh session with Supabase
      const supabaseClient = createSupabaseClient()
      const { data: authData, error: authError } = await supabaseClient.auth.refreshSession({
        refresh_token
      })

      if (authError || !authData.session) {
        return err('Invalid refresh token', 401)
      }

      // Verify admin account exists
      const { data: adminAccount, error: adminError } = await supabaseAdmin
        .from('AdminAccount')
        .select('id, name, email')
        .eq('id', authData.user.id)
        .single()

      if (adminError || !adminAccount) {
        return err('Admin account not found', 403)
      }

      return ok({
        user: {
          id: adminAccount.id,
          name: adminAccount.name,
          email: adminAccount.email,
          isAdmin: true
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at
        }
      })
    }

    // GET /auth/me
    if (method === 'GET' && route === 'me') {
      const authHeader = req.headers.get('Authorization')
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return err('No token provided', 401)
      }

      const token = authHeader.substring(7)
      
      // Verify token with Supabase
      const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token)

      if (verifyError || !user) {
        return err('Invalid token', 401)
      }

      // Get admin account from database
      const { data: adminAccount, error: adminError } = await supabaseAdmin
        .from('AdminAccount')
        .select('id, name, email')
        .eq('id', user.id)
        .single()

      if (adminError || !adminAccount) {
        return err('Admin account not found', 404)
      }

      return ok({
        user: {
          id: adminAccount.id,
          name: adminAccount.name,
          email: adminAccount.email,
          isAdmin: true
        }
      })
    }

    // POST /auth/password-reset
    if (method === 'POST' && route === 'password-reset') {
      const body = await req.json()
      const { email } = body

      if (!email) {
        return err('Email is required', 400)
      }

      // Get redirect URL from environment variable or use default
      const redirectUrl = Deno.env.get('PASSWORD_RESET_REDIRECT_URL') || 'https://agrotask.net/reset-senha'

      // Send password reset email via Supabase
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      })

      // Always return success message (don't reveal if email exists)
      // This is a security best practice
      return ok({
        message: 'If the email exists, a password reset link has been sent'
      })
    }

    // POST /auth/reset-password
    if (method === 'POST' && route === 'reset-password') {
      const body = await req.json()
      const { token, password } = body

      if (!token || !password) {
        return err('Token and password are required', 400)
      }

      if (password.length < 6) {
        return err('Password must be at least 6 characters', 400)
      }

      // Verify token and get user
      const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token)
      
      if (verifyError || !user) {
        return err('Invalid token', 401)
      }

      // Check if admin account exists
      const { data: adminAccount, error: adminError } = await supabaseAdmin
        .from('AdminAccount')
        .select('id, name, email')
        .eq('id', user.id)
        .single()

      if (adminError || !adminAccount) {
        return err('Admin account not found', 403)
      }

      // Update password using Supabase Auth
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password }
      )

      if (updateError) {
        return err(updateError.message || 'Failed to update password', 400)
      }

      return ok({
        message: 'Password updated successfully'
      })
    }

    return err('Route not found', 404)
  } catch (error) {
    console.error('Error:', error)
    return err(error.message || 'Internal server error', 500)
  }
})

