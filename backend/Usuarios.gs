/**
 * ============================================================
 * PRONTIO - Usuarios.gs
 * ============================================================
 *
 * ✅ SCHEMA DEFINITIVO (ABA "Usuarios")
 *
 * Nomes oficiais (recomendado):
 * - ID_Usuario                 (string)  ex: USR_001
 * - NomeCompleto               (string)  nome exibido
 * - Login                      (string)  único (case-insensitive)
 * - Email                      (string)  opcional
 * - Perfil                     (string)  admin | medico | recepcao | profissional | secretaria | etc
 * - Ativo                      (boolean) TRUE/FALSE
 * - SenhaHash                  (string)  base64(sha256(senhaTexto))
 * - RegistroProfissional       (string)  ex: CRM 12345 / CRP 091234
 * - ConselhoProfissional       (string)  ex: CRM | CRP | CRO | COREN (opcional)
 * - Especialidade              (string)  opcional
 * - AssinaturaDigitalBase64    (string)  opcional
 * - CorInterface               (string)  opcional
 * - PermissoesCustomizadasJson (string)  JSON string (opcional)
 * - ID_Clinica                 (string)  opcional
 * - ID_Profissional            (string)  opcional
 * - CriadoEm                   (date/ISO)
 * - AtualizadoEm               (date/ISO)
 * - UltimoLoginEm              (date/ISO)
 *
 * ✅ Importante:
 * - Ativo e SenhaHash precisam ser SEMPRE corretos.
 * - Registro/Especialidade NUNCA devem ir para Ativo/SenhaHash.
 *
 * ✅ Compatibilidade:
 * - Este arquivo mantém aliases para schemas antigos (Nome, senhaHash, PasswordHash, etc).
 */

var USUARIOS_SHEET_NAME = "Usuarios";

/**
 * Dispatcher de ações (chamado pelo Registry/Api).
 * Compatibilidade:
 * - Chamadas antigas passam apenas (action, payload)
 * - Chamadas novas (Pilar E / Pilar G) passam (action, payload, ctx)
 */
function handleUsuariosAction(action, payload, ctx) {
  switch (action) {
    case "Usuarios_Listar":
      return Usuarios_Listar_(payload);
    case "Usuarios_Criar":
      return Usuarios_Criar_(payload);
    case "Usuarios_Atualizar":
      return Usuarios_Atualizar_(payload);
    case "Usuarios_AlterarSenha":
      return Usuarios_AlterarSenha_(payload);

    // ✅ Pilar C (PROD): reset/admin por ID ou por login/email
    // ✅ Pilar G (auditoria): precisa ctx para registrar quem fez o reset
    case "Usuarios_ResetSenhaAdmin":
      return Usuarios_ResetSenhaAdmin_(payload, ctx);

    // ✅ Pilar E (self-service): alterar a própria senha (exige ctx.user)
    // ✅ Pilar G (auditoria): registra SUCCESS/DENY
    case "Usuarios_AlterarMinhaSenha":
      return Usuarios_AlterarMinhaSenha_(payload, ctx);

    // ✅ utilitário (não registrado no Registry por padrão): garante colunas oficiais no header
    case "Usuarios_EnsureSchema":
      return Usuarios_EnsureSchema_(payload);

    default:
      _usuariosThrow_("USUARIOS_UNKNOWN_ACTION", "Ação de usuários desconhecida: " + action, { action: action });
  }
}

/**
 * ✅ Ajuste mínimo:
 * - Se PRONTIO_getDb_ existir (DEV/PROD), usa ele.
 * - Senão, cai no SpreadsheetApp.getActiveSpreadsheet() (legado).
 */
