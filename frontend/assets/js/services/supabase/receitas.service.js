/**
 * PRONTIO - Receitas Service (Supabase)
 * Operações de receitas do prontuário usando PostgreSQL
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
  const getProfissionalId = () => PRONTIO.session?.idProfissional || PRONTIO.session?.profissionalId || null;

  // ============================================================
  // RECEITAS SERVICE
  // ============================================================

  const ReceitasService = {

    /**
     * Lista receitas por paciente com paginação
     */
    async listarPorPaciente({ idPaciente, limit = 25, cursor = null } = {}) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId || !idPaciente) {
        return { success: false, error: "Paciente ou clínica não identificados" };
      }

      try {
        let query = supabase
          .from("receita")
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

        // Carrega itens de cada receita
        const receitas = (data || []).slice(0, limit);
        for (const receita of receitas) {
          const { data: itens } = await supabase
            .from("receita_item")
            .select("*")
            .eq("receita_id", receita.id)
            .order("ordem", { ascending: true });
          receita.itens = itens || [];
        }

        const items = receitas.map(r => this._mapToFrontend(r));
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
     * Busca receita por ID
     */
    async obterPorId(idReceita) {
      const supabase = getSupabase();

      try {
        const { data: receita, error } = await supabase
          .from("receita")
          .select("*")
          .eq("id", idReceita)
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        // Carrega itens
        const { data: itens } = await supabase
          .from("receita_item")
          .select("*")
          .eq("receita_id", receita.id)
          .order("ordem", { ascending: true });

        receita.itens = itens || [];

        return {
          success: true,
          data: { receita: this._mapToFrontend(receita) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Salva nova receita com itens
     */
    async salvar({ idPaciente, idAgenda = null, dataReceita, observacoes, itens = [] }) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();
      const profissionalId = getProfissionalId();

      if (!clinicaId || !idPaciente) {
        return { success: false, error: "Paciente ou clínica não identificados" };
      }

      if (!itens || itens.length === 0) {
        return { success: false, error: "Adicione pelo menos um medicamento" };
      }

      try {
        // Gera UUID no cliente para poder usar nos itens
        const receitaId = crypto.randomUUID();

        // Cria receita
        const receita = {
          id: receitaId,
          clinica_id: clinicaId,
          paciente_id: idPaciente,
          data_receita: dataReceita || new Date().toISOString().split("T")[0],
          observacoes: observacoes || ""
        };

        // Só inclui campos opcionais se tiverem valor
        if (profissionalId) receita.profissional_id = profissionalId;
        if (idAgenda) receita.agenda_id = idAgenda;

        const { error: errReceita } = await supabase
          .from("receita")
          .insert(receita);

        if (errReceita) {
          return { success: false, error: errReceita.message };
        }

        // Cria itens
        const itensParaInserir = itens.map((item, idx) => ({
          receita_id: receitaId,
          nome_medicamento: item.remedio || item.nomeRemedio || item.nome || "",
          posologia: item.posologia || "",
          via_administracao: item.via || item.viaAdministracao || "",
          quantidade: item.quantidade || "",
          observacao: item.observacao || "",
          ordem: idx
        }));

        const { error: errItens } = await supabase
          .from("receita_item")
          .insert(itensParaInserir);

        if (errItens) {
          console.warn("[ReceitasService] Erro ao inserir itens:", errItens);
        }

        return {
          success: true,
          data: {
            idReceita: receitaId,
            receita: { idReceita: receitaId, dataReceita: receita.data_receita, observacoes: receita.observacoes }
          }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Exclui receita (soft delete)
     */
    async excluir(idReceita) {
      const supabase = getSupabase();

      if (!idReceita) {
        return { success: false, error: "ID da receita é obrigatório" };
      }

      try {
        const { error } = await supabase
          .from("receita")
          .eq("id", idReceita)
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
     * Busca medicamentos para autocomplete
     */
    async buscarMedicamentos(termo, limite = 50) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!termo || termo.length < 2) {
        return { success: true, data: { medicamentos: [] } };
      }

      try {
        let query = supabase
          .from("medicamento")
          .select("*")
          .eq("ativo", true)
          .ilike("nome", `%${termo}%`)
          .limit(limite);

        // Busca global + da clínica
        if (clinicaId) {
          query = query.or(`clinica_id.is.null,clinica_id.eq.${clinicaId}`);
        }

        const { data, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        const medicamentos = (data || []).map(m => ({
          nome: m.nome,
          Nome_Medicacao: m.nome,
          Posologia: m.posologia || "",
          Via_Administracao: m.via_administracao || "",
          Quantidade: m.quantidade || ""
        }));

        return { success: true, data: { medicamentos } };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ========================================
    // MAPEAMENTOS
    // ========================================

    _mapToFrontend(r) {
      if (!r) return null;

      const itens = (r.itens || []).map(i => ({
        remedio: i.nome_medicamento,
        nomeRemedio: i.nome_medicamento,
        nome: i.nome_medicamento,
        posologia: i.posologia,
        via: i.via_administracao,
        viaAdministracao: i.via_administracao,
        quantidade: i.quantidade,
        observacao: i.observacao
      }));

      return {
        idReceita: r.id,
        ID_Receita: r.id,
        idPaciente: r.paciente_id,
        idProfissional: r.profissional_id,
        idAgenda: r.agenda_id,
        dataReceita: r.data_receita,
        DataReceita: r.data_receita,
        tipoReceita: r.tipo_receita,
        TipoReceita: r.tipo_receita,
        status: r.status,
        Status: r.status,
        observacoes: r.observacoes,
        Observacoes: r.observacoes,
        itens: itens,
        dataHoraCriacao: r.criado_em,
        dataHora: r.criado_em,
        data: r.criado_em,
        criadoEm: r.criado_em,
        atualizadoEm: r.atualizado_em,
        ativo: r.ativo
      };
    }
  };

  // Exporta
  PRONTIO.services.receitas = ReceitasService;

  console.info("[PRONTIO.services.receitas] Serviço Supabase inicializado");

})(window);
