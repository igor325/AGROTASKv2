# AgroTask

Sistema de gestão de tarefas rurais para coordenação de equipes e atividades agrícolas. Monorepo com frontend (Vite/React/TypeScript) e backend (Supabase Edge Functions) para gestão de usuários, atividades, lembretes e templates de mensagens WhatsApp.

## 📋 Visão Geral

O AgroTask é uma aplicação completa para gerenciamento de atividades rurais que permite:
- Gerenciar usuários e equipes
- Criar e gerenciar tarefas (únicas ou repetitivas)
- Configurar lembretes administrativos
- Criar templates de mensagens WhatsApp
- Enviar notificações via WhatsApp
- Visualizar calendário semanal de atividades

## 🏗️ Estrutura do Projeto

```
agro-task/
├── frontend/              # Aplicação web (Vite + React + TypeScript)
├── backend-deprecated/    # Backend legado (Fastify + Prisma) - mantido para referência
├── supabase/              # Supabase Edge Functions (backend atual)
│   └── functions/         # Funções serverless por módulo
└── README.md             # Este arquivo
```

## 🚀 Início Rápido

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- O Vite escolhe a porta disponível (ex.: `http://localhost:8082`)
- Configure `VITE_API_URL` em `frontend/.env` se necessário

### Backend (Supabase Edge Functions)

O backend atual utiliza Supabase Edge Functions. Consulte a documentação do Supabase para deploy e configuração.

### Backend Deprecated

O código em `backend-deprecated/` é mantido apenas para referência histórica. Não deve ser usado em produção.

## ⚙️ Configuração

### Frontend

Crie `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
```

Para produção, defina a URL da sua API Supabase.

### Backend (Supabase)

Configure as variáveis de ambiente no Supabase Dashboard:
- `DATABASE_URL`: URL de conexão PostgreSQL
- Outras variáveis específicas das funções

## 📚 Documentação Técnica

### Schema do Banco de Dados

O projeto utiliza PostgreSQL com Prisma ORM. Principais modelos:

#### User
- Gerenciamento de usuários da equipe
- Campos: `name`, `phone`, `email`, `description`, `tags`, `status`

#### Activity
- Tarefas/atividades (únicas ou repetitivas)
- Suporta:
  - **Tarefas únicas**: `scheduledDate` (DateTime completo)
  - **Tarefas repetitivas**: `repeatStartDate`, `scheduledTime` (HH:MM), `repeatInterval`, `repeatUnit`, `repeatEndType`
- Campos de mensagem: `messageTemplate`, `customMessage`, `messageString`
- Flag `shouldSendNotification` controla disparo automático pelo microserviço
- Roles: `roles` (array de strings, renomeado de `tags`)

#### AdminReminder
- Lembretes administrativos
- Estrutura idêntica a `Activity` para consistência
- Suporta tarefas únicas e repetitivas
- Campo `messageString` para mensagem do lembrete

#### MessageTemplate
- Templates de mensagens WhatsApp
- Campos: `name`, `category`, `templateBody`
- Variáveis suportadas: `{{NOME}}`, `{{TAREFA}}`, `{{DATA}}`, `{{HORARIO}}`

#### WorkShift
- Eventos pontuais de turno (início, fim, checkpoints)
- Campos: `title`, `time`, `messageString`, `alertMinutesBefore` (default: 5)

### Atualizações Importantes do Schema

#### 1. Activity: Separação de Tarefas Únicas vs Repetitivas

**Problema anterior**: O campo `time` era ambíguo, usado para ambos os tipos.

**Solução**:
- **Tarefas únicas**: `scheduledDate` (DateTime completo)
- **Tarefas repetitivas**: `repeatStartDate` + `scheduledTime` (String HH:MM)

**Migração SQL**:
```sql
-- Adicionar novos campos
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "repeatStartDate" timestamp without time zone,
ADD COLUMN IF NOT EXISTS "scheduledDate" timestamp without time zone,
ADD COLUMN IF NOT EXISTS "scheduledTime" text;

-- Migrar dados existentes
UPDATE "Activity"
SET "scheduledDate" = "createdAt"::date + time::time
WHERE "isRepeating" = false AND time IS NOT NULL;

UPDATE "Activity"
SET "scheduledTime" = time::text,
    "repeatStartDate" = CURRENT_DATE
WHERE "isRepeating" = true AND time IS NOT NULL;
```

#### 2. Activity: Renomeação de `tags` para `roles`

Campo `tags` renomeado para `roles` para melhor semântica.

#### 3. AdminReminder: Estrutura Unificada com Activity

