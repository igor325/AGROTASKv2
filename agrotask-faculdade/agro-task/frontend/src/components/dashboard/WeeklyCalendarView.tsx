import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, ChevronLeft, ChevronRight, Grid3X3, List } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { Activity } from "@/services/activityService"
import { fromUTC } from "@/lib/timezone"

interface WeeklyCalendarViewProps {
  activities: Activity[]
}

const ROW_HEIGHT = 48
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i) // 00:00 às 23:00
const VISIBLE_START_HOUR = 6
const VISIBLE_END_HOUR = 18

export function WeeklyCalendarView({ activities }: WeeklyCalendarViewProps) {
  const [isCalendarView, setIsCalendarView] = useState(true)
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = VISIBLE_START_HOUR * ROW_HEIGHT
    }
  }, [isCalendarView, currentWeekOffset])
  
  const getCurrentWeekDates = () => {
    // Normalize to local midnight to avoid timezone drift
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate Monday as the start of the week (ISO week)
    // JS getDay(): Sunday=0, Monday=1, ... Saturday=6
    // For Sunday, we should go back 6 days to reach the current week's Monday
    const day = today.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day

    // Use milliseconds to avoid setDate() issues with negative values
    const startOfWeek = new Date(today.getTime() + (mondayOffset + (currentWeekOffset * 7)) * 24 * 60 * 60 * 1000)
    startOfWeek.setHours(0, 0, 0, 0)
    
    const weekDates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek.getTime() + i * 24 * 60 * 60 * 1000)
      date.setHours(0, 0, 0, 0)
      weekDates.push(date)
    }
    
    
    return weekDates
  }

  const weekDates = getCurrentWeekDates()
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  
  // Check if an activity should appear on a specific date
  const isActivityOnDate = (activity: Activity, date: Date): boolean => {
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    
    // Non-repeating tasks
    if (!activity.isRepeating && activity.scheduledDate) {
      // Convert from GMT+0 to GMT-3 to get correct date
      const timeInfo = fromUTC(activity.scheduledDate)
      if (!timeInfo) return false
      
      // Parse date components from GMT-3 date string
      const [year, month, day] = timeInfo.date.split('-').map(Number)
      
      // Create dates using local timezone (both should be in same timezone for comparison)
      // targetDate is already in local timezone (GMT-3 in Brazil)
      // activityDate should also be in local timezone
      const activityDate = new Date(year, month - 1, day, 0, 0, 0, 0)
      
      // Compare dates by their date components (not time)
      const activityYear = activityDate.getFullYear()
      const activityMonth = activityDate.getMonth()
      const activityDay = activityDate.getDate()
      
      const targetYear = targetDate.getFullYear()
      const targetMonth = targetDate.getMonth()
      const targetDay = targetDate.getDate()
      
      return activityYear === targetYear && 
             activityMonth === targetMonth && 
             activityDay === targetDay
    }

    // Repeating tasks
    if (activity.isRepeating) {
      // End date guard (applies to both daily and weekly)
      // Convert from GMT+0 to GMT-3 for comparison
      if (activity.repeatEndType === 'date' && activity.repeatEndDate) {
        const endDateInfo = fromUTC(activity.repeatEndDate)
        if (!endDateInfo) return false
        
        const [year, month, day] = endDateInfo.date.split('-').map(Number)
        const endDate = new Date(year, month - 1, day)
        endDate.setHours(0, 0, 0, 0)
        if (endDate < targetDate) return false
      }

      if (activity.repeatUnit === 'day') {
        if (!activity.repeatStartDate) return false
        
        // Convert from GMT+0 to GMT-3 for comparison
        const startDateInfo = fromUTC(activity.repeatStartDate)
        if (!startDateInfo) return false
        
        const [year, month, day] = startDateInfo.date.split('-').map(Number)
        const startDate = new Date(year, month - 1, day)
        startDate.setHours(0, 0, 0, 0)
        if (startDate > targetDate) return false

        const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const isOccurrenceDay = daysDiff % activity.repeatInterval === 0

        if (activity.repeatEndType === 'occurrences' && activity.repeatOccurrences) {
          const occurrenceNumber = Math.floor(daysDiff / activity.repeatInterval) + 1
          if (occurrenceNumber > activity.repeatOccurrences) return false
        }
        return isOccurrenceDay
      }

      if (activity.repeatUnit === 'week') {
        // Map JS getDay (0=Sunday .. 6=Saturday) to ISO (0=Monday .. 6=Sunday)
        const targetIsoDow = targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1

        // If weekdays are specified, honor them even without a repeatStartDate
        if (Array.isArray(activity.repeatDaysOfWeek) && activity.repeatDaysOfWeek.length > 0) {
          return activity.repeatDaysOfWeek.includes(targetIsoDow)
        }

        // Fallback to startDate-based weekly recurrence when no weekdays are set
        if (!activity.repeatStartDate) return false
        
        // Convert from GMT+0 to GMT-3 for comparison
        const startDateInfo = fromUTC(activity.repeatStartDate)
        if (!startDateInfo) return false
        
        const [year, month, day] = startDateInfo.date.split('-').map(Number)
        const startDate = new Date(year, month - 1, day, 0, 0, 0, 0)
        
        // Compare by date components
        if (startDate.getFullYear() > targetDate.getFullYear() ||
            (startDate.getFullYear() === targetDate.getFullYear() && startDate.getMonth() > targetDate.getMonth()) ||
            (startDate.getFullYear() === targetDate.getFullYear() && startDate.getMonth() === targetDate.getMonth() && startDate.getDate() > targetDate.getDate())) {
          return false
        }

        const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const weeksDiff = Math.floor(daysDiff / 7)
        const isOccurrenceWeek = weeksDiff % activity.repeatInterval === 0

        if (activity.repeatEndType === 'occurrences' && activity.repeatOccurrences) {
          const occurrenceNumber = Math.floor(weeksDiff / activity.repeatInterval) + 1
          if (occurrenceNumber > activity.repeatOccurrences) return false
        }

        const isSameDayOfWeek = targetDate.getDay() === startDate.getDay()
        return isOccurrenceWeek && isSameDayOfWeek
      }
    }

    return false
  }

  // Get activities for a specific day
  const getActivitiesForDay = (dayIndex: number) => {
    const date = weekDates[dayIndex]
    return activities
      .filter(activity => isActivityOnDate(activity, date))
  }

  const getActivityTime = (activity: Activity): string => {
    // Extract time from scheduledDate (convert from GMT+0 to GMT-3)
    if (activity.scheduledDate) {
      const timeInfo = fromUTC(activity.scheduledDate)
      
      return timeInfo?.time || "00:00"
    }
    return "00:00"
  }

  const getTimePosition = (time: string) => {
    const [hour, minute] = time.split(':').map(Number)
    const totalMinutes = hour * 60 + minute
    return (totalMinutes / 60) * ROW_HEIGHT // 64px por hora
  }

  const getDurationHeight = () => {
    return ROW_HEIGHT // Default 1 hour duration equals one row height
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'canceled': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  // Check if two activities overlap
  const activitiesOverlap = (activityA: Activity, activityB: Activity) => {
    const timeA = getActivityTime(activityA)
    const timeB = getActivityTime(activityB)
    const [hourA, minA] = timeA.split(':').map(Number)
    const [hourB, minB] = timeB.split(':').map(Number)
    const startA = hourA * 60 + minA
    const startB = hourB * 60 + minB
    const endA = startA + 60 // Assume 1 hour duration
    const endB = startB + 60
    
    return (startA < endB && endA > startB)
  }

  // Calculate layout positions for overlapping activities
  // Returns layout info per activity, only grouping activities that actually overlap
  const getActivityLayout = (activities: Activity[]) => {
    if (activities.length === 0) {
      return { activityToColumn: new Map<string, number>(), totalColumns: 0, activityGroups: [] }
    }

    const sortedActivities = [...activities].sort((a, b) => {
      const timeA = getActivityTime(a)
      const timeB = getActivityTime(b)
      return timeA.localeCompare(timeB)
    })

    // Group activities that overlap with each other
    const overlapGroups: Activity[][] = []
    const activityToGroup = new Map<string, number>()

    sortedActivities.forEach(activity => {
      let addedToGroup = false

      // Check if this activity overlaps with any existing group
      for (let i = 0; i < overlapGroups.length; i++) {
        const group = overlapGroups[i]
        const overlapsWithGroup = group.some(a => activitiesOverlap(a, activity))
        
        if (overlapsWithGroup) {
          group.push(activity)
          activityToGroup.set(activity.id, i)
          addedToGroup = true
          break
        }
      }

      // If no overlap with existing groups, create a new group
      if (!addedToGroup) {
        overlapGroups.push([activity])
        activityToGroup.set(activity.id, overlapGroups.length - 1)
      }
    })

    // For each group, calculate column layout (only if group has more than 1 activity)
    const activityToColumn = new Map<string, number>()
    let maxColumns = 0

    overlapGroups.forEach((group, groupIndex) => {
      if (group.length === 1) {
        // Single activity - no columns needed, use column -1 to indicate full width
        activityToColumn.set(group[0].id, -1)
      } else {
        // Multiple activities - calculate column layout within this group
        const columns: Activity[][] = []
        
        group.forEach(activity => {
          let placed = false
          
          // Try to place in existing column
          for (let i = 0; i < columns.length; i++) {
            const column = columns[i]
            const hasOverlap = column.some(a => activitiesOverlap(a, activity))
            
            if (!hasOverlap) {
              column.push(activity)
              activityToColumn.set(activity.id, i)
              placed = true
              break
            }
          }
          
          // Create new column if needed
          if (!placed) {
            columns.push([activity])
            activityToColumn.set(activity.id, columns.length - 1)
          }
        })

        maxColumns = Math.max(maxColumns, columns.length)
      }
    })

    return { 
      activityToColumn, 
      totalColumns: maxColumns,
      activityGroups: overlapGroups
    }
  }

  const previousWeek = () => setCurrentWeekOffset(prev => prev - 1)
  const nextWeek = () => setCurrentWeekOffset(prev => prev + 1)
  const goToToday = () => setCurrentWeekOffset(0)

  if (!isCalendarView) {
    // Table view
    // Group activities by time slot and day index (0-6)
    const groupedByTime: { [time: string]: Activity[][] } = {}
    
    activities.forEach(activity => {
      if (activity.status !== 'pending') return
      
      weekDates.forEach((date, dayIndex) => {
        if (isActivityOnDate(activity, date)) {
          const timeKey = getActivityTime(activity)
          if (!groupedByTime[timeKey]) {
            // Initialize 7 columns (Mon-Sun) with empty arrays
            groupedByTime[timeKey] = Array.from({ length: 7 }, () => [])
          }
          groupedByTime[timeKey][dayIndex].push(activity)
        }
      })
    })
    const timeSlots = Object.keys(groupedByTime).sort()

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Atividades da Semana
              </CardTitle>
              <CardDescription>
                Programação semanal de atividades
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCalendarView(true)}
              >
                <Grid3X3 className="w-4 h-4 mr-1" />
                Calendário
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Hoje
              </Button>
              <Button variant="outline" size="sm" onClick={previousWeek}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium">
                {weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - {weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
              <Button variant="outline" size="sm" onClick={nextWeek}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Horário</th>
                  {dayNames.map((day, index) => (
                    <th key={day} className="text-center p-3 font-medium">
                      <div className="flex flex-col">
                        <span>{day}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {weekDates[index].getDate().toString().padStart(2, '0')}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Nenhuma atividade agendada para esta semana
                    </td>
                  </tr>
                ) : (
                  timeSlots.map((time) => (
                    <tr key={time} className="border-b">
                      <td className="p-3 font-medium">{time}</td>
                      {Array.from({ length: 7 }).map((_, dayIndex) => (
                        <td key={dayIndex} className="p-3 text-sm">
                          {groupedByTime[time][dayIndex].length > 0 ? (
                            <div className="space-y-1">
                              {groupedByTime[time][dayIndex].map((activity: Activity) => (
                                <div key={activity.id} className="text-xs">
                                  <div className="font-medium">{activity.title}</div>
                                  <div className="text-muted-foreground">
                                    {activity.users.map(u => u.user.name).join(", ")}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Atividades da Semana
            </CardTitle>
            <CardDescription>
              Vista de calendário das atividades programadas
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCalendarView(false)}
            >
              <List className="w-4 h-4 mr-1" />
              Tabela
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={previousWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium">
              {weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - {weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
            <Button variant="outline" size="sm" onClick={nextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-auto"
          style={{ maxHeight: (VISIBLE_END_HOUR - VISIBLE_START_HOUR + 1) * ROW_HEIGHT }}
        >
          <div className="grid grid-cols-8 gap-0 min-w-[800px]">
            {/* Header com horários */}
            <div className="border-r border-border">
              <div className="h-12 border-b border-border flex items-center justify-center font-medium text-sm sticky top-0 z-20 bg-card">
                Horário
              </div>
              {ALL_HOURS.map((hour) => (
                <div key={hour} className="border-b border-border flex items-center justify-center text-xs text-muted-foreground" style={{ height: ROW_HEIGHT }}>
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>
            
            {/* Colunas dos dias */}
            {dayNames.map((day, dayIndex) => {
              const dayActivities = getActivitiesForDay(dayIndex)
              const { activityToColumn, totalColumns } = getActivityLayout(dayActivities)
              
              return (
                <div key={dayIndex} className="border-r border-border relative">
                  {/* Header do dia */}
                  <div className="h-12 border-b border-border flex flex-col items-center justify-center bg-card sticky top-0 z-20">
                    <span className="font-medium text-sm">{day}</span>
                    <span className="text-xs text-muted-foreground">
                      {weekDates[dayIndex].getDate().toString().padStart(2, '0')}
                    </span>
                  </div>
                  {/* Grade contínua 24h */}
                  <div className="relative" style={{ height: ALL_HOURS.length * ROW_HEIGHT }}>
                    {ALL_HOURS.map((hour) => (
                      <div key={hour} className="border-b border-border/30" style={{ height: ROW_HEIGHT }} />
                    ))}
                    {dayActivities.map((activity) => {
                      const time = getActivityTime(activity)
                      const columnIndex = activityToColumn.get(activity.id) ?? -1
                      
                      // If columnIndex is -1, activity doesn't overlap with others - use full width
                      const isOverlapping = columnIndex !== -1 && totalColumns > 1
                      
                      const columnWidth = isOverlapping 
                        ? `${100 / totalColumns}%` 
                        : 'calc(100% - 8px)'
                      
                      const leftPosition = isOverlapping 
                        ? `${(columnIndex * 100) / totalColumns}%` 
                        : '4px'
                      
                      return (
                        <div
                          key={activity.id}
                          className={`absolute rounded-md p-1 text-xs text-white shadow-sm hover:z-10 hover:shadow-lg transition-shadow ${getStatusColor(activity.status)}`}
                          style={{ 
                            top: getTimePosition(time), 
                            height: getDurationHeight(),
                            left: leftPosition,
                            width: columnWidth,
                            paddingLeft: isOverlapping ? '2px' : '4px',
                            paddingRight: isOverlapping ? '2px' : '4px'
                          }}
                          title={`${activity.title} - ${time}\n${activity.users.map(u => u.user.name).join(", ")}`}
                        >
                          <div className="font-medium truncate">{activity.title}</div>
                          {!isOverlapping || totalColumns <= 2 ? (
                            <div className="text-xs opacity-90 truncate">
                              {activity.users.map(u => u.user.name).join(", ")}
                            </div>
                          ) : null}
                          <div className="text-xs opacity-75">{time}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Legenda */}
        <div className="mt-4 flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Pendente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Concluída</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-500 rounded"></div>
            <span>Cancelada</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
