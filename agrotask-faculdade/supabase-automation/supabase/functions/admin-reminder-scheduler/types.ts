// Type definitions for Admin Reminder Scheduler

export interface AdminReminder {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'completed' | 'canceled';
  createdAt: string;
  
  // Agendamento único (TIMESTAMP com data + hora)
  scheduledDate: string | null; // ISO 8601 timestamp
  
  // Recorrência
  isRepeating: boolean;
  repeatStartDate: string | null;
  repeatInterval: number;
  repeatUnit: 'day' | 'week';
  repeatDaysOfWeek: number[]; // 0=Seg, 1=Ter...6=Dom
  repeatEndType: 'never' | 'date' | 'occurrences';
  repeatEndDate: string | null;
  repeatOccurrences: number | null;
  
  // Mensagem
  messageString: string | null;
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface ExecutionLog {
  id: string;
  activityId: string | null;
  userId: string;
  executedAt: string;
  alertType: 'shift_start' | 'shift_end' | 'individual' | 'admin_reminder';
  success: boolean;
  errorMessage: string | null;
  metadata: Record<string, any>;
}

export interface SchedulerResponse {
  success: boolean;
  timestamp: string;
  results: {
    remindersProcessed: number;
    adminsNotified: number;
    errors: string[];
  };
}

export interface AlertResult {
  executed: boolean;
  adminsNotified: number;
  remindersProcessed: number;
  errors: string[];
}