function getUsuariosSheet_() {
  var ss;
  try {
    if (typeof PRONTIO_getDb_ === "function") ss = PRONTIO_getDb_();
    else ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  var sheet = ss.getSheetByName(USUARIOS_SHEET_NAME);
  if (!sheet) {
    _usuariosThrow_("USUARIOS_SHEET_NOT_FOUND", 'Aba de usuários não encontrada: "' + USUARIOS_SHEET_NAME + '".', null);
  }
  return sheet;
}

function gerarNovoUsuarioId_() {
  return "USR_" + Utilities.getUuid().split("-")[0].toUpperCase();
}

/**
 * ✅ Hash definitivo de senha (compatível com Auth.gs atual)
 * Base64(SHA-256( senhaTexto ))
 */
function hashSenha_(senha) {
  if (!senha) return "";
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(senha)
  );
  return Utilities.base64Encode(bytes);
}

function Usuarios_verifyPassword_(senha, senhaHash) {
  senha = (senha || "").toString();
  senhaHash = (senhaHash || "").toString();
  if (!senha || !senhaHash) return false;
  return hashSenha_(senha) === senhaHash;
}

function boolFromCell_(v) {
  if (v === true) return true;
  if (v === false) return false;
  var s = (v || "").toString().trim().toLowerCase();
  if (s === "true" || s === "1" || s === "sim" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "nao" || s === "não" || s === "no") return false;
  return false;
}

function _usuariosThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || (Errors && Errors.CODES ? Errors.CODES.INTERNAL_ERROR : "INTERNAL_ERROR"));
  err.details = (details === undefined ? null : details);
  throw err;
}

/**
 * ======================
 * Header helpers (aliases)
 * ======================
 */

function _uHeader_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (!values || !values.length) return { header: [], values: values || [] };
  var header = values[0].map(function (h) { return (h || "").toString().trim(); });
  return { header: header, values: values };
}

function _uFindCol_(header, names) {
  for (var i = 0; i < names.length; i++) {
    var idx = header.indexOf(names[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * ✅ Índices com aliases + campos novos do schema definitivo
 */
function _uBuildIdx_(header) {
  var idx = {
    // IDs
    id: _uFindCol_(header, ["ID_Usuario", "idUsuario", "id_usuario", "id"]),

    // Campos base
    nome: _uFindCol_(header, ["NomeCompleto", "Nome", "nome", "nomeCompleto"]),
    login: _uFindCol_(header, ["Login", "login", "emailLogin"]),
    email: _uFindCol_(header, ["Email", "E-mail", "email"]),
    perfil: _uFindCol_(header, ["Perfil", "perfil", "Role", "role"]),
    ativo: _uFindCol_(header, ["Ativo", "ativo", "Ativa"]),

    // Auth
    senhaHash: _uFindCol_(header, ["SenhaHash", "senhaHash", "PasswordHash", "passwordHash"]),

    // ✅ Campos profissionais (schema definitivo)
    registroProfissional: _uFindCol_(header, ["RegistroProfissional", "DocumentoRegistro", "documentoRegistro", "Registro", "registro"]),
    conselhoProfissional: _uFindCol_(header, ["ConselhoProfissional", "Conselho", "conselho"]),
    especialidade: _uFindCol_(header, ["Especialidade", "especialidade"]),
    assinaturaDigitalBase64: _uFindCol_(header, ["AssinaturaDigitalBase64", "assinaturaDigitalBase64"]),
    corInterface: _uFindCol_(header, ["CorInterface", "corInterface"]),
    permissoesCustomizadas: _uFindCol_(header, ["PermissoesCustomizadasJson", "PermissoesCustomizadas", "permissoesCustomizadas"]),

    // ✅ Vinculações
    idClinica: _uFindCol_(header, ["ID_Clinica", "idClinica", "idClinicaRef", "idClinicaUsuario"]),
    idProfissional: _uFindCol_(header, ["ID_Profissional", "idProfissional", "idProfissionalRef"]),

    // Datas
    criadoEm: _uFindCol_(header, ["CriadoEm", "criadoEm"]),
    atualizadoEm: _uFindCol_(header, ["AtualizadoEm", "atualizadoEm"]),
    ultimoLoginEm: _uFindCol_(header, ["UltimoLoginEm", "ÚltimoLoginEm", "ultimoLoginEm"])
  };

  return idx;
}

function _uGet_(row, idx) {
  if (idx < 0) return "";
  return row[idx];
}

/**
 * ============================================================
 * ✅ ENSURE SCHEMA (cria colunas oficiais faltantes no header)
 * - Não remove nada.
 * - Não reordena (para não quebrar histórico), só garante que existam os nomes oficiais.
 * ============================================================
 */
function Usuarios_EnsureSchema_(payload) {
  var sheet = getUsuariosSheet_();
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", "Cabeçalho ausente na aba Usuarios.", null);
  }

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || "").trim(); });
  var needed = [
    "ID_Usuario",
    "NomeCompleto",
    "Login",
    "Email",
    "Perfil",
    "Ativo",
    "SenhaHash",
    "RegistroProfissional",
    "ConselhoProfissional",
    "Especialidade",
    "AssinaturaDigitalBase64",
    "CorInterface",
    "PermissoesCustomizadasJson",
    "ID_Clinica",
    "ID_Profissional",
    "CriadoEm",
    "AtualizadoEm",
    "UltimoLoginEm"
  ];

  var added = [];
  for (var i = 0; i < needed.length; i++) {
    var colName = needed[i];
    if (header.indexOf(colName) < 0) {
      header.push(colName);
      added.push(colName);
    }
  }

  if (added.length) {
    // escreve header expandido
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }

  return { ok: true, added: added, totalCols: header.length };
}

