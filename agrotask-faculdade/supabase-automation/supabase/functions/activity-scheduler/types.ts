// Type definitions for AgroTask Activity Scheduler

export interface Activity {
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
  messageTemplateId: string | null;
  customMessage: string | null;
  messageString: string | null;
  roles: string[];
  
  // Notificação
  shouldSendNotification: boolean;
}

export interface User {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: 'active' | 'inactive';
  tags: string[];
}

export interface ActivityUser {
  activityId: string;
  userId: string;
  User: User;
}

export interface ActivityWithUsers extends Activity {
  ActivityUsers: ActivityUser[];
}

export interface WorkShift {
  id: string;
  title: string;
  time: string; // "HH:MM"
  messageString: string | null;
  alertMinutesBefore: number;
  createdAt: string;
}

export interface ExecutionLog {
  id: string;
  activityId: string | null;
  userId: string;
  executedAt: string;
  alertType: string; // Pode ser 'individual' ou o title do WorkShift
  success: boolean;
  errorMessage: string | null;
  metadata: Record<string, any>;
}

export interface SchedulerResponse {
  success: boolean;
  timestamp: string;
  results: {
    shifts: { [shiftTitle: string]: AlertResult };
    individualAlerts: AlertResult;
  };
}

export interface AlertResult {
  executed: boolean;
  usersNotified: number;
  activitiesProcessed: number;
  errors: string[];
}


