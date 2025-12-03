// AgroTask Activity Scheduler - Main Entry Point

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createWaapiClient } from './waapi.ts';
import { shouldExecuteToday, filterActivitiesForToday, hasReachedEndCriteria } from './recurrence.ts';
import {
  getWorkShifts,
  getActiveUsers,
  getActiveActivities,
  getUserActivities,
  checkExecutionLog,
  saveExecutionLog,
  saveExecutionLogBatch,
  markActivityAsCompleted,
} from './queries.ts';
import { Activity, User, AlertResult, SchedulerResponse, WorkShift } from './types.ts';

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
    return 0; // Retorna 0 (meia-noite) como fallback
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
 * Formata lista de tarefas (título + descrição) em tópicos
 */
function formatTasksList(activities: Activity[]): string {
  return activities
    .map(a => {
      const descStr = a.description ? `\n  ${a.description}` : '';
      return `• ${a.title}${descStr}`;
    })
    .join('\n');
}

/**
 * Substitui variáveis na mensagem pelo valor do usuário
 * Suporta: 
 * - {{NOME}}, {{ NOME}}, {{NOME }}, {{ NOME }} -> nome do usuário
 * - {{TAREFAS}}, {{ TAREFAS}}, {{TAREFAS }}, {{ TAREFAS }} -> lista de tarefas formatada
 */
function replaceMessageVariables(
  message: string, 
  userName: string, 
  tasksList: string
): string {
  let result = message.replace(/\{\{\s*NOME\s*\}\}/g, userName);
  result = result.replace(/\{\{\s*TAREFAS\s*\}\}/g, tasksList);
  return result;
}

/**
 * Monta mensagem de shift usando o messageString do WorkShift
 */
function buildShiftMessage(
  userName: string, 
  activities: Activity[], 
  shift: WorkShift
): string {
  const tasksList = formatTasksList(activities);
  
  // Usar messageString do shift (obrigatório - se null, não chamamos esta função)
  return replaceMessageVariables(shift.messageString!, userName, tasksList);
}

/**
 * Processa um evento de turno (genérico para qualquer WorkShift)
 */
