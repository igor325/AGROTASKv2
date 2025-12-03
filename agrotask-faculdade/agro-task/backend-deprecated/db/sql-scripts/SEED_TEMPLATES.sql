-- Seed default message templates
-- Run this SQL in your Supabase SQL editor to populate initial templates

INSERT INTO "MessageTemplate" (id, name, category, "templateBody", "createdAt")
VALUES 
  (
    gen_random_uuid(),
    'Template Padrão',
    'Geral',
    'Olá, {{NOME}}!

Segue a sua tarefa: {{TAREFA}}

Para ser realizada no dia {{DATA}} às {{HORARIO}}.

Atenciosamente,
Equipe AgroTask',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Template Urgente',
    'Urgente',
    '🚨 URGENTE - {{NOME}}!

Tarefa prioritária: {{TAREFA}}

Prazo: {{DATA}} às {{HORARIO}}

Por favor, confirme o recebimento desta mensagem.

Equipe AgroTask',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Template Lembrete',
    'Lembrete',
    'Oi {{NOME}}, tudo bem?

Só para lembrar da sua tarefa de hoje: {{TAREFA}}

Horário: {{HORARIO}}

Qualquer dúvida, pode chamar!

AgroTask',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Template Início de Turno',
    'Rotina',
    'Bom dia, {{NOME}}! 🌅

Suas tarefas para hoje:

{{TAREFA}}

Horário de início: {{HORARIO}}

Tenha um ótimo dia de trabalho!',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Template Fim de Turno',
    'Rotina',
    'Olá {{NOME}}! 🌇

Lembrete de encerramento de turno.

Tarefa: {{TAREFA}}

Horário: {{HORARIO}}

Não esqueça de registrar as atividades realizadas.',
    CURRENT_TIMESTAMP
  )
ON CONFLICT (id) DO NOTHING;

