var USUARIOS_SHEET_NAME = "Usuarios";

/**
 * ✅ Repo-first / API-first:
 * - Evita SpreadsheetApp direto
 * - Evita fallback para ActiveSpreadsheet (mantém arquitetura consistente)
 * - Usa PRONTIO_getDb_ (se existir) ou Repo_getDb_
 */
function Usuarios_getDb_() {
  var ss = null;

  try {
    if (typeof PRONTIO_getDb_ === "function") ss = PRONTIO_getDb_();
  } catch (_) {}

  try {
    if (!ss && typeof Repo_getDb_ === "function") ss = Repo_getDb_();
  } catch (_) {}

  if (!ss) {
    _usuariosThrow_(
      "INTERNAL_ERROR",
      "Usuarios: DB não disponível. Esperado PRONTIO_getDb_ ou Repo_getDb_.",
      { missing: ["PRONTIO_getDb_", "Repo_getDb_"] }
    );
  }

  return ss;
}

/**
 * ✅ Usado somente quando realmente precisa de Sheet (ex.: EnsureSchema).
 * - Não usa SpreadsheetApp diretamente.
 */
function Usuarios_getSheet_() {
  var ss = Usuarios_getDb_();
  var sheet = ss.getSheetByName(USUARIOS_SHEET_NAME);
  if (!sheet) {
    _usuariosThrow_(
      "USUARIOS_SHEET_NOT_FOUND",
      'Aba de usuários não encontrada: "' + USUARIOS_SHEET_NAME + '".',
      null
    );
  }
  return sheet;
}

/**
 * ⚠️ Compat/Debug:
 * Se algo ainda chamar o antigo getUsuariosSheet_(), falha rápido
 * para você localizar e corrigir o call-site.
 *
 * Depois que estiver tudo ok, você pode remover essa função.
 */
function getUsuariosSheet_() {
  _usuariosThrow_(
    "DEPRECATED",
    "getUsuariosSheet_() foi descontinuado. Use Usuarios_getSheet_() (repo-first) ou Repository.",
    { migrateTo: "Usuarios_getSheet_" }
  );
}

function gerarNovoUsuarioId_() {
  return "USR_" + Utilities.getUuid().split("-")[0].toUpperCase();
}

function boolFromCell_(v) {
  if (v === true) return true;
  if (v === false) return false;
  var s = (v || "").toString().trim().toLowerCase();
  if (s === "true" || s === "1" || s === "sim" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "nao" || s === "não" || s === "no") return false;
  return false;
}
