// Recurrence calculation logic for activities

import { Activity } from './types.ts';

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
 * Conta quantas vezes uma atividade já foi executada (do log)
 */
export async function countExecutions(
  activityId: string,
  supabaseClient: any
): Promise<number> {
  const { count, error } = await supabaseClient
    .from('ActivityExecutionLog')
    .select('*', { count: 'exact', head: true })
    .eq('activityId', activityId)
    .eq('alertType', 'individual');

  if (error) {
    console.error('Error counting executions:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Determina se uma atividade deve ser executada hoje
 */
export async function shouldExecuteToday(
  activity: Activity,
  today: Date,
  supabaseClient: any
): Promise<boolean> {
  // Atividade única
  if (!activity.isRepeating) {
    if (!activity.scheduledDate) return false;
    
    // Comparar apenas a parte da data (YYYY-MM-DD) em UTC
    const scheduledDate = new Date(activity.scheduledDate);
    const scheduledDateStr = scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return scheduledDateStr === todayStr;
  }

  // Atividade recorrente
  if (!activity.repeatStartDate) return false;

  const startDate = new Date(activity.repeatStartDate);
  startDate.setHours(0, 0, 0, 0);
  
  const todayCopy = new Date(today);
  todayCopy.setHours(0, 0, 0, 0);

  // Ainda não começou
  if (todayCopy < startDate) return false;

  const diasDesdeInicio = diffDays(todayCopy, startDate);

  // Verificar tipo de repetição
  if (activity.repeatUnit === 'day') {
    // Recorrência diária
    const intervalo = activity.repeatInterval || 1;
    
    if (diasDesdeInicio % intervalo !== 0) return false;

  } else if (activity.repeatUnit === 'week') {
    // Recorrência semanal
    
    // 1. Verificar dia da semana
    if (!activity.repeatDaysOfWeek || activity.repeatDaysOfWeek.length === 0) {
      console.warn(`Activity ${activity.id} is weekly but has no repeatDaysOfWeek`);
      return false;
    }

    const diaDaSemana = todayCopy.getDay(); // 0=Dom, 1=Seg...
    const diaAjustado = convertWeekday(diaDaSemana);

    if (!activity.repeatDaysOfWeek.includes(diaAjustado)) return false;

    // 2. Verificar intervalo de semanas
    // FIX: Precisa calcular semanas considerando o início da semana, não do dia exato
    // Normalizar ambas as datas para o primeiro dia da semana (Segunda-feira)
    const startWeekStart = new Date(startDate);
    const startDayOfWeek = startWeekStart.getDay();
    const daysToMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Quantos dias até segunda
    startWeekStart.setDate(startWeekStart.getDate() - daysToMonday);
    startWeekStart.setHours(0, 0, 0, 0);
    
    const todayWeekStart = new Date(todayCopy);
    const todayDayOfWeek = todayWeekStart.getDay();
    const todayDaysToMonday = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;
    todayWeekStart.setDate(todayWeekStart.getDate() - todayDaysToMonday);
    todayWeekStart.setHours(0, 0, 0, 0);
    
    // Calcular diferença em semanas desde a primeira segunda-feira
    const weekDiff = Math.floor((todayWeekStart.getTime() - startWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const intervalo = activity.repeatInterval || 1;

    if (weekDiff % intervalo !== 0) return false;
  }

  // Verificar critério de término
  if (activity.repeatEndType === 'date') {
    if (!activity.repeatEndDate) return true;
    
    const endDate = new Date(activity.repeatEndDate);
    endDate.setHours(23, 59, 59, 999);
    
    return todayCopy <= endDate;
  }

  if (activity.repeatEndType === 'occurrences') {
    if (!activity.repeatOccurrences) return true;
    
    const count = await countExecutions(activity.id, supabaseClient);
    return count < activity.repeatOccurrences;
  }

  // never
  return true;
}

/**
 * Filtra atividades que devem executar hoje
 */
export async function filterActivitiesForToday(
  activities: Activity[],
  today: Date,
  supabaseClient: any
): Promise<Activity[]> {
  const results = await Promise.all(
    activities.map(async (activity) => {
      const shouldExecute = await shouldExecuteToday(activity, today, supabaseClient);
      return shouldExecute ? activity : null;
    })
  );

  return results.filter((activity): activity is Activity => activity !== null);
}

/**
 * Verifica se uma atividade recorrente atingiu o critério de finalização
 */
export async function hasReachedEndCriteria(
  activity: Activity,
  today: Date,
  supabaseClient: any
): Promise<boolean> {
  // Atividade única sempre finaliza após execução
  if (!activity.isRepeating) {
    return true;
  }

  // Atividade recorrente - verificar critério de término
  if (activity.repeatEndType === 'date') {
    if (!activity.repeatEndDate) return false;
    
    const endDate = new Date(activity.repeatEndDate);
    endDate.setHours(23, 59, 59, 999);
    
    const todayCopy = new Date(today);
    todayCopy.setHours(0, 0, 0, 0);
    
    // Se hoje é a última data ou passou, atingiu o critério
    return todayCopy >= endDate;
  }

  if (activity.repeatEndType === 'occurrences') {
    if (!activity.repeatOccurrences) return false;
    
    const count = await countExecutions(activity.id, supabaseClient);
    // Se já executou o número de ocorrências, atingiu o critério
    return count >= activity.repeatOccurrences;
  }

  // never - nunca atinge critério de finalização
  return false;
}


