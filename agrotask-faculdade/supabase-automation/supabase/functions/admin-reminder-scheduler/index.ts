// Admin Reminder Scheduler - Main Entry Point

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createWaapiClient } from './waapi.ts';
import { shouldExecuteToday, filterRemindersForToday, hasReachedEndCriteria } from './recurrence.ts';
import {
  getAdminReminders,
  getAdminAccounts,
  checkExecutionLog,
  saveExecutionLog,
  markReminderAsCompleted,
} from './queries.ts';
import { AdminReminder, AdminAccount, AlertResult, SchedulerResponse } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Converte horário "HH:MM" para minutos
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  
  // Validação básica
  if (isNaN(hours) || isNaN(minutes)) {
    console.error(`⚠️ Invalid time format: "${time}"`);
    return 0;
  }
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    console.error(`⚠️ Time out of range: "${time}" (h:${hours}, m:${minutes})`);
    return 0;
  }
  
  return hours * 60 + minutes;
}

/**
 * Extrai horário "HH:MM" de um timestamp (UTC-3 Brasília)
 */
function extractTimeFromTimestamp(timestamp: string | null): string | null {
  if (!timestamp) return null;
  
  try {
    const date = new Date(timestamp);
    
    // Converter UTC para horário de Brasília (UTC-3)
    const brasiliaOffset = -3 * 60; // -3 horas em minutos
    const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    const brasiliaMinutes = utcMinutes + brasiliaOffset;
    
    // Ajustar se passar de meia-noite
    let adjustedMinutes = brasiliaMinutes;
    if (brasiliaMinutes < 0) {
      adjustedMinutes = brasiliaMinutes + (24 * 60);
    } else if (brasiliaMinutes >= (24 * 60)) {
      adjustedMinutes = brasiliaMinutes - (24 * 60);
    }
    
    const hours = Math.floor(adjustedMinutes / 60);
    const minutes = adjustedMinutes % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } catch (error) {
    console.error(`⚠️ Error extracting time from timestamp: "${timestamp}"`, error);
    return null;
  }
}

/**
 * Obtém horário atual em minutos (timezone Brasil/Brasília UTC-3)
 */
function getCurrentTimeInMinutes(): number {
  const now = new Date();
  // Converter UTC para horário de Brasília (UTC-3)
  const brasiliaOffset = -3 * 60; // -3 horas em minutos
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const brasiliaMinutes = utcMinutes + brasiliaOffset;
  
  // Ajustar se passar de meia-noite
  if (brasiliaMinutes < 0) {
    return brasiliaMinutes + (24 * 60);
  } else if (brasiliaMinutes >= (24 * 60)) {
    return brasiliaMinutes - (24 * 60);
  }
  
  return brasiliaMinutes;
}

/**
 * Substitui variáveis na mensagem pelo valor do admin
 * Suporta: {{NOME}}, {{ NOME}}, {{NOME }}, {{ NOME }} -> nome do admin
 */
function replaceMessageVariables(message: string, adminName: string): string {
  return message.replace(/\{\{\s*NOME\s*\}\}/g, adminName);
}

/**
 * Verifica se o horário do reminder está na janela de tempo atual
 * Janela: [currentMinutes, currentMinutes + 5)
 * Nota: Com cron a cada 5min, o checkExecutionLog previne duplicatas
 */
function isWithinTimeWindow(scheduledTime: string, currentMinutes: number): boolean {
  const scheduledMinutes = timeToMinutes(scheduledTime);
  const windowEnd = currentMinutes + 5;
  
  // Caso normal: janela não cruza meia-noite
  if (windowEnd < 1440) {
    return scheduledMinutes >= currentMinutes && scheduledMinutes < windowEnd;
  }
  
  // Caso especial: janela cruza meia-noite (ex: 23:58 até 00:03)
  const adjustedWindowEnd = windowEnd % 1440;
  return scheduledMinutes >= currentMinutes || scheduledMinutes < adjustedWindowEnd;
}

/**
 * Processa admin reminders
 */
