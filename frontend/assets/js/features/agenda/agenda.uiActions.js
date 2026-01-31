// frontend/assets/js/features/agenda/agenda.uiActions.js
/**
 * PRONTIO — Agenda UI Actions (Front)
 * ------------------------------------------------------------
 * Responsável por:
 * - Navegação (dia/semana, hoje, agora, anterior/próximo)
 * - Filtros + persistência
 * - Abrir/fechar modais (Novo + Bloqueio)
 * - Integrar com loaders (recarregar dia/semana)
 * - Picker de pacientes (open/close/isOpen/clear)
 *
 * ✅ Como abrir na data atual:
 * - No init(dom), se o input-data estiver vazio, seta para HOJE.
 * - Em seguida, se não houver dataSelecionada, sincroniza com o input.
 *
 * Importante:
 * - Editar e Prontuário pertencem ao editActions.
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  const FX = PRONTIO.features.agenda.formatters;

  function createAgendaUiActions({ state, view, loaders }) {
    if (!state || !view || !loaders) {
      console.error("[AgendaUiActions] Dependências ausentes.");
      return {};
    }

    const storage = global.localStorage || null;

    const KEY_VIEW = "prontio.agenda.modoVisao";
    const KEY_FILTERS = "prontio.agenda.filtros.v2";

    function persistModo_() {
      try { storage?.setItem(KEY_VIEW, state.modoVisao); } catch (_) {}
    }

    function persistFiltros_() {
      try {
        storage?.setItem(KEY_FILTERS, JSON.stringify({
          nome: state.filtros?.nome || "",
          status: state.filtros?.status || ""
        }));
      } catch (_) {}
    }

    function ensureDate_() {
      if (!state.dom?.inputData) return "";
      if (!state.dom.inputData.value) {
        state.dom.inputData.value = FX.formatDateToInput(new Date());
      }
      return state.dom.inputData.value;
    }

    async function refresh_() {
      if (state.modoVisao === "semana") return loaders.carregarSemana();
      return loaders.carregarDia();
    }

    function init(dom) {
      state.dom = dom;

      // ✅ 1) garante que abre em HOJE (se vazio)
      ensureDate_();
      state.dataSelecionada = state.dom?.inputData?.value || "";

      // filtros persistidos
      try {
        const raw = storage?.getItem(KEY_FILTERS);
        if (raw) {
          const parsed = JSON.parse(raw);
          state.filtros = {
            nome: parsed?.nome || "",
            status: parsed?.status || ""
          };
        }
      } catch (_) {}

      if (dom.inputFiltroNome) dom.inputFiltroNome.value = state.filtros?.nome || "";
      if (dom.selectFiltroStatus) dom.selectFiltroStatus.value = state.filtros?.status || "";

      // visão persistida
      try {
        const v = storage?.getItem(KEY_VIEW);
        if (v === "semana" || v === "dia") state.modoVisao = v;
      } catch (_) {}

      // ✅ 2) aplica o toggle de visão já no init (sem recarregar aqui)
      view.setVisao?.(state.modoVisao, state.dom?.btnVisaoDia, state.dom?.btnVisaoSemana);
    }

    // -------------------------
    // Visão / Navegação
    // -------------------------
    async function setVisao(modo) {
      if (modo !== "dia" && modo !== "semana") return;
      state.modoVisao = modo;
      persistModo_();
      view.setVisao?.(modo, state.dom?.btnVisaoDia, state.dom?.btnVisaoSemana);
      await refresh_();
    }

    async function onChangeData() {
      state.dataSelecionada = ensureDate_();
      await refresh_();
    }

    async function onHoje() {
      if (!state.dom?.inputData) return;
      state.dom.inputData.value = FX.formatDateToInput(new Date());
      state.dataSelecionada = state.dom.inputData.value;
      await refresh_();
    }

    async function onAgora() {
      // mantém simples: vai para HOJE e recarrega
      await onHoje();
    }

    async function onNav(delta) {
      const v = ensureDate_();
      if (!v) return;

      const d = FX.parseInputDate(v);
      if (state.modoVisao === "semana") d.setDate(d.getDate() + 7 * delta);
      else d.setDate(d.getDate() + 1 * delta);

      state.dom.inputData.value = FX.formatDateToInput(d);
      state.dataSelecionada = state.dom.inputData.value;
      await refresh_();
    }

    // -------------------------
    // Filtros
    // -------------------------
    async function onFiltrosChanged(nome, status) {
      state.filtros = { nome: String(nome || ""), status: String(status || "") };
      persistFiltros_();
      await refresh_();
    }

    async function limparFiltros() {
      state.filtros = { nome: "", status: "" };
      persistFiltros_();

      if (state.dom?.inputFiltroNome) state.dom.inputFiltroNome.value = "";
      if (state.dom?.selectFiltroStatus) state.dom.selectFiltroStatus.value = "";

      await refresh_();
    }

    // -------------------------
    // Modais (UI pura): Novo + Bloqueio
    // -------------------------
    function abrirModalNovo(horaPre) {
      if (horaPre && state.dom?.novoHoraInicio) state.dom.novoHoraInicio.value = horaPre;
      view.openModal?.(state.dom?.modalNovo, state.dom?.novoHoraInicio || state.dom?.novoNomePaciente);
      view.setFormMsg?.(state.dom?.msgNovo, "", "");
      view.safeDisable?.(state.dom?.btnSubmitNovo, false);
    }

    function fecharModalNovo() {
      view.closeModal?.(state.dom?.modalNovo);
      state.dom?.formNovo?.reset?.();
      view.setFormMsg?.(state.dom?.msgNovo, "", "");
      view.safeDisable?.(state.dom?.btnSubmitNovo, false);
      state.pacienteNovo = null;
    }

    function abrirModalBloqueio(horaPre) {
      if (horaPre && state.dom?.bloqHoraInicio) state.dom.bloqHoraInicio.value = horaPre;
      view.openModal?.(state.dom?.modalBloqueio, state.dom?.bloqHoraInicio);
      view.setFormMsg?.(state.dom?.msgBloqueio, "", "");
      view.safeDisable?.(state.dom?.btnSubmitBloqueio, false);
    }

    function fecharModalBloqueio() {
      view.closeModal?.(state.dom?.modalBloqueio);
      state.dom?.formBloqueio?.reset?.();
      view.setFormMsg?.(state.dom?.msgBloqueio, "", "");
      view.safeDisable?.(state.dom?.btnSubmitBloqueio, false);
    }

    // -------------------------
    // Pacientes picker (UI)
    // -------------------------
    function openPacientePicker(mode) {
      if (!state.pacientesPicker) {
        alert("Seletor de pacientes não disponível.");
        return;
      }
      state.pacientesPicker.open({ mode: mode === "editar" ? "editar" : "novo" });
    }

    function closePacientePicker() {
      state.pacientesPicker?.close?.();
    }

    function isPacientePickerOpen() {
      return !!state.pacientesPicker?.isOpen?.();
    }

    function clearPaciente(mode) {
      if (mode === "editar") {
        state.pacienteEditar = null;
        if (state.dom?.editNomePaciente) state.dom.editNomePaciente.value = "";
      } else {
        state.pacienteNovo = null;
        if (state.dom?.novoNomePaciente) state.dom.novoNomePaciente.value = "";
        if (state.dom?.novoTelefone) state.dom.novoTelefone.value = "";
      }
    }

    return {
      init,
      setVisao,
      onChangeData,
      onHoje,
      onAgora,
      onNav,
      onFiltrosChanged,
      limparFiltros,
      abrirModalNovo,
      fecharModalNovo,
      abrirModalBloqueio,
      fecharModalBloqueio,
      openPacientePicker,
      closePacientePicker,
      isPacientePickerOpen,
      clearPaciente
    };
  }

  PRONTIO.features.agenda.uiActions = { createAgendaUiActions };
})(window);