/**
 * Lista todos os usuários (sem senha).
 */
function Usuarios_Listar_(payload) {
  var sheet = getUsuariosSheet_();
  var pack = _uHeader_(sheet);
  var values = pack.values;
  if (values.length <= 1) return [];

  var header = pack.header;
  var idx = _uBuildIdx_(header);

  if (idx.id < 0) _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Coluna de ID do usuário não encontrada (esperado: "ID_Usuario").', { header: header });

  var lista = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[idx.id]) continue;

    lista.push({
      id: String(_uGet_(row, idx.id) || ""),
      nome: idx.nome >= 0 ? String(_uGet_(row, idx.nome) || "") : "",
      login: idx.login >= 0 ? String(_uGet_(row, idx.login) || "") : "",
      email: idx.email >= 0 ? String(_uGet_(row, idx.email) || "") : "",
      perfil: idx.perfil >= 0 ? String(_uGet_(row, idx.perfil) || "") : "",
      ativo: idx.ativo >= 0 ? boolFromCell_(_uGet_(row, idx.ativo)) : false,

      // ✅ novos campos (se existirem)
      registroProfissional: idx.registroProfissional >= 0 ? String(_uGet_(row, idx.registroProfissional) || "") : "",
      conselhoProfissional: idx.conselhoProfissional >= 0 ? String(_uGet_(row, idx.conselhoProfissional) || "") : "",
      especialidade: idx.especialidade >= 0 ? String(_uGet_(row, idx.especialidade) || "") : "",
      assinaturaDigitalBase64: idx.assinaturaDigitalBase64 >= 0 ? String(_uGet_(row, idx.assinaturaDigitalBase64) || "") : "",
      corInterface: idx.corInterface >= 0 ? String(_uGet_(row, idx.corInterface) || "") : "",
      permissoesCustomizadasJson: idx.permissoesCustomizadas >= 0 ? String(_uGet_(row, idx.permissoesCustomizadas) || "") : "",

      idClinica: idx.idClinica >= 0 ? String(_uGet_(row, idx.idClinica) || "") : "",
      idProfissional: idx.idProfissional >= 0 ? String(_uGet_(row, idx.idProfissional) || "") : "",

      criadoEm: idx.criadoEm >= 0 ? (_uGet_(row, idx.criadoEm) || "") : "",
      atualizadoEm: idx.atualizadoEm >= 0 ? (_uGet_(row, idx.atualizadoEm) || "") : "",
      ultimoLoginEm: idx.ultimoLoginEm >= 0 ? (_uGet_(row, idx.ultimoLoginEm) || "") : ""
    });
  }

  return lista;
}

/**
 * Busca usuário por identificador para autenticação (inclui senhaHash).
 * ✅ Pilar A: Aceita Login OU Email (case-insensitive). Prioriza Login.
 */
