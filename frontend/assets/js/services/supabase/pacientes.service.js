/**
 * PRONTIO - Pacientes Service (Supabase)
 * Operações de pacientes usando PostgreSQL
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.services = PRONTIO.services || {};

  const getSupabase = () => PRONTIO.supabase;
  const getClinicaId = () => PRONTIO.session?.clinicaId || null;

  // ============================================================
  // PACIENTES SERVICE
  // ============================================================

  const PacientesService = {

    /**
     * Lista pacientes com paginação
     */
    async listar({ page = 1, pageSize = 50, termo = "", somenteAtivos = true, ordenacao = "nome" } = {}) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId) {
        return { success: false, error: "Clínica não identificada" };
      }

      try {
        let query = supabase
          .from("paciente")
          .select("*")
          .eq("clinica_id", clinicaId);

        // Filtro de ativos
        if (somenteAtivos) {
          query = query.eq("ativo", true);
        }

        // Busca por termo
        if (termo) {
          query = query.or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,telefone_principal.ilike.%${termo}%`);
        }

        // Ordenação
        if (ordenacao === "nome" || ordenacao === "nomeAsc") {
          query = query.order("nome_completo", { ascending: true });
        } else if (ordenacao === "nomeDesc") {
          query = query.order("nome_completo", { ascending: false });
        } else if (ordenacao === "dataCadastroDesc") {
          query = query.order("criado_em", { ascending: false });
        } else if (ordenacao === "dataCadastroAsc") {
          query = query.order("criado_em", { ascending: true });
        }

        // Paginação
        const offset = (page - 1) * pageSize;
        query = query.limit(pageSize).offset(offset);

        const { data, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        // Mapeia para formato compatível com frontend atual
        const pacientes = (data || []).map(p => this._mapToFrontend(p));

        return {
          success: true,
          data: {
            pacientes,
            paging: {
              page,
              pageSize,
              total: pacientes.length,
              hasMore: pacientes.length === pageSize
            }
          }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Busca paciente por ID
     */
    async obterPorId(id) {
      const supabase = getSupabase();

      try {
        const { data, error } = await supabase
          .from("paciente")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { paciente: this._mapToFrontend(data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Cria novo paciente
     */
    async criar(dados) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId) {
        return { success: false, error: "Clínica não identificada" };
      }

      try {
        const paciente = this._mapToDatabase(dados);
        paciente.clinica_id = clinicaId;

        const { data, error } = await supabase
          .from("paciente")
          .insert(paciente);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { paciente: this._mapToFrontend(data), idPaciente: data.id }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Atualiza paciente
     */
    async atualizar(id, dados) {
      const supabase = getSupabase();

      try {
        const paciente = this._mapToDatabase(dados);

        const { data, error } = await supabase
          .from("paciente")
          .update(paciente)
          .eq("id", id);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { paciente: this._mapToFrontend(data?.[0] || data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Altera status do paciente (ativo/inativo)
     */
    async alterarStatus(id, ativo) {
      const supabase = getSupabase();

      try {
        const { data, error } = await supabase
          .from("paciente")
          .update({
            ativo: ativo,
            status: ativo ? "ATIVO" : "INATIVO"
          })
          .eq("id", id);

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true, data: { id, ativo } };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Busca simples para autocomplete
     */
    async buscarSimples(termo, limite = 30) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!termo || !clinicaId) {
        return { success: true, data: { pacientes: [] } };
      }

      try {
        const { data, error } = await supabase
          .from("paciente")
          .select("id, nome_completo, nome_social, cpf, telefone_principal, data_nascimento")
          .eq("clinica_id", clinicaId)
          .eq("ativo", true)
          .or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,telefone_principal.ilike.%${termo}%`)
          .limit(limite);

        if (error) {
          return { success: false, error: error.message };
        }

        const pacientes = (data || []).map(p => ({
          idPaciente: p.id,
          ID_Paciente: p.id,
          nome: p.nome_social || p.nome_completo,
          nomeCompleto: p.nome_completo,
          documento: p.cpf,
          telefone: p.telefone_principal,
          data_nascimento: p.data_nascimento
        }));

        return { success: true, data: { pacientes } };
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
        idPaciente: p.id,
        ID_Paciente: p.id,
        nomeCompleto: p.nome_completo,
        nomeSocial: p.nome_social,
        nomeExibicao: p.nome_social || p.nome_completo,
        sexo: p.sexo,
        dataNascimento: p.data_nascimento,
        estadoCivil: p.estado_civil,
        profissao: p.profissao,
        cpf: p.cpf,
        rg: p.rg,
        rgOrgaoEmissor: p.rg_orgao_emissor,
        telefonePrincipal: p.telefone_principal,
        telefoneSecundario: p.telefone_secundario,
        telefone1: p.telefone_principal,
        telefone: p.telefone_principal,
        email: p.email,
        cep: p.cep,
        logradouro: p.logradouro,
        numero: p.numero,
        complemento: p.complemento,
        bairro: p.bairro,
        cidade: p.cidade,
        estado: p.estado,
        planoSaude: p.plano_saude,
        numeroCarteirinha: p.numero_carteirinha,
        tipoSanguineo: p.tipo_sanguineo,
        alergias: p.alergias,
        observacoesClinicas: p.observacoes_clinicas,
        observacoesAdministrativas: p.observacoes_administrativas,
        status: p.status,
        ativo: p.ativo,
        criadoEm: p.criado_em,
        atualizadoEm: p.atualizado_em
      };
    },

    _mapToDatabase(dados) {
      const d = {};

      if (dados.nomeCompleto !== undefined) d.nome_completo = dados.nomeCompleto;
      if (dados.nomeSocial !== undefined) d.nome_social = dados.nomeSocial;
      if (dados.sexo !== undefined) d.sexo = dados.sexo;
      if (dados.dataNascimento !== undefined) d.data_nascimento = dados.dataNascimento;
      if (dados.estadoCivil !== undefined) d.estado_civil = dados.estadoCivil;
      if (dados.profissao !== undefined) d.profissao = dados.profissao;
      if (dados.cpf !== undefined) d.cpf = dados.cpf;
      if (dados.rg !== undefined) d.rg = dados.rg;
      if (dados.rgOrgaoEmissor !== undefined) d.rg_orgao_emissor = dados.rgOrgaoEmissor;
      if (dados.telefonePrincipal !== undefined) d.telefone_principal = dados.telefonePrincipal;
      if (dados.telefoneSecundario !== undefined) d.telefone_secundario = dados.telefoneSecundario;
      if (dados.email !== undefined) d.email = dados.email;
      if (dados.cep !== undefined) d.cep = dados.cep;
      if (dados.logradouro !== undefined) d.logradouro = dados.logradouro;
      if (dados.numero !== undefined) d.numero = dados.numero;
      if (dados.complemento !== undefined) d.complemento = dados.complemento;
      if (dados.bairro !== undefined) d.bairro = dados.bairro;
      if (dados.cidade !== undefined) d.cidade = dados.cidade;
      if (dados.estado !== undefined) d.estado = dados.estado;
      if (dados.planoSaude !== undefined) d.plano_saude = dados.planoSaude;
      if (dados.numeroCarteirinha !== undefined) d.numero_carteirinha = dados.numeroCarteirinha;
      if (dados.tipoSanguineo !== undefined) d.tipo_sanguineo = dados.tipoSanguineo;
      if (dados.alergias !== undefined) d.alergias = dados.alergias;
      if (dados.observacoesClinicas !== undefined) d.observacoes_clinicas = dados.observacoesClinicas;
      if (dados.observacoesAdministrativas !== undefined) d.observacoes_administrativas = dados.observacoesAdministrativas;
      if (dados.status !== undefined) d.status = dados.status;
      if (dados.ativo !== undefined) d.ativo = dados.ativo;

      return d;
    }
  };

  // Exporta
  PRONTIO.services.pacientes = PacientesService;

  console.info("[PRONTIO.services.pacientes] Serviço Supabase inicializado");

})(window);
