-- ============================================================
-- PRONTIO - Schema PostgreSQL para Supabase
-- Migração de Google Sheets para banco profissional
-- ============================================================

-- Habilita extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TIPOS ENUM
-- ============================================================

CREATE TYPE perfil_usuario AS ENUM ('admin', 'profissional', 'secretaria');
CREATE TYPE tipo_profissional AS ENUM ('MEDICO', 'NUTRICIONISTA', 'PSICOLOGO', 'FISIOTERAPEUTA', 'OUTRO');
CREATE TYPE status_paciente AS ENUM ('ATIVO', 'INATIVO', 'OBITO');
CREATE TYPE sexo_tipo AS ENUM ('M', 'F', 'O', 'NI');
CREATE TYPE tipo_evento AS ENUM ('CONSULTA', 'RETORNO', 'PROCEDIMENTO', 'BLOQUEIO', 'OUTRO');
CREATE TYPE status_agenda AS ENUM ('MARCADO', 'CONFIRMADO', 'AGUARDANDO', 'EM_ATENDIMENTO', 'ATENDIDO', 'FALTOU', 'CANCELADO', 'REMARCADO');
CREATE TYPE origem_agenda AS ENUM ('RECEPCAO', 'MEDICO', 'SISTEMA');
CREATE TYPE dia_semana AS ENUM ('SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM');
CREATE TYPE tipo_excecao AS ENUM ('BLOQUEIO_TOTAL', 'HORARIO_ESPECIAL');
CREATE TYPE status_receita AS ENUM ('RASCUNHO', 'FINAL');

-- ============================================================
-- TABELA: CLINICA (raiz do sistema)
-- ============================================================

CREATE TABLE clinica (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(200) NOT NULL,
    endereco VARCHAR(500),
    telefone VARCHAR(50),
    email VARCHAR(120),
    logo_url VARCHAR(500),
    timezone VARCHAR(60) DEFAULT 'America/Sao_Paulo',
    templates_documentos JSONB DEFAULT '{}',
    parametros_globais JSONB DEFAULT '{}',
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_clinica_ativo ON clinica(ativo);

-- ============================================================
-- TABELA: PROFISSIONAL
-- ============================================================

CREATE TABLE profissional (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    tipo tipo_profissional NOT NULL DEFAULT 'MEDICO',
    nome_completo VARCHAR(200) NOT NULL,
    documento_registro VARCHAR(40),
    especialidade VARCHAR(120),
    assinatura_digital_base64 TEXT,
    cor_interface VARCHAR(30) DEFAULT '#3B82F6',
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_profissional_clinica ON profissional(clinica_id);
CREATE INDEX idx_profissional_ativo ON profissional(ativo);

-- ============================================================
-- TABELA: USUARIO
-- ============================================================

CREATE TABLE usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    profissional_id UUID REFERENCES profissional(id) ON DELETE SET NULL,
    auth_user_id UUID UNIQUE, -- Link com Supabase Auth
    nome_completo VARCHAR(200) NOT NULL,
    login VARCHAR(120) NOT NULL,
    email VARCHAR(120),
    perfil perfil_usuario NOT NULL DEFAULT 'secretaria',
    permissoes_customizadas JSONB DEFAULT '{}',
    ativo BOOLEAN DEFAULT true,
    ultimo_login_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(clinica_id, login)
);

-- Índices
CREATE INDEX idx_usuario_clinica ON usuario(clinica_id);
CREATE INDEX idx_usuario_auth ON usuario(auth_user_id);
CREATE INDEX idx_usuario_login ON usuario(login);

-- ============================================================
-- TABELA: PACIENTE
-- ============================================================

CREATE TABLE paciente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,

    -- Dados pessoais
    nome_completo VARCHAR(200) NOT NULL,
    nome_social VARCHAR(200),
    sexo sexo_tipo DEFAULT 'NI',
    data_nascimento DATE,
    estado_civil VARCHAR(50),
    profissao VARCHAR(100),

    -- Documentos
    cpf VARCHAR(14),
    rg VARCHAR(20),
    rg_orgao_emissor VARCHAR(20),

    -- Contato
    telefone_principal VARCHAR(30),
    telefone_secundario VARCHAR(30),
    email VARCHAR(120),

    -- Endereço
    cep VARCHAR(10),
    logradouro VARCHAR(200),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),

    -- Saúde
    plano_saude VARCHAR(100),
    numero_carteirinha VARCHAR(50),
    tipo_sanguineo VARCHAR(5),
    alergias TEXT,
    observacoes_clinicas TEXT,
    observacoes_administrativas TEXT,

    -- Controle
    status status_paciente DEFAULT 'ATIVO',
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_paciente_clinica ON paciente(clinica_id);
CREATE INDEX idx_paciente_nome ON paciente(nome_completo);
CREATE INDEX idx_paciente_cpf ON paciente(cpf);
CREATE INDEX idx_paciente_telefone ON paciente(telefone_principal);
CREATE INDEX idx_paciente_ativo ON paciente(ativo);
CREATE INDEX idx_paciente_criado ON paciente(criado_em DESC);

