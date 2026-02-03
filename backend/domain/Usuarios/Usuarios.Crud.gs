/**
 * Lista todos os usuários (sem senha) - via Repository
 */
function Usuarios_Listar_(payload) {
  // garante schema (best-effort)
  try { Usuarios_EnsureSchema_({}); } catch (_) {}

  var rows = Usuarios_Repo_List_();
  var lista = [];

  for (var i = 0; i < rows.length; i++) {
    var dto = Usuarios_RepoRowToDto_(rows[i]);
    if (!dto.id) continue;
    lista.push(dto);
  }

  return lista;
}

/**
 * Busca usuário por identificador para autenticação (inclui senhaHash).
 * ✅ Aceita Login OU Email (case-insensitive). Prioriza Login.
 * Retorna também nomeCompleto.
 *
 * IMPORTANTE: mantém shape do retorno original para Auth.gs.
 */
function Usuarios_findByLoginForAuth_(identifier) {
  var q = (identifier || "").toString().trim().toLowerCase();
  if (!q) return null;

  try { Usuarios_EnsureSchema_({}); } catch (_) {}

  var row = Usuarios_Repo_FindByIdentifier_(q);
  if (!row) return null;

  // valida campos mínimos (id, senha, ativo)
  var id = String(_usrPick_(row, ["ID_Usuario", "idUsuario", "id_usuario", "id"]) || "").trim();
  var senhaHash = String(_usrPick_(row, ["SenhaHash", "senhaHash", "PasswordHash", "passwordHash"]) || "").trim();
  var ativo = _usrBool_(_usrPick_(row, ["Ativo", "ativo", "Ativa"]));

  if (!id || !senhaHash) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", "Registro de usuário incompleto para autenticação.", {
      required: ["ID_Usuario", "SenhaHash"],
      got: { id: id, senhaHash: !!senhaHash }
    });
  }

  var nome = String(_usrPick_(row, ["NomeCompleto", "Nome", "nome", "nomeCompleto"]) || "").trim();
  var idProfissional = String(_usrPick_(row, ["ID_Profissional", "idProfissional", "idProfissionalRef"]) || "").trim();

  return {
    id: id,
    nome: nome,
    nomeCompleto: nome,
    login: String(_usrPick_(row, ["Login", "login", "emailLogin"]) || "").trim(),
    email: String(_usrPick_(row, ["Email", "E-mail", "email"]) || "").trim(),
    perfil: String(_usrPick_(row, ["Perfil", "perfil", "Role", "role"]) || "").trim(),
    idProfissional: idProfissional || null,
    ativo: ativo,
    senhaHash: senhaHash
  };
}

/**
 * Localiza registro por ID_Usuario via Repository.
 * Retorno compat: { row, idx, sheet, rowIndex, header }.
 *
 * Como agora não existe sheet/rowIndex/idx, retornamos apenas { row } e um stub nos outros campos.
 * (Se algum caller externo depender de sheet/rowIndex, migre também esse caller.)
 */
function Usuarios_findRowById_(id) {
  var v = (id || "").toString().trim();
  if (!v) return null;

  try { Usuarios_EnsureSchema_({}); } catch (_) {}

  var row = Usuarios_Repo_GetById_(v);
  if (!row) return null;

  return {
    sheet: null,
    rowIndex: -1,
    header: [],
    idx: {},    // não usado no modo repo
    row: row
  };
}

/**
 * Localiza registro por Login OU Email (case-insensitive) via Repository.
 * Mesmo formato compat do findRowById_.
 */
function Usuarios_findRowByIdentifier_(identifier) {
  var q = (identifier || "").toString().trim().toLowerCase();
  if (!q) return null;

  try { Usuarios_EnsureSchema_({}); } catch (_) {}

  var row = Usuarios_Repo_FindByIdentifier_(q);
  if (!row) return null;

  return {
    sheet: null,
    rowIndex: -1,
    header: [],
    idx: {},
    row: row
  };
}

/**
 * Marca UltimoLoginEm (best-effort) - via patch
 */
function Usuarios_markUltimoLogin_(id) {
  var v = (id || "").toString().trim();
  if (!v) return { ok: false };

  var ok = Usuarios_Repo_UpdateById_(v, { UltimoLoginEm: new Date().toISOString() });
  return { ok: !!ok };
}

/**
 * Cria usuário - via Repository
 */
