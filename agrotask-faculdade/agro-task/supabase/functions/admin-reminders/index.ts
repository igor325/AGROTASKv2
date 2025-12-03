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

    // GET /admin-reminders
    if (method === 'GET' && !id) {
      const { data, error } = await supabase
        .from('AdminReminder')
        .select('*')
        .order('createdAt', { ascending: false })
      
      if (error) throw new Error(error.message)
      return ok(data)
    }

    // GET /admin-reminders/:id
    if (method === 'GET' && id) {
      const { data, error } = await supabase
        .from('AdminReminder')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return err('Admin reminder not found', 404)
        throw new Error(error.message)
      }
      return ok(data)
    }

    // POST /admin-reminders
    if (method === 'POST') {
      const body = await req.json()
      const {
        title,
        description,
        status,
        isRepeating,
        repeatInterval,
        repeatUnit,
        repeatStartDate,
        repeatEndType,
        repeatEndDate,
        repeatOccurrences,
        repeatDaysOfWeek,
        scheduledDate,
        messageString
      } = body

      // Validate required fields
      if (!title) {
        return err('Title is required', 400)
      }

      // Validate message content
      if (!description && !messageString) {
        return err('Admin reminder must have a description or message', 400)
      }

      // Validate date/time based on isRepeating
      if (isRepeating) {
        if (repeatUnit === 'day' && !repeatStartDate) {
          return err('Start date is required for daily repeating reminders', 400)
        }
        if (repeatUnit === 'week' && (!repeatDaysOfWeek || repeatDaysOfWeek.length === 0)) {
          return err('Days of week are required for weekly repeating reminders', 400)
        }
      } else {
        if (!scheduledDate) {
          return err('Scheduled date is required for non-repeating reminders', 400)
        }
      }

      const insertData: any = {
        title,
        description: description || null,
        status: status || 'pending',
        isRepeating: isRepeating || false,
        repeatInterval: isRepeating ? (repeatInterval || 1) : null,
        repeatUnit: isRepeating ? (repeatUnit || 'day') : null,
        repeatStartDate: isRepeating && repeatStartDate ? repeatStartDate : null,
        repeatEndType: isRepeating ? (repeatEndType || 'never') : null,
        repeatEndDate: isRepeating && repeatEndDate ? repeatEndDate : null,
        repeatOccurrences: isRepeating ? (repeatOccurrences || null) : null,
        repeatDaysOfWeek: isRepeating && repeatDaysOfWeek ? repeatDaysOfWeek : [],
        scheduledDate: scheduledDate || null,
        messageString: messageString || null
      }

      const { data, error } = await supabase
        .from('AdminReminder')
        .insert(insertData)
        .select()
        .single()
      
      if (error) throw new Error(error.message)
      return ok(data)
    }

    // PUT /admin-reminders/:id
    if (method === 'PUT' && id) {
      const body = await req.json()
      const {
        title,
        description,
        isRepeating,
        repeatInterval,
        repeatUnit,
        repeatStartDate,
        repeatEndType,
        repeatEndDate,
        repeatOccurrences,
        repeatDaysOfWeek,
        scheduledDate,
        messageString,
        status
      } = body

      const updateData: any = {}
      if (title !== undefined) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (isRepeating !== undefined) updateData.isRepeating = isRepeating
      if (repeatInterval !== undefined) updateData.repeatInterval = repeatInterval
      if (repeatUnit !== undefined) updateData.repeatUnit = repeatUnit
      if (repeatStartDate !== undefined) updateData.repeatStartDate = repeatStartDate
      if (repeatEndType !== undefined) updateData.repeatEndType = repeatEndType
      if (repeatEndDate !== undefined) updateData.repeatEndDate = repeatEndDate
      if (repeatOccurrences !== undefined) updateData.repeatOccurrences = repeatOccurrences
      if (repeatDaysOfWeek !== undefined) updateData.repeatDaysOfWeek = repeatDaysOfWeek
      if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate
      if (messageString !== undefined) updateData.messageString = messageString
      
      if (status !== undefined) {
        const validStatuses = ['pending', 'completed', 'canceled']
        if (!validStatuses.includes(status)) {
          return err('Status inválido. Use: pending, completed ou canceled', 400)
        }
        updateData.status = status
      }

      const { data, error } = await supabase
        .from('AdminReminder')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return err('Admin reminder not found', 404)
        throw new Error(error.message)
      }
      return ok(data)
    }

    // DELETE /admin-reminders/:id
    if (method === 'DELETE' && id) {
      const { error } = await supabase
        .from('AdminReminder')
        .delete()
        .eq('id', id)
      
      if (error) {
        if (error.code === 'PGRST116') return err('Admin reminder not found', 404)
        throw new Error(error.message)
      }
      return ok({ message: 'Admin reminder deleted successfully' })
    }

    return err('Route not found', 404)
  } catch (error) {
    console.error('Error:', error)
    return err(error.message || 'Internal server error', error.message.includes('Auth') ? 401 : 500)
  }
})

