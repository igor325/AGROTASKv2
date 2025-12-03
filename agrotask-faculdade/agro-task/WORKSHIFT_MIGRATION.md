# Migração WorkShift - Mudanças na Tabela

## Resumo
A tabela `WorkShift` foi refatorada para suportar múltiplos eventos pontuais de turno (ao invés de apenas início/fim). Cada linha agora representa um horário específico com sua própria mensagem.

## Schema Anterior
```sql
CREATE TABLE WorkShift (
  id UUID PRIMARY KEY,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  alertMinutesBefore INTEGER DEFAULT 0,
  startMessageString TEXT,
  endMessageString TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

## Schema Novo
```sql
CREATE TABLE WorkShift (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  time TEXT NOT NULL,
  messageString TEXT,
  alertMinutesBefore INTEGER DEFAULT 5,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

## Mudanças dos Campos

### Campos Removidos
- ❌ `startTime` → substituído por `time`
- ❌ `endTime` → substituído por `time`
- ❌ `startMessageString` → substituído por `messageString`
- ❌ `endMessageString` → substituído por `messageString`

### Campos Novos
- ✅ `title` (TEXT, obrigatório) - Nome do turno (ex: "Início do turno matinal", "Fim do turno")
- ✅ `time` (TEXT, obrigatório) - Horário único no formato HH:MM
- ✅ `messageString` (TEXT, nullable) - Mensagem com variáveis `{{NOME}}`, `{{TAREFAS}}`

### Campos Alterados
- ⚠️ `alertMinutesBefore` - Default alterado de `0` para `5`

## Migração de Dados
Cada registro antigo foi transformado em **2 registros novos**:

### Antes (1 registro)
```json
{
  "id": "abc-123",
  "startTime": "07:30",
  "endTime": "18:00",
  "alertMinutesBefore": 15,
  "startMessageString": "Bom dia {{NOME}}...",
  "endMessageString": "Turno encerrado {{NOME}}..."
}
```

### Depois (2 registros)
```json
[
  {
    "id": "novo-uuid-1",
    "title": "Início do turno",
    "time": "07:30",
    "messageString": "Bom dia {{NOME}}...",
    "alertMinutesBefore": 15
  },
  {
    "id": "novo-uuid-2",
    "title": "Fim do turno",
    "time": "18:00",
    "messageString": "Turno encerrado {{NOME}}...",
    "alertMinutesBefore": 15
  }
]
```

## API da Edge Function

### Endpoint: `/work-shifts`

**GET /work-shifts**
```json
// Retorna todos os turnos ordenados por time (crescente)
[
  {
    "id": "uuid",
    "title": "Início do turno",
    "time": "07:30",
    "messageString": "Bom dia {{NOME}}...",
    "alertMinutesBefore": 5,
    "createdAt": "2025-11-24T..."
  }
]
```

**POST /work-shifts**
```json
// Body
{
  "title": "Pausa para almoço",
  "time": "12:00",
  "messageString": "Hora do almoço, {{NOME}}!",
  "alertMinutesBefore": 10
}
```

**PUT /work-shifts/:id**
```json
// Body (todos os campos opcionais)
{
  "title": "Título atualizado",
  "time": "12:30",
  "messageString": "Nova mensagem",
  "alertMinutesBefore": 15
}
```

**DELETE /work-shifts/:id**
```
// Remove o turno
```

## Impacto no Microserviço

### O que você precisa adaptar:

1. **Buscar todos os turnos** (não apenas um único registro)
```typescript
const shifts = await fetch('/work-shifts').then(r => r.json())
// shifts agora é um array com N registros
```

2. **Iterar sobre cada turno** para agendar mensagens
```typescript
for (const shift of shifts) {
  const { time, alertMinutesBefore, messageString, title } = shift
  
  // Calcular horário do alerta
  const alertTime = calculateAlertTime(time, alertMinutesBefore)
  
  // Agendar disparo da mensagem
  scheduleMessage(alertTime, messageString)
}
```

3. **Processar variáveis da mensagem**
```typescript
const message = shift.messageString
  ?.replace(/\{\{NOME\}\}/g, userName)
  ?.replace(/\{\{TAREFAS\}\}/g, tasksList)
```

4. **Não assumir que existem apenas 2 turnos**
   - Antes: 1 registro com início/fim
   - Agora: N registros (início, fim, pausas, checkpoints, etc.)

## Variáveis Suportadas
- `{{NOME}}` - Nome do colaborador
- `{{TAREFAS}}` - Lista de tarefas atribuídas

## Validações da API
- `title` - obrigatório
- `time` - obrigatório, formato HH:MM (regex: `^([0-1][0-9]|2[0-3]):[0-5][0-9]$`)
- `messageString` - opcional
- `alertMinutesBefore` - opcional, default 5

