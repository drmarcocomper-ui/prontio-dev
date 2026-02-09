/**
 * PRONTIO - Medicamentos Service (Supabase)
 * CRUD de medicamentos para receitas
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.services = PRONTIO.services || {};

  const getSupabase = () => PRONTIO.supabase;
  const getClinicaId = () => {
    if (PRONTIO.session?.clinicaId) return PRONTIO.session.clinicaId;
    if (PRONTIO.session?.idClinica) return PRONTIO.session.idClinica;
    // Fallback: tenta ler do localStorage
    try {
      const raw = localStorage.getItem("prontio_session");
      if (raw) {
        const s = JSON.parse(raw);
        return s.clinicaId || s.idClinica || null;
      }
    } catch (_) {}
    return null;
  };

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

        const limitar = (str, max) => str && str.length > max ? str.substring(0, max) : str;

        const medicamento = {
          id: medicamentoId,
          clinica_id: clinicaId,
          nome: limitar(nome.trim(), 200),
          tipo_receita: limitar(tipoReceita || "COMUM", 50),
          favorito: !!favorito
        };

        // Campos opcionais - só envia se tiver valor
        if (posologia && posologia.trim()) medicamento.posologia = limitar(posologia.trim(), 500);
        if (quantidade && quantidade.trim()) medicamento.quantidade = limitar(quantidade.trim(), 50);
        if (via && via.trim()) medicamento.via_administracao = limitar(via.trim(), 50);

        const { error } = await supabase
          .from("medicamento")
          .insert(medicamento);

        if (error) {
          console.error("[MedicamentosService] Erro criar:", error);
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { medicamento: { idMedicamento: medicamentoId, nome: nome.trim() } }
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
        if (posologia !== undefined) updateData.posologia = posologia;
        if (quantidade !== undefined) updateData.quantidade = quantidade;
        if (via !== undefined) updateData.via_administracao = via;
        if (tipoReceita !== undefined) updateData.tipo_receita = tipoReceita;
        if (favorito !== undefined) updateData.favorito = !!favorito;
        if (ativo !== undefined) updateData.ativo = !!ativo;

        const { error } = await supabase
          .from("medicamento")
          .eq("id", idMedicamento)
          .update(updateData);

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
     * Remove medicamento (soft delete - inativa)
     */
    async deletar(idMedicamento) {
      return this.atualizar(idMedicamento, { ativo: false });
    },

    /**
     * Inativa todos os medicamentos da clinica
     */
    async deletarTodos() {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId) {
        return { success: false, error: "Clinica nao identificada" };
      }

      try {
        const { error } = await supabase
          .from("medicamento")
          .eq("clinica_id", clinicaId)
          .eq("ativo", true)
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
     * Importa medicamentos em lote (para migração)
     */
    async importarLote(medicamentos) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!medicamentos || !medicamentos.length) {
        return { success: false, error: "Nenhum medicamento para importar" };
      }

      try {
        // Monta lista de medicamentos válidos
        const itensParaInserir = medicamentos.map(m => {
          const nome = String(m.Nome_Medicacao || m.nome || "").trim();
          if (!nome) return null;

          return {
            nome: nome,
            posologia: String(m.Posologia || m.posologia || "").trim() || "",
            quantidade: String(m.Quantidade || m.quantidade || "").trim() || "",
            via: String(m.Via_Administracao || m.via || "").trim() || "",
            tipoReceita: String(m.Tipo_Receita || m.tipoReceita || "COMUM").trim(),
            favorito: m.Favorito === true || m.favorito === true
          };
        }).filter(Boolean);

        if (!itensParaInserir.length) {
          return { success: false, error: "Nenhum medicamento valido encontrado" };
        }

        // Insere um por um para evitar problemas de schema cache
        let importados = 0;
        let erros = [];

        for (const item of itensParaInserir) {
          const result = await this.criar({
            nome: item.nome,
            posologia: item.posologia,
            quantidade: item.quantidade,
            via: item.via,
            tipoReceita: item.tipoReceita,
            favorito: item.favorito
          });

          if (result.success) {
            importados++;
          } else {
            erros.push(`${item.nome}: ${result.error}`);
          }
        }

        if (importados === 0) {
          return { success: false, error: erros.join("; ") || "Nenhum medicamento importado" };
        }

        return {
          success: true,
          data: { importados, erros: erros.length }
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
        posologia: m.posologia,
        Posologia: m.posologia,
        quantidade: m.quantidade,
        Quantidade: m.quantidade,
        via: m.via_administracao,
        Via_Administracao: m.via_administracao,
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
