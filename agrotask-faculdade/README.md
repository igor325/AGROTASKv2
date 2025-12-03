# AgroTask - Projeto Faculdade

Este repositório contém uma seleção dos componentes principais do projeto AgroTask, incluindo:

- **agro-task**: Sistema completo de gestão de tarefas rurais com frontend (React/TypeScript) e backend (Supabase Edge Functions)
- **supabase-automation**: Sistema de automação para envio de alertas via WhatsApp

## 📋 Estrutura

```
agrotask-faculdade/
├── agro-task/              # Aplicação principal
│   ├── frontend/           # Frontend React + TypeScript
│   ├── backend-deprecated/ # Backend legado (referência)
│   └── supabase/           # Supabase Edge Functions
└── supabase-automation/    # Automação de alertas
    └── supabase/           # Edge Functions de agendamento
```

## 🚀 Início Rápido

### Frontend (agro-task)

```bash
cd agro-task/frontend
npm install
npm run dev
```

### Backend (Supabase Edge Functions)

Consulte os READMEs individuais de cada módulo:
- `agro-task/README.md` - Documentação completa do sistema principal
- `supabase-automation/README.md` - Documentação do sistema de automação

## 📚 Documentação

- [AgroTask Principal](./agro-task/README.md)
- [Supabase Automation](./supabase-automation/README.md)

## 🛠️ Tecnologias

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase Edge Functions (Deno)
- **Banco de Dados**: PostgreSQL (via Supabase)
- **Automação**: pg_cron, Supabase Edge Functions

## 📄 Licença

Projeto acadêmico - Faculdade

