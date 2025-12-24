/**
 * ============================================================
 * PRONTIO - Registry.gs
 * ============================================================
 * Responsabilidade:
 * - Registrar actions disponíveis na API.
 * - Definir metadados: requiresAuth, roles, validations, locks.
 *
 * Contrato:
 * - Api.gs chama: Registry_getAction_(action)
 * - Retorna:
 *   {
 *     action: string,
 *     handler: function(ctx, payload) -> any,
 *     requiresAuth: boolean,
 *     roles: string[],
 *     validations: array,
 *     requiresLock: boolean,
 *     lockKey: string|null
 *   }
 *
 * Observações:
 * - Este Registry é construído sob demanda (lazy) na primeira chamada.
 * - Em DEV, algumas actions auxiliares podem existir.
 * - Em PROD, actions DEV NÃO devem ser registradas.
 */

var REGISTRY_ACTIONS = null;

function Registry_getAction_(action) {
  action = String(action || "").trim();
  if (!action) return null;

  if (!REGISTRY_ACTIONS) {
    REGISTRY_ACTIONS = _Registry_build_();
  }

  return REGISTRY_ACTIONS[action] || null;
}

/**
 * Utilitário opcional:
 * Cria um handler seguro para quando uma função não existe no deploy.
 * Isso evita que o Registry "quebre" durante a construção do map.
 *
 * (Mantido para compatibilidade e uso futuro.)
 */
function _Registry_missingHandler_(fnName) {
  return function (ctx, payload) {
    var err = new Error("Handler não disponível no deploy: " + String(fnName));
    err.code = "INTERNAL_ERROR";
    err.details = { missingHandler: String(fnName) };
    throw err;
  };
}