function Usuarios_findByLoginForAuth_(identifier) {
  identifier = (identifier || "").toString().trim().toLowerCase();
  if (!identifier) return null;

  var sheet = getUsuariosSheet_();
  var pack = _uHeader_(sheet);
  var values = pack.values;
  if (values.length <= 1) return null;

  var header = pack.header;
  var idx = _uBuildIdx_(header);

  if (idx.id < 0 || idx.senhaHash < 0 || idx.ativo < 0) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", "Cabeçalho da aba Usuarios incompleto para autenticação.", {
      required: ["ID_Usuario", "SenhaHash", "Ativo"],
      header: header,
      idx: idx
    });
  }

  var foundByEmail = null;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[idx.id]) continue;

    var rowLogin = idx.login >= 0 ? String(_uGet_(row, idx.login) || "").trim().toLowerCase() : "";
    var rowEmail = idx.email >= 0 ? String(_uGet_(row, idx.email) || "").trim().toLowerCase() : "";

    // Prioridade 1: Login
    if (rowLogin && rowLogin === identifier) {
      return {
        id: String(_uGet_(row, idx.id) || ""),
        nome: idx.nome >= 0 ? String(_uGet_(row, idx.nome) || "") : "",
        login: idx.login >= 0 ? String(_uGet_(row, idx.login) || "") : "",
        email: idx.email >= 0 ? String(_uGet_(row, idx.email) || "") : "",
        perfil: idx.perfil >= 0 ? String(_uGet_(row, idx.perfil) || "") : "",
        ativo: idx.ativo >= 0 ? boolFromCell_(_uGet_(row, idx.ativo)) : false,
        senhaHash: idx.senhaHash >= 0 ? String(_uGet_(row, idx.senhaHash) || "") : ""
      };
    }

    // Fallback: Email
    if (!foundByEmail && rowEmail && rowEmail === identifier) {
      foundByEmail = {
        id: String(_uGet_(row, idx.id) || ""),
        nome: idx.nome >= 0 ? String(_uGet_(row, idx.nome) || "") : "",
        login: idx.login >= 0 ? String(_uGet_(row, idx.login) || "") : "",
        email: idx.email >= 0 ? String(_uGet_(row, idx.email) || "") : "",
        perfil: idx.perfil >= 0 ? String(_uGet_(row, idx.perfil) || "") : "",
        ativo: idx.ativo >= 0 ? boolFromCell_(_uGet_(row, idx.ativo)) : false,
        senhaHash: idx.senhaHash >= 0 ? String(_uGet_(row, idx.senhaHash) || "") : ""
      };
    }
  }

  return foundByEmail;
}

/**
 * Localiza linha por ID_Usuario.
 * Retorna { sheet, rowIndex, row, header, idx } ou null.
 */
function Usuarios_findRowById_(id) {
  id = (id || "").toString().trim();
  if (!id) return null;

  var sheet = getUsuariosSheet_();
  var pack = _uHeader_(sheet);
  var values = pack.values;
  if (values.length <= 1) return null;

  var header = pack.header;
  var idx = _uBuildIdx_(header);

  if (idx.id < 0) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Coluna "ID_Usuario" (ou alias) não encontrada.', { header: header, idx: idx });
  }

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row[idx.id] && String(row[idx.id]) === id) {
      return { sheet: sheet, rowIndex: i + 1, row: row, header: header, idx: idx };
    }
  }
  return null;
}

/**
 * Localiza linha por Login OU Email (case-insensitive).
 * Retorna { sheet, rowIndex, row, header, idx } ou null.
 */