-- ============================================================
-- TABELA: AGENDA_EVENTO (agendamentos)
-- ============================================================

CREATE TABLE agenda_evento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES profissional(id) ON DELETE CASCADE,
    paciente_id UUID REFERENCES paciente(id) ON DELETE SET NULL,

    -- Horário
    inicio_datetime TIMESTAMPTZ NOT NULL,
    fim_datetime TIMESTAMPTZ NOT NULL,

    -- Detalhes
    titulo VARCHAR(200),
    notas TEXT,
    tipo tipo_evento DEFAULT 'CONSULTA',
    status status_agenda DEFAULT 'MARCADO',
    origem origem_agenda DEFAULT 'RECEPCAO',
    permite_encaixe BOOLEAN DEFAULT false,

    -- Cancelamento
    cancelado_em TIMESTAMPTZ,
    cancelado_motivo VARCHAR(500),

    -- Controle
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_agenda_clinica ON agenda_evento(clinica_id);
CREATE INDEX idx_agenda_profissional ON agenda_evento(profissional_id);
CREATE INDEX idx_agenda_paciente ON agenda_evento(paciente_id);
CREATE INDEX idx_agenda_inicio ON agenda_evento(inicio_datetime);
CREATE INDEX idx_agenda_data ON agenda_evento(DATE(inicio_datetime));
CREATE INDEX idx_agenda_status ON agenda_evento(status);
CREATE INDEX idx_agenda_ativo ON agenda_evento(ativo);

-- Índice composto para busca por período (otimização P0)
CREATE INDEX idx_agenda_periodo ON agenda_evento(profissional_id, inicio_datetime, ativo);

-- ============================================================
-- TABELA: ATENDIMENTO (fila de atendimento do dia)
-- ============================================================

CREATE TABLE atendimento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    agenda_evento_id UUID REFERENCES agenda_evento(id) ON DELETE SET NULL,
    profissional_id UUID NOT NULL REFERENCES profissional(id) ON DELETE CASCADE,
    paciente_id UUID REFERENCES paciente(id) ON DELETE SET NULL,

    -- Controle
    data_ref DATE NOT NULL,
    ordem INTEGER,
    sala VARCHAR(60),
    observacoes TEXT,

    -- Status e marcos temporais
    status status_agenda DEFAULT 'MARCADO',
    confirmado_em TIMESTAMPTZ,
    chegada_em TIMESTAMPTZ,
    chamado_em TIMESTAMPTZ,
    inicio_atendimento_em TIMESTAMPTZ,
    atendido_em TIMESTAMPTZ,
    faltou_em TIMESTAMPTZ,
    cancelado_em TIMESTAMPTZ,
    remarcado_em TIMESTAMPTZ,

    -- Controle
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_atendimento_clinica ON atendimento(clinica_id);
CREATE INDEX idx_atendimento_data ON atendimento(data_ref);
CREATE INDEX idx_atendimento_profissional ON atendimento(profissional_id, data_ref);
CREATE INDEX idx_atendimento_status ON atendimento(status);

-- ============================================================
-- TABELA: DISPONIBILIDADE (horários regulares)
-- ============================================================

