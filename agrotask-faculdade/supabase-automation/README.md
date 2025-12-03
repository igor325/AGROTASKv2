# AgroTask Automation

Sistema de automação para envio de alertas de atividades e lembretes administrativos via WhatsApp usando Supabase Edge Functions e Waapi.

## 🚀 Setup Rápido

### 1. Pré-requisitos
- Projeto Supabase com pg_cron e pg_net habilitados
- Conta Waapi configurada
- Supabase CLI instalado

### 2. Edge Functions

O projeto possui 2 Edge Functions:
- **activity-scheduler**: Alertas de atividades (15min antes + turnos)
- **admin-reminder-scheduler**: Lembretes administrativos (horário exato)

### 3. Variáveis de Ambiente

Configure no Dashboard: **Project Settings → Edge Functions → Secrets**

```env
WAAPI_TOKEN=seu_token_aqui
WAAPI_INSTANCE_ID=sua_instancia_aqui
WAAPI_API_URL=https://waapi.app/api/v1
```

### 4. Deploy

```bash
# Deploy das Edge Functions
cd supabase/functions
supabase functions deploy activity-scheduler --project-ref SEU_PROJECT_ID
supabase functions deploy admin-reminder-scheduler --project-ref SEU_PROJECT_ID

# Criar/Verificar os cronjobs
# Execute no SQL Editor do Supabase:

-- Job 1: Activity Scheduler (alertas de atividades)
SELECT cron.schedule(
  'activity-scheduler-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/activity-scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Job 2: Admin Reminder Scheduler (lembretes admin)
SELECT cron.schedule(
  'admin-reminder-scheduler-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/admin-reminder-scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## 📋 Funcionalidades

### Activity Scheduler

#### 1. Alertas de Início de Turno
- **Quando:** `WorkShift.startTime - alertMinutesBefore`
- **O que:** Lista todas as tarefas do dia para cada usuário
- **Condição:** Só envia se usuário tiver ≥1 tarefa

#### 2. Alertas de Fim de Turno
- **Quando:** `WorkShift.endTime - alertMinutesBefore`
- **O que:** Lembrete de encerramento com lista de tarefas
- **Condição:** Só envia se usuário tiver ≥1 tarefa

#### 3. Alertas Individuais
- **Quando:** 15 minutos antes de cada atividade
- **O que:** Mensagem personalizada (`activity.messageString`)
- **Suporte:** Atividades únicas e recorrentes

### Admin Reminder Scheduler

#### 1. Lembretes Administrativos
- **Quando:** No horário exato (janela de detecção: 5 minutos)
- **Para quem:** TODOS os AdminAccount automaticamente
- **O que:** Mensagem personalizada (`messageString`)
- **Suporte:** Lembretes únicos e recorrentes
- **Diferença:** Sem alertas de turno, sem antecipação
- **Duplicatas:** Prevenidas pelo log de execução (só envia 1x por dia)

## 🔄 Recorrência

### Atividades Diárias
```sql
INSERT INTO "Activity" (
  title,
  "scheduledDate",
  "isRepeating",
  "repeatUnit",
  "repeatInterval",
  "repeatStartDate",
  "repeatEndType"
) VALUES (
  'Tarefa Diária',
  CURRENT_DATE + INTERVAL '14 hours',  -- Hoje às 14:00
  true,
  'day',
  1,  -- Todo dia
  CURRENT_DATE,
  'never'
);
```

### Atividades Semanais
```sql
INSERT INTO "Activity" (
  title,
  "scheduledDate",
  "isRepeating",
  "repeatUnit",
  "repeatInterval",
  "repeatDaysOfWeek",  -- 0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex, 5=Sab, 6=Dom
  "repeatStartDate",
  "repeatEndType"
) VALUES (
  'Tarefa Semanal',
  CURRENT_DATE + INTERVAL '9 hours',  -- Hoje às 09:00
  true,
  'week',
  2,  -- A cada 2 semanas
  ARRAY[0, 2, 4],  -- Segunda, Quarta, Sexta
  CURRENT_DATE,
  'never'
);
```

### Critérios de Término
- **never:** Executa indefinidamente
- **date:** Termina em `repeatEndDate`
- **occurrences:** Termina após `repeatOccurrences` execuções

## 📊 Monitoramento

### Ver Status do Cron
```sql
SELECT * FROM cron.job 
WHERE jobname = 'activity-scheduler-job';
```

### Últimas Execuções do Cron
```sql
SELECT 
  status,
  return_message,
  start_time,
  end_time - start_time as duration
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'activity-scheduler-job')
ORDER BY start_time DESC 
LIMIT 20;
```

### Últimos Alertas Enviados
```sql
SELECT 
  el."executedAt",
  el."alertType",
  el.success,
  u.name as usuario,
  a.title as atividade
