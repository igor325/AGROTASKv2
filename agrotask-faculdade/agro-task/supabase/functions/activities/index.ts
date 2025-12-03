import { handleCors, ok, err } from '../_shared/response.ts'
import { requireAuth } from '../_shared/auth.ts'

// Helpers to format date/time in Brazil timezone
const toBrazilDateParts = (isoString?: string | null) => {
  if (!isoString) return { date: '', time: '' }
  // Normalize to UTC
  let normalized = isoString.replace(' ', 'T').replace(/[+-]\d{2}:\d{2}$/,'')
  if (!normalized.endsWith('Z')) normalized += 'Z'
  const date = new Date(normalized)
  
  // Converter para timezone do Brasil (America/Sao_Paulo = GMT-3)
  // Usar toLocaleString para obter componentes no timezone correto
  const brazilDateStr = date.toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  // Formato retornado: "MM/DD/YYYY, HH:MM:SS"
  const [datePart, timePart] = brazilDateStr.split(', ')
  const [month, day, year] = datePart.split('/')
  
  // Formatar data como dd/MM/yyyy (formato brasileiro)
  const dateStr = `${day}/${month}/${year}`
  
  // Extrair hora no formato HH:MM
  const time = timePart ? timePart.slice(0, 5) : ''
  
  return { date: dateStr, time }
}

