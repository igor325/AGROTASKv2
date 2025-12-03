import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Search, 
  Calendar,
  Clock,
  User,
  Edit,
  Repeat,
  MessageSquare,
  Trash2,
  Loader2,
  MoreVertical
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import activityService from "@/services/activityService"
import type { Activity, CreateActivityData, MessageTemplate } from "@/services/activityService"
import { userService } from "@/services/userService"
import { toUTC, fromUTC } from "@/lib/timezone"

interface User {
  id: string
  name: string
  email?: string
  phone?: string
}

const Tarefas = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activities, setActivities] = useState<Activity[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [globalLoading, setGlobalLoading] = useState(false)
  
  // Form states
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [repeatType, setRepeatType] = useState<"none" | "repeat">("none")
  const [repeatEvery, setRepeatEvery] = useState("1")
  const [repeatUnit, setRepeatUnit] = useState<"day" | "week">("day")
  const [repeatStartDate, setRepeatStartDate] = useState("")
  const [endType, setEndType] = useState<"never" | "date" | "occurrences">("never")
  const [endDate, setEndDate] = useState("")
  const [endCount, setEndCount] = useState("1")
  const [singleDate, setSingleDate] = useState("")
  const [time, setTime] = useState("")
  const [templateType, setTemplateType] = useState<"template" | "custom">("custom")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [customMessage, setCustomMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [shouldSendNotification, setShouldSendNotification] = useState(true)

  // Helper: format date to dd/MM/yyyy
  const formatDateBR = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      return `${day}/${month}/${year}`
    } catch {
      return ""
    }
  }

  // Helper: map selected user IDs to names
  const getSelectedUserNames = () => {
    const map = new Map(users.map(u => [u.id, u.name]))
    return selectedUserIds.map(id => map.get(id) || "")
  }

  // Helper: build final message string with variable substitution
  const buildMessageString = (): string | undefined => {
    let base = ""
    if (templateType === "template") {
      const tpl = templates.find(t => t.id === selectedTemplateId)
      base = tpl?.templateBody || ""
    } else if (templateType === "custom") {
      base = customMessage || ""
    }

    if (!base) return undefined

    const nomes = getSelectedUserNames().filter(Boolean).join(", ")

    // Determine DATA
    let dataStr = ""
    if (repeatType === "none") {
      if (singleDate) {
        dataStr = formatDateBR(`${singleDate}T00:00:00`)
      }
    } else {
      if (repeatUnit === "day" && repeatStartDate) {
        dataStr = formatDateBR(`${repeatStartDate}T00:00:00`)
      } else if (repeatUnit === "week" && weekdays.length > 0) {
        const weekdayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
        dataStr = `Dias: ${weekdays.map(i => weekdayNames[i]).join(', ')}`
      }
    }

    // Determine HORARIO
    let horarioStr = ""
    if (time) {
      horarioStr = time
    } else if (repeatType === "none" && singleDate) {
      // If non-repeating and a date exists, try to use composed date+time
      horarioStr = ""
    }

    // Replace variables (except {{NOME}} which is kept for microservices)
    // Build TAREFA with title and description
    const tarefaStr = description && description.trim()
      ? `${title}\n${description}` 
      : title
    
    let result = base
    // Only replace {{TAREFA}}, {{DATA}}, {{HORARIO}}
    // Keep {{NOME}} intact for microservices to handle
    result = result.replace(/\{\{TAREFA\}\}/g, tarefaStr)
                   .replace(/\{\{DATA\}\}/g, dataStr)
                   .replace(/\{\{HORARIO\}\}/g, horarioStr)

    return result
  }

  const toggleWeekday = (dayIndex: number) => {
    setWeekdays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    )
  }

  // Helper: check if form is valid for submission
  const isFormValid = (): boolean => {
    // Title is required
    if (!title.trim()) return false

    // At least one user is required
    if (selectedUserIds.length === 0) return false

    // Message validation
    if (templateType === "template" && !selectedTemplateId) return false
    if (templateType === "custom" && !customMessage.trim()) return false

    // Validation for non-repeating tasks
    if (repeatType === "none") {
      if (!singleDate || !time) return false
    }

    // Validation for repeating tasks
    if (repeatType === "repeat") {
      if (!time) return false
      if (repeatUnit === "week" && weekdays.length === 0) return false
      if (endType === "date" && !endDate) return false
      if (endType === "occurrences" && (!endCount || parseInt(endCount) < 1)) return false
    }

    return true
  }

  // Helper: get preview of message when template is selected
  const getMessagePreview = (): string | null => {
    if (templateType === "template" && selectedTemplateId) {
      const tpl = templates.find(t => t.id === selectedTemplateId)
      if (!tpl) return null
      
      // Build preview with sample data
      const sampleTitle = title || "Título da tarefa"
      const sampleDesc = description || "Descrição da tarefa"
      const sampleTarefa = description && description.trim()
        ? `${sampleTitle}\n${sampleDesc}`
        : sampleTitle
      
      const sampleData = singleDate 
        ? formatDateBR(`${singleDate}T00:00:00`)
        : (repeatType === "repeat" && repeatStartDate
          ? formatDateBR(`${repeatStartDate}T00:00:00`)
          : "DD/MM/AAAA")
      
      const sampleHorario = time || "HH:MM"
      
      return tpl.templateBody
        .replace(/\{\{TAREFA\}\}/g, sampleTarefa)
        .replace(/\{\{DATA\}\}/g, sampleData)
        .replace(/\{\{HORARIO\}\}/g, sampleHorario)
        // Keep {{NOME}} for microservices
    }
    return null
  }

  // Helper: calculate earliest allowed time
  // Regra: pegar o próximo ciclo do serviço (minuto múltiplo de 5 estritamente no futuro)
  // e somar 15 minutos. Ex.: 09:25 -> ciclo 09:30 -> permitido a partir de 09:45.
  const getNextValidTime = (): { date: string; time: string } => {
    // Get current time in Brazil timezone (GMT-3)
    const now = new Date()
    const brazilDateStr = now.toLocaleString('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    
    const [datePart, timePart] = brazilDateStr.split(', ')
    const [hour, minute] = timePart.split(':').map(Number)
    
    // Calculate next scheduler cycle minute (strictly future, multiple of 5)
    let nextMinute: number
    let nextHour = hour
    let nextDate = datePart
    
    if (minute % 5 === 0) {
      // At exact multiple of 5: next cycle is +5 minutes
      nextMinute = minute + 5
      if (nextMinute >= 60) {
        nextMinute = 0
        nextHour += 1
        if (nextHour >= 24) {
          nextHour = 0
          // Move to next day (simplified: assume datePart is YYYY-MM-DD)
          const [y, m, d] = datePart.split('-').map(Number)
          const nextDay = new Date(y, m - 1, d + 1)
          nextDate = nextDay.toISOString().split('T')[0]
        }
      }
    } else {
      // Round up to next 5-minute boundary
      nextMinute = Math.ceil(minute / 5) * 5
      if (nextMinute >= 60) {
        nextMinute = 0
        nextHour += 1
        if (nextHour >= 24) {
          nextHour = 0
          const [y, m, d] = datePart.split('-').map(Number)
          const nextDay = new Date(y, m - 1, d + 1)
          nextDate = nextDay.toISOString().split('T')[0]
        }
      }
    }
    // Add 15 minutes to the next scheduler cycle to get the earliest allowed time
    const [y, m, d] = nextDate.split('-').map(Number)
    const allowed = new Date(y, m - 1, d, nextHour, nextMinute, 0, 0)
    allowed.setMinutes(allowed.getMinutes() + 15)

    const allowedDate = `${allowed.getFullYear()}-${String(allowed.getMonth() + 1).padStart(2, '0')}-${String(allowed.getDate()).padStart(2, '0')}`
    const allowedTime = `${String(allowed.getHours()).padStart(2, '0')}:${String(allowed.getMinutes()).padStart(2, '0')}`

    return { date: allowedDate, time: allowedTime }
  }

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [activitiesData, usersData, templatesData] = await Promise.all([
        activityService.getActivities().catch(() => []),
        userService.getAllUsers().catch(() => ({ success: false, data: [] })),
        activityService.getMessageTemplates().catch(() => [])
      ])
      setActivities(activitiesData || [])
      setUsers(usersData?.data || [])
      setTemplates(templatesData || [])
    } catch (error) {
      toast.error("Erro ao carregar dados")
      console.error(error)
      // Ensure arrays are set even on error
      setActivities([])
      setUsers([])
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setSelectedUserIds([])
    setRepeatType("none")
    setRepeatEvery("1")
    setRepeatUnit("day")
    setRepeatStartDate("")
    setEndType("never")
    setEndDate("")
    setEndCount("1")
    setSingleDate("")
    setTime("")
    setTemplateType("custom")
    setSelectedTemplateId("")
    setCustomMessage("")
    setEditingActivity(null)
    setWeekdays([])
    setShouldSendNotification(true)
  }

  const loadActivityForEdit = (activity: Activity) => {
    setEditingActivity(activity)
    setTitle(activity.title)
    setDescription(activity.description || "")
    setSelectedUserIds(activity.users.map(u => u.userId))
    setRepeatType(activity.isRepeating ? "repeat" : "none")
    
    if (activity.isRepeating) {
      // Repeating task
      setRepeatEvery(activity.repeatInterval.toString())
      setRepeatUnit(activity.repeatUnit)
      setRepeatStartDate(activity.repeatStartDate ? activity.repeatStartDate.split('T')[0] : "")
      setEndType(activity.repeatEndType)
      setEndDate(activity.repeatEndDate ? activity.repeatEndDate.split('T')[0] : "")
      setEndCount(activity.repeatOccurrences?.toString() || "1")
      // Extract time from scheduledDate (convert from GMT+0 to GMT-3)
      const timeInfo = activity.scheduledDate ? fromUTC(activity.scheduledDate) : null
      setTime(timeInfo?.time || "")
      setWeekdays(activity.repeatDaysOfWeek || [])
    } else {
      // Non-repeating task
      if (activity.scheduledDate) {
        // Convert from GMT+0 to GMT-3
        const timeInfo = fromUTC(activity.scheduledDate)
        if (timeInfo) {
          setSingleDate(timeInfo.date)
          setTime(timeInfo.time)
        }
      }
    }
    
    if (activity.messageTemplateId) {
      setTemplateType("template")
      setSelectedTemplateId(activity.messageTemplateId)
    } else {
      setTemplateType("custom")
      setCustomMessage(activity.messageString || "")
    }
    setShouldSendNotification(activity.shouldSendNotification ?? true)
    
    setIsDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Título é obrigatório")
      return
    }

    if (selectedUserIds.length === 0) {
      toast.error("Selecione pelo menos uma pessoa")
      return
    }

    // Validate that there's a message (template or custom)
    if (templateType === "template" && !selectedTemplateId) {
      toast.error("Selecione um template de mensagem")
      return
    }
    
    if (templateType === "custom" && !customMessage.trim()) {
      toast.error("A mensagem personalizada não pode estar vazia")
      return
    }

    // Validation for non-repeating tasks
    if (repeatType === "none") {
      if (!singleDate) {
        toast.error("Data é obrigatória para tarefas únicas")
        return
      }
      if (!time) {
        toast.error("Horário é obrigatório para tarefas únicas")
        return
      }
    }

    // Validation for repeating tasks
    if (repeatType === "repeat") {
      if (repeatUnit === "week") {
        if (weekdays.length === 0) {
          toast.error("Selecione pelo menos um dia da semana para tarefas semanais")
          return
        }
      }
      if (endType === "date" && !endDate) {
        toast.error("Data de término é obrigatória")
        return
      }
      if (endType === "occurrences" && (!endCount || parseInt(endCount) < 1)) {
        toast.error("Número de ocorrências deve ser maior que 0")
        return
      }
    }

    // Validate minimum time (must be >= next valid time (minute 0 or 5) for scheduler)
    // Only applies when creating/editing tasks scheduled for today
    if (time) {
      const nextValid = getNextValidTime()
      const todayBrazil = new Date().toLocaleString('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      
      let selectedDate: string
      if (repeatType === "none") {
        selectedDate = singleDate
      } else {
        // For repeating tasks, check if base date is today
        const existingScheduledDate = editingActivity?.scheduledDate ? (fromUTC(editingActivity.scheduledDate)?.date || null) : null
        const existingStartDate = editingActivity?.repeatStartDate
          ? editingActivity.repeatStartDate.split('T')[0]
          : null
        selectedDate = existingStartDate || existingScheduledDate || todayBrazil
      }
      
      // Only validate if selected date is today (same date as next valid time)
      if (selectedDate === todayBrazil || selectedDate === nextValid.date) {
        // Compare times: selected time must be >= next valid time
        const [selectedHour, selectedMin] = time.split(':').map(Number)
        const [validHour, validMin] = nextValid.time.split(':').map(Number)
        
        const selectedMinutes = selectedHour * 60 + selectedMin
        const validMinutes = validHour * 60 + validMin
        
        if (selectedMinutes < validMinutes) {
          if (repeatType === "repeat") {
            // Não bloquear para repetição: apenas alertar o risco de não executar hoje
            toast.warning(
              `Atenção: esta atividade pode não ser executada hoje (avisamos 15 minutos antes). Horário mínimo recomendado: ${nextValid.time}.`
            )
          } else {
            // Bloquear para tarefas únicas
            toast.error(`O horário mínimo permitido é ${nextValid.time} (próxima execução do serviço + 15min)`)
            return
          }
        }
      }
    }

    setSubmitting(true)
    try {
      const finalMessageString = buildMessageString()
      const data: CreateActivityData = {
        title,
        description: description || undefined,
        isRepeating: repeatType === "repeat",
        userIds: selectedUserIds,
        messageTemplateId: templateType === "template" ? selectedTemplateId : null,
        // Enviar messageString somente no modo personalizado; no modo template o backend recalcula
        messageString: templateType === "custom" ? finalMessageString : undefined,
        shouldSendNotification,
      }

      // Convert date+time to GMT+0 (UTC) for database storage
      if (repeatType === "none") {
        // Non-repeating task: combine date and time into scheduledDate (GMT+0)
        data.scheduledDate = toUTC(singleDate, time)
      } else {
        // Repeating task
        data.repeatInterval = parseInt(repeatEvery)
        data.repeatUnit = repeatUnit
        data.repeatEndType = endType
        
        // startDate não é selecionável: usar data da criação (Brasil)
        const todayBrazil = new Date().toLocaleString('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).split(', ')[0]
        
        // Determinar a data base existente
        const existingScheduledDate = editingActivity?.scheduledDate ? (fromUTC(editingActivity.scheduledDate)?.date || null) : null
        const existingStartDate = editingActivity?.repeatStartDate
          ? editingActivity.repeatStartDate.split('T')[0]
          : null
        const baseDate = existingStartDate || existingScheduledDate || todayBrazil

        // Sempre enviar repeatStartDate (para garantir que exista após edição)
        data.repeatStartDate = toUTC(baseDate, time)

        // scheduledDate para repetição segue a mesma base + horário
        data.scheduledDate = toUTC(baseDate, time)
        
        // Add repeat days of week for weekly tasks
        if (repeatUnit === "week" && weekdays.length > 0) {
          data.repeatDaysOfWeek = weekdays
        }
        
        if (endType === "date" && endDate) {
          data.repeatEndDate = new Date(endDate).toISOString()
        } else if (endType === "occurrences") {
          data.repeatOccurrences = parseInt(endCount)
        }
      }

      if (editingActivity) {
        // If rescheduling (date/time changed), ensure status returns to pending
        const existingTimeInfo = editingActivity.scheduledDate ? fromUTC(editingActivity.scheduledDate) : null
        const existingTime = existingTimeInfo?.time || ""
        const newTime = time || ""
        const newDateIso = data.scheduledDate
        const existingDateIso = editingActivity.scheduledDate ? new Date(editingActivity.scheduledDate).toISOString() : null
        const timeChanged = newTime !== existingTime
        const dateChanged = newDateIso !== existingDateIso
        if (timeChanged || dateChanged) {
          (data as any).status = 'pending'
        }
        await activityService.updateActivity(editingActivity.id, data)
        toast.success("Tarefa atualizada com sucesso!")
      } else {
        await activityService.createActivity(data)
        toast.success("Tarefa criada com sucesso!")
      }

      await loadData()
      setIsDialogOpen(false)
      resetForm()
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || "Erro ao salvar tarefa")
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return

    try {
      await activityService.deleteActivity(id)
      toast.success("Tarefa excluída com sucesso!")
      await loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Erro ao excluir tarefa")
      console.error(error)
    }
  }

  const handleToggleSwitch = async (activity: Activity, nextChecked: boolean) => {
    try {
      if (nextChecked) {
        // Reativar com loading global
        if (activity.status === 'canceled') {
          setGlobalLoading(true)
          const updated = await activityService.toggleCanceled(activity.id)
          toast.success(
            updated.status === 'completed'
              ? "Tarefa reativada e marcada como concluída"
              : "Tarefa reativada e marcada como pendente"
          )
        }
      } else {
        // Desativar
        if (activity.status !== 'canceled') {
          await activityService.updateActivity(activity.id, { status: 'canceled' })
          toast.success("Tarefa desativada com sucesso!")
        }
      }
      await loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Erro ao alternar status da tarefa")
      console.error(error)
    } finally {
      setGlobalLoading(false)
    }
  }

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.users.some(u => u.user.name.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter === "all" || activity.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="default">Pendente</Badge>
      case "completed": return <Badge variant="secondary" className="bg-green-100 text-green-800">Concluída</Badge>
      case "canceled": return <Badge variant="destructive">Cancelada</Badge>
      default: return <Badge>{status}</Badge>
    }
  }

  const userOptions = users.map(user => ({
    label: user.name,
    value: user.id
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">
            Gerencie e organize todas as atividades rurais
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingActivity ? "Editar Tarefa" : "Criar Nova Tarefa"}</DialogTitle>
              <DialogDescription>
                {editingActivity ? "Atualize as informações da tarefa" : "Adicione uma nova atividade rural ao sistema"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor="title">Título da Tarefa</Label>
                <Input 
                  id="title" 
                  placeholder="Ex: Alimentar gado do pasto A" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea 
                  id="description" 
                  placeholder="Detalhe as instruções para a tarefa"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* People Selection */}
              <div className="space-y-2">
                <Label>Pessoas Envolvidas</Label>
                <MultiSelect
                  options={userOptions}
                  selected={selectedUserIds}
                  onChange={setSelectedUserIds}
                  placeholder="Buscar e selecionar pessoas..."
                />
              </div>

              {/* Repetition */}
              <div className="space-y-2">
                <Label>Repetição</Label>
                <RadioGroup value={repeatType} onValueChange={(v) => setRepeatType(v as "none" | "repeat")} className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="none" />
                    <Label htmlFor="none">Não repetir</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="repeat" id="repeat" />
                    <Label htmlFor="repeat">Repetir</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Non-repeating fields */}
              {repeatType === "none" && (
                <div className="space-y-4 border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Data</Label>
                      <Input 
                        id="date" 
                        type="date" 
                        value={singleDate}
                        onChange={(e) => setSingleDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Horário</Label>
                      <Input 
                        id="time" 
                        type="time" 
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Repeating fields */}
              {repeatType === "repeat" && (
                <div className="space-y-4 border-t pt-4">

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Repetir a cada</Label>
                      <div className="flex gap-2">
                        <Input 
                          type="number" 
                          value={repeatEvery}
                          onChange={(e) => setRepeatEvery(e.target.value)}
                          min="1"
                          className="w-20"
                        />
                        <Select value={repeatUnit} onValueChange={(v) => setRepeatUnit(v as "day" | "week")}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">Dia(s)</SelectItem>
                            <SelectItem value="week">Semana(s)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="repeat-time">Horário</Label>
                      <Input 
                        id="repeat-time" 
                        type="time" 
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </div>
                  </div>
                  {repeatUnit == "week" && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>Dias da semana</Label>
                      <div className="flex gap-2">
                        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, index) => (
                          <Button key={day} variant={weekdays.includes(index) ? "default" : "outline"} className="w-10 h-8 text-xs" onClick={() => toggleWeekday(index)}>
                            {day}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>)}

                  <div className="space-y-2">
                    <Label>Terminar</Label>
                    <RadioGroup value={endType} onValueChange={(v) => setEndType(v as "never" | "date" | "occurrences")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="never" id="never" />
                        <Label htmlFor="never">Nunca</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="date" id="end-date" />
                        <Label htmlFor="end-date">Em data específica</Label>
                        {endType === "date" && (
                          <Input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="ml-2"
                          />
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="occurrences" id="end-count" />
                        <Label htmlFor="end-count">Após</Label>
                        {endType === "occurrences" && (
                          <>
                            <Input 
                              type="number" 
                              value={endCount}
                              onChange={(e) => setEndCount(e.target.value)}
                              min="1"
                              className="w-20 ml-2"
                            />
                            <span className="text-sm text-muted-foreground">ocorrências</span>
                          </>
                        )}
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}

              {/* WhatsApp Template */}
              <div className="space-y-2 border-t pt-4">
                <Label>Mensagem WhatsApp (obrigatório)</Label>
                <RadioGroup value={templateType} onValueChange={(v) => setTemplateType(v as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="template" id="predefined-template" />
                    <Label htmlFor="predefined-template">Template pré-definido</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom-template" />
                    <Label htmlFor="custom-template">Personalizado</Label>
                  </div>
                </RadioGroup>

                {templateType === "template" && (
                  <div className="space-y-2">
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplateId && getMessagePreview() && (
                      <div className="p-3 bg-muted rounded-lg border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Pré-visualização da mensagem:</p>
                        <div className="text-sm whitespace-pre-wrap font-mono bg-background p-2 rounded border">
                          {getMessagePreview()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Nota: {"{{NOME}}"} será substituído pelo nome de cada destinatário no envio.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {templateType === "custom" && (
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Digite sua mensagem personalizada..."
                    rows={6}
                  />
                )}

                <div className="p-3 bg-muted rounded-lg text-sm">
                  <h4 className="font-medium mb-2">Variáveis disponíveis:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>{"{{NOME}}"} - Nome da pessoa</span>
                    <span>{"{{TAREFA}}"} - Título e descrição da tarefa</span>
                    <span>{"{{DATA}}"} - Data da tarefa</span>
                    <span>{"{{HORARIO}}"} - Horário da tarefa</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <Label htmlFor="toggle-notification">Notificação automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Controle se esta tarefa deve disparar mensagens pelo microserviço.
                  </p>
                </div>
                <Switch
                  id="toggle-notification"
                  checked={shouldSendNotification}
                  onCheckedChange={setShouldSendNotification}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleSubmit} 
                disabled={submitting || !isFormValid()}
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingActivity ? "Atualizar Tarefa" : "Criar Tarefa"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, descrição ou responsável..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="canceled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities List */}
      <div className="space-y-4">
        {filteredActivities.map((activity) => (
          <Card key={activity.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2">
                    <h3 className="text-lg font-semibold whitespace-normal break-words">{activity.title}</h3>
                  </div>
                  
                  {activity.description && (
                    <p className="text-muted-foreground mb-3">{activity.description}</p>
                  )}
                  
                  <div className="flex items-center gap-6 text-sm flex-wrap">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{activity.users.map(u => u.user.name).join(", ")}</span>
                    </div>
                    {activity.scheduledDate && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {(() => {
                          const timeInfo = fromUTC(activity.scheduledDate)
                          return timeInfo?.time || ""
                        })()}
                      </span>
                    </div>
                    )}
                    {activity.messageTemplate && (
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <span>{activity.messageTemplate.name}</span>
                    </div>
                    )}
                    {!activity.messageTemplateId && activity.messageString && (
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <span>Mensagem personalizada</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {getStatusBadge(activity.status)}
                  {activity.isRepeating && (
                    <Badge variant="outline" className="text-xs flex items-center">
                      <Repeat className="w-3 h-3 mr-1" />
                      Repetir a cada {activity.repeatInterval} {activity.repeatUnit === "day" ? "dia(s)" : "semana(s)"}
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {activity.status === 'canceled' ? 'Desativada' : 'Ativa'}
                    </span>
                    <Switch
                      checked={activity.status !== 'canceled'}
                      disabled={submitting || globalLoading}
                      onCheckedChange={(checked) => handleToggleSwitch(activity, checked)}
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Configurações">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => loadActivityForEdit(activity)}>
                        <Edit className="w-3 h-3 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(activity.id)}>
                        <Trash2 className="w-3 h-3 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredActivities.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma tarefa encontrada</h3>
            <p className="text-muted-foreground">
              Tente ajustar os termos de busca ou crie uma nova tarefa.
            </p>
          </CardContent>
        </Card>
      )}

      {globalLoading && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-background rounded-md p-6 shadow-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processando reativação...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default Tarefas
