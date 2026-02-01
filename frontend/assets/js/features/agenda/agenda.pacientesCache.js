// frontend/assets/js/features/agenda/agenda.pacientesCache.js
/**
 * Cache local (front) para resolver nomeCompleto a partir de idPaciente.
 * - Agenda (backend) NÃO faz join com Pacientes.
 * - Front resolve exibição via cache persistido.
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  const STORAGE_KEY = "prontio.agenda.pacientesCache.v1";

  function safeJsonParse(raw, fallback) {
    try {
      if (!raw) return fallback;
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function createPacientesCache(storage, state) {
    storage = storage || global.localStorage;

    // maps em memória
    const nomeById = {};
    const miniById = {};

    function load() {
      const raw = storage ? storage.getItem(STORAGE_KEY) : null;
      const data = safeJsonParse(raw, null);
      if (!data) return;

      if (data.nomeById && typeof data.nomeById === "object") {
        Object.keys(data.nomeById).forEach((k) => (nomeById[k] = data.nomeById[k]));
      }
      if (data.miniById && typeof data.miniById === "object") {
        Object.keys(data.miniById).forEach((k) => (miniById[k] = data.miniById[k]));
      }
    }

    function save() {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ nomeById, miniById }));
      } catch (_) {}
    }

    function getPacienteId(p) {
      if (!p) return "";
      return String(p.idPaciente || p.ID_Paciente || "").trim();
    }

    function getNome(p) {
      if (!p) return "";
      return String(p.nomeCompleto || p.nome || "").trim();
    }

    function cachePaciente(p) {
      const id = getPacienteId(p);
      if (!id) return;

      const nome = getNome(p);
      if (nome) nomeById[id] = nome;

      miniById[id] = {
        idPaciente: id,
        nomeCompleto: nome || "",
        telefone: String(p.telefone || p.telefonePrincipal || "").trim(),
        documento: String(p.documento || p.cpf || "").trim()
      };

      save();
    }

    function resolveNomeFromId(idPaciente) {
      const id = String(idPaciente || "").trim();
      if (!id) return "";
      return String(nomeById[id] || "").trim();
    }

    function getMiniById(idPaciente) {
      const id = String(idPaciente || "").trim();
      return id ? (miniById[id] || null) : null;
    }

    function enrichUiList(uiList) {
      const list = Array.isArray(uiList) ? uiList : [];
      for (let i = 0; i < list.length; i++) {
        const ag = list[i];
        if (!ag) continue;

        // id do paciente pode vir em ID_Paciente ou idPaciente
        const id = String(ag.ID_Paciente || ag.idPaciente || "").trim();

        // se já tem nome, ok
        const already = String(ag.nomeCompleto || "").trim();
        if (already) continue;

        // bloqueio
        if (ag.bloqueio === true || String(ag.tipo || "").toUpperCase() === "BLOQUEIO") {
          ag.nomeCompleto = "Bloqueio";
          continue;
        }

        const nome = resolveNomeFromId(id);
        if (nome) ag.nomeCompleto = nome;
      }
      return list;
    }

    // inicializa
    load();

    // expõe também no state (opcional)
    if (state) {
      state.pacientesCache_nomeById = nomeById;
      state.pacientesCache_miniById = miniById;
    }

    return {
      cachePaciente,
      resolveNomeFromId,
      getMiniById,
      enrichUiList
    };
  }

  PRONTIO.features.agenda.pacientesCache = { createPacientesCache };
})(window);