const buildMessageString = (
  activity: any,
  userNames: string[],
  templateBody?: string | null,
  _customMessage?: string | null
) => {
  const base = (templateBody || '').toString()
  if (!base) return ''

  const nomes = userNames.filter(Boolean).join(', ')
  // DATA
  let dataStr = ''
  if (!activity.isRepeating) {
    if (activity.scheduledDate) {
      const { date } = toBrazilDateParts(activity.scheduledDate)
      dataStr = date
    }
  } else {
    if (activity.repeatUnit === 'day' && activity.repeatStartDate) {
      const { date } = toBrazilDateParts(activity.repeatStartDate)
      dataStr = date
    } else if (activity.repeatUnit === 'week' && Array.isArray(activity.repeatDaysOfWeek) && activity.repeatDaysOfWeek.length > 0) {
      const weekdayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
      dataStr = `Dias: ${activity.repeatDaysOfWeek.map((i: number) => weekdayNames[i] || '').join(', ')}`
    }
  }
  // HORARIO
  let horarioStr = ''
  if (activity.scheduledDate) {
    const { time } = toBrazilDateParts(activity.scheduledDate)
    horarioStr = time
  }

  // Build TAREFA with title and description
  const tarefaStr = activity.description && activity.description.trim()
    ? `${activity.title || ''}\n${activity.description}`
    : (activity.title || '')

  // Only replace {{TAREFA}}, {{DATA}}, {{HORARIO}}
  // Keep {{NOME}} intact for microservices to handle
  return base
    .replace(/\{\{TAREFA\}\}/g, tarefaStr)
    .replace(/\{\{DATA\}\}/g, dataStr)
    .replace(/\{\{HORARIO\}\}/g, horarioStr)
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { supabase } = await requireAuth(req)
    const url = new URL(req.url)
    const method = req.method
    
    // Extract ID and route from path
    // URL format: /functions/v1/activities or /functions/v1/activities/:id or /functions/v1/activities/:id/:action
    const pathParts = url.pathname.split('/').filter(Boolean)
    const functionNameIndex = pathParts.findIndex(p => p === 'activities')
    
    // Get the segment after 'activities'
    const idSegment = functionNameIndex >= 0 && pathParts[functionNameIndex + 1] ? pathParts[functionNameIndex + 1] : null
    const actionSegment = functionNameIndex >= 0 && pathParts[functionNameIndex + 2] ? pathParts[functionNameIndex + 2] : null
    
    // Check if idSegment is a valid UUID
    const isId = idSegment && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idSegment)
    const id = isId ? idSegment : null
    const action = isId && actionSegment ? actionSegment : null

    // POST /activities/:id/toggle-canceled
    if (method === 'POST' && id && action === 'toggle-canceled') {
      // Get current activity
      const { data: activity, error: fetchError } = await supabase
        .from('Activity')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !activity) {
        return err('Activity not found', 404)
      }

      let newStatus = 'pending'

      // If not canceled, set to canceled
      if (activity.status !== 'canceled') {
        newStatus = 'canceled'
      } else {
        // Reactivate: decide between completed or pending
        const now = new Date()

        if (!activity.isRepeating) {
          // Non-repeating: if scheduledDate is in the past -> completed
          if (activity.scheduledDate && new Date(activity.scheduledDate) < now) {
            newStatus = 'completed'
          } else {
            newStatus = 'pending'
          }
        } else {
          // Repeating
          if (activity.repeatEndType === 'never') {
            newStatus = 'pending'
          } else if (activity.repeatEndType === 'date' && activity.repeatEndDate) {
            newStatus = new Date(activity.repeatEndDate) < now ? 'completed' : 'pending'
          } else if (activity.repeatEndType === 'occurrences') {
            // Would need more complex logic to count occurrences
            newStatus = 'pending'
          } else {
            newStatus = 'pending'
          }
        }
      }

      const { data, error } = await supabase
        .from('Activity')
        .update({ status: newStatus })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(error.message)
      return ok(data)
    }

    // GET /activities
    if (method === 'GET' && !id) {
      // Fetch activities with related data
      const { data: activities, error: activitiesError } = await supabase
        .from('Activity')
        .select(`
          *,
          messageTemplate:MessageTemplate(id, name, templateBody)
        `)
        .order('createdAt', { ascending: false })

      if (activitiesError) throw new Error(activitiesError.message)

      // For each activity, fetch users
      const enrichedActivities = await Promise.all(
        activities.map(async (activity: any) => {
          const { data: activityUsers } = await supabase
            .from('ActivityUsers')
            .select(`
              userId,
              user:User(id, name, email, phone)
            `)
            .eq('activityId', activity.id)

          return {
            ...activity,
            users: activityUsers || []
          }
        })
      )

      return ok(enrichedActivities)
    }

    // GET /activities/:id
    if (method === 'GET' && id) {
      const { data: activity, error: activityError } = await supabase
        .from('Activity')
        .select(`
          *,
          messageTemplate:MessageTemplate(id, name, templateBody)
        `)
        .eq('id', id)
        .single()

      if (activityError) {
        if (activityError.code === 'PGRST116') return err('Activity not found', 404)
        throw new Error(activityError.message)
      }

      // Fetch users for this activity
      const { data: activityUsers } = await supabase
        .from('ActivityUsers')
        .select(`
          userId,
          user:User(id, name, email, phone)
        `)
        .eq('activityId', id)

      return ok({
        ...activity,
        users: activityUsers || []
      })
    }

    // POST /activities
    if (method === 'POST' && !id) {
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
        messageTemplateId,
        messageString,
        userIds,
        shouldSendNotification
      } = body

      if (!title) return err('Title is required', 400)
      if (!messageTemplateId && !messageString && !description) {
        return err('Activity must have a description or message (template/custom)', 400)
      }
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return err('At least one user is required', 400)
      }

      const activityData: any = {
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
        // Prefer template if provided; otherwise allow custom messageString
        messageTemplateId: messageTemplateId ?? null,
        messageString: messageTemplateId ? null : (messageString || null),
        shouldSendNotification: shouldSendNotification === undefined ? true : !!shouldSendNotification
      }

      const { data: activity, error: activityError } = await supabase
        .from('Activity')
        .insert(activityData)
        .select()
        .single()

      if (activityError) throw new Error(activityError.message)

      const activityUserData = userIds.map((userId: string) => ({ activityId: activity.id, userId }))
      const { error: usersError } = await supabase.from('ActivityUsers').insert(activityUserData)
      if (usersError) throw new Error(usersError.message)

      const { data: completeActivity } = await supabase
        .from('Activity')
        .select(`*, messageTemplate:MessageTemplate(id, name, templateBody)`) 
        .eq('id', activity.id)
        .single()

      const { data: activityUsers } = await supabase
        .from('ActivityUsers')
        .select(`userId, user:User(id, name, email, phone)`) 
        .eq('activityId', activity.id)

      const userNames = (activityUsers || []).map((u: any) => u.user?.name).filter(Boolean)
      // If template chosen, compute from template; otherwise use provided custom string
      const finalMessage = completeActivity?.messageTemplate?.templateBody
        ? buildMessageString(completeActivity, userNames, completeActivity.messageTemplate.templateBody, null)
        : (messageString || null)

      await supabase.from('Activity').update({ messageString: finalMessage || null }).eq('id', activity.id)

      return ok({ ...completeActivity, users: activityUsers || [], messageString: finalMessage || completeActivity?.messageString || '' })
    }

    // PUT /activities/:id
    if (method === 'PUT' && id) {
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
        messageTemplateId,
        messageString,
        userIds,
        shouldSendNotification
      } = body

      const updateData: any = {}
      if (title !== undefined) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (status !== undefined) updateData.status = status
      if (isRepeating !== undefined) updateData.isRepeating = isRepeating
      if (repeatInterval !== undefined) updateData.repeatInterval = repeatInterval
      if (repeatUnit !== undefined) updateData.repeatUnit = repeatUnit
      if (repeatStartDate !== undefined) updateData.repeatStartDate = repeatStartDate
      if (repeatEndType !== undefined) updateData.repeatEndType = repeatEndType
      if (repeatEndDate !== undefined) updateData.repeatEndDate = repeatEndDate
      if (repeatOccurrences !== undefined) updateData.repeatOccurrences = repeatOccurrences
      if (repeatDaysOfWeek !== undefined) updateData.repeatDaysOfWeek = repeatDaysOfWeek
      if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate
      // Exclusividade com prioridade para template quando fornecido
      if (messageTemplateId !== undefined) {
        updateData.messageTemplateId = messageTemplateId
        if (messageTemplateId) {
          // ao escolher template, limpamos messageString (será recalculado)
          updateData.messageString = null
        }
      }
      if (messageString !== undefined && (messageTemplateId === undefined || messageTemplateId === null)) {
        updateData.messageString = messageString || null
        if (messageTemplateId === undefined) {
          updateData.messageTemplateId = null
        }
      }
      if (shouldSendNotification !== undefined) {
        updateData.shouldSendNotification = !!shouldSendNotification
      }

      const { error: updateError } = await supabase.from('Activity').update(updateData).eq('id', id)
      if (updateError) {
        if (updateError.code === 'PGRST116') return err('Activity not found', 404)
        throw new Error(updateError.message)
      }

      if (userIds !== undefined && Array.isArray(userIds)) {
        await supabase.from('ActivityUsers').delete().eq('activityId', id)
        if (userIds.length > 0) {
          const activityUserData = userIds.map((userId: string) => ({ activityId: id, userId }))
          await supabase.from('ActivityUsers').insert(activityUserData)
        }
      }

      const { data: activity } = await supabase
        .from('Activity')
        .select(`*, messageTemplate:MessageTemplate(id, name, templateBody)`) 
        .eq('id', id)
        .single()

      const { data: activityUsers } = await supabase
        .from('ActivityUsers')
        .select(`userId, user:User(id, name, email, phone)`) 
        .eq('activityId', id)

      const userNames = (activityUsers || []).map((u: any) => u.user?.name).filter(Boolean)
      const finalMessage = activity?.messageTemplate?.templateBody
        ? buildMessageString(activity, userNames, activity.messageTemplate.templateBody, null)
        : (messageString !== undefined ? (messageString || null) : activity?.messageString || null)

      await supabase.from('Activity').update({ messageString: finalMessage || null }).eq('id', id)

      return ok({ ...activity, users: activityUsers || [], messageString: finalMessage || activity?.messageString || '' })
    }

    // DELETE /activities/:id
    if (method === 'DELETE' && id) {
      // Delete activity-user relationships first
      await supabase
        .from('ActivityUsers')
        .delete()
        .eq('activityId', id)

      // Delete activity
      const { error } = await supabase
        .from('Activity')
        .delete()
        .eq('id', id)

      if (error) {
        if (error.code === 'PGRST116') return err('Activity not found', 404)
        throw new Error(error.message)
      }

      return ok({ message: 'Activity deleted successfully' })
    }

    return err('Route not found', 404)
  } catch (error) {
    console.error('Error:', error)
    return err(error.message || 'Internal server error', error.message.includes('Auth') ? 401 : 500)
  }
})

