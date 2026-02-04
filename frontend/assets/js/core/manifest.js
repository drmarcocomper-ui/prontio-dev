(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};

  // ============================================================
  // Versão global do front (cache-busting)
  // ============================================================
  PRONTIO.APP_VERSION = PRONTIO.APP_VERSION || "1.4.8";

  // ============================================================
  // PAGE MANIFEST
  // - Define JS/CSS por página
  // - Ordem importa
  // ============================================================
  PRONTIO.PAGE_MANIFEST = {
    login: {
      js: [
        "assets/js/widgets/widget-toast.js",
        "assets/js/pages/page-login.js"
      ],
      css: ["assets/css/pages/page-login.css"]
    },

    // =========================
    // AGENDA (modular)
    // =========================
    agenda: {
      js: [
        // base
        "assets/js/features/agenda/agenda.formatters.js",
        "assets/js/features/agenda/agenda.view.js",
        "assets/js/features/agenda/agenda.api.js",
        "assets/js/features/agenda/agenda.state.js",

        // pacientes / autocomplete
        "assets/js/widgets/widget-typeahead.js",
        "assets/js/features/pacientes/pacientes.api.js",
        "assets/js/features/pacientes/pacientes.picker.js",

        // módulos da agenda
        "assets/js/features/agenda/agenda.pacientesCache.js",
        "assets/js/features/agenda/agenda.filtros.js",
        "assets/js/features/agenda/agenda.loaders.js",
        "assets/js/features/agenda/agenda.uiActions.js",
        "assets/js/features/agenda/agenda.editActions.js",

        // controller + events + entry
        "assets/js/features/agenda/agenda.controller.js",
        "assets/js/features/agenda/agenda.events.js",
        "assets/js/features/agenda/agenda.entry.js",

        // page
        "assets/js/pages/page-agenda.js"
      ],
      css: ["assets/css/pages/page-agenda.css"]
    },

    chat: {
      js: ["assets/js/pages/page-chat.js"],
      css: ["assets/css/pages/page-chat.css"]
    },

    configuracoes: {
      js: ["assets/js/pages/page-configuracoes.js"],
      css: ["assets/css/pages/page-configuracoes.css"]
    },

    exames: {
      js: ["assets/js/pages/page-exames.js"],
      css: ["assets/css/pages/page-exames.css"]
    },

    laudo: {
      js: ["assets/js/pages/page-laudo.js"],
      css: ["assets/css/pages/page-laudo.css"]
    },

    // =========================
    // PACIENTES (modular)
    // =========================
    pacientes: {
      js: [
        "assets/js/features/pacientes/pacientes.api.js",
        "assets/js/features/pacientes/pacientes.state.js",
        "assets/js/features/pacientes/pacientes.view.js",
        "assets/js/features/pacientes/pacientes.actions.js",
        "assets/js/features/pacientes/pacientes.events.js",
        "assets/js/features/pacientes/pacientes.entry.js"
      ],
      css: ["assets/css/pages/page-pacientes.css"]
    },

    // =========================
    // PRONTUÁRIO (modular)
    // =========================
    prontuario: {
      js: [
        "assets/js/features/prontuario/prontuario.utils.js",
        "assets/js/features/prontuario/prontuario.api.js",
        "assets/js/features/prontuario/prontuario.context.js",
        "assets/js/features/prontuario/prontuario.paciente.js",
        "assets/js/features/prontuario/prontuario.receita-panel.js",
        "assets/js/features/prontuario/prontuario.documentos-panel.js",
        "assets/js/features/prontuario/prontuario.evolucoes.js",
        "assets/js/features/prontuario/prontuario.entry.js"
      ],
      css: ["assets/css/pages/page-prontuario.css"]
    },

    receita: {
      js: ["assets/js/pages/page-receita.js"],
      css: ["assets/css/pages/page-receita.css"]
    },

    relatorios: {
      js: ["assets/js/pages/page-relatorios.js"],
      css: ["assets/css/pages/page-relatorios.css"]
    },

    usuarios: {
      js: ["assets/js/pages/page-usuarios.js"],
      css: ["assets/css/pages/page-usuarios.css"]
    },

    "alterar-senha": {
      js: ["assets/js/pages/page-alterar-senha.js"],
      css: []
    },

    "forgot-password": {
      js: ["assets/js/pages/page-forgot-password.js"],
      css: []
    },

    "reset-password": {
      js: ["assets/js/pages/page-reset-password.js"],
      css: []
    }
  };
})(window);
