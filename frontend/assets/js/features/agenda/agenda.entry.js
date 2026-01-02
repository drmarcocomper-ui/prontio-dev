// frontend/assets/js/features/agenda/agenda.entry.js
(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  const { createAgendaState } = PRONTIO.features.agenda.state;
  const { createAgendaApi } = PRONTIO.features.agenda.api;
  const { createAgendaView } = PRONTIO.features.agenda.view;
  const { createAgendaController } = PRONTIO.features.agenda.controller;
  const { bindAgendaEvents } = PRONTIO.features.agenda.events;

  function getEl(doc, id) {
    const el = doc.getElementById(id);
    if (!el) console.warn(`[Agenda] elemento #${id} não encontrado.`);
    return el;
  }

  function collectDom(doc) {
    // Page root
    const inputData = getEl(doc, "input-data");
    if (!inputData) return null;

    // Header controls
    const btnHoje = getEl(doc, "btn-hoje");
    const btnAgora = getEl(doc, "btn-agora");
    const btnDiaAnterior = getEl(doc, "btn-dia-anterior");
    const btnDiaPosterior = getEl(doc, "btn-dia-posterior");

    // View toggles
    const secDia = doc.querySelector(".agenda-dia");
    const secSemana = doc.getElementById("agenda-semana");
    const semanaGridEl = getEl(doc, "agenda-semana-grid");
    const btnVisaoDia = getEl(doc, "btn-visao-dia");
    const btnVisaoSemana = getEl(doc, "btn-visao-semana");

    // Day list + resumo
    const listaHorariosEl = getEl(doc, "agenda-lista-horarios");
    const resumoTotalEl = getEl(doc, "resumo-total");
    const resumoConfirmadosEl = getEl(doc, "resumo-confirmados");
    const resumoFaltasEl = getEl(doc, "resumo-faltas");
    const resumoCanceladosEl = getEl(doc, "resumo-cancelados");
    const resumoConcluidosEl = getEl(doc, "resumo-concluidos");
    const resumoEmAtendimentoEl = getEl(doc, "resumo-em-atendimento");

    // Filtros
    const inputFiltroNome = getEl(doc, "filtro-nome");
    const selectFiltroStatus = getEl(doc, "filtro-status");
    const btnLimparFiltros = getEl(doc, "btn-limpar-filtros");

    // Actions
    const btnNovoAgendamento = getEl(doc, "btn-novo-agendamento");
    const btnBloquearHorario = getEl(doc, "btn-bloquear-horario");

    // Modal: Novo
    const modalNovo = getEl(doc, "modal-novo-agendamento");
    const btnFecharModalNovo = getEl(doc, "btn-fechar-modal");
    const btnCancelarModalNovo = getEl(doc, "btn-cancelar-modal");
    const formNovo = getEl(doc, "form-novo-agendamento");
    const msgNovo = getEl(doc, "novo-agendamento-mensagem");

    const novoHoraInicio = getEl(doc, "novo-hora-inicio");
    const novoDuracao = getEl(doc, "novo-duracao");
    const novoNomePaciente = getEl(doc, "novo-nome-paciente");
    const novoTelefone = getEl(doc, "novo-telefone");
    const novoTipo = getEl(doc, "novo-tipo");
    const novoMotivo = getEl(doc, "novo-motivo");
    const novoOrigem = getEl(doc, "novo-origem");
    const novoCanal = getEl(doc, "novo-canal");
    const novoPermiteEncaixe = getEl(doc, "novo-permite-encaixe");

    const btnSelecionarPaciente = getEl(doc, "btn-selecionar-paciente");
    const btnLimparPaciente = getEl(doc, "btn-limpar-paciente");
    const btnSubmitNovo = getEl(doc, "btn-submit-novo");

    // Modal: Editar
    const modalEdit = getEl(doc, "modal-editar-agendamento");
    const btnFecharModalEditar = getEl(doc, "btn-fechar-modal-editar");
    const btnCancelarEditar = getEl(doc, "btn-cancelar-editar");
    const formEditar = getEl(doc, "form-editar-agendamento");
    const msgEditar = getEl(doc, "editar-agendamento-mensagem");

    const editIdAgenda = getEl(doc, "edit-id-agenda");
    const editData = getEl(doc, "edit-data");
    const editHoraInicio = getEl(doc, "edit-hora-inicio");
    const editDuracao = getEl(doc, "edit-duracao");
    const editNomePaciente = getEl(doc, "edit-nome-paciente");
    const editTipo = getEl(doc, "edit-tipo");
    const editMotivo = getEl(doc, "edit-motivo");
    const editOrigem = getEl(doc, "edit-origem");
    const editCanal = getEl(doc, "edit-canal");
    const editPermiteEncaixe = getEl(doc, "edit-permite-encaixe");

    const btnEditSelecionarPaciente = getEl(doc, "btn-edit-selecionar-paciente");
    const btnEditLimparPaciente = getEl(doc, "btn-edit-limpar-paciente");
    const btnSubmitEditar = getEl(doc, "btn-submit-editar");

    // Modal: Bloqueio
    const modalBloqueio = getEl(doc, "modal-bloqueio");
    const btnFecharModalBloqueio = getEl(doc, "btn-fechar-modal-bloqueio");
    const btnCancelarBloqueio = getEl(doc, "btn-cancelar-bloqueio");
    const formBloqueio = getEl(doc, "form-bloqueio");
    const msgBloqueio = getEl(doc, "bloqueio-mensagem");
    const bloqHoraInicio = getEl(doc, "bloq-hora-inicio");
    const bloqDuracao = getEl(doc, "bloq-duracao");
    const btnSubmitBloqueio = getEl(doc, "btn-submit-bloqueio");

    // Modal: Pacientes (fallback)
    const modalPacientes = getEl(doc, "modal-pacientes");
    const buscaPacienteTermo = getEl(doc, "busca-paciente-termo");
    const listaPacientesEl = getEl(doc, "lista-pacientes");
    const msgPacientesEl = getEl(doc, "pacientes-resultado-msg");
    const btnFecharModalPacientes = getEl(doc, "btn-fechar-modal-pacientes");

    return {
      inputData,
      btnHoje,
      btnAgora,
      btnDiaAnterior,
      btnDiaPosterior,

      secDia,
      secSemana,
      semanaGridEl,
      btnVisaoDia,
      btnVisaoSemana,

      listaHorariosEl,
      resumoTotalEl,
      resumoConfirmadosEl,
      resumoFaltasEl,
      resumoCanceladosEl,
      resumoConcluidosEl,
      resumoEmAtendimentoEl,

      inputFiltroNome,
      selectFiltroStatus,
      btnLimparFiltros,

      btnNovoAgendamento,
      btnBloquearHorario,

      // modal novo
      modalNovo,
      btnFecharModalNovo,
      btnCancelarModalNovo,
      formNovo,
      msgNovo,
      novoHoraInicio,
      novoDuracao,
      novoNomePaciente,
      novoTelefone,
      novoTipo,
      novoMotivo,
      novoOrigem,
      novoCanal,
      novoPermiteEncaixe,
      btnSelecionarPaciente,
      btnLimparPaciente,
      btnSubmitNovo,

      // modal editar
      modalEdit,
      btnFecharModalEditar,
      btnCancelarEditar,
      formEditar,
      msgEditar,
      editIdAgenda,
      editData,
      editHoraInicio,
      editDuracao,
      editNomePaciente,
      editTipo,
      editMotivo,
      editOrigem,
      editCanal,
      editPermiteEncaixe,
      btnEditSelecionarPaciente,
      btnEditLimparPaciente,
      btnSubmitEditar,

      // modal bloqueio
      modalBloqueio,
      btnFecharModalBloqueio,
      btnCancelarBloqueio,
      formBloqueio,
      msgBloqueio,
      bloqHoraInicio,
      bloqDuracao,
      btnSubmitBloqueio,

      // modal pacientes
      modalPacientes,
      buscaPacienteTermo,
      listaPacientesEl,
      msgPacientesEl,
      btnFecharModalPacientes
    };
  }

  async function init({ document, window }) {
    const dom = collectDom(document);
    if (!dom) return;

    const state = createAgendaState(window.localStorage);
    const api = createAgendaApi(PRONTIO);
    const view = createAgendaView({ document, window, dom, state });
    const controller = createAgendaController({ api, view, state, window });

    bindAgendaEvents({ document, dom, controller, state, view });

    await controller.init();
  }

  PRONTIO.features.agenda.entry = { init };
})(window);
