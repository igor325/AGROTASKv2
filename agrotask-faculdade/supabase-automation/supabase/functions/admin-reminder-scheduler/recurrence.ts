// Recurrence calculation logic for admin reminders

import { AdminReminder } from './types.ts';

/**
 * Calcula a diferença em dias entre duas datas
 */
function diffDays(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor((utc1 - utc2) / msPerDay);
}

/**
 * Converte dia da semana do JavaScript (0=Dom) para nosso formato (0=Seg)
 */
function convertWeekday(jsDay: number): number {
  // JS: 0=Dom, 1=Seg, 2=Ter...6=Sab
  // Nosso: 0=Seg, 1=Ter...6=Dom
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Conta quantas vezes um reminder já foi executado (do log)
 */
export async function countExecutions(
  reminderId: string,
  supabaseClient: any
): Promise<number> {
  const { count, error } = await supabaseClient
    .from('ActivityExecutionLog')
    .select('*', { count: 'exact', head: true })
    .eq('activityId', reminderId)
    .eq('alertType', 'admin_reminder');

  if (error) {
    console.error('Error counting executions:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Determina se um reminder deve ser executado hoje
 */
export async function shouldExecuteToday(
  reminder: AdminReminder,
  today: Date,
  supabaseClient: any
): Promise<boolean> {
  // Reminder único
  if (!reminder.isRepeating) {
    if (!reminder.scheduledDate) return false;
    
    // Comparar apenas a parte da data (YYYY-MM-DD) em UTC
    const scheduledDate = new Date(reminder.scheduledDate);
    const scheduledDateStr = scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return scheduledDateStr === todayStr;
  }

  // Reminder recorrente
  if (!reminder.repeatStartDate) return false;

  const startDate = new Date(reminder.repeatStartDate);
  startDate.setHours(0, 0, 0, 0);
  
  const todayCopy = new Date(today);
  todayCopy.setHours(0, 0, 0, 0);

  // Ainda não começou
  if (todayCopy < startDate) return false;

  const diasDesdeInicio = diffDays(todayCopy, startDate);

  // Verificar tipo de repetição
  if (reminder.repeatUnit === 'day') {
    // Recorrência diária
    const intervalo = reminder.repeatInterval || 1;
    
    if (diasDesdeInicio % intervalo !== 0) return false;

  } else if (reminder.repeatUnit === 'week') {
    // Recorrência semanal
    
    // 1. Verificar dia da semana
    if (!reminder.repeatDaysOfWeek || reminder.repeatDaysOfWeek.length === 0) {
      console.warn(`Reminder ${reminder.id} is weekly but has no repeatDaysOfWeek`);
      return false;
    }

    const diaDaSemana = todayCopy.getDay(); // 0=Dom, 1=Seg...
    const diaAjustado = convertWeekday(diaDaSemana);

    if (!reminder.repeatDaysOfWeek.includes(diaAjustado)) return false;

    // 2. Verificar intervalo de semanas
    // Normalizar ambas as datas para o primeiro dia da semana (Segunda-feira)
    const startWeekStart = new Date(startDate);
    const startDayOfWeek = startWeekStart.getDay();
    const daysToMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    startWeekStart.setDate(startWeekStart.getDate() - daysToMonday);
    startWeekStart.setHours(0, 0, 0, 0);
    
    const todayWeekStart = new Date(todayCopy);
    const todayDayOfWeek = todayWeekStart.getDay();
    const todayDaysToMonday = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;
    todayWeekStart.setDate(todayWeekStart.getDate() - todayDaysToMonday);
    todayWeekStart.setHours(0, 0, 0, 0);
    
    // Calcular diferença em semanas desde a primeira segunda-feira
    const weekDiff = Math.floor((todayWeekStart.getTime() - startWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const intervalo = reminder.repeatInterval || 1;

    if (weekDiff % intervalo !== 0) return false;
  }

  // Verificar critério de término
  if (reminder.repeatEndType === 'date') {
    if (!reminder.repeatEndDate) return true;
    
    const endDate = new Date(reminder.repeatEndDate);
    endDate.setHours(23, 59, 59, 999);
    
    return todayCopy <= endDate;
  }

  if (reminder.repeatEndType === 'occurrences') {
    if (!reminder.repeatOccurrences) return true;
    
    const count = await countExecutions(reminder.id, supabaseClient);
    return count < reminder.repeatOccurrences;
  }

  // never
  return true;
}

/**
 * Filtra reminders que devem executar hoje
 */
export async function filterRemindersForToday(
  reminders: AdminReminder[],
  today: Date,
  supabaseClient: any
): Promise<AdminReminder[]> {
  const results = await Promise.all(
    reminders.map(async (reminder) => {
      const shouldExecute = await shouldExecuteToday(reminder, today, supabaseClient);
      return shouldExecute ? reminder : null;
    })
  );

  return results.filter((reminder): reminder is AdminReminder => reminder !== null);
}

/**
 * Verifica se um reminder atingiu o critério de finalização
 */
export async function hasReachedEndCriteria(
  reminder: AdminReminder,
  today: Date,
  supabaseClient: any
): Promise<boolean> {
  // Reminder único sempre finaliza após execução
  if (!reminder.isRepeating) {
    return true;
  }

  // Reminder recorrente - verificar critério de término
  if (reminder.repeatEndType === 'date') {
    if (!reminder.repeatEndDate) return false;
    
    const endDate = new Date(reminder.repeatEndDate);
    endDate.setHours(23, 59, 59, 999);
    
    const todayCopy = new Date(today);
    todayCopy.setHours(0, 0, 0, 0);
    
    // Se hoje é a última data ou passou, atingiu o critério
    return todayCopy >= endDate;
  }

  if (reminder.repeatEndType === 'occurrences') {
    if (!reminder.repeatOccurrences) return false;
    
    const count = await countExecutions(reminder.id, supabaseClient);
    // Se já executou o número de ocorrências, atingiu o critério
    return count >= reminder.repeatOccurrences;
  }

  // never - nunca atinge critério de finalização
  return false;
}

