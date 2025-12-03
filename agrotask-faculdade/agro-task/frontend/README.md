# Frontend (Vite / React / TypeScript)

Aplicação web do AgroTask construída com Vite, React e TypeScript. Interface para gerenciamento de usuários, atividades, lembretes e templates.

## Requisitos
- Node.js 18+

## Instalação
```bash
cd frontend
npm install
```

## Executar em desenvolvimento
```bash
npm run dev
```
- O Vite escolhe a porta disponível (ex.: `http://localhost:8082`).
- O backend padrão é `http://localhost:3000` caso `VITE_API_URL` não esteja definido.

## Variáveis de ambiente
- `VITE_API_URL`: URL base da API. Exemplo:
  - Desenvolvimento local: `http://localhost:3000`
  - Produção: `https://sua-api.com`
- Crie um arquivo `.env` na pasta `frontend`:
```
VITE_API_URL=http://localhost:3000
```

## Scripts
- `npm run dev`: inicia servidor de desenvolvimento.
- `npm run build`: gera build de produção em `dist/`.
- `npm run preview`: serve o build gerado localmente.

## Estrutura
- `src/components/`: componentes reutilizáveis (UI, layout, etc.).
- `src/pages/`: páginas da aplicação (Dashboard, Usuarios, Templates, etc.).
- `src/services/`: serviços de API (`api.ts`, `userService.ts`, etc.).
- `src/hooks/`: hooks customizados (`useUsers`, `useAuth`, `use-toast`).
- `src/lib/`: utilitários.

## Autenticação
- O login utiliza backend e Supabase; tokens são gerenciados pelo backend.
- Rotas protegidas usam `ProtectedRoute` e `AuthProvider`.

## Convenções de UI e Acessibilidade
- Seguimos o design system (shadcn/ui) com semântica e ARIA.
- Campos com validação exibem mensagens contextuais e possuem `aria-invalid` e `aria-describedby`.

## Integração com API
- Base configurada em `src/services/api.ts` via `VITE_API_URL`.
- Em desenvolvimento, se a env não estiver definida, a API padrão é `http://localhost:3000`.

## Deploy
- Defina `VITE_API_URL` apropriada para ambiente de produção.
- Execute `npm run build` e sirva `dist/` com seu servidor estático preferido.

## Problemas comuns
- CORS: garanta que o backend permita a origem da sua porta de desenvolvimento.
- API indisponível: configure `VITE_API_URL` corretamente e verifique a saúde do backend.

## Links úteis
- Backend: `../backend/README.md`
- Docs: `../docs/README.md`
