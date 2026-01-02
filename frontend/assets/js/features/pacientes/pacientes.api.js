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
 *
 * ✅ Padronização (2026):
 * - Nome no front: "nomeCompleto" (oficial)
 * - Campo "nome" fica como alias (compat), mas não é mais a verdade.
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

  /**
   * Normaliza paciente vindo do backend (novo ou legado) para o shape usado no front.
   * ✅ Nome oficial: nomeCompleto
   *
   * Aceita chaves comuns do projeto:
   * - idPaciente / ID_Paciente / id / ID
   * - nomeCompleto / nome / Nome
   * - cpf / documento
   * - telefonePrincipal / telefone
   * - dataNascimento / data_nascimento
   */
  function normalizePatientObj(p) {
    if (!p || typeof p !== "object") return null;

    const idPaciente = String(p.idPaciente || p.ID_Paciente || p.id || p.ID || "").trim();

    const nomeCompleto = String(
      p.nomeCompleto ||
      p.NomeCompleto ||
      p.nome ||
      p.Nome ||
      ""
    ).trim();

    // Documento: prioriza CPF quando existir
    const documento = String(
      p.cpf ||
      p.CPF ||
      p.documento ||
      p.documento_paciente ||
      ""
    ).trim();

    const telefone = String(
      p.telefonePrincipal ||
      p.telefone ||
      p.telefone_paciente ||
      ""
    ).trim();

    const dataNascimento = String(
      p.dataNascimento ||
      p.data_nascimento ||
      p.nascimento ||
      ""
    ).trim();

    return {
      idPaciente,
      // ✅ oficial
      nomeCompleto,
      // alias (compat com partes antigas; não usar como "verdade")
      nome: nomeCompleto,

      documento,
      telefone,
      data_nascimento: dataNascimento
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
