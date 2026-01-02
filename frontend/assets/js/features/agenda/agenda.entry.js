// frontend/assets/js/features/agenda/agenda.events.js
(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  /**
   * Binder de eventos COMPATÍVEL com o controller NOVO:
   * controller = { state, actions, view }
   *
   * ⚠️ NÃO usa controller.initWithDom (legado).
   */
  function bindAgendaEvents({ document, dom, controller }) {
    const actions = controller && controller.actions ? controller.actions : null;
    const view = controller && controller.view ? controller.view : null;

    if (!actions || !dom) {
      console.error("[AgendaEvents] controller.actions/dom ausentes.");
      return;
    }

    // ====== DATA ======
    dom.inputData && dom.inputData.addEventListener("change", () => actions.onChangeData());

    dom.btnHoje && dom.btnHoje.addEventListener("click", () => actions.onHoje());
    dom.btnAgora && dom.btnAgora.addEventListener("click", () => actions.onAgora());

    dom.btnDiaAnterior && dom.btnDiaAnterior.addEventListener("click", () => actions.onNav(-1));
    dom.btnDiaPosterior && dom.btnDiaPosterior.addEventListener("click", () => actions.onNav(+1));

    // ====== VISÃO ======
    dom.btnVisaoDia && dom.btnVisaoDia.addEventListener("click", () => actions.setVisao("dia"));
    dom.btnVisaoSemana && dom.btnVisaoSemana.addEventListener("click", () => actions.setVisao("semana"));

    // ====== FILTROS ======
    let filtroDebounce = null;
    function scheduleFiltros() {
      if (filtroDebounce) clearTimeout(filtroDebounce);
      filtroDebounce = setTimeout(() => {
        actions.onFiltrosChanged(
          dom.inputFiltroNome ? dom.inputFiltroNome.value : "",
          dom.selectFiltroStatus ? dom.selectFiltroStatus.value : ""
        );
      }, 120);
    }

    dom.inputFiltroNome && dom.inputFiltroNome.addEventListener("input", scheduleFiltros);
    dom.inputFiltroNome && dom.inputFiltroNome.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); scheduleFiltros(); }
    });
    dom.selectFiltroStatus && dom.selectFiltroStatus.addEventListener("change", scheduleFiltros);

    dom.btnLimparFiltros && dom.btnLimparFiltros.addEventListener("click", () => actions.limparFiltros());

    // ====== AÇÕES ======
    dom.btnNovoAgendamento && dom.btnNovoAgendamento.addEventListener("click", () => actions.abrirModalNovo());
    dom.btnBloquearHorario && dom.btnBloquearHorario.addEventListener("click", () => actions.abrirModalBloqueio());

    // ====== MODAL NOVO ======
    dom.btnFecharModalNovo && dom.btnFecharModalNovo.addEventListener("click", () => actions.fecharModalNovo());
    dom.btnCancelarModalNovo && dom.btnCancelarModalNovo.addEventListener("click", () => actions.fecharModalNovo());
    dom.modalNovo && dom.modalNovo.addEventListener("click", (event) => {
      if (event.target === dom.modalNovo) actions.fecharModalNovo();
    });
    dom.formNovo && dom.formNovo.addEventListener("submit", (e) => { e.preventDefault(); actions.submitNovo(); });

    // ====== MODAL EDITAR ======
    dom.btnFecharModalEditar && dom.btnFecharModalEditar.addEventListener("click", () => actions.fecharModalEditar());
    dom.btnCancelarEditar && dom.btnCancelarEditar.addEventListener("click", () => actions.fecharModalEditar());
    dom.modalEdit && dom.modalEdit.addEventListener("click", (event) => {
      if (event.target === dom.modalEdit) actions.fecharModalEditar();
    });
    dom.formEditar && dom.formEditar.addEventListener("submit", (e) => { e.preventDefault(); actions.submitEditar(); });

    // ====== MODAL BLOQUEIO ======
    dom.btnFecharModalBloqueio && dom.btnFecharModalBloqueio.addEventListener("click", () => actions.fecharModalBloqueio());
    dom.btnCancelarBloqueio && dom.btnCancelarBloqueio.addEventListener("click", () => actions.fecharModalBloqueio());
    dom.modalBloqueio && dom.modalBloqueio.addEventListener("click", (event) => {
      if (event.target === dom.modalBloqueio) actions.fecharModalBloqueio();
    });
    dom.formBloqueio && dom.formBloqueio.addEventListener("submit", (e) => { e.preventDefault(); actions.submitBloqueio(); });

    // ====== PACIENTES PICKER (reutilizável) ======
    dom.btnSelecionarPaciente && dom.btnSelecionarPaciente.addEventListener("click", () => actions.openPacientePicker("novo"));
    dom.btnEditSelecionarPaciente && dom.btnEditSelecionarPaciente.addEventListener("click", () => actions.openPacientePicker("editar"));

    dom.btnFecharModalPacientes && dom.btnFecharModalPacientes.addEventListener("click", () => actions.closePacientePicker());

    dom.btnLimparPaciente && dom.btnLimparPaciente.addEventListener("click", () => actions.clearPaciente("novo"));
    dom.btnEditLimparPaciente && dom.btnEditLimparPaciente.addEventListener("click", () => actions.clearPaciente("editar"));

    // ====== ESC fecha modal ======
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      if (actions.isPacientePickerOpen && actions.isPacientePickerOpen()) {
        e.preventDefault();
        actions.closePacientePicker();
        return;
      }

      if (view && view.isModalVisible) {
        if (view.isModalVisible(dom.modalPacientes)) { e.preventDefault(); actions.closePacientePicker(); return; }
        if (view.isModalVisible(dom.modalBloqueio)) { e.preventDefault(); actions.fecharModalBloqueio(); return; }
        if (view.isModalVisible(dom.modalEdit)) { e.preventDefault(); actions.fecharModalEditar(); return; }
        if (view.isModalVisible(dom.modalNovo)) { e.preventDefault(); actions.fecharModalNovo(); return; }
      }
    });
  }

  PRONTIO.features.agenda.events = { bindAgendaEvents };
})(window);
