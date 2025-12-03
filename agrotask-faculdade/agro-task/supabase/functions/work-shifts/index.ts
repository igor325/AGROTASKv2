import { handleCors, ok, err } from '../_shared/response.ts'
import { requireAuth } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { supabase } = await requireAuth(req)
    const url = new URL(req.url)
    const method = req.method
    
    // Extract ID from path if present
    const pathMatch = url.pathname.match(/\/([^\/]+)$/)
    const lastSegment = pathMatch ? pathMatch[1] : null
    const isId = lastSegment && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastSegment)
    const id = isId ? lastSegment : null

    // GET /work-shifts
    if (method === 'GET' && !id) {
      const { data, error } = await supabase
        .from('WorkShift')
        .select('*')
        .order('time', { ascending: true })
      
      if (error) throw new Error(error.message)
      return ok(data)
    }

    // GET /work-shifts/:id
    if (method === 'GET' && id) {
      const { data, error } = await supabase
        .from('WorkShift')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return err('Work shift not found', 404)
        throw new Error(error.message)
      }
      return ok(data)
    }

    // POST /work-shifts
    if (method === 'POST') {
      const body = await req.json()
      const { title, time, messageString, alertMinutesBefore } = body

      if (!title || !time) {
        return err('Title and time are required', 400)
      }

      // Validate time format (HH:MM)
      if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        return err('Time must be in HH:MM format', 400)
      }

      const { data, error } = await supabase
        .from('WorkShift')
        .insert({
          title,
          time,
          messageString: messageString ?? null,
          alertMinutesBefore: alertMinutesBefore !== undefined ? alertMinutesBefore : 5,
        })
        .select()
        .single()
      
      if (error) throw new Error(error.message)
      return ok(data)
    }

    // PUT /work-shifts/:id
    if (method === 'PUT' && id) {
      const body = await req.json()
      const { title, time, messageString, alertMinutesBefore } = body

      const updateData: any = {}
      if (title !== undefined) updateData.title = title
      if (time !== undefined) {
        // Validate time format (HH:MM)
        if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
          return err('Time must be in HH:MM format', 400)
        }
        updateData.time = time
      }
      if (messageString !== undefined) updateData.messageString = messageString ?? null
      if (alertMinutesBefore !== undefined) updateData.alertMinutesBefore = alertMinutesBefore

      const { data, error } = await supabase
        .from('WorkShift')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return err('Work shift not found', 404)
        throw new Error(error.message)
      }
      return ok(data)
    }

    // DELETE /work-shifts/:id
    if (method === 'DELETE' && id) {
      const { error } = await supabase
        .from('WorkShift')
        .delete()
        .eq('id', id)
      
      if (error) {
        if (error.code === 'PGRST116') return err('Work shift not found', 404)
        throw new Error(error.message)
      }
      return ok({ message: 'Work shift deleted successfully' })
    }

    return err('Route not found', 404)
  } catch (error) {
    console.error('Error:', error)
    return err(error.message || 'Internal server error', error.message.includes('Auth') ? 401 : 500)
  }
})