function Usuarios_findRowByIdentifier_(identifier) {
  identifier = (identifier || "").toString().trim().toLowerCase();
  if (!identifier) return null;

  var sheet = getUsuariosSheet_();
  var pack = _uHeader_(sheet);
  var values = pack.values;
  if (values.length <= 1) return null;

  var header = pack.header;
  var idx = _uBuildIdx_(header);

  if (idx.id < 0) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Coluna "ID_Usuario" (ou alias) não encontrada.', { header: header, idx: idx });
  }

  var foundByEmail = null;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[idx.id]) continue;

    var rowLogin = idx.login >= 0 ? String(_uGet_(row, idx.login) || "").trim().toLowerCase() : "";
    var rowEmail = idx.email >= 0 ? String(_uGet_(row, idx.email) || "").trim().toLowerCase() : "";

    if (rowLogin && rowLogin === identifier) {
      return { sheet: sheet, rowIndex: i + 1, row: row, header: header, idx: idx };
    }

    if (!foundByEmail && rowEmail && rowEmail === identifier) {
      foundByEmail = { sheet: sheet, rowIndex: i + 1, row: row, header: header, idx: idx };
    }
  }

  return foundByEmail;
}

/**
 * Marca UltimoLoginEm (best-effort).
 */
function Usuarios_markUltimoLogin_(id) {
  id = (id || "").toString().trim();
  if (!id) return { ok: false };

  var sheet = getUsuariosSheet_();
  var pack = _uHeader_(sheet);
  var values = pack.values;
  if (values.length <= 1) return { ok: false };

  var header = pack.header;
  var idx = _uBuildIdx_(header);

  if (idx.id < 0 || idx.ultimoLoginEm < 0) return { ok: false };

  var linha = -1;
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row[idx.id] && String(row[idx.id]) === id) {
      linha = i + 1;
      break;
    }
  }
  if (linha < 0) return { ok: false };

  sheet.getRange(linha, idx.ultimoLoginEm + 1).setValue(new Date());
  return { ok: true };
}

/**
 * Cria usuário.
 * Observação: respeita o header atual da aba (NomeCompleto, etc.)
 */
function Usuarios_Criar_(payload) {
  payload = payload || {};

  var nome = String(payload.nome || payload.nomeCompleto || "").trim();
  var login = String(payload.login || "").trim();
  var email = String(payload.email || "").trim();
  var perfil = String(payload.perfil || "").trim() || "secretaria";
  var senha = String(payload.senha || "");

  // ✅ campos profissionais (opcional)
  var registroProfissional = String(payload.registroProfissional || payload.documentoRegistro || "").trim();
  var conselhoProfissional = String(payload.conselhoProfissional || "").trim();
  var especialidade = String(payload.especialidade || "").trim();

  if (!nome) _usuariosThrow_("USUARIOS_NOME_OBRIGATORIO", "Nome é obrigatório.", null);
  if (!login) _usuariosThrow_("USUARIOS_LOGIN_OBRIGATORIO", "Login é obrigatório.", null);
  if (!senha) _usuariosThrow_("USUARIOS_SENHA_OBRIGATORIA", "Senha é obrigatória.", null);

  var sheet = getUsuariosSheet_();
  var pack = _uHeader_(sheet);
  var values = pack.values;
  if (values.length < 1) _usuariosThrow_("USUARIOS_BAD_SCHEMA", "Cabeçalho ausente na aba Usuarios.", null);

  var header = pack.header;
  var idx = _uBuildIdx_(header);

  if (idx.id < 0 || idx.login < 0 || idx.senhaHash < 0 || idx.ativo < 0) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", "Cabeçalho da aba Usuarios incompleto.", { header: header, idx: idx });
  }

  var loginLower = login.toLowerCase();
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowLogin = String(_uGet_(row, idx.login) || "").trim().toLowerCase();
    if (rowLogin && rowLogin === loginLower) {
      _usuariosThrow_("USUARIOS_LOGIN_DUPLICADO", "Já existe um usuário com este login.", { login: login });
    }
  }

  var novoId = gerarNovoUsuarioId_();
  var agora = new Date();
  var senhaHash = hashSenha_(senha);

  var novaLinha = new Array(sheet.getLastColumn());
  novaLinha[idx.id] = novoId;

  if (idx.nome >= 0) novaLinha[idx.nome] = nome;
  if (idx.login >= 0) novaLinha[idx.login] = login;
  if (idx.email >= 0) novaLinha[idx.email] = email;
  if (idx.perfil >= 0) novaLinha[idx.perfil] = perfil;
  if (idx.ativo >= 0) novaLinha[idx.ativo] = true;
  if (idx.senhaHash >= 0) novaLinha[idx.senhaHash] = senhaHash;

  // ✅ novos campos se existirem no header
  if (idx.registroProfissional >= 0) novaLinha[idx.registroProfissional] = registroProfissional;
  if (idx.conselhoProfissional >= 0) novaLinha[idx.conselhoProfissional] = conselhoProfissional;
  if (idx.especialidade >= 0) novaLinha[idx.especialidade] = especialidade;

  if (idx.criadoEm >= 0) novaLinha[idx.criadoEm] = agora;
  if (idx.atualizadoEm >= 0) novaLinha[idx.atualizadoEm] = agora;

  sheet.appendRow(novaLinha);

  return {
    id: novoId,
    nome: nome,
    login: login,
    email: email,
    perfil: perfil,
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora
  };
}

