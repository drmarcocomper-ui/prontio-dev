// frontend/assets/js/features/agenda/agenda.api.js
/**
 * PRONTIO — Agenda API (Front)
 * ------------------------------------------------------------
 * Objetivo:
 * - Ser o ÚNICO lugar onde o front conhece os nomes das actions da Agenda/AgendaConfig.
 * - Expor métodos claros e replicáveis (Listar/Criar/Atualizar/Cancelar/etc.).
 * - Normalizar a resposta (envelope vs data direto).
 * - Padronizar erros.
 *
 * Contrato canônico adotado (backend Registry):
 * - Agenda.Listar
 * - Agenda.Criar
 * - Agenda.Atualizar
 * - Agenda.Cancelar
 * - Agenda.ValidarConflito
 * - Agenda.BloquearHorario
 * - Agenda.DesbloquearHorario
 * - AgendaConfig.Obter
 * - AgendaConfig.Salvar
 *
 * Observação:
 * - Pacientes NÃO fica mais aqui.
 *   Use: features/pacientes/pacientes.api.js
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  // ------------------------------------------------------------
  // Infra: resolve callApiData
  // ------------------------------------------------------------
  function resolveCallApiData(PRONTIORef) {
    // 1) padrão preferido do core
    if (PRONTIORef && PRONTIORef.api && typeof PRONTIORef.api.callApiData === "function") {
      return PRONTIORef.api.callApiData;
    }

    // 2) fallback global (projeto legado)
    if (typeof global.callApiData === "function") return global.callApiData;

    // 3) erro explícito
    return function () {
      console.error("[AgendaApi] callApiData não está definido.");
      return Promise.reject(new Error("API não inicializada (callApiData indefinido)."));
    };
  }

  // ------------------------------------------------------------
  // Helpers: normalização de resposta e erro
  // ------------------------------------------------------------
  function isEnvelope(obj) {
    return !!obj && typeof obj === "object" && typeof obj.success === "boolean" && Array.isArray(obj.errors);
  }

  function buildApiErrorFromEnvelope(env) {
    const e0 = (env && env.errors && env.errors[0]) ? env.errors[0] : null;
    const code = e0 && e0.code ? String(e0.code) : "API_ERROR";
    const message = (e0 && e0.message ? String(e0.message) : "") || "Erro na API.";
    const details = e0 && (e0.details !== undefined) ? e0.details : null;

    const err = new Error(message);
    err.name = "ProntioApiError";
    err.code = code;
    err.details = details;
    err.requestId = env && (env.requestId || (env.meta && env.meta.request_id))
      ? String(env.requestId || env.meta.request_id)
      : "";
    err.meta = env && env.meta ? env.meta : {};
    err.envelope = env;
    return err;
  }

  function unwrapData(result) {
    // Alguns callApiData retornam envelope inteiro; outros retornam somente envelope.data; outros retornam data puro.
    if (isEnvelope(result)) {
      if (result.success) return result.data;
      throw buildApiErrorFromEnvelope(result);
    }

    // Se vier algo como {envelope:{success:true,data:{...}}}
    if (result && typeof result === "object" && isEnvelope(result.envelope)) {
      const env = result.envelope;
      if (env.success) return env.data;
      throw buildApiErrorFromEnvelope(env);
    }

    // Caso comum no seu projeto: callApiData retorna direto "data"
    return result;
  }

  async function callAction(callApiData, action, payload) {
    const res = await callApiData({ action, payload: payload || {} });
    return unwrapData(res);
  }

  function assertYmd(v, fieldName) {
    const s = String(v || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const err = new Error(`Campo "${fieldName}" inválido (esperado YYYY-MM-DD).`);
      err.code = "VALIDATION_ERROR";
      err.details = { field: fieldName, value: v };
      throw err;
    }
    return s;
  }

  // ------------------------------------------------------------
  // API pública (feature)
  // ------------------------------------------------------------
  function createAgendaApi(PRONTIORef) {
    const callApiData = resolveCallApiData(PRONTIORef);

    return {
      // -----------------------
      // AgendaConfig (canônico)
      // -----------------------
      async configObter() {
        return await callAction(callApiData, "AgendaConfig.Obter", {});
      },

      async configSalvar(payload) {
        // payload: conforme contrato do AgendaConfig.gs
        return await callAction(callApiData, "AgendaConfig.Salvar", payload || {});
      },

      // -----------------------
      // Agenda (canônico)
      // -----------------------
      async listar(params) {
        // params: { periodo:{inicio,fim}, filtros?, recursos? }
        const p = params || {};
        const periodo = p.periodo || {};
        const inicio = assertYmd(periodo.inicio, "periodo.inicio");
        const fim = assertYmd(periodo.fim, "periodo.fim");

        return await callAction(callApiData, "Agenda.Listar", {
          periodo: { inicio, fim },
          filtros: p.filtros || {},
          recursos: p.recursos || {}
        });
      },

      async criar(payload) {
        // payload: {data, hora_inicio, duracao_minutos, idPaciente?, titulo?, notas?, tipo?, origem?, status?, permitirEncaixe?}
        return await callAction(callApiData, "Agenda.Criar", payload || {});
      },

      async atualizar(idAgenda, patch) {
        const id = String(idAgenda || "").trim();
        if (!id) {
          const err = new Error('"idAgenda" é obrigatório.');
          err.code = "VALIDATION_ERROR";
          err.details = { field: "idAgenda" };
          throw err;
        }
        if (!patch || typeof patch !== "object") {
          const err = new Error('"patch" é obrigatório (objeto).');
          err.code = "VALIDATION_ERROR";
          err.details = { field: "patch" };
          throw err;
        }
        return await callAction(callApiData, "Agenda.Atualizar", { idAgenda: id, patch });
      },

      async cancelar(idAgenda, motivo) {
        const id = String(idAgenda || "").trim();
        if (!id) {
          const err = new Error('"idAgenda" é obrigatório.');
          err.code = "VALIDATION_ERROR";
          err.details = { field: "idAgenda" };
          throw err;
        }
        return await callAction(callApiData, "Agenda.Cancelar", {
          idAgenda: id,
          motivo: motivo ? String(motivo).slice(0, 500) : ""
        });
      },

      async validarConflito(payload) {
        // payload: {data, hora_inicio, duracao_minutos, ignoreIdAgenda?, permitirEncaixe?, tipo?}
        return await callAction(callApiData, "Agenda.ValidarConflito", payload || {});
      },

      async bloquearHorario(payload) {
        // payload: {data, hora_inicio, duracao_minutos, titulo?, notas?, origem?}
        return await callAction(callApiData, "Agenda.BloquearHorario", payload || {});
      },

      async desbloquearHorario(idAgenda, motivo) {
        const id = String(idAgenda || "").trim();
        if (!id) {
          const err = new Error('"idAgenda" é obrigatório.');
          err.code = "VALIDATION_ERROR";
          err.details = { field: "idAgenda" };
          throw err;
        }
        return await callAction(callApiData, "Agenda.DesbloquearHorario", {
          idAgenda: id,
          motivo: motivo ? String(motivo).slice(0, 500) : ""
        });
      }
    };
  }

  PRONTIO.features.agenda.api = { createAgendaApi };
})(window);
