-- ============================================================
-- PRONTIO - Row Level Security (RLS)
-- Segurança multi-tenant: cada clínica só vê seus dados
-- ============================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE clinica ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissional ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE paciente ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_disponibilidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_excecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE receita ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamnese_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamnese ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNÇÃO: Obtém clinica_id do usuário logado
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_clinica_id()
RETURNS UUID AS $$
DECLARE
    clinica UUID;
BEGIN
    SELECT u.clinica_id INTO clinica
    FROM usuario u
    WHERE u.auth_user_id = auth.uid();

    RETURN clinica;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNÇÃO: Verifica se usuário é admin
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_perfil perfil_usuario;
BEGIN
    SELECT u.perfil INTO user_perfil
    FROM usuario u
    WHERE u.auth_user_id = auth.uid();

    RETURN user_perfil = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- POLÍTICAS: CLINICA
-- ============================================================

-- Usuários só veem sua própria clínica
CREATE POLICY "Usuários veem sua clínica"
    ON clinica FOR SELECT
    USING (id = get_user_clinica_id());

-- Apenas admins podem atualizar
CREATE POLICY "Admins atualizam clínica"
    ON clinica FOR UPDATE
    USING (id = get_user_clinica_id() AND is_admin());

-- ============================================================
-- POLÍTICAS: PROFISSIONAL
-- ============================================================

CREATE POLICY "Usuários veem profissionais da clínica"
    ON profissional FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Admins inserem profissionais"
    ON profissional FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id() AND is_admin());

CREATE POLICY "Admins atualizam profissionais"
    ON profissional FOR UPDATE
    USING (clinica_id = get_user_clinica_id() AND is_admin());

-- ============================================================
-- POLÍTICAS: USUARIO
-- ============================================================

CREATE POLICY "Usuários veem usuários da clínica"
    ON usuario FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Admins inserem usuários"
    ON usuario FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id() AND is_admin());

CREATE POLICY "Admins atualizam usuários"
    ON usuario FOR UPDATE
    USING (clinica_id = get_user_clinica_id() AND is_admin());

-- ============================================================
-- POLÍTICAS: PACIENTE
-- ============================================================

CREATE POLICY "Usuários veem pacientes da clínica"
    ON paciente FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários inserem pacientes"
    ON paciente FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários atualizam pacientes"
    ON paciente FOR UPDATE
    USING (clinica_id = get_user_clinica_id());

-- ============================================================
-- POLÍTICAS: AGENDA_EVENTO
-- ============================================================

CREATE POLICY "Usuários veem agendamentos da clínica"
    ON agenda_evento FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários inserem agendamentos"
    ON agenda_evento FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários atualizam agendamentos"
    ON agenda_evento FOR UPDATE
    USING (clinica_id = get_user_clinica_id());

-- ============================================================
-- POLÍTICAS: ATENDIMENTO
-- ============================================================

CREATE POLICY "Usuários veem atendimentos da clínica"
    ON atendimento FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários inserem atendimentos"
    ON atendimento FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários atualizam atendimentos"
    ON atendimento FOR UPDATE
    USING (clinica_id = get_user_clinica_id());

-- ============================================================
-- POLÍTICAS: AGENDA_DISPONIBILIDADE
-- ============================================================

CREATE POLICY "Usuários veem disponibilidades"
    ON agenda_disponibilidade FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Admins inserem disponibilidades"
    ON agenda_disponibilidade FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id() AND is_admin());

CREATE POLICY "Admins atualizam disponibilidades"
    ON agenda_disponibilidade FOR UPDATE
    USING (clinica_id = get_user_clinica_id() AND is_admin());

-- ============================================================
-- POLÍTICAS: AGENDA_EXCECAO
-- ============================================================

CREATE POLICY "Usuários veem exceções"
    ON agenda_excecao FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Admins inserem exceções"
    ON agenda_excecao FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id());

CREATE POLICY "Admins atualizam exceções"
    ON agenda_excecao FOR UPDATE
    USING (clinica_id = get_user_clinica_id());

-- ============================================================
-- POLÍTICAS: EVOLUCAO
-- ============================================================

CREATE POLICY "Usuários veem evoluções da clínica"
    ON evolucao FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários inserem evoluções"
    ON evolucao FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários atualizam evoluções"
    ON evolucao FOR UPDATE
    USING (clinica_id = get_user_clinica_id());

-- ============================================================
-- POLÍTICAS: MEDICAMENTO
-- ============================================================

CREATE POLICY "Usuários veem medicamentos da clínica"
    ON medicamento FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários inserem medicamentos"
    ON medicamento FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários atualizam medicamentos"
    ON medicamento FOR UPDATE
    USING (clinica_id = get_user_clinica_id());

-- ============================================================
-- POLÍTICAS: RECEITA
-- ============================================================

CREATE POLICY "Usuários veem receitas da clínica"
    ON receita FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários inserem receitas"
    ON receita FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários atualizam receitas"
    ON receita FOR UPDATE
    USING (clinica_id = get_user_clinica_id());

-- ============================================================
-- POLÍTICAS: ANAMNESE_TEMPLATE
-- ============================================================

CREATE POLICY "Usuários veem templates da clínica"
    ON anamnese_template FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Admins inserem templates"
    ON anamnese_template FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id() AND is_admin());

CREATE POLICY "Admins atualizam templates"
    ON anamnese_template FOR UPDATE
    USING (clinica_id = get_user_clinica_id() AND is_admin());

-- ============================================================
-- POLÍTICAS: ANAMNESE
-- ============================================================

CREATE POLICY "Usuários veem anamneses da clínica"
    ON anamnese FOR SELECT
    USING (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários inserem anamneses"
    ON anamnese FOR INSERT
    WITH CHECK (clinica_id = get_user_clinica_id());

CREATE POLICY "Usuários atualizam anamneses"
    ON anamnese FOR UPDATE
    USING (clinica_id = get_user_clinica_id());

-- ============================================================
-- POLÍTICAS: AUDIT_LOG
-- ============================================================

CREATE POLICY "Admins veem audit da clínica"
    ON audit_log FOR SELECT
    USING (clinica_id = get_user_clinica_id() AND is_admin());

CREATE POLICY "Sistema insere audit"
    ON audit_log FOR INSERT
    WITH CHECK (true); -- Permitido para logging

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

-- Permite que usuários autenticados usem as funções
GRANT EXECUTE ON FUNCTION get_user_clinica_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