/**
 * Atualiza usuário.
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

  // ✅ novos campos opcionais
  var registroProfissional = payload.registroProfissional !== undefined ? String(payload.registroProfissional || "").trim() : null;
  var conselhoProfissional = payload.conselhoProfissional !== undefined ? String(payload.conselhoProfissional || "").trim() : null;
  var especialidade = payload.especialidade !== undefined ? String(payload.especialidade || "").trim() : null;

  if (!id) _usuariosThrow_("USUARIOS_ID_OBRIGATORIO", "ID é obrigatório.", null);
  if (!nome) _usuariosThrow_("USUARIOS_NOME_OBRIGATORIO", "Nome é obrigatório.", null);
  if (!login) _usuariosThrow_("USUARIOS_LOGIN_OBRIGATORIO", "Login é obrigatório.", null);

  var sheet = getUsuariosSheet_();
  var pack = _uHeader_(sheet);
  var values = pack.values;
  if (values.length <= 1) _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id });

  var header = pack.header;
  var idx = _uBuildIdx_(header);

  if (idx.id < 0 || idx.login < 0) _usuariosThrow_("USUARIOS_BAD_SCHEMA", "Cabeçalho da aba Usuarios incompleto.", { header: header, idx: idx });

  var linha = -1;
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row[idx.id] && String(row[idx.id]) === id) {
      linha = i + 1;
      break;
    }
  }
  if (linha === -1) _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id });

  var loginLower = login.toLowerCase();
  for (var j = 1; j < values.length; j++) {
    var r = values[j];
    if (!r[idx.id]) continue;

    var idCheck = String(r[idx.id]);
    var loginCheck = String(_uGet_(r, idx.login) || "").trim().toLowerCase();

    if (idCheck !== id && loginCheck === loginLower) {
      _usuariosThrow_("USUARIOS_LOGIN_DUPLICADO", "Já existe outro usuário com este login.", { login: login });
    }
  }

  var agora = new Date();
  var rowValues = sheet.getRange(linha, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (idx.nome >= 0) rowValues[idx.nome] = nome;
  if (idx.login >= 0) rowValues[idx.login] = login;
  if (idx.email >= 0) rowValues[idx.email] = email;
  if (idx.perfil >= 0) rowValues[idx.perfil] = perfil;
  if (idx.ativo >= 0) rowValues[idx.ativo] = ativo;

  // ✅ novos campos (se existirem no header e vierem no payload)
  if (idx.registroProfissional >= 0 && registroProfissional !== null) rowValues[idx.registroProfissional] = registroProfissional;
  if (idx.conselhoProfissional >= 0 && conselhoProfissional !== null) rowValues[idx.conselhoProfissional] = conselhoProfissional;
  if (idx.especialidade >= 0 && especialidade !== null) rowValues[idx.especialidade] = especialidade;

  if (idx.atualizadoEm >= 0) rowValues[idx.atualizadoEm] = agora;

  sheet.getRange(linha, 1, 1, rowValues.length).setValues([rowValues]);

  return {
    id: id,
    nome: nome,
    login: login,
    email: email,
    perfil: perfil,
    ativo: ativo,
    atualizadoEm: agora
  };
}

/**
 * ✅ Altera/reset senha de um usuário (admin).
 * payload: { id, senha }
 * (mantido para compatibilidade com chamadas existentes)
 */
