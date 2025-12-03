import { handleCors, ok, err } from '../_shared/response.ts'
import { requireAuth } from '../_shared/auth.ts'

// Local helpers to compute messageString similarly to activities function
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
  templateBody: string
) => {
  const base = (templateBody || '').toString()
  if (!base) return ''
  const nomes = userNames.filter(Boolean).join(', ')
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
  // Handle CORS preflight
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

    // GET /message-templates
    if (method === 'GET' && !id) {
      const { data, error } = await supabase
        .from('MessageTemplate')
        .select('*')
        .order('createdAt', { ascending: false })
      
      if (error) throw new Error(error.message)
      return ok(data)
    }

    // GET /message-templates/:id
    if (method === 'GET' && id) {
      const { data, error } = await supabase
        .from('MessageTemplate')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          return err('Template not found', 404)
        }
        throw new Error(error.message)
      }
      return ok(data)
    }

    // POST /message-templates
    if (method === 'POST') {
      const body = await req.json()
      const { name, category, templateBody } = body

      // Validate required fields
      if (!name || !category || !templateBody) {
        return err('Name, category, and template body are required', 400)
      }

      const { data, error } = await supabase
        .from('MessageTemplate')
        .insert({ name, category, templateBody })
        .select()
        .single()
      
      if (error) throw new Error(error.message)
      return ok(data)
    }

    // PUT /message-templates/:id
    if (method === 'PUT' && id) {
      const body = await req.json()
      const { name, category, templateBody } = body

      // Build update data
      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (category !== undefined) updateData.category = category
      if (templateBody !== undefined) updateData.templateBody = templateBody

      const { data, error } = await supabase
        .from('MessageTemplate')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          return err('Template not found', 404)
        }
        throw new Error(error.message)
      }
      // Recompute messageString for all activities using this template
      // 1) Fetch activities referencing the template
      const { data: activities } = await supabase
        .from('Activity')
        .select('id, title, description, isRepeating, repeatUnit, repeatStartDate, repeatDaysOfWeek, scheduledDate')
        .eq('messageTemplateId', id)

      if (activities && activities.length > 0) {
        for (const activity of activities) {
          // Fetch user names for this activity
          const { data: activityUsers } = await supabase
            .from('ActivityUsers')
            .select('user:User(name)')
            .eq('activityId', activity.id)

          const userNames = (activityUsers || []).map((u: any) => u.user?.name).filter(Boolean)
          const computed = buildMessageString(activity, userNames, data.templateBody)
          if (computed) {
            await supabase
              .from('Activity')
              .update({ messageString: computed })
              .eq('id', activity.id)
          }
        }
      }

      return ok(data)
    }

    // DELETE /message-templates/:id
    if (method === 'DELETE' && id) {
      // Check if template is being used by any activities
      const { count, error: countError } = await supabase
        .from('Activity')
        .select('*', { count: 'exact', head: true })
        .eq('messageTemplateId', id)
      
      if (countError) throw new Error(countError.message)
      
      if (count && count > 0) {
        return err(`Cannot delete template. It is being used by ${count} activity(ies)`, 400)
      }

      const { error } = await supabase
        .from('MessageTemplate')
        .delete()
        .eq('id', id)
      
      if (error) {
        if (error.code === 'PGRST116') {
          return err('Template not found', 404)
        }
        throw new Error(error.message)
      }
      
      return ok({ message: 'Template deleted successfully' })
    }

    return err('Route not found', 404)
  } catch (error) {
    console.error('Error:', error)
    return err(error.message || 'Internal server error', error.message.includes('Auth') ? 401 : 500)
  }
})

