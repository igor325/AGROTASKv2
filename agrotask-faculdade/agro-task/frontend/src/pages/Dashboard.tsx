import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useNavigate } from "react-router-dom"
import { WeeklyCalendarView } from "@/components/dashboard/WeeklyCalendarView"
import { 
  CalendarDays, 
  Users, 
  CheckSquare, 
  AlertTriangle,
  Plus,
  Clock,
  Loader2
} from "lucide-react"
import activityService from "@/services/activityService"
import type { Activity } from "@/services/activityService"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { fromUTC } from "@/lib/timezone"

const Dashboard = () => {
  const navigate = useNavigate()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadActivities()
  }, [])

  const loadActivities = async () => {
    try {
      setLoading(true)
      const data = await activityService.getActivities()
      setActivities(data)
    } catch (error) {
      toast.error("Erro ao carregar atividades")
      console.error(error)
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  // Filter today's tasks
  const getTodaysTasks = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return activities.filter(activity => {
      // Exclude canceled tasks; include pending and completed scheduled for hoje
      if (activity.status === 'canceled') return false

      // For non-repeating tasks, check if scheduledDate is today (convert from GMT+0 to GMT-3)
      if (!activity.isRepeating && activity.scheduledDate) {
        const timeInfo = fromUTC(activity.scheduledDate)
        if (!timeInfo) return false
        
        const [year, month, day] = timeInfo.date.split('-').map(Number)
        const activityDate = new Date(year, month - 1, day)
        activityDate.setHours(0, 0, 0, 0)
        return activityDate.getTime() === today.getTime()
      }
      
      // For repeating tasks, calculate if today is an occurrence day
      if (activity.isRepeating) {
        // Check if it has ended - convert from GMT+0 to GMT-3
        if (activity.repeatEndType === 'date' && activity.repeatEndDate) {
          const endDateInfo = fromUTC(activity.repeatEndDate)
          if (!endDateInfo) return false
          
          const [year, month, day] = endDateInfo.date.split('-').map(Number)
          const endDate = new Date(year, month - 1, day)
          endDate.setHours(0, 0, 0, 0)
          if (endDate < today) return false
        }

        if (activity.repeatUnit === 'day') {
          if (!activity.repeatStartDate) return false
          
          // Convert from GMT+0 to GMT-3 for comparison
          const startDateInfo = fromUTC(activity.repeatStartDate)
          if (!startDateInfo) return false
          
          const [year, month, day] = startDateInfo.date.split('-').map(Number)
          const startDate = new Date(year, month - 1, day)
          startDate.setHours(0, 0, 0, 0)
          
          // Check if it has started
          if (startDate > today) return false
          
          // Calculate if today is a valid occurrence
          const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          const isOccurrenceDay = daysDiff % activity.repeatInterval === 0
          
          // Check if we've reached the max occurrences
          if (activity.repeatEndType === 'occurrences' && activity.repeatOccurrences) {
            const occurrenceNumber = Math.floor(daysDiff / activity.repeatInterval) + 1
            if (occurrenceNumber > activity.repeatOccurrences) return false
          }
          
          return isOccurrenceDay
        }
        
        if (activity.repeatUnit === 'week') {
          // Map JS getDay (0=Sunday .. 6=Saturday) to ISO (0=Monday .. 6=Sunday)
          const todayIsoDow = today.getDay() === 0 ? 6 : today.getDay() - 1

          // If weekdays are specified, honor them even without a repeatStartDate
          if (Array.isArray(activity.repeatDaysOfWeek) && activity.repeatDaysOfWeek.length > 0) {
            return activity.repeatDaysOfWeek.includes(todayIsoDow)
          }

          // Fallback to startDate-based weekly recurrence when no weekdays are set
          if (!activity.repeatStartDate) return false
          
          // Convert from GMT+0 to GMT-3 for comparison
          const startDateInfo = fromUTC(activity.repeatStartDate)
          if (!startDateInfo) return false
          
          const [year, month, day] = startDateInfo.date.split('-').map(Number)
          const startDate = new Date(year, month - 1, day)
          startDate.setHours(0, 0, 0, 0)
          
          // Check if it has started
          if (startDate > today) return false
          
          const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          const weeksDiff = Math.floor(daysDiff / 7)
          const isOccurrenceWeek = weeksDiff % activity.repeatInterval === 0
          
          // Check if we've reached the max occurrences
          if (activity.repeatEndType === 'occurrences' && activity.repeatOccurrences) {
            const occurrenceNumber = Math.floor(weeksDiff / activity.repeatInterval) + 1
            if (occurrenceNumber > activity.repeatOccurrences) return false
          }
          
          // For weekly, check if today is same day of week as start date
          const isSameDayOfWeek = today.getDay() === startDate.getDay()
          
          return isOccurrenceWeek && isSameDayOfWeek
        }
      }
      
      return false
    })
  }

  const todaysTasks = getTodaysTasks()

  const { user } = useAuth()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bem-vindo(a){user?.name ? ` ${user.name}` : ""}</h1>
          <p className="text-muted-foreground">
            Visão geral das atividades rurais de hoje
          </p>
        </div>
      </div>

      {/* Today's Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Tarefas de Hoje
            </div>
            <Badge variant="outline" className="text-sm">
              Total: {todaysTasks.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Próximas atividades programadas para hoje
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {/* Skeleton item */}
              {[0,1,2].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <div className="text-right ml-4 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : todaysTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma tarefa agendada para hoje</p>
            </div>
          ) : (
            todaysTasks
              .sort((a, b) => {
        // Sort by time if available - extract from scheduledDate (GMT-3)
        const timeInfoA = a.scheduledDate ? fromUTC(a.scheduledDate) : null
        const timeA = timeInfoA?.time || null
                
        const timeInfoB = b.scheduledDate ? fromUTC(b.scheduledDate) : null
        const timeB = timeInfoB?.time || null

                if (timeA && timeB) {
                  return timeA.localeCompare(timeB)
                }
                return 0
              })
              .map((task) => {
                // Extract time from scheduledDate (GMT-3)
                const timeInfo = task.scheduledDate ? fromUTC(task.scheduledDate) : null
                const displayTime = timeInfo?.time || null

                return (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{task.title}</h3>
                        {task.isRepeating && (
                          <Badge variant="outline" className="text-xs">
                            Repetir {task.repeatUnit === 'day' ? 'diariamente' : 'semanalmente'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {task.users.map(u => u.user.name).join(", ")}
                      </p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      {displayTime && (
                        <div className="text-sm font-medium mb-1">
                          {displayTime}
                        </div>
                      )}
                      <Badge variant="default" className="text-xs">
                        {task.status === 'pending' ? 'Pendente' : 
                         task.status === 'completed' ? 'Concluída' : 'Cancelada'}
                      </Badge>
                    </div>
                  </div>
                )
              })
          )}
        </CardContent>
      </Card>

      {/* Atividades Semanais com Toggle */}
      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Atividades da Semana
            </CardTitle>
            <CardDescription>Carregando calendário semanal...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-64 w-full" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <WeeklyCalendarView activities={activities} />
      )}
    </div>
  )
}

export default Dashboard