function Usuarios_Criar_(payload) {
  payload = payload || {};

  try { Usuarios_EnsureSchema_({}); } catch (_) {}

  var nome = String(payload.nome || payload.nomeCompleto || "").trim();
  var login = String(payload.login || "").trim();
  var email = String(payload.email || "").trim();
  var perfil = String(payload.perfil || "").trim() || "secretaria";
  var senha = String(payload.senha || "");

  var registroProfissional = String(payload.registroProfissional || payload.documentoRegistro || "").trim();
  var conselhoProfissional = String(payload.conselhoProfissional || "").trim();
  var especialidade = String(payload.especialidade || "").trim();

  if (!nome) _usuariosThrow_("USUARIOS_NOME_OBRIGATORIO", "Nome é obrigatório.", null);
  if (!login) _usuariosThrow_("USUARIOS_LOGIN_OBRIGATORIO", "Login é obrigatório.", null);
  if (!senha) _usuariosThrow_("USUARIOS_SENHA_OBRIGATORIA", "Senha é obrigatória.", null);

  // checa duplicidade (case-insensitive)
  var list = Usuarios_Repo_List_();
  var loginLower = login.toLowerCase();
  for (var i = 0; i < list.length; i++) {
    var r = list[i] || {};
    var rowLogin = String(_usrPick_(r, ["Login", "login", "emailLogin"]) || "").trim().toLowerCase();
    if (rowLogin && rowLogin === loginLower) {
      _usuariosThrow_("USUARIOS_LOGIN_DUPLICADO", "Já existe um usuário com este login.", { login: login });
    }
  }

  var novoId = gerarNovoUsuarioId_();
  var agoraIso = new Date().toISOString();
  var senhaHash = hashSenha_(senha);

  // usa colunas oficiais (Repository escreve por header)
  var dto = {
    ID_Usuario: novoId,
    NomeCompleto: nome,
    Login: login,
    Email: email,
    Perfil: perfil,
    Ativo: true,
    SenhaHash: senhaHash,

    RegistroProfissional: registroProfissional,
    ConselhoProfissional: conselhoProfissional,
    Especialidade: especialidade,

    CriadoEm: agoraIso,
    AtualizadoEm: agoraIso
  };

  Usuarios_Repo_Insert_(dto);

  return {
    id: novoId,
    nome: nome,
    nomeCompleto: nome,
    login: login,
    email: email,
    perfil: perfil,
    ativo: true,
    criadoEm: agoraIso,
    atualizadoEm: agoraIso
  };
}

/**
 * Atualiza usuário - via patch
 */
function Usuarios_Atualizar_(payload) {
  payload = payload || {};

  var id = String(payload.id || "").trim();
  var nome = String(payload.nome || payload.nomeCompleto || "").trim();
  var login = String(payload.login || "").trim();
  var email = String(payload.email || "").trim();
  var perfil = String(payload.perfil || "").trim() || "secretaria";

  var ativo;
  if (typeof payload.ativo === "boolean") ativo = payload.ativo;
  else ativo = boolFromCell_(payload.ativo);

  var registroProfissional = payload.registroProfissional !== undefined ? String(payload.registroProfissional || "").trim() : null;
  var conselhoProfissional = payload.conselhoProfissional !== undefined ? String(payload.conselhoProfissional || "").trim() : null;
  var especialidade = payload.especialidade !== undefined ? String(payload.especialidade || "").trim() : null;

  if (!id) _usuariosThrow_("USUARIOS_ID_OBRIGATORIO", "ID é obrigatório.", null);
  if (!nome) _usuariosThrow_("USUARIOS_NOME_OBRIGATORIO", "Nome é obrigatório.", null);
  if (!login) _usuariosThrow_("USUARIOS_LOGIN_OBRIGATORIO", "Login é obrigatório.", null);

  try { Usuarios_EnsureSchema_({}); } catch (_) {}

  // checa existência
  var existing = Usuarios_Repo_GetById_(id);
  if (!existing) _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id });

  // checa duplicidade login em outros IDs
  var list = Usuarios_Repo_List_();
  var loginLower = login.toLowerCase();

  for (var i = 0; i < list.length; i++) {
    var r = list[i] || {};
    var rid = String(_usrPick_(r, ["ID_Usuario", "idUsuario", "id_usuario", "id"]) || "").trim();
    if (!rid) continue;

    var rlogin = String(_usrPick_(r, ["Login", "login", "emailLogin"]) || "").trim().toLowerCase();
    if (rid !== id && rlogin && rlogin === loginLower) {
      _usuariosThrow_("USUARIOS_LOGIN_DUPLICADO", "Já existe outro usuário com este login.", { login: login });
    }
  }

  var patch = {
    NomeCompleto: nome,
    Login: login,
    Email: email,
    Perfil: perfil,
    Ativo: ativo,
    AtualizadoEm: new Date().toISOString()
  };

  if (registroProfissional !== null) patch.RegistroProfissional = registroProfissional;
  if (conselhoProfissional !== null) patch.ConselhoProfissional = conselhoProfissional;
  if (especialidade !== null) patch.Especialidade = especialidade;

  var ok = Usuarios_Repo_UpdateById_(id, patch);
  if (!ok) _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id });

  return {
    id: id,
    nome: nome,
    nomeCompleto: nome,
    login: login,
    email: email,
    perfil: perfil,
    ativo: ativo,
    atualizadoEm: patch.AtualizadoEm
  };
}
