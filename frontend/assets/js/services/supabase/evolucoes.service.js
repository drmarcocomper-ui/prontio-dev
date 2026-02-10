/**
 * PRONTIO - Evoluções Service (Supabase)
 * Operações de evoluções do prontuário usando PostgreSQL
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.services = PRONTIO.services || {};

  const getSupabase = () => PRONTIO.supabase;
  const getClinicaId = () => {
    if (PRONTIO.session?.clinicaId) return PRONTIO.session.clinicaId;
    if (PRONTIO.session?.idClinica) return PRONTIO.session.idClinica;
    try {
      const raw = localStorage.getItem("prontio_session");
      if (raw) {
        const s = JSON.parse(raw);
        return s.clinicaId || s.idClinica || null;
      }
    } catch (_) {}
    return null;
  };
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
        console.warn("[evolucoes.service] listar: clinicaId=%s, idPaciente=%s", clinicaId, idPaciente);
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
    async salvar({ idPaciente, idAgenda = null, texto }) {
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
          texto: texto.trim()
        };

        if (profissionalId) evolucao.profissional_id = profissionalId;
        if (idAgenda) evolucao.agenda_evento_id = idAgenda;

        console.info("[evolucoes.service] Inserindo evolucao:", { clinicaId, idPaciente, temProfissional: !!profissionalId });

        const { error } = await supabase
          .from("evolucao")
          .insert(evolucao);

        if (error) {
          console.error("[evolucoes.service] Erro ao inserir:", error.message);
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { evolucao: { texto: evolucao.texto } }
        };
      } catch (err) {
        console.error("[evolucoes.service] Exceção ao salvar:", err);
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
        const { error } = await supabase
          .from("evolucao")
          .eq("id", idEvolucao)
          .update({
            texto: texto.trim(),
            atualizado_em: new Date().toISOString()
          });

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { evolucao: { idEvolucao, texto: texto.trim() } }
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
          .eq("id", idEvolucao)
          .update({ ativo: false });

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Importa evoluções em lote (migração da planilha)
     */
    async importarLote(evolucoes) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId) {
        return { success: false, error: "Clinica nao identificada" };
      }

      if (!evolucoes || !evolucoes.length) {
        return { success: false, error: "Nenhuma evolucao para importar" };
      }

      let importados = 0;
      let erros = [];

      for (const ev of evolucoes) {
        const texto = String(ev.texto || "").trim();
        const idPaciente = String(ev.idPaciente || "").trim();

        if (!texto || !idPaciente) {
          erros.push("Evolucao sem texto ou paciente");
          continue;
        }

        const registro = {
          clinica_id: clinicaId,
          paciente_id: idPaciente,
          texto: texto,
          ativo: ev.ativo !== false && ev.ativo !== "false" && ev.ativo !== "FALSE"
        };

        // Preserva timestamps originais se disponíveis
        if (ev.criadoEm) registro.criado_em = ev.criadoEm;
        if (ev.atualizadoEm) registro.atualizado_em = ev.atualizadoEm;

        try {
          const { error } = await supabase
            .from("evolucao")
            .insert(registro);

          if (error) {
            erros.push(error.message);
          } else {
            importados++;
          }
        } catch (err) {
          erros.push(err.message);
        }
      }

      if (importados === 0) {
        return { success: false, error: erros.join("; ") || "Nenhuma evolucao importada" };
      }

      return {
        success: true,
        data: { importados, erros: erros.length }
      };
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
        idAgenda: e.agenda_evento_id,
        texto: e.texto,
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
