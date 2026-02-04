// frontend/assets/js/features/agenda/agenda.controller.js
/**
 * PRONTIO — Agenda Controller (Front)
 * ------------------------------------------------------------
 * Controller FINO (orquestrador)
 *
 * Responsabilidades:
 * - Inicializar state, api e view
 * - Conectar módulos especializados
 * - Injetar dependências (pacientesPicker + pacientesCache) no state
 * - Expor actions públicas para agenda.entry.js
 * - Disparar LOAD inicial (dia/semana) no init
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  function createAgendaController(env) {
    env = env || {};
    const document = env.document || global.document;
    const storage = global.localStorage || null;

    // ✅ Resolvido em runtime (não no parse do arquivo)
    const createAgendaApi = PRONTIO.features.agenda.api?.createAgendaApi;
    const createAgendaView = PRONTIO.features.agenda.view?.createAgendaView;
    const createAgendaState = PRONTIO.features.agenda.state?.createAgendaState;

    // módulos especializados
    const createAgendaLoaders = PRONTIO.features.agenda.loaders?.createAgendaLoaders;
    const createAgendaUiActions = PRONTIO.features.agenda.uiActions?.createAgendaUiActions;
    const createAgendaEditActions = PRONTIO.features.agenda.editActions?.createAgendaEditActions;

    // cache de pacientes (front)
    const createPacientesCache = PRONTIO.features.agenda.pacientesCache?.createPacientesCache || null;

    // integração opcional: picker de pacientes
    const createPacientesApi = PRONTIO.features?.pacientes?.api?.createPacientesApi || null;
    const createPacientesPicker = PRONTIO.features?.pacientes?.picker?.createPacientesPicker || null;

    if (!createAgendaApi || !createAgendaView || !createAgendaState) {
      console.error("[AgendaController] Dependências básicas não carregadas.");
      return null;
    }

    // core
    const api = createAgendaApi(PRONTIO);
    const view = createAgendaView({ document });
    const state = createAgendaState(storage);

    // cache local de pacientes (para exibição + prontuário)
    state.pacientesCache = (createPacientesCache && typeof createPacientesCache === "function")
      ? createPacientesCache(storage, state)
      : null;

    // módulos
    const loaders = createAgendaLoaders ? createAgendaLoaders({ api, state, view }) : null;
    const uiActions = createAgendaUiActions ? createAgendaUiActions({ state, view, loaders }) : null;
    const editActions = createAgendaEditActions ? createAgendaEditActions({ api, state, view, loaders }) : null;

    if (!loaders || !uiActions || !editActions) {
      console.error("[AgendaController] Módulos da Agenda não carregados (loaders/uiActions/editActions).", {
        createAgendaLoaders: typeof createAgendaLoaders,
        createAgendaUiActions: typeof createAgendaUiActions,
        createAgendaEditActions: typeof createAgendaEditActions,
        loaders: loaders,
        uiActions: uiActions,
        editActions: editActions,
        api: !!api,
        state: !!state,
        view: !!view
      });
      return null;
    }

    // Pacientes API (picker)
    const pacientesApi = (createPacientesApi && typeof createPacientesApi === "function")
      ? createPacientesApi(PRONTIO)
      : null;

    function _nomePaciente_(p) {
      return String(p?.nomeCompleto || p?.nome || "").trim();
    }

    function _telPaciente_(p) {
      return String(p?.telefone || p?.telefonePrincipal || "").trim();
    }

    function tryInitPacientesPicker_(dom) {
      state.pacientesPicker = null;

      if (!pacientesApi || typeof pacientesApi.buscarSimples !== "function") return;
      if (!createPacientesPicker) return;

      if (!dom || !dom.modalPacientes || !dom.buscaPacienteTermo || !dom.listaPacientesEl || !dom.msgPacientesEl) return;

      try {
        const picker = createPacientesPicker({
          document,
          modalEl: dom.modalPacientes,
          inputTermoEl: dom.buscaPacienteTermo,
          listEl: dom.listaPacientesEl,
          msgEl: dom.msgPacientesEl,
          closeBtnEl: dom.btnFecharModalPacientes,
          view: view,
          searchFn: async (termo, limite) => {
            const data = await pacientesApi.buscarSimples(termo, limite || 30);
            return (data && data.pacientes) ? data.pacientes : [];
          },
          onSelect: (p, ctx2) => {
            // ✅ cacheia paciente para exibição futura (cards) e prontuário
            try { state.pacientesCache?.cachePaciente?.(p); } catch (_) {}

            const mode = (ctx2 && ctx2.mode) ? String(ctx2.mode) : "novo";
            if (mode === "editar") {
              state.pacienteEditar = p;
              if (dom.editNomePaciente) dom.editNomePaciente.value = _nomePaciente_(p);
            } else {
              state.pacienteNovo = p;
              if (dom.novoNomePaciente) dom.novoNomePaciente.value = _nomePaciente_(p);
              if (dom.novoTelefone && !String(dom.novoTelefone.value || "").trim()) {
                dom.novoTelefone.value = _telPaciente_(p);
              }
            }
          }
        });

        if (picker && typeof picker.bind === "function") picker.bind();
        state.pacientesPicker = picker || null;
      } catch (e) {
        console.warn("[AgendaController] Falha ao inicializar pacientesPicker:", e);
        state.pacientesPicker = null;
      }
    }

    // actions públicas (contrato com agenda.entry.js)
    const actions = {
      init(dom) {
        state.dom = dom;

        // injeta picker
        tryInitPacientesPicker_(dom);

        uiActions.init(dom);
        loaders.init(dom);

        // ✅ LOAD INICIAL (resolve: "slots só aparecem depois de criar")
        uiActions.setVisao(state.modoVisao || "dia").catch((err) => {
          console.error("[AgendaController] Erro em setVisao, tentando carregar dia:", err);
          loaders.carregarDia();
        });
      },

      // navegação / visão
      setVisao: uiActions.setVisao,
      onChangeData: uiActions.onChangeData,
      onHoje: uiActions.onHoje,
      onAgora: uiActions.onAgora,
      onNav: uiActions.onNav,

      // filtros
      onFiltrosChanged: uiActions.onFiltrosChanged,
      limparFiltros: uiActions.limparFiltros,

      // pacientes
      openPacientePicker: uiActions.openPacientePicker,
      closePacientePicker: uiActions.closePacientePicker,
      isPacientePickerOpen: uiActions.isPacientePickerOpen,
      clearPaciente: uiActions.clearPaciente,

      // modais (novo/bloqueio)
      abrirModalNovo: uiActions.abrirModalNovo,
      fecharModalNovo: uiActions.fecharModalNovo,
      abrirModalBloqueio: uiActions.abrirModalBloqueio,
      fecharModalBloqueio: uiActions.fecharModalBloqueio,

      // editar/prontuário (editActions)
      abrirModalEditar: editActions.abrirModalEditar,
      fecharModalEditar: editActions.fecharModalEditar,
      abrirProntuario: editActions.abrirProntuario,

      // mutações
      submitNovo: editActions.submitNovo,
      submitEditar: editActions.submitEditar,
      submitBloqueio: editActions.submitBloqueio,
      mudarStatus: editActions.mudarStatus,
      desbloquear: editActions.desbloquear
    };

    // útil para loaders (callbacks)
    state.controllerActions = actions;

    return { state, actions, view };
  }

  PRONTIO.features.agenda.controller = { createAgendaController };
})(window);
