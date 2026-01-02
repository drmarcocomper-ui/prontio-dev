// frontend/assets/js/features/pacientes/pacientes.api.js
/**
 * PRONTIO — Pacientes API (Front)
 * ------------------------------------------------------------
 * Objetivo:
 * - Centralizar ações de pacientes (contrato profissional) em 1 lugar.
 * - Permitir migração suave do legado:
 *   - Preferir "Pacientes.BuscarSimples"
 *   - Fallback para "Pacientes_BuscarSimples"
 *
 * Regras:
 * - Não conhece DOM.
 * - Só conhece callApiData (core).
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.pacientes = PRONTIO.features.pacientes || {};

  function resolveCallApiData(PRONTIORef) {
    if (PRONTIORef && PRONTIORef.api && typeof PRONTIORef.api.callApiData === "function") {
      return PRONTIORef.api.callApiData;
    }
    if (typeof global.callApiData === "function") return global.callApiData;

    return function () {
      console.error("[PacientesApi] callApiData não está definido.");
      return Promise.reject(new Error("API não inicializada (callApiData indefinido)."));
    };
  }

  function isEnvelope(obj) {
    return !!obj && typeof obj === "object" && typeof obj.success === "boolean" && Array.isArray(obj.errors);
  }

  function unwrapData(result) {
    if (isEnvelope(result)) {
      if (result.success) return result.data;
      const e0 = result.errors && result.errors[0] ? result.errors[0] : null;
      const err = new Error((e0 && e0.message) ? String(e0.message) : "Erro na API.");
      err.code = (e0 && e0.code) ? String(e0.code) : "API_ERROR";
      err.details = (e0 && e0.details !== undefined) ? e0.details : null;
      err.envelope = result;
      throw err;
    }
    return result;
  }

  async function callAction(callApiData, action, payload) {
    const res = await callApiData({ action, payload: payload || {} });
    return unwrapData(res);
  }

  function normalizePatientObj(p) {
    if (!p || typeof p !== "object") return null;
    return {
      idPaciente: String(p.ID_Paciente || p.idPaciente || p.id || p.ID || ""),
      nome: String(p.nome || ""),
      documento: String(p.documento || ""),
      telefone: String(p.telefone || ""),
      data_nascimento: String(p.data_nascimento || "")
    };
  }

  function createPacientesApi(PRONTIORef) {
    const callApiData = resolveCallApiData(PRONTIORef);

    async function buscarSimples(termo, limite) {
      const t = String(termo || "").trim();
      if (t.length < 2) return { pacientes: [] };

      const payload = { termo: t, limite: (typeof limite === "number" && limite > 0) ? limite : 12 };

      // Preferência: contrato novo
      try {
        const data = await callAction(callApiData, "Pacientes.BuscarSimples", payload);
        return {
          pacientes: (data && data.pacientes ? data.pacientes : []).map(normalizePatientObj).filter(Boolean)
        };
      } catch (e) {
        // fallback: legado
        const data = await callAction(callApiData, "Pacientes_BuscarSimples", payload);
        return {
          pacientes: (data && data.pacientes ? data.pacientes : []).map(normalizePatientObj).filter(Boolean)
        };
      }
    }

    return { buscarSimples };
  }

  PRONTIO.features.pacientes.api = { createPacientesApi, normalizePatientObj };
})(window);