FROM "ActivityExecutionLog" el
LEFT JOIN "User" u ON el."userId" = u.id
LEFT JOIN "Activity" a ON el."activityId" = a.id
ORDER BY el."executedAt" DESC
LIMIT 50;
```

### Estatísticas do Dia
```sql
SELECT 
  "alertType",
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as sucessos,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as falhas
FROM "ActivityExecutionLog"
WHERE DATE("executedAt") = CURRENT_DATE
GROUP BY "alertType";
```

### Atividades Programadas para Hoje
```sql
-- Únicas
SELECT * FROM "Activity"
WHERE status = 'pending'
  AND "isRepeating" = false
  AND DATE("scheduledDate") = CURRENT_DATE
ORDER BY "scheduledDate";

-- Recorrentes
SELECT * FROM "Activity"
WHERE status = 'pending'
  AND "isRepeating" = true
ORDER BY "scheduledDate";
```

## 🧪 Teste Local

### Chamar Edge Function Manualmente
```bash
curl -X POST https://SEU_PROJECT_REF.supabase.co/functions/v1/activity-scheduler \
  -H "Authorization: Bearer SEU_ANON_KEY"
```

### Criar Atividade de Teste
```sql
-- Atividade daqui a 10 minutos
INSERT INTO "Activity" (
  title, 
  "scheduledDate",
  "messageString",
  status,
  "isRepeating",
  roles
) VALUES (
  'Teste Automação',
  NOW() + INTERVAL '10 minutes',
  'Mensagem de teste!',
  'pending',
  false,
  '{}'
) RETURNING id;

-- Associar a um usuário
INSERT INTO "ActivityUsers" ("activityId", "userId")
VALUES (
  'ID_DA_ATIVIDADE_ACIMA',
  'ID_DE_UM_USUARIO'
);
```

## 🐛 Troubleshooting

### Alertas não chegam

1. **Verificar Cron:**
```sql
-- Ver se está rodando
SELECT * FROM cron.job WHERE jobname = 'activity-scheduler-job';

-- Ver erros
SELECT * FROM cron.job_run_details 
WHERE status = 'failed'
ORDER BY start_time DESC LIMIT 5;
```

2. **Verificar Edge Function:**
- Dashboard → Edge Functions → activity-scheduler → Logs

3. **Verificar Waapi:**
- Testar credenciais no dashboard Waapi
- Ver logs de envio

### Usuário não recebe

```sql
-- Verificar dados do usuário
SELECT id, name, phone, status FROM "User" WHERE id = 'USER_ID';

-- Verificar se já foi enviado
SELECT * FROM "ActivityExecutionLog"
WHERE "userId" = 'USER_ID'
  AND DATE("executedAt") = CURRENT_DATE;

-- Verificar se tem atividades
SELECT a.* 
FROM "Activity" a
JOIN "ActivityUsers" au ON a.id = au."activityId"
WHERE au."userId" = 'USER_ID' AND a.status = 'pending';
```

### Recorrência não funciona

```sql
-- Para semanais, verificar dias da semana
SELECT id, title, "repeatDaysOfWeek", "repeatInterval"
FROM "Activity"
WHERE "isRepeating" = true AND "repeatUnit" = 'week';

-- Verificar limite de ocorrências
SELECT 
  a.id,
  a.title,
  a."repeatOccurrences" as limite,
  COUNT(el.id) as executadas
FROM "Activity" a
LEFT JOIN "ActivityExecutionLog" el ON a.id = el."activityId"
WHERE a."isRepeating" = true AND a."repeatEndType" = 'occurrences'
GROUP BY a.id;
```

## 🔧 Manutenção

### Pausar Sistema
```sql
SELECT cron.unschedule('activity-scheduler-job');
```

### Reativar Sistema
```sql
SELECT cron.schedule(
  'activity-scheduler-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/activity-scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### Limpar Logs Antigos
```sql
DELETE FROM "ActivityExecutionLog"
WHERE "executedAt" < NOW() - INTERVAL '30 days';
```

## 📁 Estrutura do Projeto

```
/
├── README.md                       # Este arquivo
├── DATABASE.md                     # Schema simplificado
├── .gitignore
└── supabase/
    └── functions/
        ├── activity-scheduler/      # Alertas de atividades
        │   ├── index.ts
        │   ├── types.ts
        │   ├── queries.ts
        │   ├── recurrence.ts
        │   ├── waapi.ts
        │   └── deno.json
        └── admin-reminder-scheduler/ # Lembretes admin
            ├── index.ts
            ├── types.ts
            ├── queries.ts
            ├── recurrence.ts
            ├── waapi.ts
            └── deno.json
```

## ⚙️ Detalhes Técnicos

### Timezone
- Sistema configurado para **UTC-3 (Brasília)**
- Conversão automática de horários

### Formatação de Telefone
- Suporta múltiplos formatos brasileiros
- Remove 9º dígito automaticamente quando necessário
- Formato final: `556196142188@c.us` (12 dígitos)

### Prevenção de Duplicatas
- Log de execução por usuário/atividade/dia
- Verificação antes de enviar cada alerta

### Performance
- Execuções em paralelo (shift start, shift end, individual alerts)
- Queries otimizadas com indexes

## 📄 Licença

Projeto interno AgroTask
