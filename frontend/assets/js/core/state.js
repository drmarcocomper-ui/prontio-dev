// frontend/assets/js/core/state.js
// =====================================
// PRONTIO - core/state.js
// Estado global leve do PRONTIO (PASSO 3)
//
// - Paciente atual (id, nome)
// - Agendamento atual (id)
// - Sincroniza com localStorage para persistir entre páginas.
//
// ✅ PASSO 3 (Consolidação):
// - Usa um único store: "prontio.core.state.v1"
// - Mantém retrocompat: lê/migra chaves antigas por módulo
// - Dispara evento "prontio:state-changed" quando algo muda
//
// Uso recomendado:
//
//   const state = PRONTIO.core.state;
//   state.setPacienteAtual({ id: 'P123', nome: 'Fulano' });
//   const paciente = state.getPacienteAtual();
//
// =====================================

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const core = (PRONTIO.core = PRONTIO.core || {});
  const stateNS = (core.state = core.state || {});

  // ✅ novo store único
  const STORE_KEY = "prontio.core.state.v1";

  // ✅ legado (mantido para migração/compat)
  const LEGACY_KEYS = {
    PACIENTE_ID: "prontio_pacienteAtualId",
    PACIENTE_NOME: "prontio_pacienteAtualNome",
    AGENDA_ID: "prontio_agendaAtualId"
  };

  // estado em memória
  let store = {
    pacienteAtual: null, // { id, nome } | null
    agendaAtualId: null  // string|null
  };

  // -----------------------------------------
  // Helpers de localStorage seguros
  // -----------------------------------------
  function lsGet(key) {
    try {
      return global.localStorage ? global.localStorage.getItem(key) : null;
    } catch (_) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      if (!global.localStorage) return;
      if (value === null || value === undefined) global.localStorage.removeItem(key);
      else global.localStorage.setItem(key, String(value));
    } catch (_) {}
  }

  function lsGetJson(key) {
    const raw = lsGet(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function lsSetJson(key, obj) {
    try {
      if (!global.localStorage) return;
      if (obj === null || obj === undefined) {
        global.localStorage.removeItem(key);
      } else {
        global.localStorage.setItem(key, JSON.stringify(obj));
      }
    } catch (_) {}
  }

  function dispatchStateChanged_(payload) {
    try {
      const detail = payload || {};
      const ev = new CustomEvent("prontio:state-changed", { detail });
      global.dispatchEvent(ev);
    } catch (e) {
      try {
        const ev = document.createEvent("Event");
        ev.initEvent("prontio:state-changed", true, true);
        ev.detail = payload || {};
        global.dispatchEvent(ev);
      } catch (_) {}
    }
  }

  function saveStore_(reason) {
    lsSetJson(STORE_KEY, store);
    dispatchStateChanged_({ reason: reason || "save", state: getSnapshot_() });
  }

  function getSnapshot_() {
    return {
      pacienteAtual: store.pacienteAtual ? { ...store.pacienteAtual } : null,
      agendaAtualId: store.agendaAtualId ? String(store.agendaAtualId) : null
    };
  }

  // -----------------------------------------
  // Inicialização + migração de legado
  // -----------------------------------------
  function initFromStorage_() {
    const fromNew = lsGetJson(STORE_KEY);
    if (fromNew && typeof fromNew === "object") {
      store.pacienteAtual = (fromNew.pacienteAtual && fromNew.pacienteAtual.id)
        ? { id: String(fromNew.pacienteAtual.id), nome: String(fromNew.pacienteAtual.nome || "") }
        : null;

      store.agendaAtualId = fromNew.agendaAtualId ? String(fromNew.agendaAtualId) : null;
      return;
    }

    // Se não existe novo store, tenta legado e migra
    const legacyPacienteId = lsGet(LEGACY_KEYS.PACIENTE_ID);
    const legacyPacienteNome = lsGet(LEGACY_KEYS.PACIENTE_NOME);
    const legacyAgendaId = lsGet(LEGACY_KEYS.AGENDA_ID);

    if (legacyPacienteId) {
      store.pacienteAtual = { id: String(legacyPacienteId), nome: String(legacyPacienteNome || "") };
    } else {
      store.pacienteAtual = null;
    }

    store.agendaAtualId = legacyAgendaId ? String(legacyAgendaId) : null;

    // Migra para o novo store (sem apagar legado para não quebrar telas antigas)
    saveStore_("migrate-legacy");
  }

  initFromStorage_();

  // -----------------------------------------
  // Paciente atual (API pública compat)
  // -----------------------------------------
  function setPacienteAtualInternal(paciente) {
    if (!paciente || !paciente.id) {
      store.pacienteAtual = null;

      // mantém compat: limpa legado também
      lsSet(LEGACY_KEYS.PACIENTE_ID, null);
      lsSet(LEGACY_KEYS.PACIENTE_NOME, null);

      saveStore_("setPacienteAtual:clear");
      return;
    }

    store.pacienteAtual = {
      id: String(paciente.id),
      nome: String(paciente.nome || "")
    };

    // compat: escreve legado também (para telas antigas)
    lsSet(LEGACY_KEYS.PACIENTE_ID, store.pacienteAtual.id);
    lsSet(LEGACY_KEYS.PACIENTE_NOME, store.pacienteAtual.nome);

    saveStore_("setPacienteAtual");
  }

  function getPacienteAtualInternal() {
    return store.pacienteAtual ? { ...store.pacienteAtual } : null;
  }

  function clearPacienteAtualInternal() {
    setPacienteAtualInternal(null);
  }

  // -----------------------------------------
  // Agenda atual (API pública compat)
  // -----------------------------------------
  function setAgendaAtualInternal(idAgenda) {
    if (!idAgenda) {
      store.agendaAtualId = null;

      // compat
      lsSet(LEGACY_KEYS.AGENDA_ID, null);

      saveStore_("setAgendaAtual:clear");
      return;
    }

    store.agendaAtualId = String(idAgenda);

    // compat
    lsSet(LEGACY_KEYS.AGENDA_ID, store.agendaAtualId);

    saveStore_("setAgendaAtual");
  }

  function getAgendaAtualInternal() {
    return store.agendaAtualId ? String(store.agendaAtualId) : null;
  }

  function clearAgendaAtualInternal() {
    setAgendaAtualInternal(null);
  }

  // -----------------------------------------
  // Exposição pública em PRONTIO.core.state
  // -----------------------------------------
  stateNS.getSnapshot = getSnapshot_;

  stateNS.setPacienteAtual = setPacienteAtualInternal;
  stateNS.getPacienteAtual = getPacienteAtualInternal;
  stateNS.clearPacienteAtual = clearPacienteAtualInternal;

  stateNS.setAgendaAtual = setAgendaAtualInternal;
  stateNS.getAgendaAtual = getAgendaAtualInternal;
  stateNS.clearAgendaAtual = clearAgendaAtualInternal;

})(window);
