# Backend (Fastify / Prisma)

API do AgroTask usando Fastify, Prisma e PostgreSQL.

## Requisitos
- Node.js 18+
- PostgreSQL

## Setup
1. Crie `backend/.env` com `DATABASE_URL` (ex.: `postgresql://user:pass@localhost:5432/agrotask`).
2. Instale dependências: `npm install` (gera Prisma Client via `postinstall`).
3. Rode o servidor: `npm run dev` (porta padrão `3000`).

## Scripts
- `npm run dev`: inicia API com watch.
- `npm start`: inicia API.
- `npm run migrate`: executa `prisma migrate dev`.
- `npm run generate`: `prisma generate` (rodado no postinstall).

## Prisma
- Client gerado em `node_modules/@prisma/client`.
- Migrações em `prisma/migrations/`.
- Esquema: `prisma/schema.prisma`.

## SQL Scripts Legados
- Scripts organizados em `db/sql-scripts/`.
- Use-os como referência histórica; preferir migrações Prisma atuais.

## Seed de Templates
- Script opcional para popular templates iniciais: `db/sql-scripts/SEED_TEMPLATES.sql`.
- Execução recomendada via editor SQL do Supabase (ou psql) em ambientes que precisem de dados de exemplo.
- Alternativa sugerida: migrar para `prisma/seed` para automatizar o seed via Node/Prisma.

## CORS
- Permitido para `http://localhost:5173`, `http://localhost:3000`, `http://localhost:8081`.

## Rotas Principais
- `GET /users`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id`
- `GET /activities` e relacionadas
- `GET /message-templates` e relacionadas
- `GET /admin-reminders` e relacionadas