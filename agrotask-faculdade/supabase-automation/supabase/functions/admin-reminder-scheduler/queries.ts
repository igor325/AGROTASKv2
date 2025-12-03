// Database queries for admin reminder scheduler

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AdminReminder, AdminAccount } from './types.ts';

/**
 * Busca todos os AdminReminders ativos (pending)
 */
export async function getAdminReminders(
  supabase: SupabaseClient
): Promise<AdminReminder[]> {
  const { data, error } = await supabase
    .from('AdminReminder')
    .select('*')
    .eq('status', 'pending')
    .order('scheduledDate', { nullsFirst: false });

  if (error) {
    console.error('Error fetching admin reminders:', error);
    throw error;
  }

  return data || [];
}

/**
 * Busca todos os AdminAccounts
 */
export async function getAdminAccounts(
  supabase: SupabaseClient
): Promise<AdminAccount[]> {
  const { data, error } = await supabase
    .from('AdminAccount')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching admin accounts:', error);
    throw error;
  }

  return data || [];
}

/**
 * Verifica se já existe log de execução para hoje
 */
export async function checkExecutionLog(
  supabase: SupabaseClient,
  reminderId: string,
  adminId: string,
  date: Date
): Promise<boolean> {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Calcular próximo dia para comparação inclusiva
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];

  const { count, error } = await supabase
    .from('ActivityExecutionLog')
    .select('id', { count: 'exact', head: true })
    .eq('activityId', reminderId)
    .eq('userId', adminId)
    .eq('alertType', 'admin_reminder')
    .gte('executedAt', `${dateStr}T00:00:00`)
    .lt('executedAt', `${nextDayStr}T00:00:00`);

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
    reminderId: string;
    adminId: string;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const { error } = await supabase
    .from('ActivityExecutionLog')
    .insert({
      activityId: data.reminderId,
      userId: data.adminId,
      alertType: 'admin_reminder',
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
 * Marca um AdminReminder como completed
 */
export async function markReminderAsCompleted(
  supabase: SupabaseClient,
  reminderId: string
): Promise<void> {
  const { error } = await supabase
    .from('AdminReminder')
    .update({ status: 'completed' })
    .eq('id', reminderId);

  if (error) {
    console.error('Error marking reminder as completed:', error);
    throw error;
  }
}

