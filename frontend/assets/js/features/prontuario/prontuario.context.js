(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.prontuario = PRONTIO.features.prontuario || {};

  function getQueryParams() {
    const params = new URLSearchParams(global.location.search || "");
    const obj = {};
    params.forEach((v, k) => (obj[k] = v));
    return obj;
  }

  // ✅ Padronização (2026):
  // - Fonte oficial do nome no front: nomeCompleto
  // - Removido uso de nome_paciente
  function carregarContextoProntuario() {
    const params = getQueryParams();
    let ctxStorage = null;
    let ctxState = null;

    try {
      const raw = global.localStorage.getItem("prontio.prontuarioContexto");
      if (raw) ctxStorage = JSON.parse(raw);
    } catch (e) {}

    try {
      if (PRONTIO.core && PRONTIO.core.state && PRONTIO.core.state.getPacienteAtual) {
        ctxState = PRONTIO.core.state.getPacienteAtual();
      } else if (PRONTIO.state && PRONTIO.state.getPacienteAtual) {
        ctxState = PRONTIO.state.getPacienteAtual();
      }
    } catch (e) {}

    const idPaciente =
      params.idPaciente ||
      params.pacienteId ||
      params.id ||
      (ctxStorage && (ctxStorage.ID_Paciente || ctxStorage.idPaciente)) ||
      (ctxState && (ctxState.ID_Paciente || ctxState.idPaciente)) ||
      "";

    const idAgenda =
      params.idAgenda ||
      params.agendaId ||
      (ctxStorage && (ctxStorage.ID_Agenda || ctxStorage.idAgenda)) ||
      (ctxState && (ctxState.ID_Agenda || ctxState.idAgenda)) ||
      "";

    const nomeCompleto =
      params.nomeCompleto ||
      params.pacienteNomeCompleto ||
      params.nome ||
      params.pacienteNome ||
      (ctxStorage && (ctxStorage.nomeCompleto || ctxStorage.nome)) ||
      (ctxState && (ctxState.nomeCompleto || ctxState.nome)) ||
      "—";

    return {
      idPaciente: String(idPaciente || "").trim(),
      ID_Paciente: String(idPaciente || "").trim(),

      idAgenda: String(idAgenda || "").trim(),
      ID_Agenda: String(idAgenda || "").trim(),

      nomeCompleto: String(nomeCompleto || "").trim() || "—",

      // alias (compat)
      nome: String(nomeCompleto || "").trim() || "—",
    };
  }

  PRONTIO.features.prontuario.context = {
    getQueryParams,
    carregarContextoProntuario,
  };
})(window, document);
