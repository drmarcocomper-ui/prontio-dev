/**
 * PRONTIO - Agenda State (LOCAL)
 * - Estado exclusivo da Agenda (UI), não interfere com PRONTIO.core.state
 */
(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.agenda = PRONTIO.agenda || {};

  const _state = {
    pacienteSelecionado: null,
    modoVisao: "dia", // "dia" | "semana" (semana entra na etapa 2B)
    filtros: { nome: "", status: "" },
    dataSelecionada: null
  };

  PRONTIO.agenda.state = {
    getPacienteSelecionado() {
      return _state.pacienteSelecionado;
    },
    setPacienteSelecionado(p) {
      _state.pacienteSelecionado = p || null;
    },

    getModoVisao() {
      return _state.modoVisao;
    },
    setModoVisao(modo) {
      _state.modoVisao = (modo === "semana") ? "semana" : "dia";
    },

    getFiltros() {
      return { ..._state.filtros };
    },
    setFiltros(f) {
      _state.filtros.nome = String((f && f.nome) || "");
      _state.filtros.status = String((f && f.status) || "");
    },

    getDataSelecionada() {
      return _state.dataSelecionada;
    },
    setDataSelecionada(ymd) {
      _state.dataSelecionada = ymd ? String(ymd) : null;
    },

    resetModalNovo() {
      _state.pacienteSelecionado = null;
    }
  };
})(window);
