// frontend/assets/js/core/state.js
// =====================================
// PRONTIO - core/state.js
// Estado global leve do PRONTIO
//
// - Paciente atual (id, nome)
// - Agendamento atual (id)
// - Sincroniza com localStorage para persistir entre páginas.
//
// Uso recomendado:
//
//   const state = PRONTIO.core.state;
//   state.setPacienteAtual({ id: 'P123', nome: 'Fulano' });
//   const paciente = state.getPacienteAtual();
//
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const core = (PRONTIO.core = PRONTIO.core || {});
  const stateNS = (core.state = core.state || {});

  const KEYS = {
    PACIENTE_ID: "prontio_pacienteAtualId",
    PACIENTE_NOME: "prontio_pacienteAtualNome",
    AGENDA_ID: "prontio_agendaAtualId",
  };

  let pacienteAtual = null; // { id, nome } ou null
  let agendaAtualId = null;

  // -----------------------------------------
  // Helpers de localStorage seguros
  // -----------------------------------------
  function lsGet(key) {
    try {
      return global.localStorage ? global.localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      if (!global.localStorage) return;
      if (value === null || value === undefined) {
        global.localStorage.removeItem(key);
      } else {
        global.localStorage.setItem(key, value);
      }
    } catch (e) {
      // Ignora erros (modo privado, etc.)
    }
  }

  // -----------------------------------------
  // Inicialização a partir do localStorage
  // -----------------------------------------
  function initFromStorage() {
    const id = lsGet(KEYS.PACIENTE_ID);
    const nome = lsGet(KEYS.PACIENTE_NOME);

    if (id) {
      pacienteAtual = { id: id, nome: nome || "" };
    } else {
      pacienteAtual = null;
    }

    const agId = lsGet(KEYS.AGENDA_ID);
    agendaAtualId = agId || null;
  }

  // Executa uma vez na carga do arquivo
  initFromStorage();

  // -----------------------------------------
  // Paciente atual
  // -----------------------------------------
  function setPacienteAtualInternal(paciente) {
    if (!paciente || !paciente.id) {
      pacienteAtual = null;
      lsSet(KEYS.PACIENTE_ID, null);
      lsSet(KEYS.PACIENTE_NOME, null);
      return;
    }

    pacienteAtual = {
      id: paciente.id,
      nome: paciente.nome || "",
    };

    lsSet(KEYS.PACIENTE_ID, pacienteAtual.id);
    lsSet(KEYS.PACIENTE_NOME, pacienteAtual.nome);
  }

  function getPacienteAtualInternal() {
    // devolve uma cópia para evitar mutação externa acidental
    return pacienteAtual ? { ...pacienteAtual } : null;
  }

  function clearPacienteAtualInternal() {
    setPacienteAtualInternal(null);
  }

  // -----------------------------------------
  // Agenda atual
  // -----------------------------------------
  function setAgendaAtualInternal(idAgenda) {
    if (!idAgenda) {
      agendaAtualId = null;
      lsSet(KEYS.AGENDA_ID, null);
      return;
    }

    agendaAtualId = String(idAgenda);
    lsSet(KEYS.AGENDA_ID, agendaAtualId);
  }

  function getAgendaAtualInternal() {
    return agendaAtualId;
  }

  function clearAgendaAtualInternal() {
    setAgendaAtualInternal(null);
  }

  // -----------------------------------------
  // Exposição pública em PRONTIO.core.state
  // -----------------------------------------
  stateNS.setPacienteAtual = setPacienteAtualInternal;
  stateNS.getPacienteAtual = getPacienteAtualInternal;
  stateNS.clearPacienteAtual = clearPacienteAtualInternal;

  stateNS.setAgendaAtual = setAgendaAtualInternal;
  stateNS.getAgendaAtual = getAgendaAtualInternal;
  stateNS.clearAgendaAtual = clearAgendaAtualInternal;

})(window);
