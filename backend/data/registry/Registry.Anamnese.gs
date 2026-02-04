// backend/data/registry/Registry.Anamnese.gs
/**
 * PRONTIO - Registry.Anamnese.gs
 * Registro de actions para o dominio de Anamnese.
 */

function Registry_RegisterAnamnese_(map) {
  function _anamneseHandler_(actionName) {
    return function (ctx, payload) {
      if (typeof handleAnamneseAction !== "function") {
        var e = new Error("handleAnamneseAction nao disponivel.");
        e.code = "INTERNAL_ERROR";
        e.details = { action: actionName };
        throw e;
      }
      return handleAnamneseAction(actionName, payload || {});
    };
  }

  // ===================== TEMPLATES =====================
  map["Anamnese.Template.Listar"] = {
    action: "Anamnese.Template.Listar",
    handler: _anamneseHandler_("Anamnese.Template.Listar"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Anamnese.Template.Obter"] = {
    action: "Anamnese.Template.Obter",
    handler: _anamneseHandler_("Anamnese.Template.Obter"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Anamnese.Template.Salvar"] = {
    action: "Anamnese.Template.Salvar",
    handler: _anamneseHandler_("Anamnese.Template.Salvar"),
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "ANAMNESE_TEMPLATE"
  };

  map["Anamnese.Template.Excluir"] = {
    action: "Anamnese.Template.Excluir",
    handler: _anamneseHandler_("Anamnese.Template.Excluir"),
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "ANAMNESE_TEMPLATE"
  };

  // ===================== ANAMNESE =====================
  map["Anamnese.Salvar"] = {
    action: "Anamnese.Salvar",
    handler: _anamneseHandler_("Anamnese.Salvar"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ANAMNESE"
  };

  map["Anamnese.ListarPorPaciente"] = {
    action: "Anamnese.ListarPorPaciente",
    handler: _anamneseHandler_("Anamnese.ListarPorPaciente"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Anamnese.ListarPorPacientePaged"] = {
    action: "Anamnese.ListarPorPacientePaged",
    handler: _anamneseHandler_("Anamnese.ListarPorPacientePaged"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Anamnese.ObterPorId"] = {
    action: "Anamnese.ObterPorId",
    handler: _anamneseHandler_("Anamnese.ObterPorId"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // ===================== REMINDERS =====================
  map["Anamnese.Reminder.Listar"] = {
    action: "Anamnese.Reminder.Listar",
    handler: _anamneseHandler_("Anamnese.Reminder.Listar"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Anamnese.Reminder.MarcarCompleto"] = {
    action: "Anamnese.Reminder.MarcarCompleto",
    handler: _anamneseHandler_("Anamnese.Reminder.MarcarCompleto"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ANAMNESE_REMINDER"
  };
}
