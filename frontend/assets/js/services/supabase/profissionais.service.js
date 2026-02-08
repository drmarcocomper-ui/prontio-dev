/**
 * PRONTIO - Profissionais Service (Supabase)
 * Operações de profissionais usando PostgreSQL
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.services = PRONTIO.services || {};

  const getSupabase = () => PRONTIO.supabase;
  const getClinicaId = () => PRONTIO.session?.clinicaId || null;

  // ============================================================
  // PROFISSIONAIS SERVICE
  // ============================================================

  const ProfissionaisService = {

    /**
     * Lista todos os profissionais ativos
     */
    async listar() {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId) {
        return { success: false, error: "Clínica não identificada" };
      }

      try {
        const { data, error } = await supabase
          .from("profissional")
          .select("*")
          .eq("clinica_id", clinicaId)
          .eq("ativo", true)
          .order("nome_completo", { ascending: true });

        if (error) {
          return { success: false, error: error.message };
        }

        const profissionais = (data || []).map(p => this._mapToFrontend(p));

        return {
          success: true,
          data: { profissionais }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Busca profissional por ID
     */
    async obterPorId(id) {
      const supabase = getSupabase();

      try {
        const { data, error } = await supabase
          .from("profissional")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { profissional: this._mapToFrontend(data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Cria novo profissional
     */
    async criar(dados) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId) {
        return { success: false, error: "Clínica não identificada" };
      }

      try {
        const profissional = this._mapToDatabase(dados);
        profissional.clinica_id = clinicaId;

        const { data, error } = await supabase
          .from("profissional")
          .insert(profissional);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { profissional: this._mapToFrontend(data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Atualiza profissional
     */
    async atualizar(id, dados) {
      const supabase = getSupabase();

      try {
        const profissional = this._mapToDatabase(dados);

        const { data, error } = await supabase
          .from("profissional")
          .update(profissional)
          .eq("id", id);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { profissional: this._mapToFrontend(data?.[0] || data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // ========================================
    // MAPEAMENTOS
    // ========================================

    _mapToFrontend(p) {
      if (!p) return null;
      return {
        idProfissional: p.id,
        ID_Profissional: p.id,
        idClinica: p.clinica_id,
        tipo: p.tipo,
        nomeCompleto: p.nome_completo,
        documentoRegistro: p.documento_registro,
        especialidade: p.especialidade,
        assinaturaDigitalBase64: p.assinatura_digital_base64,
        corInterface: p.cor_interface,
        ativo: p.ativo,
        criadoEm: p.criado_em,
        atualizadoEm: p.atualizado_em
      };
    },

    _mapToDatabase(dados) {
      const d = {};

      if (dados.tipo !== undefined) d.tipo = dados.tipo;
      if (dados.nomeCompleto !== undefined) d.nome_completo = dados.nomeCompleto;
      if (dados.documentoRegistro !== undefined) d.documento_registro = dados.documentoRegistro;
      if (dados.especialidade !== undefined) d.especialidade = dados.especialidade;
      if (dados.assinaturaDigitalBase64 !== undefined) d.assinatura_digital_base64 = dados.assinaturaDigitalBase64;
      if (dados.corInterface !== undefined) d.cor_interface = dados.corInterface;
      if (dados.ativo !== undefined) d.ativo = dados.ativo;

      return d;
    }
  };

  // Exporta
  PRONTIO.services.profissionais = ProfissionaisService;

  console.info("[PRONTIO.services.profissionais] Serviço Supabase inicializado");

})(window);
