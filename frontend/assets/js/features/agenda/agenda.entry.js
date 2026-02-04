// frontend/assets/js/features/agenda/agenda.entry.js
/**
 * PRONTIO — Agenda Entry (Front)
 * ------------------------------------------------------------
 * Ajuste (2026-01):
 * - Valida dependências dos módulos split antes de iniciar.
 * - Mantém init blindado e não quebra a página se faltar script.
 *
 * Regras:
 * - Não chama API diretamente
 * - Apenas monta DOM, cria controller e faz bind de eventos
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  // ✅ GARANTIA: entry sempre existe
  PRONTIO.features.agenda.entry = PRONTIO.features.agenda.entry || {};

  function getEl(doc, id) {
    const el = doc.getElementById(id);
    if (!el) console.warn(`[Agenda] elemento #${id} não encontrado.`);
    return el;
  }

  function collectDom(doc) {
    const inputData = getEl(doc, "input-data");
    if (!inputData) return null;

    return {
      inputData,

      btnHoje: getEl(doc, "btn-hoje"),
      btnAgora: getEl(doc, "btn-agora"),
      btnDiaAnterior: getEl(doc, "btn-dia-anterior"),
      btnDiaPosterior: getEl(doc, "btn-dia-posterior"),

      btnVisaoDia: getEl(doc, "btn-visao-dia"),
      btnVisaoSemana: getEl(doc, "btn-visao-semana"),

      inputFiltroNome: getEl(doc, "filtro-nome"),
      selectFiltroStatus: getEl(doc, "filtro-status"),
      btnLimparFiltros: getEl(doc, "btn-limpar-filtros"),

      btnNovoAgendamento: getEl(doc, "btn-novo-agendamento"),
      btnBloquearHorario: getEl(doc, "btn-bloquear-horario"),

      // modal novo
      modalNovo: getEl(doc, "modal-novo-agendamento"),
      btnFecharModalNovo: getEl(doc, "btn-fechar-modal"),
      btnCancelarModalNovo: getEl(doc, "btn-cancelar-modal"),
      formNovo: getEl(doc, "form-novo-agendamento"),
      msgNovo: getEl(doc, "novo-agendamento-mensagem"),
      novoHoraInicio: getEl(doc, "novo-hora-inicio"),
      novoDuracao: getEl(doc, "novo-duracao"),
      novoNomePaciente: getEl(doc, "novo-nome-paciente"),
      novoTelefone: getEl(doc, "novo-telefone"),
      novoTipo: getEl(doc, "novo-tipo"),
      novoMotivo: getEl(doc, "novo-motivo"),
      novoOrigem: getEl(doc, "novo-origem"),
      novoCanal: getEl(doc, "novo-canal"),
      novoPermiteEncaixe: getEl(doc, "novo-permite-encaixe"),
      btnSelecionarPaciente: getEl(doc, "btn-selecionar-paciente"),
      btnLimparPaciente: getEl(doc, "btn-limpar-paciente"),
      btnSubmitNovo: getEl(doc, "btn-submit-novo"),

      // modal editar
      modalEdit: getEl(doc, "modal-editar-agendamento"),
      btnFecharModalEditar: getEl(doc, "btn-fechar-modal-editar"),
      btnCancelarEditar: getEl(doc, "btn-cancelar-editar"),
      formEditar: getEl(doc, "form-editar-agendamento"),
      msgEditar: getEl(doc, "editar-agendamento-mensagem"),
      editIdAgenda: getEl(doc, "edit-id-agenda"),
      editData: getEl(doc, "edit-data"),
      editHoraInicio: getEl(doc, "edit-hora-inicio"),
      editDuracao: getEl(doc, "edit-duracao"),
      editNomePaciente: getEl(doc, "edit-nome-paciente"),
      editTipo: getEl(doc, "edit-tipo"),
      editMotivo: getEl(doc, "edit-motivo"),
      editOrigem: getEl(doc, "edit-origem"),
      editCanal: getEl(doc, "edit-canal"),
      editPermiteEncaixe: getEl(doc, "edit-permite-encaixe"),
      btnEditSelecionarPaciente: getEl(doc, "btn-edit-selecionar-paciente"),
      btnEditLimparPaciente: getEl(doc, "btn-edit-limpar-paciente"),
      btnSubmitEditar: getEl(doc, "btn-submit-editar"),

      // modal bloqueio
      modalBloqueio: getEl(doc, "modal-bloqueio"),
      btnFecharModalBloqueio: getEl(doc, "btn-fechar-modal-bloqueio"),
      btnCancelarBloqueio: getEl(doc, "btn-cancelar-bloqueio"),
      formBloqueio: getEl(doc, "form-bloqueio"),
      msgBloqueio: getEl(doc, "bloqueio-mensagem"),
      bloqHoraInicio: getEl(doc, "bloq-hora-inicio"),
      bloqDuracao: getEl(doc, "bloq-duracao"),
      btnSubmitBloqueio: getEl(doc, "btn-submit-bloqueio"),

      // modal pacientes
      modalPacientes: getEl(doc, "modal-pacientes"),
      buscaPacienteTermo: getEl(doc, "busca-paciente-termo"),
      listaPacientesEl: getEl(doc, "lista-pacientes"),
      msgPacientesEl: getEl(doc, "pacientes-resultado-msg"),
      btnFecharModalPacientes: getEl(doc, "btn-fechar-modal-pacientes")
    };
  }

  function assertAgendaDeps_() {
    const miss = [];
    const a = PRONTIO.features && PRONTIO.features.agenda ? PRONTIO.features.agenda : {};

    // base
    if (!a.formatters) miss.push("agenda.formatters.js");
    if (!a.view || typeof a.view.createAgendaView !== "function") miss.push("agenda.view.js");
    if (!a.api || typeof a.api.createAgendaApi !== "function") miss.push("agenda.api.js");
    if (!a.controller || typeof a.controller.createAgendaController !== "function") miss.push("agenda.controller.js");
    if (!a.events || typeof a.events.bindAgendaEvents !== "function") miss.push("agenda.events.js");

    // split modules (obrigatórios para o novo controller)
    if (!a.loaders || typeof a.loaders.createAgendaLoaders !== "function") miss.push("agenda.loaders.js");
    if (!a.uiActions || typeof a.uiActions.createAgendaUiActions !== "function") miss.push("agenda.uiActions.js");
    if (!a.editActions || typeof a.editActions.createAgendaEditActions !== "function") miss.push("agenda.editActions.js");
    if (!a.pacientesCache || typeof a.pacientesCache.createPacientesCache !== "function") miss.push("agenda.pacientesCache.js");
    if (!a.filtros || typeof a.filtros.createAgendaFiltros !== "function") miss.push("agenda.filtros.js");

    // state
    if (!a.state || typeof a.state.createAgendaState !== "function") miss.push("agenda.state.js");

    return miss;
  }

  function init(env) {
    env = env || {};
    const doc = env.document || global.document;

    try {
      const dom = collectDom(doc);
      if (!dom) {
        console.error("[PRONTIO][Agenda] DOM da Agenda incompleto (input-data ausente).");
        return;
      }

      const missing = assertAgendaDeps_();
      if (missing.length) {
        console.error("[PRONTIO][Agenda] Dependências faltando (scripts):", missing.join(", "));
        console.error("[PRONTIO][Agenda] Estado atual:", {
          formatters: !!PRONTIO.features?.agenda?.formatters,
          view: typeof PRONTIO.features?.agenda?.view?.createAgendaView,
          api: typeof PRONTIO.features?.agenda?.api?.createAgendaApi,
          controller: typeof PRONTIO.features?.agenda?.controller?.createAgendaController,
          events: typeof PRONTIO.features?.agenda?.events?.bindAgendaEvents,
          loaders: typeof PRONTIO.features?.agenda?.loaders?.createAgendaLoaders,
          uiActions: typeof PRONTIO.features?.agenda?.uiActions?.createAgendaUiActions,
          editActions: typeof PRONTIO.features?.agenda?.editActions?.createAgendaEditActions,
          pacientesCache: typeof PRONTIO.features?.agenda?.pacientesCache?.createPacientesCache,
          filtros: typeof PRONTIO.features?.agenda?.filtros?.createAgendaFiltros,
          state: typeof PRONTIO.features?.agenda?.state?.createAgendaState
        });
        return;
      }

      const controller = PRONTIO.features.agenda.controller.createAgendaController({ document: doc });
      if (!controller || !controller.actions || typeof controller.actions.init !== "function") {
        console.error("[PRONTIO][Agenda] controller inválido:", controller);
        return;
      }

      controller.actions.init(dom);

      const binder = PRONTIO.features.agenda.events.bindAgendaEvents;
      binder({ document: doc, dom, controller });
    } catch (e) {
      console.error("[PRONTIO][Agenda] Falha dentro de agenda.entry.init:", e);
    }
  }

  PRONTIO.features.agenda.entry.init = init;

})(window);