CREATE TABLE agenda_disponibilidade (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES profissional(id) ON DELETE CASCADE,

    dia_semana dia_semana NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    intervalo_minutos INTEGER DEFAULT 30,
    local_sala VARCHAR(120),

    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_disponibilidade_profissional ON agenda_disponibilidade(profissional_id);

-- ============================================================
-- TABELA: EXCEÇÃO (bloqueios e horários especiais)
-- ============================================================

CREATE TABLE agenda_excecao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES profissional(id) ON DELETE CASCADE,

    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    tipo tipo_excecao NOT NULL,
    blocos_especiais JSONB,
    motivo VARCHAR(500),

    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_excecao_profissional ON agenda_excecao(profissional_id);
CREATE INDEX idx_excecao_data ON agenda_excecao(data_inicio, data_fim);

-- ============================================================
-- TABELA: EVOLUÇÃO (prontuário)
-- ============================================================

CREATE TABLE evolucao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES paciente(id) ON DELETE CASCADE,
    profissional_id UUID REFERENCES profissional(id) ON DELETE SET NULL,
    agenda_evento_id UUID REFERENCES agenda_evento(id) ON DELETE SET NULL,

    data_evolucao DATE NOT NULL,
    tipo VARCHAR(100),
    texto TEXT NOT NULL,

    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_evolucao_paciente ON evolucao(paciente_id);
CREATE INDEX idx_evolucao_data ON evolucao(data_evolucao DESC);
CREATE INDEX idx_evolucao_profissional ON evolucao(profissional_id);

-- ============================================================
-- TABELA: MEDICAMENTO (catálogo)
-- ============================================================

CREATE TABLE medicamento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,

    nome VARCHAR(200) NOT NULL,
    posologia VARCHAR(200),
    via_administracao VARCHAR(50),
    quantidade VARCHAR(50),
    tipo_receita VARCHAR(50),
    favorito BOOLEAN DEFAULT false,

    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_medicamento_clinica ON medicamento(clinica_id);
CREATE INDEX idx_medicamento_nome ON medicamento(nome);
CREATE INDEX idx_medicamento_favorito ON medicamento(favorito);

-- ============================================================
-- TABELA: RECEITA
-- ============================================================

CREATE TABLE receita (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES paciente(id) ON DELETE CASCADE,
    profissional_id UUID REFERENCES profissional(id) ON DELETE SET NULL,

    data_receita DATE NOT NULL,
    texto_medicamentos TEXT,
    observacoes TEXT,
    status status_receita DEFAULT 'RASCUNHO',
    itens JSONB DEFAULT '[]',

    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_receita_paciente ON receita(paciente_id);
CREATE INDEX idx_receita_data ON receita(data_receita DESC);
CREATE INDEX idx_receita_profissional ON receita(profissional_id);

-- ============================================================
-- TABELA: ANAMNESE TEMPLATE
-- ============================================================

CREATE TABLE anamnese_template (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,

    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    secoes JSONB NOT NULL DEFAULT '[]',
    versao VARCHAR(20) DEFAULT '1.0',

    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_anamnese_template_clinica ON anamnese_template(clinica_id);

-- ============================================================
-- TABELA: ANAMNESE (preenchida)
-- ============================================================

CREATE TABLE anamnese (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES paciente(id) ON DELETE CASCADE,
    profissional_id UUID REFERENCES profissional(id) ON DELETE SET NULL,
    template_id UUID REFERENCES anamnese_template(id) ON DELETE SET NULL,

    nome_template VARCHAR(200),
    dados JSONB NOT NULL DEFAULT '{}',
    data_preenchimento DATE NOT NULL,
    data_retorno_devido DATE,

    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_anamnese_paciente ON anamnese(paciente_id);
CREATE INDEX idx_anamnese_data ON anamnese(data_preenchimento DESC);

-- ============================================================
-- TABELA: AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID REFERENCES clinica(id) ON DELETE SET NULL,
    usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,

    acao VARCHAR(100) NOT NULL,
    tipo_evento VARCHAR(50),
    resultado VARCHAR(20),
    detalhes JSONB DEFAULT '{}',
    ip_hint VARCHAR(50),

    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_audit_clinica ON audit_log(clinica_id);
CREATE INDEX idx_audit_usuario ON audit_log(usuario_id);
CREATE INDEX idx_audit_data ON audit_log(criado_em DESC);
CREATE INDEX idx_audit_acao ON audit_log(acao);

-- ============================================================
-- TRIGGERS PARA ATUALIZAR atualizado_em
-- ============================================================

CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica trigger em todas as tabelas
CREATE TRIGGER tr_clinica_atualizado BEFORE UPDATE ON clinica FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_profissional_atualizado BEFORE UPDATE ON profissional FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_usuario_atualizado BEFORE UPDATE ON usuario FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_paciente_atualizado BEFORE UPDATE ON paciente FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_agenda_evento_atualizado BEFORE UPDATE ON agenda_evento FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_atendimento_atualizado BEFORE UPDATE ON atendimento FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_disponibilidade_atualizado BEFORE UPDATE ON agenda_disponibilidade FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_excecao_atualizado BEFORE UPDATE ON agenda_excecao FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_evolucao_atualizado BEFORE UPDATE ON evolucao FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_medicamento_atualizado BEFORE UPDATE ON medicamento FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_receita_atualizado BEFORE UPDATE ON receita FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_anamnese_template_atualizado BEFORE UPDATE ON anamnese_template FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER tr_anamnese_atualizado BEFORE UPDATE ON anamnese FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- ============================================================
-- COMENTÁRIOS NAS TABELAS (documentação)
-- ============================================================

COMMENT ON TABLE clinica IS 'Clínicas cadastradas no sistema (multi-tenant)';
COMMENT ON TABLE profissional IS 'Médicos e outros profissionais de saúde';
COMMENT ON TABLE usuario IS 'Usuários do sistema (login)';
COMMENT ON TABLE paciente IS 'Pacientes da clínica';
COMMENT ON TABLE agenda_evento IS 'Agendamentos e bloqueios de horário';
COMMENT ON TABLE atendimento IS 'Fila de atendimento do dia';
COMMENT ON TABLE agenda_disponibilidade IS 'Horários regulares de atendimento';
COMMENT ON TABLE agenda_excecao IS 'Bloqueios e horários especiais';
COMMENT ON TABLE evolucao IS 'Evoluções do prontuário';
COMMENT ON TABLE medicamento IS 'Catálogo de medicamentos';
COMMENT ON TABLE receita IS 'Receitas médicas';
COMMENT ON TABLE anamnese_template IS 'Templates de anamnese';
COMMENT ON TABLE anamnese IS 'Anamneses preenchidas';
COMMENT ON TABLE audit_log IS 'Log de auditoria de ações';
