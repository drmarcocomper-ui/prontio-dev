// frontend/assets/js/features/pacientes/pacientes.api.js
/**
 * PRONTIO — Pacientes API (Front)
 * ------------------------------------------------------------
 * ✅ Expandido:
 * - listar / criar / atualizar / alterarStatusAtivo / buscarSimples
 * - dot-actions (canônico quando existir) + fallback underscore/legacy
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

  async function callWithFallback(callApiData, actionDot, actionUnderscore, payload) {
    try {
      return await callAction(callApiData, actionDot, payload || {});
    } catch (e) {
      if (!actionUnderscore) throw e;
      return await callAction(callApiData, actionUnderscore, payload || {});
    }
  }

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
      nomeCompleto,
      nome: nomeCompleto, // alias compat
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

      // Registry suporta dot e underscore
      const data = await callWithFallback(callApiData, "Pacientes.BuscarSimples", "Pacientes_BuscarSimples", payload);
      return {
        pacientes: (data && data.pacientes ? data.pacientes : []).map(normalizePatientObj).filter(Boolean)
      };
    }

    async function listar(payload) {
      // Registry: Pacientes.Listar alias de Pacientes_Listar
      return await callWithFallback(callApiData, "Pacientes.Listar", "Pacientes_Listar", payload || {});
    }

    async function criar(payload) {
      // Registry: Pacientes.Criar alias de Pacientes_Criar
      return await callWithFallback(callApiData, "Pacientes.Criar", "Pacientes_Criar", payload || {});
    }

    async function atualizar(payload) {
      // ✅ Registry agora tem Pacientes.Atualizar
      return await callWithFallback(callApiData, "Pacientes.Atualizar", "Pacientes_Atualizar", payload || {});
    }

    async function obterPorId(idPaciente) {
      const id = String(idPaciente || "").trim();
      if (!id) {
        const err = new Error('"idPaciente" é obrigatório.');
        err.code = "VALIDATION_ERROR";
        throw err;
      }
      return await callWithFallback(callApiData, "Pacientes.ObterPorId", "Pacientes_ObterPorId", { idPaciente: id });
    }

    async function listarSelecao(payload) {
      return await callWithFallback(callApiData, "Pacientes.ListarSelecao", "Pacientes_ListarSelecao", payload || {});
    }

    async function alterarStatusAtivo(payload) {
      // Registry: Pacientes.AlterarStatusAtivo alias de Pacientes_AlterarStatusAtivo
      return await callWithFallback(callApiData, "Pacientes.AlterarStatusAtivo", "Pacientes_AlterarStatusAtivo", payload || {});
    }

    return { buscarSimples, listar, criar, atualizar, alterarStatusAtivo, obterPorId, listarSelecao };
  }

  PRONTIO.features.pacientes.api = { createPacientesApi, normalizePatientObj };
})(window);
