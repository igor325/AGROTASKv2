import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface RepeatModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (repeatConfig: RepeatConfig) => void
}

export interface RepeatConfig {
  enabled: boolean
  every: number
  unit: 'day' | 'week' | 'year'
  weekdays: number[]
  endType: 'never' | 'date' | 'count'
  endDate?: string
  endCount?: number
}

export function RepeatModal({ open, onOpenChange, onSave }: RepeatModalProps) {
  const [every, setEvery] = useState(1)
  const [unit, setUnit] = useState<'day' | 'week' | 'year'>('week')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [endType, setEndType] = useState<'never' | 'date' | 'count'>('never')
  const [endDate, setEndDate] = useState('')
  const [endCount, setEndCount] = useState(1)

  const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  const toggleWeekday = (dayIndex: number) => {
    setWeekdays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    )
  }

  const handleSave = () => {
    onSave({
      enabled: true,
      every,
      unit,
      weekdays,
      endType,
      endDate: endType === 'date' ? endDate : undefined,
      endCount: endType === 'count' ? endCount : undefined
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Repetir tarefa</DialogTitle>
          <DialogDescription>
            Configure como esta tarefa deve se repetir
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Every */}
          <div className="space-y-2">
            <Label>A cada</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="99"
                value={every}
                onChange={(e) => setEvery(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <Select value={unit} onValueChange={(value: 'day' | 'week' | 'year') => setUnit(value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">dia(s)</SelectItem>
                  <SelectItem value="week">semana(s)</SelectItem>
                  <SelectItem value="year">ano(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* On (weekdays) - Only show for weekly */}
          {unit === 'week' && (
            <div className="space-y-2">
              <Label>Em</Label>
              <div className="flex gap-1">
                {weekdayLabels.map((day, index) => (
                  <Button
                    key={day}
                    variant={weekdays.includes(index) ? "default" : "outline"}
                    size="sm"
                    className="w-12 h-8 text-xs"
                    onClick={() => toggleWeekday(index)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Ends */}
          <div className="space-y-3">
            <Label>Termina</Label>
            <RadioGroup value={endType} onValueChange={(value: 'never' | 'date' | 'count') => setEndType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="never" id="never" />
                <Label htmlFor="never">Nunca</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="date" id="date" />
                <Label htmlFor="date">Em</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={endType !== 'date'}
                  className="flex-1"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="count" id="count" />
                <Label htmlFor="count">Após</Label>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={endCount}
                  onChange={(e) => setEndCount(parseInt(e.target.value) || 1)}
                  disabled={endType !== 'count'}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">vezes</span>
              </div>
            </RadioGroup>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}