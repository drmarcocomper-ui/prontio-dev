-- ============================================================
-- PRONTIO - Tabelas do Prontuário (Supabase)
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. EVOLUÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS evolucao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES clinica(id),
  paciente_id UUID NOT NULL REFERENCES paciente(id),
  profissional_id UUID REFERENCES profissional(id),
  agenda_id UUID REFERENCES agenda_evento(id),

  texto TEXT NOT NULL,
  origem VARCHAR(50) DEFAULT 'PRONTUARIO',

  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ativo BOOLEAN DEFAULT TRUE
);

-- Índices para evoluções
CREATE INDEX IF NOT EXISTS idx_evolucao_paciente ON evolucao(paciente_id);
CREATE INDEX IF NOT EXISTS idx_evolucao_clinica ON evolucao(clinica_id);
CREATE INDEX IF NOT EXISTS idx_evolucao_criado ON evolucao(criado_em DESC);

-- RLS para evoluções
ALTER TABLE evolucao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evolucao_all" ON evolucao FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. RECEITAS
-- ============================================================
CREATE TABLE IF NOT EXISTS receita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES clinica(id),
  paciente_id UUID NOT NULL REFERENCES paciente(id),
  profissional_id UUID REFERENCES profissional(id),
  agenda_id UUID REFERENCES agenda_evento(id),

  data_receita DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_receita VARCHAR(50) DEFAULT 'COMUM',
  status VARCHAR(50) DEFAULT 'ATIVA',
  observacoes TEXT,

  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ativo BOOLEAN DEFAULT TRUE
);

-- Índices para receitas
CREATE INDEX IF NOT EXISTS idx_receita_paciente ON receita(paciente_id);
CREATE INDEX IF NOT EXISTS idx_receita_clinica ON receita(clinica_id);
CREATE INDEX IF NOT EXISTS idx_receita_criado ON receita(criado_em DESC);

-- RLS para receitas
ALTER TABLE receita ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receita_all" ON receita FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. ITENS DA RECEITA (Medicamentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS receita_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receita_id UUID NOT NULL REFERENCES receita(id) ON DELETE CASCADE,

  nome_medicamento VARCHAR(255) NOT NULL,
  posologia TEXT,
  via_administracao VARCHAR(50),
  quantidade VARCHAR(100),
  observacao TEXT,
  ordem INTEGER DEFAULT 0,

  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para itens
CREATE INDEX IF NOT EXISTS idx_receita_item_receita ON receita_item(receita_id);

-- RLS para itens
ALTER TABLE receita_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receita_item_all" ON receita_item FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. ANAMNESES
-- ============================================================
CREATE TABLE IF NOT EXISTS anamnese (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES clinica(id),
  paciente_id UUID NOT NULL REFERENCES paciente(id),
  profissional_id UUID REFERENCES profissional(id),

  nome_template VARCHAR(255) NOT NULL,
  dados JSONB DEFAULT '{}',

  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ativo BOOLEAN DEFAULT TRUE
);

-- Índices para anamneses
CREATE INDEX IF NOT EXISTS idx_anamnese_paciente ON anamnese(paciente_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_clinica ON anamnese(clinica_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_criado ON anamnese(criado_em DESC);

-- RLS para anamneses
ALTER TABLE anamnese ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anamnese_all" ON anamnese FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. MEDICAMENTOS (Catálogo para autocomplete)
-- ============================================================
CREATE TABLE IF NOT EXISTS medicamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID REFERENCES clinica(id), -- NULL = global

  nome VARCHAR(255) NOT NULL,
  posologia_padrao TEXT,
  via_padrao VARCHAR(50),
  quantidade_padrao VARCHAR(100),

  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca
CREATE INDEX IF NOT EXISTS idx_medicamento_nome ON medicamento(nome);
CREATE INDEX IF NOT EXISTS idx_medicamento_clinica ON medicamento(clinica_id);

-- RLS para medicamentos
ALTER TABLE medicamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medicamento_all" ON medicamento FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. CID (Catálogo para autocomplete)
-- ============================================================
CREATE TABLE IF NOT EXISTS cid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE
);

-- Índice para busca
CREATE INDEX IF NOT EXISTS idx_cid_codigo ON cid(codigo);
CREATE INDEX IF NOT EXISTS idx_cid_descricao ON cid USING gin(to_tsvector('portuguese', descricao));

-- RLS para CID
ALTER TABLE cid ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cid_select" ON cid FOR SELECT USING (true);

-- ============================================================
-- DONE!
-- ============================================================
