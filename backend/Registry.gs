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

  map["Usuarios_AlterarSenha"] = {
    action: "Usuarios_AlterarSenha",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_AlterarSenha", payload); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_AlterarSenha"
  };

  // =========================
  // CLÍNICA
  // =========================
  // ✅ Qualquer usuário autenticado pode ler (o front precisa para exibir nome/logo, etc)
  map["Clinica_Get"] = {
    action: "Clinica_Get",
    handler: Clinica_Get, // deve existir em Clinica.gs
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // ✅ Somente admin atualiza identidade/config institucional
  map["Clinica_Update"] = {
    action: "Clinica_Update",
    handler: Clinica_Update, // deve existir em Clinica.gs
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Clinica_Update"
  };

  // =========================
  // PROFISSIONAIS
  // =========================
  // Listagem pode ser útil para secretária e profissional (ex.: selecionar agenda)
  map["Profissionais_List"] = {
    action: "Profissionais_List",
    handler: Profissionais_List,
    requiresAuth: true,
    roles: [], // controlamos depois via ACL se necessário
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
  // ✅ Serve para rodar bootstrap/status do banco via API (contorna UI do Apps Script travada).
  // Requer Meta.gs com Meta_BootstrapDb e Meta_DbStatus.
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
    hasMetaBootstrap: keys.indexOf("Meta_BootstrapDb") >= 0
  };
}