function Usuarios_AlterarSenha_(payload) {
  payload = payload || {};

  var id = String(payload.id || "").trim();
  var senha = String(payload.senha || "");

  if (!id) _usuariosThrow_("USUARIOS_ID_OBRIGATORIO", "ID é obrigatório.", null);
  if (!senha) _usuariosThrow_("USUARIOS_SENHA_OBRIGATORIA", "Senha é obrigatória.", null);

  var found = Usuarios_findRowById_(id);
  if (!found) _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id });

  var idx = found.idx;

  if (idx.senhaHash < 0) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Cabeçalho deve conter "SenhaHash" (ou aliases).', { header: found.header, idx: idx });
  }

  var senhaHash = hashSenha_(senha);
  found.sheet.getRange(found.rowIndex, idx.senhaHash + 1).setValue(senhaHash);

  if (idx.atualizadoEm >= 0) {
    found.sheet.getRange(found.rowIndex, idx.atualizadoEm + 1).setValue(new Date());
  }

  return { ok: true, id: id };
}

/**
 * ============================================================
 * Pilar C — Reset de senha ADMIN (PROD)
 * ============================================================
 * payload aceito:
 * - { id: "USR_001", senha: "nova" }
 * - { identifier: "marco" | "marco@exemplo.com", senha: "nova" }
 * - { login: "...", senha: "nova" }  (alias)
 * - { email: "...", senha: "nova" }  (alias)
 *
 * opcionais:
 * - { ativar: true } -> marca Ativo=TRUE se existir coluna
 *
 * Retorna sem vazar hash:
 * { ok:true, id, login, email, ativo? }
 *
 * ✅ Pilar G:
 * - recebe ctx para auditar quem executou e quem foi afetado
 * - NÃO loga senha/token (Audit_securityEvent_ sanitiza)
 */
function Usuarios_ResetSenhaAdmin_(payload, ctx) {
  payload = payload || {};
  ctx = ctx || {};

  var id = String(payload.id || "").trim();
  var identifier = String(payload.identifier || payload.login || payload.email || "").trim();
  var senha = String(payload.senha || "");

  var ativar;
  if (typeof payload.ativar === "boolean") ativar = payload.ativar;
  else if (payload.ativar !== undefined) ativar = boolFromCell_(payload.ativar);
  else ativar = null; // não altera por padrão

  if (!senha) _usuariosThrow_("USUARIOS_SENHA_OBRIGATORIA", "Senha é obrigatória.", null);
  if (!id && !identifier) _usuariosThrow_("USUARIOS_ID_OU_IDENTIFICADOR_OBRIGATORIO", "Informe id ou identifier (login/email).", null);

  var found = id ? Usuarios_findRowById_(id) : Usuarios_findRowByIdentifier_(identifier);
  if (!found) {
    _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id || null, identifier: identifier || null });
  }

  var idx = found.idx;

  if (idx.senhaHash < 0) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Cabeçalho deve conter "SenhaHash" (ou aliases).', { header: found.header, idx: idx });
  }

  var senhaHash = hashSenha_(senha);
  found.sheet.getRange(found.rowIndex, idx.senhaHash + 1).setValue(senhaHash);

  if (ativar === true && idx.ativo >= 0) {
    found.sheet.getRange(found.rowIndex, idx.ativo + 1).setValue(true);
  }

  if (idx.atualizadoEm >= 0) {
    found.sheet.getRange(found.rowIndex, idx.atualizadoEm + 1).setValue(new Date());
  }

  // ✅ Pilar G: auditoria best-effort (sem senha)
  try {
    var targetId = idx.id >= 0 ? String(_uGet_(found.row, idx.id) || "") : "";
    var targetLogin = idx.login >= 0 ? String(_uGet_(found.row, idx.login) || "") : "";
    if (typeof Audit_securityEvent_ === "function") {
      Audit_securityEvent_(
        ctx,
        "Usuarios_ResetSenhaAdmin",
        "ADMIN_PASSWORD_RESET",
        "SUCCESS",
        { ativar: ativar === true },
        { id: targetId, login: targetLogin }
      );
    }
  } catch (_) {}

  var rowNow = found.sheet.getRange(found.rowIndex, 1, 1, found.sheet.getLastColumn()).getValues()[0];

  return {
    ok: true,
    id: idx.id >= 0 ? String(_uGet_(rowNow, idx.id) || "") : "",
    login: idx.login >= 0 ? String(_uGet_(rowNow, idx.login) || "") : "",
    email: idx.email >= 0 ? String(_uGet_(rowNow, idx.email) || "") : "",
    ativo: idx.ativo >= 0 ? boolFromCell_(_uGet_(rowNow, idx.ativo)) : null
  };
}

