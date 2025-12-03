# Schema do Banco de Dados

Documentação simplificada das tabelas envolvidas no sistema de automação de atividades e lembretes admin.

## Tabelas Principais

### 1. Activity
Atividades/Tarefas do sistema

**Campos principais:**
- `id` (UUID, PK)
- `title` (TEXT) - Título da atividade
- `description` (TEXT) - Descrição detalhada
- `status` ('pending' | 'completed' | 'canceled')
- `scheduledDate` (TIMESTAMP) - Data e hora agendadas (atividades únicas)
- `messageString` (TEXT) - Mensagem personalizada para WhatsApp
- `roles` (TEXT[]) - Roles envolvidas

**Campos de recorrência:**
- `isRepeating` (BOOLEAN) - Se é recorrente
- `repeatUnit` ('day' | 'week') - Unidade de repetição
- `repeatInterval` (INTEGER) - Intervalo (ex: a cada 2 semanas)
- `repeatDaysOfWeek` (INTEGER[]) - Dias da semana [0=Seg...6=Dom]
- `repeatStartDate` (DATE) - Data de início da recorrência
- `repeatEndType` ('never' | 'date' | 'occurrences')
- `repeatEndDate` (DATE) - Data final (se repeatEndType = 'date')
- `repeatOccurrences` (INTEGER) - Número de ocorrências (se repeatEndType = 'occurrences')

---

### 2. User
Usuários do sistema AgroTask

**Campos principais:**
- `id` (UUID, PK)
- `name` (TEXT) - Nome do usuário
- `phone` (TEXT, UNIQUE) - Telefone para WhatsApp
- `email` (TEXT, UNIQUE) - Email
- `status` ('active' | 'inactive') - Status do usuário
- `tags` (TEXT[]) - Tags de categorização

**Nota:** Apenas usuários `active` recebem alertas.

---

### 3. ActivityUsers
Relacionamento N:N entre Activity e User

**Campos:**
- `activityId` (UUID, FK → Activity.id)
- `userId` (UUID, FK → User.id)

**Chave primária:** (activityId, userId)

**Uso:** Define quais usuários participam de cada atividade.

---

### 4. WorkShift
Configuração do turno de trabalho

**Campos:**
- `id` (UUID, PK)
- `startTime` (TEXT) - Horário início "HH:MM"
- `endTime` (TEXT) - Horário fim "HH:MM"
- `alertMinutesBefore` (INTEGER) - Minutos antes para alertar

**Exemplo:**
```sql
startTime: "08:00"
endTime: "18:00"
alertMinutesBefore: 10
-- Alerta início: 07:50
-- Alerta fim: 17:50
```

**Nota:** Sistema usa o registro mais recente.

---

### 5. AdminReminder
Lembretes para administradores do sistema

**Campos principais:**
- `id` (UUID, PK)
- `title` (TEXT) - Título do lembrete
- `description` (TEXT) - Descrição detalhada
- `status` ('pending' | 'completed' | 'canceled')
- `scheduledDate` (TIMESTAMP) - Data e hora agendadas (únicos)
- `messageString` (TEXT) - Mensagem personalizada para WhatsApp

**Campos de recorrência:**
- `isRepeating` (BOOLEAN) - Se é recorrente
- `repeatUnit` ('day' | 'week') - Unidade de repetição
- `repeatInterval` (INTEGER) - Intervalo (ex: a cada 3 dias)
- `repeatDaysOfWeek` (INTEGER[]) - Dias da semana [0=Seg...6=Dom]
- `repeatStartDate` (TIMESTAMP) - Data de início da recorrência
- `repeatEndType` ('never' | 'date' | 'occurrences')
- `repeatEndDate` (TIMESTAMP) - Data final
- `repeatOccurrences` (INTEGER) - Número de ocorrências

**Diferenças vs Activity:**
- Envia no horário exato (não 15min antes)
- Enviado para TODOS os AdminAccount automaticamente
- Sem alertas de turno

---

### 6. AdminAccount
Contas administrativas do sistema

**Campos:**
- `id` (UUID, PK)
- `name` (TEXT) - Nome do admin
- `email` (TEXT, UNIQUE) - Email
- `phone` (TEXT) - Telefone para WhatsApp
- `temporaryPassword` (TEXT) - Senha temporária
- `createdAt` (TIMESTAMP) - Data de criação

**Nota:** Todos os admins recebem todos os AdminReminders.

---

### 7. ActivityExecutionLog
Log de execução de alertas (Activity + AdminReminder)