function _Registry_build_() {
  var map = {};

  // =========================
  // DIAGNÓSTICO (DEV)
  // =========================
  map["Registry_ListActions"] = {
    action: "Registry_ListActions",
    handler: Registry_ListActions,
    requiresAuth: false, // DEV: false. (Em PROD, sugiro true + roles:["admin"])
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // =========================
  // AUTH
  // =========================
  map["Auth_Login"] = {
    action: "Auth_Login",
    handler: Auth_Login,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Auth_Login"
  };

  map["Auth_Me"] = {
    action: "Auth_Me",
    handler: Auth_Me,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Auth_Logout"] = {
    action: "Auth_Logout",
    handler: Auth_Logout,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  /**
   * ============================================================
   * DEV ONLY — Reset de senha
   * ============================================================
   * - Só existe em DEV
   * - Só registra se a função existir
   * - Em PROD, essa action NÃO EXISTE (não aparece no Registry)
   */
  if (
    String(PRONTIO_ENV).toUpperCase() === "DEV" &&
    typeof Auth_ResetSenhaDev === "function"
  ) {
    map["Auth_ResetSenhaDev"] = {
      action: "Auth_ResetSenhaDev",
      handler: Auth_ResetSenhaDev,
      requiresAuth: false,
      roles: [],
      validations: [],
      requiresLock: true,
      lockKey: "Auth_ResetSenhaDev"
    };
  }

  // =========================
  // AUTH RECOVERY (Pilar H) - públicas
  // =========================
  map["Auth_ForgotPassword_Request"] = {
    action: "Auth_ForgotPassword_Request",
    handler: Auth_ForgotPassword_Request,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Auth_ForgotPassword_Request"
  };

  map["Auth_ForgotPassword_ValidateToken"] = {
    action: "Auth_ForgotPassword_ValidateToken",
    handler: Auth_ForgotPassword_ValidateToken,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Auth_ForgotPassword_Reset"] = {
    action: "Auth_ForgotPassword_Reset",
    handler: Auth_ForgotPassword_Reset,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Auth_ForgotPassword_Reset"
  };

  // =========================
  // USUÁRIOS (admin)
  // =========================
  map["Usuarios_Listar"] = {
    action: "Usuarios_Listar",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_Listar", payload); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Usuarios_Criar"] = {
    action: "Usuarios_Criar",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_Criar", payload); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_Criar"
  };

  map["Usuarios_Atualizar"] = {
    action: "Usuarios_Atualizar",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_Atualizar", payload); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_Atualizar"
  };

  // ✅ Já existia: altera senha por ID (admin)
  map["Usuarios_AlterarSenha"] = {
    action: "Usuarios_AlterarSenha",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_AlterarSenha", payload); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_AlterarSenha"
  };

  /**
   * ============================================================
   * Pilar C — Reset de senha em PRODUÇÃO (admin-only)
   * ============================================================
   */
  map["Usuarios_ResetSenhaAdmin"] = {
    action: "Usuarios_ResetSenhaAdmin",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_ResetSenhaAdmin", payload, ctx); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_ResetSenhaAdmin"
  };

  /**
   * ============================================================
   * Pilar E — Alterar senha do PRÓPRIO usuário
   * ============================================================
   * Aqui é obrigatório passar ctx, para garantir "self-service" real.
   */
  map["Usuarios_AlterarMinhaSenha"] = {
    action: "Usuarios_AlterarMinhaSenha",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_AlterarMinhaSenha", payload, ctx); },
    requiresAuth: true,
    roles: [], // qualquer usuário autenticado
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_AlterarMinhaSenha"
  };

  // =========================
  // CLÍNICA
  // =========================
  map["Clinica_Get"] = {
    action: "Clinica_Get",
    handler: Clinica_Get,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Clinica_Update"] = {
    action: "Clinica_Update",
    handler: Clinica_Update,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Clinica_Update"
  };

  // =========================
  // PROFISSIONAIS
  // =========================
  map["Profissionais_List"] = {
    action: "Profissionais_List",
    handler: Profissionais_List,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Profissionais_Create"] = {
    action: "Profissionais_Create",
    handler: Profissionais_Create,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Profissionais_Create"
  };

  map["Profissionais_Update"] = {
    action: "Profissionais_Update",
    handler: Profissionais_Update,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Profissionais_Update"
  };

  map["Profissionais_SetActive"] = {
    action: "Profissionais_SetActive",
    handler: Profissionais_SetActive,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Profissionais_SetActive"
  };

  // =========================
  // META / MIGRATIONS (admin)
  // =========================
  map["Meta_BootstrapDb"] = {
    action: "Meta_BootstrapDb",
    handler: Meta_BootstrapDb,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Meta_BootstrapDb"
  };

  map["Meta_DbStatus"] = {
    action: "Meta_DbStatus",
    handler: Meta_DbStatus,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // =========================
  // ATENDIMENTO (novo)
  // =========================
  map["Atendimento.ListarFilaHoje"] = {
    action: "Atendimento.ListarFilaHoje",
    handler: Atendimento_Action_ListarFilaHoje_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Atendimento.MarcarChegada"] = {
    action: "Atendimento.MarcarChegada",
    handler: Atendimento_Action_MarcarChegada_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.ChamarProximo"] = {
    action: "Atendimento.ChamarProximo",
    handler: Atendimento_Action_ChamarProximo_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.Iniciar"] = {
    action: "Atendimento.Iniciar",
    handler: Atendimento_Action_Iniciar_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.Concluir"] = {
    action: "Atendimento.Concluir",
    handler: Atendimento_Action_Concluir_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.Cancelar"] = {
    action: "Atendimento.Cancelar",
    handler: Atendimento_Action_Cancelar_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  return map;
}

/**
 * ============================================================
 * Handler de diagnóstico: retorna as actions registradas.
 * ============================================================
 */
function Registry_ListActions(ctx, payload) {
  if (!REGISTRY_ACTIONS) REGISTRY_ACTIONS = _Registry_build_();

  var keys = Object.keys(REGISTRY_ACTIONS || {}).sort();
  return {
    count: keys.length,
    actions: keys,
    hasAuthLogin: keys.indexOf("Auth_Login") >= 0,
    hasUsuariosAlterarSenha: keys.indexOf("Usuarios_AlterarSenha") >= 0,
    hasClinica: keys.indexOf("Clinica_Get") >= 0 && keys.indexOf("Clinica_Update") >= 0,
    hasProfissionais: keys.indexOf("Profissionais_List") >= 0,
    hasMetaBootstrap: keys.indexOf("Meta_BootstrapDb") >= 0,
    hasAuthResetSenhaDev: keys.indexOf("Auth_ResetSenhaDev") >= 0,
    hasUsuariosResetSenhaAdmin: keys.indexOf("Usuarios_ResetSenhaAdmin") >= 0
  };
}
  map["Atendimento.SyncHoje"] = {
    action: "Atendimento.SyncHoje",
    handler: Atendimento_Action_SyncHoje_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };
