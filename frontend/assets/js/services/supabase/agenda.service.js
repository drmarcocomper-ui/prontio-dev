/**
 * PRONTIO - Agenda Service (Supabase)
 * Operações de agendamento usando PostgreSQL
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.services = PRONTIO.services || {};

  const getSupabase = () => PRONTIO.supabase;
  const getClinicaId = () => PRONTIO.session?.clinicaId || null;

  // ============================================================
  // AGENDA SERVICE
  // ============================================================

  const AgendaService = {

    /**
     * Lista agendamentos por período
     */
    async listarPorPeriodo({ inicio, fim, idProfissional = null, idPaciente = null, incluirCancelados = false } = {}) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId) {
        return { success: false, error: "Clínica não identificada" };
      }

      try {
        let query = supabase
          .from("agenda_evento")
          .select("*, paciente:paciente_id(id, nome_completo, nome_social, telefone_principal), profissional:profissional_id(id, nome_completo)")
          .eq("clinica_id", clinicaId)
          .gte("inicio_datetime", inicio)
          .lte("inicio_datetime", fim);

        if (!incluirCancelados) {
          query = query.eq("ativo", true).neq("status", "CANCELADO");
        }

        if (idProfissional) {
          query = query.eq("profissional_id", idProfissional);
        }

        if (idPaciente) {
          query = query.eq("paciente_id", idPaciente);
        }

        query = query.order("inicio_datetime", { ascending: true });

        const { data, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        const items = (data || []).map(e => this._mapToFrontend(e));

        return {
          success: true,
          data: { items, count: items.length }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Busca evento por ID
     */
    async obterPorId(id) {
      const supabase = getSupabase();

      try {
        const { data, error } = await supabase
          .from("agenda_evento")
          .select("*, paciente:paciente_id(id, nome_completo, nome_social), profissional:profissional_id(id, nome_completo)")
          .eq("id", id)
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { item: this._mapToFrontend(data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Cria novo agendamento
     */
    async criar(dados) {
      const supabase = getSupabase();
      const clinicaId = getClinicaId();

      if (!clinicaId) {
        return { success: false, error: "Clínica não identificada" };
      }

      try {
        const evento = this._mapToDatabase(dados);
        evento.clinica_id = clinicaId;

        const { data, error } = await supabase
          .from("agenda_evento")
          .insert(evento);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { item: this._mapToFrontend(data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Atualiza agendamento
     */
    async atualizar(id, dados) {
      const supabase = getSupabase();

      try {
        const evento = this._mapToDatabase(dados);

        const { data, error } = await supabase
          .from("agenda_evento")
          .update(evento)
          .eq("id", id);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { item: this._mapToFrontend(data?.[0] || data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Cancela agendamento
     */
    async cancelar(id, motivo = "") {
      const supabase = getSupabase();

      try {
        const { data, error } = await supabase
          .from("agenda_evento")
          .update({
            status: "CANCELADO",
            ativo: false,
            cancelado_em: new Date().toISOString(),
            cancelado_motivo: motivo
          })
          .eq("id", id);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          data: { item: this._mapToFrontend(data?.[0] || data) }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Atualiza status do agendamento
     */
    async atualizarStatus(id, status) {
      const supabase = getSupabase();

      try {
        const { data, error } = await supabase
          .from("agenda_evento")
          .update({ status })
          .eq("id", id);

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true, data: { id, status } };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Bloqueia horário
     */
    async bloquearHorario({ idProfissional, data, horaInicio, duracaoMin, notas = "" }) {
      const inicio = new Date(`${data}T${horaInicio}:00`);
      const fim = new Date(inicio.getTime() + duracaoMin * 60000);

      return this.criar({
        idProfissional,
        inicioDateTime: inicio.toISOString(),
        fimDateTime: fim.toISOString(),
        tipo: "BLOQUEIO",
        titulo: "BLOQUEIO",
        status: "MARCADO",
        notas
      });
    },

    // ========================================
    // MAPEAMENTOS
    // ========================================

    _mapToFrontend(e) {
      if (!e) return null;

      const paciente = e.paciente || {};
      const profissional = e.profissional || {};

      return {
        idEvento: e.id,
        idAgenda: e.id,
        idClinica: e.clinica_id,
        idProfissional: e.profissional_id,
        idPaciente: e.paciente_id,
        inicioDateTime: e.inicio_datetime,
        fimDateTime: e.fim_datetime,
        inicio: e.inicio_datetime,
        fim: e.fim_datetime,
        titulo: e.titulo,
        notas: e.notas,
        tipo: e.tipo,
        status: e.status,
        origem: e.origem,
        permiteEncaixe: e.permite_encaixe,
        canceladoEm: e.cancelado_em,
        canceladoMotivo: e.cancelado_motivo,
        ativo: e.ativo,
        criadoEm: e.criado_em,
        atualizadoEm: e.atualizado_em,
        // Dados relacionados
        nomePaciente: paciente.nome_social || paciente.nome_completo || "",
        telefonePaciente: paciente.telefone_principal || "",
        nomeProfissional: profissional.nome_completo || ""
      };
    },

    _mapToDatabase(dados) {
      const d = {};

      if (dados.idProfissional !== undefined) d.profissional_id = dados.idProfissional;
      if (dados.idPaciente !== undefined) d.paciente_id = dados.idPaciente || null;
      if (dados.inicioDateTime !== undefined) d.inicio_datetime = dados.inicioDateTime;
      if (dados.fimDateTime !== undefined) d.fim_datetime = dados.fimDateTime;
      if (dados.titulo !== undefined) d.titulo = dados.titulo;
      if (dados.notas !== undefined) d.notas = dados.notas;
      if (dados.tipo !== undefined) d.tipo = dados.tipo;
      if (dados.status !== undefined) d.status = dados.status;
      if (dados.origem !== undefined) d.origem = dados.origem;
      if (dados.permiteEncaixe !== undefined) d.permite_encaixe = dados.permiteEncaixe;

      return d;
    }
  };

  // Exporta
  PRONTIO.services.agenda = AgendaService;

  console.info("[PRONTIO.services.agenda] Serviço Supabase inicializado");

})(window);
