// backend/domain/Usuarios/Usuarios.Repo.gs
/**
 * ============================================================
 * PRONTIO - Usuarios.Repo.gs
 * ============================================================
 * Adaptador do domínio de Usuários para o Repository central (Repo_*).
 *
 * Objetivo:
 * - Implementar as funções Usuarios_Repo_* esperadas pelo domínio/Auth.gs
 * - NÃO acessar SpreadsheetApp
 * - NÃO criar/alterar schema (isso é Migrations)
 *
 * Observação:
 * - Como o Repository atual não tem "find by field", este adapter
 *   implementa a busca por login/email via Repo_list_ (scan).
 * - Depois, se quiser performance, dá pra adicionar um Repo_findOneBy_ genérico.
 */

var USUARIOS_REPO_SHEET = "Usuarios";
var USUARIOS_REPO_ID_FIELD = "ID_Usuario";

function Usuarios_Repo_List_() {
  if (typeof Repo_list_ !== "function") {
    _usuariosThrow_("INTERNAL_ERROR", "Repo_list_ não disponível (Repository.gs não carregado?).", { missing: "Repo_list_" });
  }
  return Repo_list_(USUARIOS_REPO_SHEET) || [];
}

function Usuarios_Repo_GetById_(id) {
  var v = String(id || "").trim();
  if (!v) return null;

  if (typeof Repo_getById_ !== "function") {
    _usuariosThrow_("INTERNAL_ERROR", "Repo_getById_ não disponível (Repository.gs não carregado?).", { missing: "Repo_getById_" });
  }

  return Repo_getById_(USUARIOS_REPO_SHEET, USUARIOS_REPO_ID_FIELD, v);
}

function Usuarios_Repo_Insert_(obj) {
  if (typeof Repo_insert_ !== "function") {
    _usuariosThrow_("INTERNAL_ERROR", "Repo_insert_ não disponível (Repository.gs não carregado?).", { missing: "Repo_insert_" });
  }
  return Repo_insert_(USUARIOS_REPO_SHEET, obj || {});
}

function Usuarios_Repo_UpdateById_(id, patch) {
  var v = String(id || "").trim();
  if (!v) return false;

  if (typeof Repo_update_ !== "function") {
    _usuariosThrow_("INTERNAL_ERROR", "Repo_update_ não disponível (Repository.gs não carregado?).", { missing: "Repo_update_" });
  }

  return !!Repo_update_(USUARIOS_REPO_SHEET, USUARIOS_REPO_ID_FIELD, v, patch || {});
}

/**
 * Busca por Login OU Email (case-insensitive).
 * Prioriza Login.
 *
 * Retorna o "row object" (map header->value) igual Repo_list_/Repo_getById_.
 */
function Usuarios_Repo_FindByIdentifier_(identifierLower) {
  var q = String(identifierLower || "").trim().toLowerCase();
  if (!q) return null;

  var rows = Usuarios_Repo_List_();
  if (!rows || !rows.length) return null;

  // 1) tenta Login
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i] || {};
    var login = String(r.Login || r.login || "").trim().toLowerCase();
    if (login && login === q) return r;
  }

  // 2) tenta Email
  for (var j = 0; j < rows.length; j++) {
    var r2 = rows[j] || {};
    var email = String(r2.Email || r2.email || r2["E-mail"] || "").trim().toLowerCase();
    if (email && email === q) return r2;
  }

  return null;
}

/**
 * Converte um "row object" do Repo em DTO do front/admin (sem senha).
 * Usado por Usuarios_Listar_.
 */
function Usuarios_RepoRowToDto_(row) {
  row = row || {};
  var id = String(row.ID_Usuario || row.idUsuario || row.id || "").trim();

  return {
    id: id,
    nome: String(row.NomeCompleto || row.Nome || row.nome || "").trim(),
    nomeCompleto: String(row.NomeCompleto || row.Nome || row.nome || "").trim(),
    login: String(row.Login || row.login || "").trim(),
    email: String(row.Email || row["E-mail"] || row.email || "").trim(),
    perfil: String(row.Perfil || row.perfil || row.role || "").trim(),
    ativo: boolFromCell_(row.Ativo !== undefined ? row.Ativo : row.ativo),

    // Campos extras (se existirem no header atual)
    idClinica: String(row.idClinica || row.ID_Clinica || row.idClinicaRef || "").trim() || null,
    idProfissional: String(row.idProfissional || row.ID_Profissional || row.idProfissionalRef || "").trim() || null,

    criadoEm: row.CriadoEm || row.criadoEm || null,
    atualizadoEm: row.AtualizadoEm || row.atualizadoEm || null,
    ultimoLoginEm: row.UltimoLoginEm || row.ultimoLoginEm || null
  };
}