/**
 * ============================================================
 * Pilar E — Alterar senha do PRÓPRIO usuário
 * ============================================================
 * payload:
 * - { senhaAtual, novaSenha }
 *
 * Regras:
 * - usuário deve estar autenticado (ctx.user)
 * - valida senha atual
 * - grava nova senha
 * - não permite trocar senha de outro usuário
 *
 * ✅ Pilar G:
 * - audita DENY quando senha atual inválida
 * - audita SUCCESS quando troca ocorre
 */
function Usuarios_AlterarMinhaSenha_(payload, ctx) {
  payload = payload || {};
  ctx = ctx || {};

  if (!ctx.user || !ctx.user.id) {
    _usuariosThrow_("AUTH_REQUIRED", "Usuário não autenticado.", null);
  }

  var senhaAtual = String(payload.senhaAtual || "");
  var novaSenha = String(payload.novaSenha || "");

  if (!senhaAtual) {
    _usuariosThrow_("USUARIOS_SENHA_ATUAL_OBRIGATORIA", "Senha atual é obrigatória.", null);
  }
  if (!novaSenha) {
    _usuariosThrow_("USUARIOS_NOVA_SENHA_OBRIGATORIA", "Nova senha é obrigatória.", null);
  }
  if (novaSenha.length < 6) {
    _usuariosThrow_("USUARIOS_SENHA_FRACA", "Nova senha deve ter pelo menos 6 caracteres.", null);
  }

  var found = Usuarios_findRowById_(ctx.user.id);
  if (!found) {
    _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: ctx.user.id });
  }

  var idx = found.idx;

  if (idx.senhaHash < 0) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Coluna "SenhaHash" não encontrada.', { header: found.header });
  }

  var senhaHashAtual = String(_uGet_(found.row, idx.senhaHash) || "");
  if (!Usuarios_verifyPassword_(senhaAtual, senhaHashAtual)) {
    // ✅ Pilar G: auditoria DENY best-effort
    try {
      if (typeof Audit_securityEvent_ === "function") {
        Audit_securityEvent_(
          ctx,
          "Usuarios_AlterarMinhaSenha",
          "PASSWORD_CHANGE",
          "DENY",
          { reason: "CURRENT_PASSWORD_INVALID" },
          { id: ctx.user.id, login: ctx.user.login || "" }
        );
      }
    } catch (_) {}

    _usuariosThrow_("USUARIOS_SENHA_ATUAL_INVALIDA", "Senha atual inválida.", null);
  }

  var novaHash = hashSenha_(novaSenha);
  found.sheet.getRange(found.rowIndex, idx.senhaHash + 1).setValue(novaHash);

  // Opcional: reativar (não faz aqui; isso é admin-only no Pilar C)
  if (idx.atualizadoEm >= 0) {
    found.sheet.getRange(found.rowIndex, idx.atualizadoEm + 1).setValue(new Date());
  }

  // ✅ Pilar G: auditoria SUCCESS best-effort
  try {
    if (typeof Audit_securityEvent_ === "function") {
      Audit_securityEvent_(
        ctx,
        "Usuarios_AlterarMinhaSenha",
        "PASSWORD_CHANGE",
        "SUCCESS",
        {},
        { id: ctx.user.id, login: ctx.user.login || "" }
      );
    }
  } catch (_) {}

  return {
    ok: true,
    id: ctx.user.id
  };
}