AdminReminder foi refatorado para ter a mesma estrutura de Activity:
- Suporta tarefas únicas (`scheduledDate`) e repetitivas (`repeatStartDate` + `scheduledTime`)
- Mesmos campos de repetição: `repeatInterval`, `repeatUnit`, `repeatEndType`, etc.
- Campo `messageString` adicionado para armazenar a mensagem do lembrete

#### 4. AdminReminder: Campos de Repetição Opcionais

Campos de repetição tornados opcionais para permitir lembretes não-repetitivos sem valores padrão.

### Funcionalidades Implementadas

#### Templates de Mensagens
- CRUD completo de templates
- Integração com atividades
- Proteção contra deleção de templates em uso
- Variáveis dinâmicas para personalização

#### Sistema de Repetição
- Repetição diária ou semanal
- Fim por data, ocorrências ou nunca
- Seleção de dias da semana para repetição semanal
- Validação no frontend e backend

#### Autenticação
- Integração com Supabase Auth
- Rotas protegidas
- Gerenciamento de tokens

## 🛠️ Tecnologias

### Frontend
- **Vite**: Build tool e dev server
- **React 18**: Framework UI
- **TypeScript**: Tipagem estática
- **shadcn/ui**: Componentes UI
- **Tailwind CSS**: Estilização
- **React Router**: Roteamento

### Backend
- **Supabase Edge Functions**: Funções serverless (Deno)
- **PostgreSQL**: Banco de dados
- **Prisma**: ORM (no backend-deprecated)

### Outras
- **Supabase**: Autenticação e banco de dados
- **WhatsApp API**: Integração para envio de mensagens

## 📁 Estrutura de Diretórios Detalhada

### Frontend (`frontend/`)
```
src/
├── components/        # Componentes reutilizáveis
│   ├── dashboard/    # Componentes do dashboard
│   ├── layout/       # Header, Sidebar
│   ├── task/         # Componentes de tarefas
│   └── ui/           # Componentes UI (shadcn)
├── pages/            # Páginas da aplicação
│   ├── Dashboard.tsx
│   ├── Tarefas.tsx
│   ├── Usuarios.tsx
│   ├── Templates.tsx
│   ├── Configuracoes.tsx
│   └── ...
├── services/         # Serviços de API
│   ├── api.ts
│   ├── activityService.ts
│   ├── userService.ts
│   └── ...
├── hooks/            # Hooks customizados
│   ├── useAuth.ts
│   ├── useUsers.ts
│   └── ...
└── lib/              # Utilitários
```

### Supabase Functions (`supabase/functions/`)
```
functions/
├── activities/       # CRUD de atividades
├── admin-reminders/  # CRUD de lembretes
├── auth/             # Autenticação
├── message-templates/# CRUD de templates
├── users/            # CRUD de usuários
├── waapi/            # Integração WhatsApp
└── work-shifts/      # CRUD de turnos
```

## 🔧 Scripts Disponíveis

### Frontend
```bash
npm run dev      # Servidor de desenvolvimento
npm run build    # Build de produção
npm run preview  # Preview do build
```

### Backend Deprecated
```bash
npm run dev      # API com watch
npm start        # API produção
npm run migrate  # Migrações Prisma
npm run generate # Gerar Prisma Client
```

## 🧪 Testes e Validação

### Checklist de Funcionalidades
- [x] CRUD de usuários
- [x] CRUD de atividades (únicas e repetitivas)
- [x] CRUD de templates de mensagens
- [x] CRUD de lembretes administrativos
- [x] Sistema de autenticação
- [x] Dashboard com calendário semanal
- [x] Integração WhatsApp (via WAAPI)

## 🚨 Problemas Comuns

### CORS
Garanta que o backend permita a origem da porta de desenvolvimento do frontend.

### API Indisponível
- Verifique `VITE_API_URL` no frontend
- Confirme que as Supabase Functions estão deployadas
- Verifique logs no Supabase Dashboard

### Banco de Dados
- Execute as migrações SQL necessárias no Supabase SQL Editor
- Verifique `DATABASE_URL` nas variáveis de ambiente

## 📝 Notas de Desenvolvimento

- O backend atual utiliza **Supabase Edge Functions** (Deno)
- O código em `backend-deprecated/` é mantido apenas para referência
- Migrações de schema devem ser executadas manualmente no Supabase SQL Editor
- Templates em uso por atividades não podem ser deletados (proteção no backend)

## 🔗 Links Úteis

- Frontend: `frontend/README.md`
- Backend Deprecated: `backend-deprecated/README.md`
- Supabase: https://supabase.com/docs

## 📄 Licença

[Adicione informações de licença se aplicável]
