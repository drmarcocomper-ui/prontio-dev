/**
 * PRONTIO - Evoluções Service (Supabase)
 * Operações de evoluções do prontuário usando PostgreSQL
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.services = PRONTIO.services || {};

  const getSupabase = () => PRONTIO.supabase;
  const getClinicaId = () => PRONTIO.session?.clinicaId || null;
  const getProfissionalId = () => PRONTIO.session?.idProfissional || null;
  const getProfissionalNome = () => PRONTIO.session?.nomeCompleto || PRONTIO.session?.nome || "Profissional";

  // ============================================================
  // EVOLUÇÕES SERVICE
  // ============================================================

  const EvolucoesService = {

    /**
     * Lista evoluções por paciente com paginação
     */
    async listarPorPaciente({ idPaciente, limit = 10, cursor = null } = {}) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId || !idPaciente) {
        return { success: false, error: "Paciente ou clínica não identificados" };
      }

      try {
        let query = supabase
          .from("evolucao")
          .select("*")
          .eq("clinica_id", clinicaId)
          .eq("paciente_id", idPaciente)
          .eq("ativo", true)
          .order("criado_em", { ascending: false })
          .limit(limit + 1); // +1 para verificar se há mais

        // Paginação por cursor (criado_em)
        if (cursor) {
          query = query.lt("criado_em", cursor);
        }

        const { data, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        const items = (data || []).slice(0, limit).map(e => this._mapToFrontend(e));
        const hasMore = (data || []).length > limit;
        const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].criadoEm : null;

        return {
          success: true,
          data: {
            items,
            hasMore,
            nextCursor
          }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Salva nova evolução
     */
    async salvar({ idPaciente, idAgenda = null, texto, origem = "PRONTUARIO" }) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();
      const profissionalId = getProfissionalId();

      if (!clinicaId || !idPaciente) {
        return { success: false, error: "Paciente ou clínica não identificados" };
      }

      if (!texto || !texto.trim()) {
        return { success: false, error: "Texto da evolução é obrigatório" };
      }

      try {
        const evolucao = {
          clinica_id: clinicaId,
          paciente_id: idPaciente,
          profissional_id: profissionalId || null,
          agenda_id: idAgenda || null,
          texto: texto.trim(),
          origem: origem || "PRONTUARIO"
        };

        const { data, error } = await supabase
          .from("evolucao")
          .insert(evolucao)
          .select()
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { evolucao: this._mapToFrontend(data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Atualiza evolução existente
     */
    async atualizar(idEvolucao, { texto }) {
      const supabase = getSupabase();

      if (!idEvolucao) {
        return { success: false, error: "ID da evolução é obrigatório" };
      }

      try {
        const { data, error } = await supabase
          .from("evolucao")
          .update({
            texto: texto.trim(),
            atualizado_em: new Date().toISOString()
          })
          .eq("id", idEvolucao)
          .select()
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { evolucao: this._mapToFrontend(data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Exclui evolução (soft delete)
     */
    async excluir(idEvolucao) {
      const supabase = getSupabase();

      if (!idEvolucao) {
        return { success: false, error: "ID da evolução é obrigatório" };
      }

      try {
        const { error } = await supabase
          .from("evolucao")
          .update({ ativo: false })
          .eq("id", idEvolucao);

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ========================================
    // MAPEAMENTOS
    // ========================================

    _mapToFrontend(e) {
      if (!e) return null;
      return {
        idEvolucao: e.id,
        ID_Evolucao: e.id,
        idPaciente: e.paciente_id,
        idProfissional: e.profissional_id,
        idAgenda: e.agenda_id,
        texto: e.texto,
        origem: e.origem,
        autor: getProfissionalNome(),
        dataHoraRegistro: e.criado_em,
        dataHora: e.criado_em,
        data: e.criado_em,
        criadoEm: e.criado_em,
        atualizadoEm: e.atualizado_em,
        ativo: e.ativo
      };
    }
  };

  // Exporta
  PRONTIO.services.evolucoes = EvolucoesService;

  console.info("[PRONTIO.services.evolucoes] Serviço Supabase inicializado");

})(window);