**Campos:**
- `id` (UUID, PK)
- `activityId` (UUID, NULLABLE, FK → Activity.id) - NULL para alertas de turno
- `userId` (UUID, FK → User.id)
- `executedAt` (TIMESTAMP) - Momento da execução
- `alertType` ('shift_start' | 'shift_end' | 'individual' | 'admin_reminder')
- `success` (BOOLEAN) - Se foi enviado com sucesso
- `errorMessage` (TEXT) - Mensagem de erro (se falhou)
- `metadata` (JSONB) - Dados adicionais (ex: lista de activityIds para turno)

**Uso:**
- Prevenir duplicatas (verifica se já enviou hoje)
- Contar ocorrências (para repeatEndType = 'occurrences')
- Auditoria e debugging
- Suporta tanto Activity quanto AdminReminder (via activityId)

---

## Relacionamentos

```
User ←--→ ActivityUsers ←--→ Activity
                               ↓
                     ActivityExecutionLog
                               ↑
AdminAccount ←------ AdminReminder
```

**Nota:** AdminReminder não tem tabela de relacionamento, todos os admins recebem automaticamente.

---

## Enums

### UserStatus
- `active` - Usuário ativo, recebe alertas
- `inactive` - Usuário inativo, não recebe alertas

### ActivityStatus
- `pending` - Atividade ativa, gera alertas
- `completed` - Atividade concluída
- `canceled` - Atividade cancelada

### RepeatUnit
- `day` - Repetição diária
- `week` - Repetição semanal

### RepeatEndType
- `never` - Nunca termina
- `date` - Termina em data específica
- `occurrences` - Termina após N execuções

### AlertType
- `shift_start` - Alerta de início de turno (Activity)
- `shift_end` - Alerta de fim de turno (Activity)
- `individual` - Alerta individual de atividade (Activity)
- `admin_reminder` - Lembrete administrativo (AdminReminder)

---

## Exemplos de Dados

### Atividade Única
```sql
INSERT INTO "Activity" (
  title,
  "scheduledDate",
  "messageString",
  status,
  "isRepeating",
  roles
) VALUES (
  'Reunião com Cliente',
  '2025-11-05 14:00:00',
  'Lembrete: Reunião com cliente às 14h',
  'pending',
  false,
  '{}'
);
```

### Atividade Recorrente Semanal
```sql
INSERT INTO "Activity" (
  title,
  "scheduledDate",
  "messageString",
  status,
  "isRepeating",
  "repeatUnit",
  "repeatInterval",
  "repeatDaysOfWeek",
  "repeatStartDate",
  "repeatEndType",
  roles
) VALUES (
  'Verificar Estoque',
  '2025-11-01 09:00:00',
  'Hora de verificar o estoque!',
  'pending',
  true,
  'week',
  1,
  ARRAY[0, 2, 4],  -- Segunda, Quarta, Sexta
  '2025-11-01',
  'never',
  '{}'
);
```

### Associar Usuário à Atividade
```sql
INSERT INTO "ActivityUsers" ("activityId", "userId")
VALUES (
  'uuid-da-atividade',
  'uuid-do-usuario'
);
```

---

## Queries Úteis

### Ver atividades de um usuário
```sql
SELECT a.*
FROM "Activity" a
JOIN "ActivityUsers" au ON a.id = au."activityId"
WHERE au."userId" = 'uuid-do-usuario'
  AND a.status = 'pending'
ORDER BY a."scheduledDate";
```

### Ver alertas enviados hoje
```sql
SELECT 
  el.*,
  u.name,
  a.title
FROM "ActivityExecutionLog" el
JOIN "User" u ON el."userId" = u.id
LEFT JOIN "Activity" a ON el."activityId" = a.id
WHERE DATE(el."executedAt") = CURRENT_DATE
ORDER BY el."executedAt" DESC;
```

### Ver configuração do turno
```sql
SELECT * FROM "WorkShift"
ORDER BY "createdAt" DESC
LIMIT 1;
```

---

## Extensões Necessárias

- **uuid-ossp** - Geração de UUIDs
- **pg_cron** - Agendamento de jobs
- **pg_net** - HTTP requests

## Notas Importantes

1. **Timezone:** Sistema trabalha em UTC-3 (Brasília)
2. **Formato de timestamp:** ISO 8601 (YYYY-MM-DD HH:MM:SS)
3. **Dias da semana:** 0=Segunda, 6=Domingo
4. **Telefones:** Suporta múltiplos formatos brasileiros
5. **Duplicatas:** Sistema previne automaticamente via log

