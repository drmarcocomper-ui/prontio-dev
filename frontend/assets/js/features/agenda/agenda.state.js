// frontend/assets/js/features/agenda/agenda.state.js
(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  const KEY_VIEW = "prontio.agenda.modoVisao";
  const KEY_FILTERS = "prontio.agenda.filtros.v2"; // v2 (profissional)

  function safeJsonParse(raw, fallback) {
    try {
      if (!raw) return fallback;
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function createAgendaState(storage) {
    const modoSalvo = storage ? storage.getItem(KEY_VIEW) : null;
    const modoVisao = modoSalvo === "semana" ? "semana" : "dia";

    const filtrosSalvos = storage ? safeJsonParse(storage.getItem(KEY_FILTERS), null) : null;

    return {
      modoVisao,
      dataSelecionada: "",

      filtros: {
        nome: String((filtrosSalvos && filtrosSalvos.nome) || ""),
        status: String((filtrosSalvos && filtrosSalvos.status) || "")
      },

      // config
      config: {
        hora_inicio_padrao: "08:00",
        hora_fim_padrao: "18:00",
        duracao_grade_minutos: 15
      },
      configCarregada: false,

      // dados
      agendamentosPeriodo: [], // sempre DTO canônico
      agendamentosDiaUi: [], // já no shape UI simplificado para render

      // seleção
      pacienteNovo: null,
      pacienteEditar: null,
      agendamentoEmEdicao: null,

      // concorrência leve
      inFlight: {
        statusById: new Set(),
        desbloquearById: new Set()
      }
    };
  }

  PRONTIO.features.agenda.state = { createAgendaState, KEY_VIEW, KEY_FILTERS };
})(window);
