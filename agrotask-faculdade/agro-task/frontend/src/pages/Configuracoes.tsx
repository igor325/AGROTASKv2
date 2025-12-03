import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Settings, 
  Bell, 
  Clock,
  Users,
  Save,
  RotateCcw,
  Plus,
  UserPlus,
  Loader2,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  MessageSquare,
} from "lucide-react"
import { toast } from "sonner"
import adminReminderService from "@/services/adminReminderService"
import type { AdminReminder, CreateAdminReminderData } from "@/services/adminReminderService"
import workShiftService from "@/services/workShiftService"
import type { WorkShift } from "@/services/workShiftService"
import { toUTC, fromUTC } from "@/lib/timezone"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const Configuracoes = () => {
  const [reminders, setReminders] = useState<AdminReminder[]>([])
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([])
  const [loading, setLoading] = useState(true)
  // Admin creation form state
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPhone, setAdminPhone] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [workShiftSubmitting, setWorkShiftSubmitting] = useState(false)
  
  // Form states
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [messageString, setMessageString] = useState("")
  const [reminderType, setReminderType] = useState<"none" | "repeat">("none")
  const [repeatEvery, setRepeatEvery] = useState("1")
  const [repeatUnit, setRepeatUnit] = useState<"day" | "week">("day")
  const [repeatStartDate, setRepeatStartDate] = useState("")
  const [endType, setEndType] = useState<"never" | "date" | "occurrences">("never")
  const [endDate, setEndDate] = useState("")
  const [endCount, setEndCount] = useState("1")
  const [singleDate, setSingleDate] = useState("")
  const [time, setTime] = useState("08:00")
  const [weekdays, setWeekdays] = useState<number[]>([])

  // Password policy: align with auth expectations
  const validateAdminPassword = (pwd: string) => {
    const issues: string[] = []
    if (pwd.length < 8) issues.push('mínimo de 8 caracteres')
    if (!/[a-z]/.test(pwd)) issues.push('ao menos 1 letra minúscula')
    if (!/[A-Z]/.test(pwd)) issues.push('ao menos 1 letra maiúscula')
    if (!/[0-9]/.test(pwd)) issues.push('ao menos 1 número')
    // opcional: if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(pwd)) issues.push('ao menos 1 caractere especial')
    return issues
  }

  const toggleWeekday = (dayIndex: number) => {
    setWeekdays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    )
  }

  // WorkShift form states
  const [shiftTitle, setShiftTitle] = useState("")
  const [shiftTime, setShiftTime] = useState("08:00")
  const [shiftAlertMinutes, setShiftAlertMinutes] = useState("5")
  const [shiftMessageString, setShiftMessageString] = useState("")
  const [editingWorkShiftId, setEditingWorkShiftId] = useState<string | null>(null)
  const [isWorkShiftModalOpen, setIsWorkShiftModalOpen] = useState(false)

  useEffect(() => {
    loadReminders()
    loadWorkShifts()
  }, [])

  const loadReminders = async () => {
    try {
      setLoading(true)
      const data = await adminReminderService.getAdminReminders()
      setReminders(data)
    } catch (error) {
      toast.error("Erro ao carregar lembretes")
      console.error(error)
      setReminders([])
    } finally {
      setLoading(false)
    }
  }

  const loadWorkShifts = async () => {
    try {
      const data = await workShiftService.getWorkShifts()
      setWorkShifts(data)
    } catch (error) {
      console.error(error)
      setWorkShifts([])
    }
  }

  const resetWorkShiftForm = () => {
    setShiftTitle("")
    setShiftTime("08:00")
    setShiftAlertMinutes("5")
    setShiftMessageString("")
    setEditingWorkShiftId(null)
  }

  const handleEditWorkShift = (shift: WorkShift) => {
    setShiftTitle(shift.title)
    setShiftTime(shift.time)
    setShiftAlertMinutes(shift.alertMinutesBefore.toString())
    setShiftMessageString(shift.messageString ?? "")
    setEditingWorkShiftId(shift.id)
    setIsWorkShiftModalOpen(true)
  }

  const handleNewWorkShift = () => {
    resetWorkShiftForm()
    setIsWorkShiftModalOpen(true)
  }

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setMessageString("")
    setReminderType("none")
    setRepeatEvery("1")
    setRepeatUnit("day")
    setRepeatStartDate("")
    setEndType("never")
    setEndDate("")
    setEndCount("1")
    setSingleDate("")
    setTime("08:00")
    setWeekdays([])
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Título é obrigatório")
      return
    }

    // Validate that there's a message (description or messageString)
    if (!description.trim() && !messageString.trim()) {
      toast.error("O lembrete precisa ter uma descrição ou uma mensagem")
      return
    }

    // Validation for non-repeating reminders
    if (reminderType === "none") {
      if (!singleDate) {
        toast.error("Data é obrigatória para lembretes únicos")
        return
      }
      if (!time) {
        toast.error("Horário é obrigatório")
        return
      }
    }

    // Validation for repeating reminders
    if (reminderType === "repeat") {
      if (repeatUnit === "day" && !repeatStartDate) {
        toast.error("Data de início é obrigatória para lembretes repetitivos diários")
        return
      }
      if (repeatUnit === "week") {
        if (weekdays.length === 0) {
          toast.error("Selecione pelo menos um dia da semana para lembretes semanais")
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

    setSubmitting(true)
    try {
      const data: CreateAdminReminderData = {
        title,
        description: description || undefined,
        messageString: messageString || undefined,
        isRepeating: reminderType === "repeat",
      }

      // Convert date+time to GMT+0 (UTC) for database storage
      if (reminderType === "none") {
        // Non-repeating reminder: combine date and time into scheduledDate (GMT+0)
        data.scheduledDate = toUTC(singleDate, time)
      } else {
        // Repeating reminder
        data.repeatInterval = parseInt(repeatEvery)
        data.repeatUnit = repeatUnit
        data.repeatEndType = endType
        
        // Only include start date for daily tasks
        if (repeatUnit === "day" && repeatStartDate) {
          data.repeatStartDate = new Date(repeatStartDate).toISOString()
        }

        // Also set scheduledDate for repeating, combining repeatStartDate + time when available
        if (repeatStartDate) {
          // Store repeat start date with time in GMT+0
          data.scheduledDate = toUTC(repeatStartDate, time)
        }
        
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

      await adminReminderService.createAdminReminder(data)
      toast.success("Lembrete criado com sucesso!")
      await loadReminders()
      resetForm()
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar lembrete")
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este lembrete?")) return

    try {
      await adminReminderService.deleteAdminReminder(id)
      toast.success("Lembrete excluído com sucesso!")
      await loadReminders()
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir lembrete")
      console.error(error)
    }
  }

  const formatReminderDisplay = (reminder: AdminReminder): string => {
    if (!reminder.isRepeating && reminder.scheduledDate) {
      // Convert from GMT+0 to GMT-3
      const timeInfo = fromUTC(reminder.scheduledDate)
      if (!timeInfo) return 'Sem agendamento'
      
      const [year, month, day] = timeInfo.date.split('-')
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      const dateStr = dateObj.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long',
        year: 'numeric'
      })
      
      return `${dateStr} às ${timeInfo.time}`
    }
    
    if (reminder.isRepeating) {
      const unit = reminder.repeatUnit === 'day' ? 'dia(s)' : 'semana(s)'
      const interval = reminder.repeatInterval > 1 ? `a cada ${reminder.repeatInterval} ${unit}` : unit === 'dia(s)' ? 'diariamente' : 'semanalmente'
      // Extract time from scheduledDate (convert from GMT+0 to GMT-3)
      const timeInfo = reminder.scheduledDate ? fromUTC(reminder.scheduledDate) : null
      const time = timeInfo?.time || 'sem horário'
      return `${interval} às ${time}`
    }
    
    return "Sem agendamento"
  }

  const handleWorkShiftSave = async () => {
    if (!shiftTitle.trim()) {
      toast.error("Título do turno é obrigatório")
      return
    }
    if (!shiftTime) {
      toast.error("Horário é obrigatório")
      return
    }

    setWorkShiftSubmitting(true)
    try {
      const parsedAlert = Number.parseInt(shiftAlertMinutes, 10)
      const alertValue = Number.isNaN(parsedAlert) ? 5 : parsedAlert

      const payload = {
        title: shiftTitle.trim(),
        time: shiftTime,
        messageString: shiftMessageString.trim() || null,
        alertMinutesBefore: alertValue,
      }

      if (editingWorkShiftId) {
        await workShiftService.updateWorkShift(editingWorkShiftId, payload)
        toast.success("Turno atualizado com sucesso!")
      } else {
        await workShiftService.createWorkShift(payload)
        toast.success("Turno criado com sucesso!")
      }
      
      setIsWorkShiftModalOpen(false)
      resetWorkShiftForm()
      await loadWorkShifts()
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar turno")
      console.error(error)
    } finally {
      setWorkShiftSubmitting(false)
    }
  }

  const handleWorkShiftDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este turno?")) return

    try {
      await workShiftService.deleteWorkShift(id)
      toast.success("Turno excluído com sucesso!")
      if (editingWorkShiftId === id) {
        resetWorkShiftForm()
      }
      await loadWorkShifts()
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir turno")
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Configure preferências do sistema e lembretes
        </p>
      </div>

      <div className="space-y-6">
        {/* First row: Reminders and Time Settings */}
        <div className="grid grid-cols-1 gap-6">
          {/* Administrative Reminders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Lembretes Administrativos
              </CardTitle>
              <CardDescription>
                Configure lembretes enviados para administradores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : reminders.length > 0 ? (
              <div className="p-4 border rounded-lg bg-accent/10">
                <h4 className="font-medium mb-2">Lembretes Ativos:</h4>
                <ul className="space-y-2 text-sm">
                    {reminders.map((reminder) => (
                      <li key={reminder.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div className={`w-2 h-2 rounded-full ${reminder.isRepeating ? 'bg-primary' : 'bg-warning'}`}></div>
                          <div className="flex-1">
                            <div className="font-medium">{reminder.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatReminderDisplay(reminder)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Status: <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                reminder.status === 'completed' ? 'bg-green-100 text-green-800' :
                                reminder.status === 'canceled' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>{reminder.status}</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(reminder.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </li>
                    ))}
                </ul>
              </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum lembrete criado</p>
                </div>
              )}
              
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">Novo Lembrete Administrativo</h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="reminder-title">Título do Lembrete</Label>
                    <Input 
                      id="reminder-title" 
                      placeholder="Ex: Backup mensal dos dados" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reminder-description">Descrição</Label>
                    <Input 
                      id="reminder-description" 
                      placeholder="Realizar backup completo do sistema"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message-string">Mensagem do Lembrete</Label>
                    <Input 
                      id="message-string" 
                      placeholder="Ex: Lembrar de realizar backup do sistema"
                      value={messageString}
                      onChange={(e) => setMessageString(e.target.value)}
                    />
                  </div>
                  
                  {/* Type Selection */}
                  <div className="space-y-2">
                    <Label>Tipo de Lembrete</Label>
                    <RadioGroup value={reminderType} onValueChange={(v) => setReminderType(v as "none" | "repeat")} className="flex gap-6">
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
                  {reminderType === "none" && (
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
                  {reminderType === "repeat" && (
                    <div className="space-y-4 border-t pt-4">
                      {repeatUnit == "day" && (
                        <div className="space-y-2">
                          <Label htmlFor="repeat-start-date">Data de início *</Label>
                          <Input 
                            id="repeat-start-date" 
                            type="date" 
                            value={repeatStartDate}
                            onChange={(e) => setRepeatStartDate(e.target.value)}
                          />
                        </div>
                      )}

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
                                <Button 
                                  key={day} 
                                  variant={weekdays.includes(index) ? "default" : "outline"} 
                                  className="w-10 h-8 text-xs" 
                                  onClick={() => toggleWeekday(index)}
                                  type="button"
                                >
                                  {day}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

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

                  <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Lembrete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Settings */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Turnos de Trabalho
                  </CardTitle>
                  <CardDescription>
                    Configure horários e mensagens automáticas para os turnos
                  </CardDescription>
                </div>
                <Button 
                  onClick={handleNewWorkShift}
                  disabled={loading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Turno
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : workShifts.length > 0 ? (
                <div className="space-y-2">
                  {workShifts.map((shift) => (
                    <div key={shift.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{shift.title}</div>
                          <div className="text-xs text-muted-foreground">
                            Horário: {shift.time} • Alerta: {shift.alertMinutesBefore} min antes
                          </div>
                          {shift.messageString && (
                            <div className="text-xs text-muted-foreground mt-1 italic truncate max-w-md">
                              "{shift.messageString}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditWorkShift(shift)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleWorkShiftDelete(shift.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum turno cadastrado</p>
                  <p className="text-xs mt-2">Clique em "Novo Turno" para começar</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* WorkShift Modal */}
          <Dialog open={isWorkShiftModalOpen} onOpenChange={setIsWorkShiftModalOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingWorkShiftId ? "Editar Turno" : "Novo Turno"}
                </DialogTitle>
                <DialogDescription>
                  Configure horário e mensagem automática para o turno. Use variáveis para personalizar a mensagem.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shift-title">Título do Turno *</Label>
                  <Input 
                    id="shift-title" 
                    placeholder="Ex: Início do turno matinal" 
                    value={shiftTitle}
                    onChange={(e) => setShiftTitle(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shift-time">Horário *</Label>
                    <Input 
                      id="shift-time" 
                      type="time" 
                      value={shiftTime}
                      onChange={(e) => setShiftTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shift-alert">Alerta (minutos antes)</Label>
                    <Input 
                      id="shift-alert" 
                      type="number" 
                      value={shiftAlertMinutes}
                      onChange={(e) => setShiftAlertMinutes(e.target.value)}
                      min="0"
                      placeholder="5"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="shift-message">Mensagem (opcional)</Label>
                  <Textarea
                    id="shift-message"
                    placeholder="Ex: Bom dia {{NOME}}, seu turno começa agora. Tarefas de hoje: {{TAREFAS}}"
                    value={shiftMessageString}
                    onChange={(e) => setShiftMessageString(e.target.value)}
                    className="font-mono"
                    rows={4}
                  />
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <p className="text-sm font-medium">Variáveis disponíveis:</p>
                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>
                        <code className="font-mono text-foreground bg-background/60 px-1 py-0.5 rounded">
                          {"{{NOME}}"}
                        </code>{" "}
                        - Nome do colaborador
                      </span>
                      <span>
                        <code className="font-mono text-foreground bg-background/60 px-1 py-0.5 rounded">
                          {"{{TAREFAS}}"}
                        </code>{" "}
                        - Lista de tarefas
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      As variáveis serão substituídas automaticamente pelo sistema de mensagens.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsWorkShiftModalOpen(false)
                    resetWorkShiftForm()
                  }}
                  disabled={workShiftSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="button" 
                  onClick={handleWorkShiftSave}
                  disabled={workShiftSubmitting}
                >
                  {workShiftSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      {editingWorkShiftId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      {editingWorkShiftId ? "Atualizar" : "Criar"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Second row: Admin Account Creation - Full width */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Criação de Conta Administrativa
            </CardTitle>
            <CardDescription>
              Crie novos administradores do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-10 w-full mt-4" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-name">Nome Completo</Label>
                    <Input id="admin-name" placeholder="Digite o nome completo" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input id="admin-email" type="email" placeholder="email@exemplo.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-phone">Número de Celular</Label>
                    <Input id="admin-phone" type="tel" placeholder="(00) 00000-0000" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Senha Temporária</Label>
                    <div className="relative">
                      <Input id="admin-password" type={showAdminPassword ? 'text' : 'password'} placeholder="Senha que será enviada por email" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowAdminPassword(v => !v)}>
                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button className="w-full mt-4" onClick={async () => {
                  if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
                    toast.error('Preencha nome, email e senha')
                    return
                  }
                  // Validate password policy before calling backend
                  const issues = validateAdminPassword(adminPassword)
                  if (issues.length > 0) {
                    toast.error(`Senha inválida: ${issues.join(', ')}`)
                    return
                  }
                  try {
                    setSubmitting(true)
                    const res = await (await import('@/services/authService')).authService.createAdmin({
                      name: adminName.trim(),
                      email: adminEmail.trim(),
                      password: adminPassword,
                      phone: adminPhone.trim() || undefined
                    })
                    if (res.success) {
                      toast.success('Administrador criado com sucesso')
                      setAdminName(''); setAdminEmail(''); setAdminPhone(''); setAdminPassword(''); setShowAdminPassword(false)
                    } else {
                      toast.error(res.error || 'Falha ao criar administrador')
                    }
                  } catch (e: any) {
                    toast.error(e?.message || 'Erro ao criar administrador')
                  } finally {
                    setSubmitting(false)
                  }
                }} disabled={submitting}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Criar Administrador
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Configuracoes
