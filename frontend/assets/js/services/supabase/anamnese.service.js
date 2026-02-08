/**
 * PRONTIO - Anamnese Service (Supabase)
 * Operações de anamnese do prontuário usando PostgreSQL
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.services = PRONTIO.services || {};

  const getSupabase = () => PRONTIO.supabase;
  const getClinicaId = () => PRONTIO.session?.clinicaId || null;
  const getProfissionalId = () => PRONTIO.session?.idProfissional || null;

  // ============================================================
  // ANAMNESE SERVICE
  // ============================================================

  const AnamneseService = {

    /**
     * Lista anamneses por paciente com paginação
     */
    async listarPorPaciente({ idPaciente, limit = 10, cursor = null } = {}) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId || !idPaciente) {
        return { success: false, error: "Paciente ou clínica não identificados" };
      }

      try {
        let query = supabase
          .from("anamnese")
          .select("*")
          .eq("clinica_id", clinicaId)
          .eq("paciente_id", idPaciente)
          .eq("ativo", true)
          .order("criado_em", { ascending: false })
          .limit(limit + 1);

        if (cursor) {
          query = query.lt("criado_em", cursor);
        }

        const { data, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        const items = (data || []).slice(0, limit).map(a => this._mapToFrontend(a));
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
     * Busca anamnese por ID
     */
    async obterPorId(idAnamnese) {
      const supabase = getSupabase();

      try {
        const { data, error } = await supabase
          .from("anamnese")
          .select("*")
          .eq("id", idAnamnese)
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { anamnese: this._mapToFrontend(data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Salva nova anamnese
     */
    async salvar({ idPaciente, nomeTemplate, dados }) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();
      const profissionalId = getProfissionalId();

      if (!clinicaId || !idPaciente) {
        return { success: false, error: "Paciente ou clínica não identificados" };
      }

      if (!nomeTemplate) {
        return { success: false, error: "Nome do template é obrigatório" };
      }

      try {
        const anamneseId = crypto.randomUUID();

        const anamnese = {
          id: anamneseId,
          clinica_id: clinicaId,
          paciente_id: idPaciente,
          nome_template: nomeTemplate,
          dados: dados || {}
        };

        // Só inclui campos opcionais se tiverem valor
        if (profissionalId) anamnese.profissional_id = profissionalId;

        const { error } = await supabase
          .from("anamnese")
          .insert(anamnese);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { anamnese: { idAnamnese: anamneseId, nomeTemplate, dados } }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Atualiza anamnese existente
     */
    async atualizar(idAnamnese, { nomeTemplate, dados }) {
      const supabase = getSupabase();

      if (!idAnamnese) {
        return { success: false, error: "ID da anamnese é obrigatório" };
      }

      try {
        const updateData = {
          atualizado_em: new Date().toISOString()
        };

        if (nomeTemplate !== undefined) updateData.nome_template = nomeTemplate;
        if (dados !== undefined) updateData.dados = dados;

        const { error } = await supabase
          .from("anamnese")
          .update(updateData)
          .eq("id", idAnamnese);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { anamnese: { idAnamnese, nomeTemplate, dados } }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Exclui anamnese (soft delete)
     */
    async excluir(idAnamnese) {
      const supabase = getSupabase();

      if (!idAnamnese) {
        return { success: false, error: "ID da anamnese é obrigatório" };
      }

      try {
        const { error } = await supabase
          .from("anamnese")
          .update({ ativo: false })
          .eq("id", idAnamnese);

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

    _mapToFrontend(a) {
      if (!a) return null;

      const dados = a.dados || {};

      return {
        idAnamnese: a.id,
        idPaciente: a.paciente_id,
        idProfissional: a.profissional_id,
        nomeTemplate: a.nome_template,
        nome: a.nome_template,
        dados: dados,
        // Campos do dados para compatibilidade
        titulo: dados.titulo || "",
        texto: dados.texto || "",
        queixaPrincipal: dados.queixaPrincipal || "",
        inicio: dados.inicio || "",
        evolucao: dados.evolucao || "",
        fatoresAgravantes: dados.fatoresAgravantes || "",
        pessoais: dados.pessoais || [],
        pessoaisOutros: dados.pessoaisOutros || "",
        familiares: dados.familiares || "",
        medicamentos: dados.medicamentos || [],
        temAlergia: dados.temAlergia || "",
        alergias: dados.alergias || "",
        tabagismo: dados.tabagismo || "",
        etilismo: dados.etilismo || "",
        atividadeFisica: dados.atividadeFisica || "",
        pa: dados.pa || "",
        fc: dados.fc || "",
        temperatura: dados.temperatura || "",
        peso: dados.peso || "",
        altura: dados.altura || "",
        observacoes: dados.observacoes || "",
        criadoEm: a.criado_em,
        atualizadoEm: a.atualizado_em,
        ativo: a.ativo
      };
    }
  };

  // Exporta
  PRONTIO.services.anamnese = AnamneseService;

  console.info("[PRONTIO.services.anamnese] Serviço Supabase inicializado");

})(window);
