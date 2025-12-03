import { handleCors, ok, err } from '../_shared/response.ts'
import { requireAuth } from '../_shared/auth.ts'

// Helper functions for BR phone and email validation
const digitsOnly = (s: string) => s.replace(/\D+/g, "")

const formatBrazilPhone = (digits: string) => {
  const d = digits.slice(0, 11)
  const part1 = d.slice(0, 2)
  const part2 = d.slice(2, 7)
  const part3 = d.slice(7, 11)
  let out = ""
  if (part1) out += `(${part1}`
  if (part1 && part1.length === 2) out += ") "
  if (part2) out += part2
  if (part3) out += `-${part3}`
  return out
}

const validateBrazilPhone = (value: string | null) => {
  if (value == null || value === "") return null
  if (/[^\d()\s-]/.test(value)) return "Caracteres não numéricos"
  const d = digitsOnly(value)
  if (d.length < 11) return "Número incompleto"
  if (!/^\d{11}$/.test(d)) return "Formato inválido"
  return null
}

const normalizeBrazilPhone = (value: string) => {
  const d = digitsOnly(value)
  return formatBrazilPhone(d)
}

const validateEmail = (value: string | null) => {
  if (value == null || value === "") return null
  const trimmed = String(value).trim()
  if (/[\s]/.test(trimmed)) return "Email não pode conter espaços"
  if (!trimmed.includes("@")) return "Falta @ no email"
  const parts = trimmed.split("@")
  if (parts.length !== 2 || !parts[1]) return "Falta domínio após @"
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!emailRegex.test(trimmed)) return "Formato de email inválido"
  return null
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { supabase } = await requireAuth(req)
    const url = new URL(req.url)
    const method = req.method
    
    // Extract ID from path if present (e.g., /users/:id)
    const pathMatch = url.pathname.match(/\/([^\/]+)$/)
    const lastSegment = pathMatch ? pathMatch[1] : null
    // Check if last segment is a UUID (ID) or route name
    const isId = lastSegment && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastSegment)
    const id = isId ? lastSegment : null

    // GET /users
    if (method === 'GET' && !id) {
      const { data, error } = await supabase
        .from('User')
        .select('id, name, phone, email, description, tags, status, createdAt')
        .order('createdAt', { ascending: false })
      
      if (error) throw new Error(error.message)
      return ok(data)
    }

    // GET /users/:id
    if (method === 'GET' && id) {
      const { data, error } = await supabase
        .from('User')
        .select('id, name, phone, email, description, tags, status, createdAt')
        .eq('id', id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return err('User not found', 404)
        throw new Error(error.message)
      }
      return ok(data)
    }

    // POST /users
    if (method === 'POST') {
      const body = await req.json()
      const { name, phone, email, description, tags } = body

      if (!name) {
        return err('Name is required', 400)
      }

      // Validate phone
      const phoneErr = validateBrazilPhone(phone)
      if (phoneErr) {
        return err(`Celular inválido: ${phoneErr}`, 400)
      }

      // Validate email
      const emailErr = validateEmail(email)
      if (emailErr) {
        return err(`Email inválido: ${emailErr}`, 400)
      }

      const userData = {
        name,
        phone: phone ? normalizeBrazilPhone(phone) : null,
        email: email || null,
        description: description || null,
        tags: tags || []
      }

      const { data, error } = await supabase
        .from('User')
        .insert(userData)
        .select('id, name, phone, email, description, tags, status, createdAt')
        .single()
      
      if (error) {
        // Handle unique constraint violations
        if (error.code === '23505') {
          return err('Phone or email already exists', 400)
        }
        throw new Error(error.message)
      }
      return ok(data)
    }

    // PUT /users/:id
    if (method === 'PUT' && id) {
      const body = await req.json()
      const { name, phone, email, description, tags, status } = body

      // Validate phone if provided
      if (phone !== undefined) {
        const phoneErr = validateBrazilPhone(phone)
        if (phoneErr) {
          return err(`Celular inválido: ${phoneErr}`, 400)
        }
      }

      // Validate email if provided
      if (email !== undefined) {
        const emailErr = validateEmail(email)
        if (emailErr) {
          return err(`Email inválido: ${emailErr}`, 400)
        }
      }

      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (phone !== undefined) updateData.phone = phone ? normalizeBrazilPhone(phone) : null
      if (email !== undefined) updateData.email = email
      if (description !== undefined) updateData.description = description
      if (tags !== undefined) updateData.tags = tags
      if (status !== undefined) updateData.status = status

      const { data, error } = await supabase
        .from('User')
        .update(updateData)
        .eq('id', id)
        .select('id, name, phone, email, description, tags, status, createdAt')
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return err('User not found', 404)
        if (error.code === '23505') return err('Phone or email already exists', 400)
        throw new Error(error.message)
      }
      return ok(data)
    }

    // DELETE /users/:id
    if (method === 'DELETE' && id) {
      const { error } = await supabase
        .from('User')
        .delete()
        .eq('id', id)
      
      if (error) {
        if (error.code === 'PGRST116') return err('User not found', 404)
        throw new Error(error.message)
      }
      return ok({ message: 'User deleted successfully' })
    }

    return err('Route not found', 404)
  } catch (error) {
    console.error('Error:', error)
    return err(error.message || 'Internal server error', error.message.includes('Auth') ? 401 : 500)
  }
})

