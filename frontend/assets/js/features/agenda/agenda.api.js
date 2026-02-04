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
 * ✅ Ajuste aplicado (canônico):
 * - Envia idProfissional (obrigatório) em TODOS os fluxos da Agenda.
 * - Usa actions canônicas com ponto (Agenda.*) sempre que existirem no Registry.
 * - Aceita input legacy (hora_inicio/duracao_minutos) mas NORMALIZA para camelCase no payload enviado.
 * - Evita ID_Agenda / snake_case no payload enviado ao backend.
 * - ✅ NOVO: Agenda.ListarEventosDiaParaValidacao (payload { idProfissional, data })
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
  // Helpers: sessão (idProfissional / idClinica)
  // ------------------------------------------------------------
  function getSessionUser_(PRONTIORef) {
    try {
      const s = PRONTIORef && PRONTIORef.core && PRONTIORef.core.session;
      if (s && typeof s.getUser === "function") return s.getUser();
    } catch (_) {}
    return null;
  }

  function requireIdProfissional_(PRONTIORef) {
    const u = getSessionUser_(PRONTIORef);
    const idProf = u && u.idProfissional ? String(u.idProfissional).trim() : "";
    if (!idProf) {
      const err = new Error('"idProfissional" não encontrado na sessão. Faça login como profissional ou selecione um profissional.');
      err.code = "AUTH_CONTEXT_MISSING";
      err.details = { field: "idProfissional" };
      throw err;
    }
    return idProf;
  }

  function getIdClinica_(PRONTIORef) {
    const u = getSessionUser_(PRONTIORef);
    const idClinica = u && u.idClinica ? String(u.idClinica).trim() : "";
    return idClinica || "";
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
    if (isEnvelope(result)) {
      if (result.success) return result.data;
      throw buildApiErrorFromEnvelope(result);
    }

    if (result && typeof result === "object" && isEnvelope(result.envelope)) {
      const env = result.envelope;
      if (env.success) return env.data;
      throw buildApiErrorFromEnvelope(env);
    }

    return result;
  }

  // ✅ P0-1: Suporta AbortSignal para cancelamento de requisições
  async function callAction(callApiData, action, payload, signal) {
    // Verifica se já foi cancelado antes de iniciar
    if (signal && signal.aborted) {
      const err = new Error("Requisição cancelada");
      err.name = "AbortError";
      throw err;
    }

    const res = await callApiData({ action, payload: payload || {}, signal });
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

    // Validação de data real (não só formato)
    const [y, m, d] = s.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      const err = new Error(`Campo "${fieldName}" contém data inválida (dia não existe).`);
      err.code = "VALIDATION_ERROR";
      err.details = { field: fieldName, value: v };
      throw err;
    }

    return s;
  }

  // ------------------------------------------------------------
  // Helpers: datas para Agenda.ListarPorPeriodo
  // ------------------------------------------------------------
  function ymdToLocalStart_(ymd) {
    const s = assertYmd(ymd, "ymd");
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(5, 7), 10) - 1;
    const d = parseInt(s.slice(8, 10), 10);
    return new Date(y, m, d, 0, 0, 0, 0);
  }

  function ymdToLocalEnd_(ymd) {
    const s = assertYmd(ymd, "ymd");
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(5, 7), 10) - 1;
    const d = parseInt(s.slice(8, 10), 10);
    return new Date(y, m, d, 23, 59, 59, 999);
  }

  // ------------------------------------------------------------
  // Helpers: normalização de payload legacy -> camelCase
  // ------------------------------------------------------------
  function pick_(obj, keys) {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) return obj[k];
    }
    return undefined;
  }

  function toBool_(v) {
    return v === true;
  }

  function normalizeHoraInicio_(p0) {
    const v = pick_(p0, ["horaInicio", "hora_inicio"]);
    return v !== undefined ? String(v) : "";
  }

  function normalizeDuracaoMin_(p0) {
    const v = pick_(p0, ["duracaoMin", "duracao_minutos", "duracaoMinutos"]);
    return v !== undefined ? Number(v) : 0;
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
        return await callAction(callApiData, "AgendaConfig.Salvar", payload || {});
      },

      // -----------------------
      // Agenda (canônico)
      // -----------------------
      // ✅ P0-1: Suporta signal para cancelamento de requisições
      async listar(params) {
        const p = params || {};
        const periodo = p.periodo || {};
        const inicioYmd = assertYmd(periodo.inicio, "periodo.inicio");
        const fimYmd = assertYmd(periodo.fim, "periodo.fim");

        const inicio = ymdToLocalStart_(inicioYmd);
        const fim = ymdToLocalEnd_(fimYmd);

        const idProfissional = requireIdProfissional_(PRONTIORef);
        const idClinica = getIdClinica_(PRONTIORef);

        const payload = {
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          idProfissional,
          incluirCancelados: !!(p.filtros && p.filtros.incluirCancelados === true),
          idPaciente: (p.filtros && p.filtros.idPaciente) ? String(p.filtros.idPaciente) : null
        };

        if (idClinica) payload.idClinica = idClinica;

        // ✅ P0-1: Passa signal para permitir cancelamento
        return await callAction(callApiData, "Agenda.ListarPorPeriodo", payload, p.signal);
      },

      async criar(payload) {
        const idProfissional = requireIdProfissional_(PRONTIORef);
        const idClinica = getIdClinica_(PRONTIORef);

        const p0 = payload || {};
        const p = Object.assign({}, p0);

        p.idProfissional = idProfissional;
        if (idClinica && p.idClinica === undefined) p.idClinica = idClinica;

        return await callAction(callApiData, "Agenda.Criar", p);
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

        const idProfissional = requireIdProfissional_(PRONTIORef);
        const idClinica = getIdClinica_(PRONTIORef);

        const payload = { idAgenda: id, patch: Object.assign({}, patch) };
        payload.idProfissional = idProfissional;
        if (idClinica) payload.idClinica = idClinica;

        return await callAction(callApiData, "Agenda.Atualizar", payload);
      },

      async cancelar(idAgenda, motivo) {
        const id = String(idAgenda || "").trim();
        if (!id) {
          const err = new Error('"idAgenda" é obrigatório.');
          err.code = "VALIDATION_ERROR";
          err.details = { field: "idAgenda" };
          throw err;
        }

        const idProfissional = requireIdProfissional_(PRONTIORef);
        const idClinica = getIdClinica_(PRONTIORef);

        const payload = {
          idAgenda: id,
          motivo: motivo ? String(motivo).slice(0, 500) : "",
          idProfissional
        };
        if (idClinica) payload.idClinica = idClinica;

        return await callAction(callApiData, "Agenda.Cancelar", payload);
      },

      async validarConflito(payload) {
        const idProfissional = requireIdProfissional_(PRONTIORef);
        const idClinica = getIdClinica_(PRONTIORef);

        const p0 = payload || {};
        const data = p0.data ? String(p0.data) : "";
        const horaInicio = normalizeHoraInicio_(p0);
        const duracaoMin = normalizeDuracaoMin_(p0);

        const p = {
          idProfissional,
          data,
          horaInicio,
          duracaoMin,
          ignoreIdAgenda: pick_(p0, ["ignoreIdAgenda", "ignore_id_agenda", "ignoreId"]) || null,
          permitirEncaixe: toBool_(pick_(p0, ["permitirEncaixe", "permiteEncaixe"]))
        };

        if (idClinica) p.idClinica = idClinica;

        return await callAction(callApiData, "Agenda.ValidarConflito", p);
      },

      // ✅ NOVO: usado por UI para pré-carregar eventos do dia (slots)
      async listarEventosDiaParaValidacao(payload) {
        const idProfissional = requireIdProfissional_(PRONTIORef);
        const idClinica = getIdClinica_(PRONTIORef);

        const p0 = payload || {};
        const data = assertYmd(p0.data, "data");

        const p = { idProfissional, data };
        if (idClinica) p.idClinica = idClinica;

        return await callAction(callApiData, "Agenda.ListarEventosDiaParaValidacao", p);
      },

      async bloquearHorario(payload) {
        const idProfissional = requireIdProfissional_(PRONTIORef);
        const idClinica = getIdClinica_(PRONTIORef);

        const p0 = payload || {};
        const p = {
          idProfissional,
          data: p0.data ? String(p0.data) : "",
          horaInicio: normalizeHoraInicio_(p0),
          duracaoMin: normalizeDuracaoMin_(p0),
          titulo: p0.titulo ? String(p0.titulo) : "",
          notas: p0.notas ? String(p0.notas) : "",
          origem: p0.origem ? String(p0.origem) : "SISTEMA"
        };

        if (idClinica) p.idClinica = idClinica;

        return await callAction(callApiData, "Agenda.BloquearHorario", p);
      },

      async desbloquearHorario(idAgenda, motivo) {
        const id = String(idAgenda || "").trim();
        if (!id) {
          const err = new Error('"idAgenda" é obrigatório.');
          err.code = "VALIDATION_ERROR";
          err.details = { field: "idAgenda" };
          throw err;
        }

        const idProfissional = requireIdProfissional_(PRONTIORef);
        const idClinica = getIdClinica_(PRONTIORef);

        const payload = {
          idAgenda: id,
          motivo: motivo ? String(motivo).slice(0, 500) : "",
          idProfissional
        };
        if (idClinica) payload.idClinica = idClinica;

        return await callAction(callApiData, "Agenda.DesbloquearHorario", payload);
      }
    };
  }

  PRONTIO.features.agenda.api = { createAgendaApi };
})(window);