async function processAdminReminders(
  supabase: any,
  waapiClient: any,
  currentMinutes: number,
  today: Date
): Promise<AlertResult> {
  const result: AlertResult = {
    executed: false,
    adminsNotified: 0,
    remindersProcessed: 0,
    errors: [],
  };

  try {
    console.log(`🔍 Checking admin reminders...`);

    // Buscar todos os reminders
    const allReminders = await getAdminReminders(supabase);
    
    // Filtrar apenas os que devem executar hoje
    const todayReminders = await filterRemindersForToday(allReminders, today, supabase);
    
    // Filtrar apenas os que estão na janela de tempo (próximos 5 minutos)
    // O checkExecutionLog previne duplicatas mesmo com múltiplos ciclos
    const remindersInWindow = todayReminders.filter(reminder => {
      const reminderTime = extractTimeFromTimestamp(reminder.scheduledDate);
      if (!reminderTime) return false;
      return isWithinTimeWindow(reminderTime, currentMinutes);
    });

    if (remindersInWindow.length === 0) {
      console.log('No reminders in current time window');
      return result;
    }

    console.log(`Found ${remindersInWindow.length} reminders in time window`);
    result.executed = true;

    // Buscar todos os admins
    const admins = await getAdminAccounts(supabase);
    
    if (admins.length === 0) {
      console.warn('No admin accounts found');
      return result;
    }

    // Para cada reminder na janela
    for (const reminder of remindersInWindow) {
      try {
        const reminderTime = extractTimeFromTimestamp(reminder.scheduledDate);
        console.log(`Processing reminder: ${reminder.title} (${reminderTime || 'sem horário'})`);
        
        // Enviar para TODOS os admins
        for (const admin of admins) {
          try {
            // Verificar se já enviou hoje
            const alreadySent = await checkExecutionLog(
              supabase,
              reminder.id,
              admin.id,
              today
            );

            if (alreadySent) {
              console.log(`Already sent reminder "${reminder.title}" to ${admin.name} today`);
              continue;
            }

            // Validar telefone
            if (!admin.phone) {
              console.warn(`Admin ${admin.name} has no phone number`);
              result.errors.push(`${admin.name}: sem telefone`);
              continue;
            }

            // Montar mensagem
            const reminderTimeForMessage = extractTimeFromTimestamp(reminder.scheduledDate);
            let message = reminder.messageString || 
              `🔔 Lembrete Admin

${reminder.title}
${reminder.description || ''}

Horário: ${reminderTimeForMessage || 'não definido'}

AgroTask`;

            // Substituir variáveis na mensagem
            message = replaceMessageVariables(message, admin.name);

            // Enviar via WhatsApp
            const sendResult = await waapiClient.sendMessage({
              phone: admin.phone,
              message,
            });

            if (sendResult.success) {
              console.log(`✅ Reminder sent to admin ${admin.name}`);
              result.adminsNotified++;

              // Salvar log
              await saveExecutionLog(supabase, {
                reminderId: reminder.id,
                adminId: admin.id,
                success: true,
              });
            } else {
              console.error(`❌ Failed to send to ${admin.name}: ${sendResult.error}`);
              result.errors.push(`${admin.name}: ${sendResult.error}`);

              // Salvar log de erro
              await saveExecutionLog(supabase, {
                reminderId: reminder.id,
                adminId: admin.id,
                success: false,
                errorMessage: sendResult.error,
              });
            }
          } catch (error: any) {
            console.error(`Error sending to admin ${admin.name}:`, error);
            result.errors.push(`${admin.name}: ${error.message}`);
          }
        }

        result.remindersProcessed++;

        // Verificar se o reminder deve ser marcado como completed
        // (único ou recorrente que atingiu critério de finalização)
        const shouldComplete = await hasReachedEndCriteria(reminder, today, supabase);
        
        if (shouldComplete) {
          console.log(`📋 Marking reminder ${reminder.title} as completed`);
          await markReminderAsCompleted(supabase, reminder.id);
        }
      } catch (error: any) {
        console.error(`Error processing reminder ${reminder.title}:`, error);
        result.errors.push(`${reminder.title}: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error('Error in processAdminReminders:', error);
    result.errors.push(`System error: ${error.message}`);
  }

  return result;
}

/**
 * Main handler
 */
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const waapiClient = createWaapiClient(Deno.env.toObject());

    const now = new Date();
    const currentMinutes = getCurrentTimeInMinutes();
    
    // Obter data no timezone do Brasil (para logging)
    const brasiliaDate = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // UTC-3
    
    console.log(`\n🚀 Admin Reminder Scheduler running at ${now.toISOString()} | Brasil: ${brasiliaDate.toISOString()} (${Math.floor(currentMinutes/60)}:${currentMinutes%60})`);

    // Processar reminders (usar now em UTC para comparação com scheduledDate do banco)
    const reminders = await processAdminReminders(supabase, waapiClient, currentMinutes, now);

    const response: SchedulerResponse = {
      success: true,
      timestamp: now.toISOString(),
      results: {
        remindersProcessed: reminders.remindersProcessed,
        adminsNotified: reminders.adminsNotified,
        errors: reminders.errors,
      },
    };

    console.log('✨ Scheduler completed:', JSON.stringify(response, null, 2));

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('💥 Fatal error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

