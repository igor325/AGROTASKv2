// Database queries for activity scheduler

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Activity, ActivityWithUsers, User, WorkShift } from './types.ts';

/**
 * Busca todas as configurações de turno ordenadas por horário
 */
export async function getWorkShifts(
  supabase: SupabaseClient
): Promise<WorkShift[]> {
  const { data, error } = await supabase
    .from('WorkShift')
    .select('*')
    .order('time', { ascending: true });

  if (error) {
    console.error('Error fetching WorkShifts:', error);
    throw error;
  }

  return data || [];
}

/**
 * Busca todos os usuários ativos
 */
export async function getActiveUsers(
  supabase: SupabaseClient
): Promise<User[]> {
  const { data, error } = await supabase
    .from('User')
    .select('*')
    .eq('status', 'active')
    .order('name');

  if (error) {
    console.error('Error fetching active users:', error);
    throw error;
  }

  return data || [];
}

/**
 * Busca todas as atividades ativas (pending) que devem enviar notificação
 */
export async function getActiveActivities(
  supabase: SupabaseClient
): Promise<ActivityWithUsers[]> {
  const { data, error } = await supabase
    .from('Activity')
    .select(`
      *,
      ActivityUsers (
        activityId,
        userId,
        User (*)
      )
    `)
    .eq('status', 'pending')
    .eq('shouldSendNotification', true)
    .order('scheduledDate', { nullsFirst: false });

  if (error) {
    console.error('Error fetching activities:', error);
    throw error;
  }

  return data || [];
}

/**
 * Busca atividades de um usuário específico
 * Nota: Usada para avisos de turno - inclui TODAS as tarefas independente de shouldSendNotification
 */
export async function getUserActivities(
  supabase: SupabaseClient,
  userId: string
): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('Activity')
    .select(`
      *,
      ActivityUsers!inner (userId)
    `)
    .eq('ActivityUsers.userId', userId)
    .eq('status', 'pending')
    .order('scheduledDate', { nullsFirst: false });

  if (error) {
    console.error('Error fetching user activities:', error);
    throw error;
  }

  return data || [];
}

/**
 * Verifica se já existe log de execução para hoje
 * Ignora logs mais antigos que a última atualização da atividade (reprogramações)
 */
export async function checkExecutionLog(
  supabase: SupabaseClient,
  activityId: string,
  userId: string,
  alertType: string,
  date: Date
): Promise<boolean> {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Calcular próximo dia para comparação inclusiva
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];

  // Para alertas individuais, buscar updatedAt da atividade
  let activityUpdatedAt: string | null = null;
  if (alertType === 'individual' && activityId) {
    const { data: activity } = await supabase
      .from('Activity')
      .select('updatedAt')
      .eq('id', activityId)
      .single();
    
    activityUpdatedAt = activity?.updatedAt || null;
  }

  const query = supabase
    .from('ActivityExecutionLog')
    .select('id', { count: 'exact', head: true })
    .eq('userId', userId)
    .eq('alertType', alertType)
    .gte('executedAt', `${dateStr}T00:00:00`)
    .lt('executedAt', `${nextDayStr}T00:00:00`); // FIX: Usar próximo dia para pegar 23:59:59.999

  // Para alertas individuais, filtrar por activityId
  if (alertType === 'individual' && activityId) {
    query.eq('activityId', activityId);
    
    // ✅ Ignorar logs mais antigos que a última atualização
    if (activityUpdatedAt) {
      query.gte('executedAt', activityUpdatedAt);
    }
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error checking execution log:', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Salva registro de execução no log
 */
export async function saveExecutionLog(
  supabase: SupabaseClient,
  data: {
    activityId?: string;
    userId: string;
    alertType: string;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const { error } = await supabase
    .from('ActivityExecutionLog')
    .insert({
      activityId: data.activityId || null,
      userId: data.userId,
      alertType: data.alertType,
      success: data.success,
      errorMessage: data.errorMessage || null,
      metadata: data.metadata || {},
    });

  if (error) {
    console.error('Error saving execution log:', error);
    throw error;
  }
}

/**
 * Salva múltiplos logs de execução em batch
 */
export async function saveExecutionLogBatch(
  supabase: SupabaseClient,
  logs: Array<{
    activityId?: string;
    userId: string;
    alertType: string;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }>
): Promise<void> {
  if (logs.length === 0) return;

  const { error } = await supabase
    .from('ActivityExecutionLog')
    .insert(
      logs.map(log => ({
        activityId: log.activityId || null,
        userId: log.userId,
        alertType: log.alertType,
        success: log.success,
        errorMessage: log.errorMessage || null,
        metadata: log.metadata || {},
      }))
    );

  if (error) {
    console.error('Error saving execution logs batch:', error);
    throw error;
  }
}

/**
 * Marca uma atividade como completed
 */
export async function markActivityAsCompleted(
  supabase: SupabaseClient,
  activityId: string
): Promise<void> {
  const { error } = await supabase
    .from('Activity')
    .update({ status: 'completed' })
    .eq('id', activityId);

  if (error) {
    console.error('Error marking activity as completed:', error);
    throw error;
  }
}


