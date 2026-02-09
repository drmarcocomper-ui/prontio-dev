/**
 * PRONTIO - Medicamentos Service (Supabase)
 * CRUD de medicamentos para receitas
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.services = PRONTIO.services || {};

  const getSupabase = () => PRONTIO.supabase;
  const getClinicaId = () => PRONTIO.session?.clinicaId || null;

  // ============================================================
  // MEDICAMENTOS SERVICE
  // ============================================================

  const MedicamentosService = {

    /**
     * Lista todos os medicamentos da clínica (+ globais)
     */
    async listar({ apenasAtivos = true, apenasFavoritos = false, limite = 500 } = {}) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      try {
        let query = supabase
          .from("medicamento")
          .select("*")
          .order("nome", { ascending: true })
          .limit(limite);

        // Filtra por clínica (inclui globais onde clinica_id é null)
        if (clinicaId) {
          query = query.or(`clinica_id.is.null,clinica_id.eq.${clinicaId}`);
        }

        if (apenasAtivos) {
          query = query.eq("ativo", true);
        }

        if (apenasFavoritos) {
          query = query.eq("favorito", true);
        }

        const { data, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        const items = (data || []).map(m => this._mapToFrontend(m));

        return {
          success: true,
          data: { medicamentos: items, count: items.length }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Busca medicamentos por termo (para autocomplete)
     */
    async buscar(termo, limite = 50) {
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
          .order("favorito", { ascending: false })
          .order("nome", { ascending: true })
          .limit(limite);

        if (clinicaId) {
          query = query.or(`clinica_id.is.null,clinica_id.eq.${clinicaId}`);
        }

        const { data, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        const medicamentos = (data || []).map(m => this._mapToFrontend(m));

        return { success: true, data: { medicamentos } };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Obtém medicamento por ID
     */
    async obterPorId(idMedicamento) {
      const supabase = getSupabase();

      try {
        const { data, error } = await supabase
          .from("medicamento")
          .select("*")
          .eq("id", idMedicamento)
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { medicamento: this._mapToFrontend(data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Cria novo medicamento
     */
    async criar({ nome, posologia, quantidade, via, tipoReceita, favorito = false }) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!nome || !nome.trim()) {
        return { success: false, error: "Nome do medicamento é obrigatório" };
      }

      try {
        const medicamentoId = crypto.randomUUID();

        const medicamento = {
          id: medicamentoId,
          nome: nome.trim(),
          ativo: true
        };

        // Só inclui campos opcionais se tiverem valor
        if (clinicaId) medicamento.clinica_id = clinicaId;
        if (posologia) medicamento.posologia_padrao = posologia;
        if (quantidade) medicamento.quantidade_padrao = quantidade;
        if (via) medicamento.via_padrao = via;
        if (tipoReceita) medicamento.tipo_receita = tipoReceita;
        if (favorito) medicamento.favorito = true;

        const { error } = await supabase
          .from("medicamento")
          .insert(medicamento);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { medicamento: { idMedicamento: medicamentoId, ...medicamento } }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Atualiza medicamento existente
     */
    async atualizar(idMedicamento, { nome, posologia, quantidade, via, tipoReceita, favorito, ativo }) {
      const supabase = getSupabase();

      if (!idMedicamento) {
        return { success: false, error: "ID do medicamento é obrigatório" };
      }

      try {
        const updateData = {};

        if (nome !== undefined) updateData.nome = nome.trim();
        if (posologia !== undefined) updateData.posologia_padrao = posologia;
        if (quantidade !== undefined) updateData.quantidade_padrao = quantidade;
        if (via !== undefined) updateData.via_padrao = via;
        if (tipoReceita !== undefined) updateData.tipo_receita = tipoReceita;
        if (favorito !== undefined) updateData.favorito = !!favorito;
        if (ativo !== undefined) updateData.ativo = !!ativo;

        const { error } = await supabase
          .from("medicamento")
          .update(updateData)
          .eq("id", idMedicamento);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { medicamento: { idMedicamento, ...updateData } }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Alterna favorito
     */
    async toggleFavorito(idMedicamento, favorito) {
      return this.atualizar(idMedicamento, { favorito: !!favorito });
    },

    /**
     * Desativa medicamento (soft delete)
     */
    async excluir(idMedicamento) {
      return this.atualizar(idMedicamento, { ativo: false });
    },

    /**
     * Importa medicamentos em lote (para migração)
     */
    async importarLote(medicamentos) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!medicamentos || !medicamentos.length) {
        return { success: false, error: "Nenhum medicamento para importar" };
      }

      try {
        const itens = medicamentos.map(m => {
          const item = {
            id: crypto.randomUUID(),
            nome: String(m.Nome_Medicacao || m.nome || "").trim(),
            ativo: true
          };

          // Só inclui campos opcionais se tiverem valor
          if (clinicaId) item.clinica_id = clinicaId;

          const posologia = String(m.Posologia || m.posologia || "").trim();
          if (posologia) item.posologia_padrao = posologia;

          const quantidade = String(m.Quantidade || m.quantidade || "").trim();
          if (quantidade) item.quantidade_padrao = quantidade;

          const via = String(m.Via_Administracao || m.via || "").trim();
          if (via) item.via_padrao = via;

          const tipoReceita = String(m.Tipo_Receita || m.tipoReceita || "").trim().toUpperCase();
          if (tipoReceita) item.tipo_receita = tipoReceita;

          const favorito = m.Favorito === true || m.Favorito === "true" || m.Favorito === "TRUE" || m.favorito === true;
          if (favorito) item.favorito = true;

          return item;
        }).filter(m => m.nome);

        if (!itens.length) {
          return { success: false, error: "Nenhum medicamento valido encontrado" };
        }

        const { error } = await supabase
          .from("medicamento")
          .insert(itens);

        if (error) {
          console.error("[MedicamentosService] Erro insert:", error);
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { importados: itens.length }
        };
      } catch (err) {
        console.error("[MedicamentosService] Erro importarLote:", err);
        return { success: false, error: err.message };
      }
    },

    // ========================================
    // MAPEAMENTOS
    // ========================================

    _mapToFrontend(m) {
      if (!m) return null;

      return {
        idMedicamento: m.id,
        ID_Medicamento: m.id,
        nome: m.nome,
        Nome_Medicacao: m.nome,
        posologia: m.posologia_padrao,
        Posologia: m.posologia_padrao,
        quantidade: m.quantidade_padrao,
        Quantidade: m.quantidade_padrao,
        via: m.via_padrao,
        Via_Administracao: m.via_padrao,
        tipoReceita: m.tipo_receita,
        Tipo_Receita: m.tipo_receita,
        favorito: m.favorito,
        Favorito: m.favorito,
        ativo: m.ativo,
        Ativo: m.ativo,
        clinicaId: m.clinica_id,
        criadoEm: m.criado_em
      };
    }
  };

  // Exporta
  PRONTIO.services.medicamentos = MedicamentosService;

  console.info("[PRONTIO.services.medicamentos] Serviço Supabase inicializado");

})(window);