async function processShiftEvent(
  supabase: any,
  waapiClient: any,
  shift: WorkShift,
  currentMinutes: number,
  today: Date
): Promise<AlertResult> {
  const result: AlertResult = {
    executed: false,
    usersNotified: 0,
    activitiesProcessed: 0,
    errors: [],
  };

  try {
    // Calcular horário de alerta
    const shiftMinutes = timeToMinutes(shift.time);
    const alertMinutes = shiftMinutes - shift.alertMinutesBefore;

    console.log(`[SHIFT] Checking "${shift.title}" (time: ${shift.time}, alert: ${shift.alertMinutesBefore}min before, target: ${Math.floor(alertMinutes/60)}:${String(alertMinutes%60).padStart(2,'0')})`);

    // Verificar se é o horário correto
    if (currentMinutes !== alertMinutes) {
      return result;
    }

    // Skip se não houver mensagem configurada
    if (!shift.messageString) {
      console.log(`[SHIFT] ⚠️ "${shift.title}" has no message configured, skipping`);
      return result;
    }

    console.log(`[SHIFT] ⏰ Alert time for "${shift.title}"! Sending to users...`);
    result.executed = true;

    // Buscar usuários ativos
    const users = await getActiveUsers(supabase);
    console.log(`[SHIFT] Found ${users.length} active users to process`);

    for (const user of users) {
      try {
        // Verificar se já enviou hoje usando o title do shift como alertType
        const alreadySent = await checkExecutionLog(
          supabase,
          '',
          user.id,
          shift.title,
          today
        );

        if (alreadySent) {
          console.log(`[SHIFT] ⏭️ Already sent "${shift.title}" to ${user.name} today, skipping`);
          continue;
        }

        // Buscar atividades do usuário
        const userActivities = await getUserActivities(supabase, user.id);
        
        // Filtrar apenas as que executam hoje (sem filtro de horário - mostrar todas)
        const todayActivities = await filterActivitiesForToday(
          userActivities,
          today,
          supabase
        );

        // Só envia se tiver pelo menos 1 tarefa
        if (todayActivities.length === 0) {
          console.log(`[SHIFT] ⏭️ User ${user.name} has no tasks for today, skipping`);
          continue;
        }

        // Validar telefone
        if (!user.phone) {
          console.warn(`[SHIFT] ⚠️ User ${user.name} has no phone number`);
          result.errors.push(`${user.name}: sem telefone`);
          continue;
        }

        console.log(`[SHIFT] 📤 Sending "${shift.title}" to ${user.name} with ${todayActivities.length} tasks`);
        
        // Montar mensagem
        const message = buildShiftMessage(user.name, todayActivities, shift);

        // Enviar via WhatsApp
        const sendResult = await waapiClient.sendMessage({
          phone: user.phone,
          message,
        });

        if (sendResult.success) {
          console.log(`[SHIFT] ✅ "${shift.title}" alert sent to ${user.name} (${todayActivities.length} tasks)`);
          result.usersNotified++;
          result.activitiesProcessed += todayActivities.length;

          // Salvar log usando shift.title como alertType
          await saveExecutionLog(supabase, {
            userId: user.id,
            alertType: shift.title,
            success: true,
            metadata: {
              shiftId: shift.id,
              shiftTime: shift.time,
              activityIds: todayActivities.map(a => a.id),
              taskCount: todayActivities.length,
            },
          });
        } else {
          console.error(`[SHIFT] ❌ Failed to send "${shift.title}" to ${user.name}: ${sendResult.error}`);
          result.errors.push(`${user.name}: ${sendResult.error}`);

          // Salvar log de erro
          await saveExecutionLog(supabase, {
            userId: user.id,
            alertType: shift.title,
            success: false,
            errorMessage: sendResult.error,
          });
        }
      } catch (error: any) {
        console.error(`Error processing user ${user.name}:`, error);
        result.errors.push(`${user.name}: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error(`Error in processShiftEvent for "${shift.title}":`, error);
    result.errors.push(`System error: ${error.message}`);
  }

  return result;
}

/**
 * Check 3: Alertas Individuais (15 minutos antes)
 */
async function checkIndividualAlerts(
  supabase: any,
  waapiClient: any,
  currentMinutes: number,
  today: Date
): Promise<AlertResult> {
  const result: AlertResult = {
    executed: false,
    usersNotified: 0,
    activitiesProcessed: 0,
    errors: [],
  };

  try {
    // Calcular horário alvo (15 minutos à frente)
    const targetMinutes = currentMinutes + 15;
    const targetHour = Math.floor(targetMinutes / 60) % 24; // FIX: Garantir que hora não ultrapasse 23
    const targetMin = targetMinutes % 60;
    const targetTime = `${String(targetHour).padStart(2, '0')}:${String(targetMin).padStart(2, '0')}`;

    console.log(`🔍 Checking individual alerts for ${targetTime}...`);

    // Buscar todas as atividades ativas
    const allActivities = await getActiveActivities(supabase);

    // Filtrar apenas as que têm horário == targetTime
    const activitiesAtTargetTime = allActivities.filter(a => {
      const activityTime = extractTimeFromTimestamp(a.scheduledDate);
      return activityTime === targetTime;
    });

    if (activitiesAtTargetTime.length === 0) {
      return result;
    }

    console.log(`Found ${activitiesAtTargetTime.length} activities at ${targetTime}`);
    result.executed = true;

    for (const activity of activitiesAtTargetTime) {
      try {
        // Verificar se deve executar hoje
        const shouldExecute = await shouldExecuteToday(activity, today, supabase);
        
        if (!shouldExecute) {
          console.log(`Activity ${activity.title} should not execute today`);
          continue;
        }

        // Buscar usuários dessa atividade
        const users = activity.ActivityUsers || [];

        if (users.length === 0) {
          console.warn(`Activity ${activity.title} has no users`);
          continue;
        }

        for (const activityUser of users) {
          const user = activityUser.User;

          if (!user || user.status !== 'active') {
            continue;
          }

          try {
            // Verificar se já enviou hoje
            const alreadySent = await checkExecutionLog(
              supabase,
              activity.id,
              user.id,
              'individual',
              today
            );

            if (alreadySent) {
              console.log(`Already sent individual alert for ${activity.title} to ${user.name} today`);
              continue;
            }

            if (!user.phone) {
              console.warn(`User ${user.name} has no phone number`);
              result.errors.push(`${user.name} (${activity.title}): sem telefone`);
              continue;
            }

            // Usar messageString da atividade, ou fallback
            const activityTime = extractTimeFromTimestamp(activity.scheduledDate);
            let message = activity.messageString || 
              `Oi {{NOME}}! 

Lembrete: ${activity.title}
Horário: ${activityTime || 'não definido'}

AgroTask`;

            // Substituir variáveis na mensagem (para alertas individuais, não há lista de tarefas)
            message = replaceMessageVariables(message, user.name, '');

            // Log do número antes de formatar
            console.log(`📞 Raw phone from DB for ${user.name}: "${user.phone}"`);

            const sendResult = await waapiClient.sendMessage({
              phone: user.phone,
              message,
            });

            if (sendResult.success) {
              console.log(`✅ Individual alert sent: ${activity.title} → ${user.name}`);
              result.usersNotified++;

              await saveExecutionLog(supabase, {
                activityId: activity.id,
                userId: user.id,
                alertType: 'individual',
                success: true,
              });
            } else {
              console.error(`❌ Failed to send: ${sendResult.error}`);
              result.errors.push(`${user.name} (${activity.title}): ${sendResult.error}`);

              await saveExecutionLog(supabase, {
                activityId: activity.id,
                userId: user.id,
                alertType: 'individual',
                success: false,
                errorMessage: sendResult.error,
              });
            }
          } catch (error: any) {
            console.error(`Error sending to user ${user.name}:`, error);
            result.errors.push(`${user.name} (${activity.title}): ${error.message}`);
          }
        }

        result.activitiesProcessed++;

        // Verificar se a atividade deve ser marcada como completed
        // (única ou recorrente que atingiu critério de finalização)
        const shouldComplete = await hasReachedEndCriteria(activity, today, supabase);
        
        if (shouldComplete) {
          console.log(`📋 Marking activity ${activity.title} as completed`);
          await markActivityAsCompleted(supabase, activity.id);
        }
      } catch (error: any) {
        console.error(`Error processing activity ${activity.title}:`, error);
        result.errors.push(`${activity.title}: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error('Error in checkIndividualAlerts:', error);
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
    
    console.log(`\n🚀 Scheduler running at ${now.toISOString()} | Brasil: ${brasiliaDate.toISOString()} (${Math.floor(currentMinutes/60)}:${String(currentMinutes%60).padStart(2,'0')})`);

    // Buscar todos os shifts configurados
    const shifts = await getWorkShifts(supabase);
    console.log(`📋 Found ${shifts.length} shift(s) configured: ${shifts.map(s => `"${s.title}" (${s.time})`).join(', ') || 'none'}`);
    
    // Processar shifts e alertas individuais em paralelo
    console.log(`⚙️ Processing ${shifts.length} shift(s) and individual alerts in parallel...`);
    const [shiftResults, individualAlerts] = await Promise.all([
      Promise.all(
        shifts.map(shift => 
          processShiftEvent(supabase, waapiClient, shift, currentMinutes, now)
            .then(result => ({ title: shift.title, result }))
        )
      ),
      checkIndividualAlerts(supabase, waapiClient, currentMinutes, now),
    ]);

    // Converter array de resultados em objeto com título como chave
    const shiftsObject: { [shiftTitle: string]: AlertResult } = {};
    let totalShiftNotifications = 0;
    let executedShifts = 0;
    
    for (const { title, result } of shiftResults) {
      shiftsObject[title] = result;
      totalShiftNotifications += result.usersNotified;
      if (result.executed) {
        executedShifts++;
        console.log(`[SHIFT SUMMARY] "${title}": ${result.usersNotified} user(s) notified, ${result.activitiesProcessed} tasks, ${result.errors.length} error(s)`);
      }
    }

    console.log(`[INDIVIDUAL SUMMARY] Individual alerts: ${individualAlerts.usersNotified} user(s) notified, ${individualAlerts.activitiesProcessed} activities, ${individualAlerts.errors.length} error(s)`);
    
    console.log(`\n📊 EXECUTION SUMMARY:`);
    console.log(`   - Shifts executed: ${executedShifts}/${shifts.length}`);
    console.log(`   - Total shift notifications: ${totalShiftNotifications}`);
    console.log(`   - Individual alerts sent: ${individualAlerts.usersNotified}`);
    console.log(`   - Total users notified: ${totalShiftNotifications + individualAlerts.usersNotified}`);

    const response: SchedulerResponse = {
      success: true,
      timestamp: now.toISOString(),
      results: {
        shifts: shiftsObject,
        individualAlerts,
      },
    };

    console.log('\n✨ Scheduler completed successfully');

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


