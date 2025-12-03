-- ============================================================================
-- FIX: Remove constraint do alertType para aceitar valores dinâmicos
-- ============================================================================
-- Problema: A tabela ActivityExecutionLog tinha uma constraint que limitava
--           os valores de alertType a apenas 'shift_start', 'shift_end', 'individual'
-- Solução:  Remover a constraint para aceitar qualquer string (títulos dinâmicos)
-- ============================================================================

-- Remove a constraint de check do alertType
ALTER TABLE "ActivityExecutionLog" 
DROP CONSTRAINT IF EXISTS "ActivityExecutionLog_alertType_check";

-- Adiciona um comentário explicativo no campo
COMMENT ON COLUMN "ActivityExecutionLog"."alertType" IS 
  'Tipo de alerta: pode ser shift_start, shift_end, individual, ou qualquer título de turno dinâmico (ex: "Horário pós almoço", "Início do turno")';

-- Verificação (opcional - executar após para confirmar)
-- SELECT 
--   conname AS constraint_name,
--   pg_get_constraintdef(oid) AS constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'public."ActivityExecutionLog"'::regclass
--   AND contype = 'c';

