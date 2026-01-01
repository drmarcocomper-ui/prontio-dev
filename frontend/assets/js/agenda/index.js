/**
 * PRONTIO - Agenda Index (Etapa 2A)
 * - Inicializa: prefs, render dia, modal novo
 */
(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.agenda = PRONTIO.agenda || {};

  function init() {
    const state = PRONTIO.agenda.state;
    const prefs = PRONTIO.agenda.prefs;

    // Elementos base
    const inputData = document.getElementById("input-data");
    const container = document.getElementById("agenda-lista-horarios");

    if (!inputData || !container) {
      console.warn("[PRONTIO.agenda] DOM básico não encontrado (input-data/agenda-lista-horarios).");
      return;
    }

    // Prefs iniciais
    const p = prefs.load();
    state.setModoVisao(p.modoVisao);
    state.setFiltros(p.filtros);

    // Data inicial
    if (!inputData.value) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      inputData.value = `${y}-${m}-${d}`;
    }
    state.setDataSelecionada(inputData.value);

    // Render dia inicial
    PRONTIO.agenda.day.loadDay({ data: inputData.value, container });

    // Atualiza ao trocar data
    inputData.addEventListener("change", () => {
      const ds = inputData.value;
      state.setDataSelecionada(ds);
      PRONTIO.agenda.day.loadDay({ data: ds, container });
    });

    // Bind modal novo
    const modalCtx = {
      inputData,
      modalEl: document.getElementById("modal-novo-agendamento"),
      formEl: document.getElementById("form-novo-agendamento"),
      msgEl: document.getElementById("novo-agendamento-mensagem"),
      inputHoraInicio: document.getElementById("novo-hora-inicio"),
      inputDuracao: document.getElementById("novo-duracao"),
      inputNomePaciente: document.getElementById("novo-nome-paciente"),
      inputTelefone: document.getElementById("novo-telefone"),
      inputTipo: document.getElementById("novo-tipo"),
      inputMotivo: document.getElementById("novo-motivo"),
      inputOrigem: document.getElementById("novo-origem"),
      chkPermiteEncaixe: document.getElementById("novo-permite-encaixe"),
      btnSubmit: document.getElementById("btn-submit-novo"),
      btnClose: document.getElementById("btn-fechar-modal"),
      btnCancel: document.getElementById("btn-cancelar-modal")
    };

    const modalNew = PRONTIO.agenda.modalNew.bind(modalCtx);

    // Botão “Novo”
    const btnNovo = document.getElementById("btn-novo-agendamento");
    btnNovo && btnNovo.addEventListener("click", () => modalNew.open());

    // (Etapa 2B) Semana e bloqueio entram depois.
  }

  PRONTIO.agenda.init = init;
})(window);
