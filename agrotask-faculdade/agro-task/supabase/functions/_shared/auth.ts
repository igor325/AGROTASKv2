import { createSupabaseClient } from './supabase.ts'

export const requireAuth = async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.substring(7) // Remove "Bearer "
  
  if (!token) {
    throw new Error('Authentication required')
  }

  const supabase = createSupabaseClient(token)
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error('Invalid token')
  }

  return { user, token, supabase }
}

