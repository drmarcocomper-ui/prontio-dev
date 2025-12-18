/**
 * ============================================================
 * PRONTIO - Usuarios.gs
 * Módulo de usuários (multiusuário)
 *
 * Responsabilidades:
 * - handleUsuariosAction(action, payload)
 * - Usuarios_Listar
 * - Usuarios_Criar
 * - Usuarios_Atualizar
 *
 * Futuro:
 * - Usuarios_AlterarSenha
 * - Usuarios_Arquivar
 * ============================================================
 */

var USUARIOS_SHEET_NAME = "Usuarios";

function handleUsuariosAction(action, payload) {
  switch (action) {
    case "Usuarios_Listar":
      return Usuarios_Listar_(payload);

    case "Usuarios_Criar":
      return Usuarios_Criar_(payload);

    case "Usuarios_Atualizar":
      return Usuarios_Atualizar_(payload);

    default:
      throw {
        code: "USUARIOS_UNKNOWN_ACTION",
        message: "Ação de usuários desconhecida: " + action,
        details: { action: action }
      };
  }
}

function getUsuariosSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USUARIOS_SHEET_NAME);
  if (!sheet) {
    throw {
      code: "USUARIOS_SHEET_NOT_FOUND",
      message: 'Aba de usuários não encontrada: "' + USUARIOS_SHEET_NAME + '".',
      details: null
    };
  }
  return sheet;
}

/**
 * Gera um novo ID de usuário (USR_XXXXXX)
 * (Não depende do número de linhas, evita colisão)
 */
function gerarNovoUsuarioId_() {
  return "USR_" + Utilities.getUuid().split("-")[0].toUpperCase();
}

/**
 * Hash de senha (SHA-256 + Base64).
 * NÃO armazena senha em texto puro.
 */
function hashSenha_(senha) {
  if (!senha) return "";
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    senha
  );
  return Utilities.base64Encode(bytes);
}

function boolFromCell_(v) {
  if (v === true) return true;
  if (v === false) return false;
  var s = (v || "").toString().trim().toLowerCase();
  if (s === "true" || s === "1" || s === "sim" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "nao" || s === "não" || s === "no") return false;
  return false;
}

/**
 * Lista todos os usuários (sem senha).
 */
function Usuarios_Listar_(payload) {
  var sheet = getUsuariosSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  var header = values[0].map(function (h) { return (h || "").toString().trim(); });

  var idx = {
    id: header.indexOf("ID_Usuario"),
    nome: header.indexOf("Nome"),
    login: header.indexOf("Login"),
    email: header.indexOf("Email"),
    perfil: header.indexOf("Perfil"),
    ativo: header.indexOf("Ativo"),
    criadoEm: header.indexOf("CriadoEm"),
    atualizadoEm: header.indexOf("AtualizadoEm"),
    ultimoLoginEm: header.indexOf("UltimoLoginEm")
  };

  if (idx.id < 0) {
    throw { code: "USUARIOS_BAD_SCHEMA", message: 'Coluna "ID_Usuario" não encontrada.', details: idx };
  }

  var lista = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[idx.id]) continue;

    lista.push({
      id: row[idx.id],
      nome: idx.nome >= 0 ? (row[idx.nome] || "") : "",
      login: idx.login >= 0 ? (row[idx.login] || "") : "",
      email: idx.email >= 0 ? (row[idx.email] || "") : "",
      perfil: idx.perfil >= 0 ? (row[idx.perfil] || "") : "",
      ativo: idx.ativo >= 0 ? boolFromCell_(row[idx.ativo]) : false,
      criadoEm: idx.criadoEm >= 0 ? (row[idx.criadoEm] || "") : "",
      atualizadoEm: idx.atualizadoEm >= 0 ? (row[idx.atualizadoEm] || "") : "",
      ultimoLoginEm: idx.ultimoLoginEm >= 0 ? (row[idx.ultimoLoginEm] || "") : ""
    });
  }

  return lista;
}

/**
 * Cria um novo usuário.
 *
 * payload:
 * { nome, login, email, perfil, senha }
 */
function Usuarios_Criar_(payload) {
  payload = payload || {};

  var nome = (payload.nome || "").trim();
  var login = (payload.login || "").trim();
  var email = (payload.email || "").trim();
  var perfil = (payload.perfil || "").trim() || "secretaria";
  var senha = payload.senha || "";

  if (!nome) throw { code: "USUARIOS_NOME_OBRIGATORIO", message: "Nome é obrigatório.", details: null };
  if (!login) throw { code: "USUARIOS_LOGIN_OBRIGATORIO", message: "Login é obrigatório.", details: null };
  if (!senha) throw { code: "USUARIOS_SENHA_OBRIGATORIA", message: "Senha é obrigatória.", details: null };

  var sheet = getUsuariosSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 1) throw { code: "USUARIOS_BAD_SCHEMA", message: "Cabeçalho ausente na aba Usuarios.", details: null };

  var header = values[0].map(function (h) { return (h || "").toString().trim(); });

  var idx = {
    id: header.indexOf("ID_Usuario"),
    nome: header.indexOf("Nome"),
    login: header.indexOf("Login"),
    email: header.indexOf("Email"),
    perfil: header.indexOf("Perfil"),
    ativo: header.indexOf("Ativo"),
    senhaHash: header.indexOf("SenhaHash"),
    criadoEm: header.indexOf("CriadoEm"),
    atualizadoEm: header.indexOf("AtualizadoEm")
  };

  if (idx.id < 0 || idx.login < 0 || idx.senhaHash < 0 || idx.ativo < 0) {
    throw { code: "USUARIOS_BAD_SCHEMA", message: "Cabeçalho da aba Usuarios incompleto.", details: idx };
  }

  // login duplicado
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowLogin = (row[idx.login] || "").toString().trim().toLowerCase();
    if (rowLogin && rowLogin === login.toLowerCase()) {
      throw { code: "USUARIOS_LOGIN_DUPLICADO", message: "Já existe um usuário com este login.", details: { login: login } };
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
 * Atualiza dados básicos de um usuário existente.
 *
 * payload:
 * { id, nome, login, email, perfil, ativo }
 */
function Usuarios_Atualizar_(payload) {
  payload = payload || {};

  var id = (payload.id || "").trim();
  var nome = (payload.nome || "").trim();
  var login = (payload.login || "").trim();
  var email = (payload.email || "").trim();
  var perfil = (payload.perfil || "").trim() || "secretaria";

  var ativo;
  if (typeof payload.ativo === "boolean") ativo = payload.ativo;
  else ativo = boolFromCell_(payload.ativo);

  if (!id) throw { code: "USUARIOS_ID_OBRIGATORIO", message: "ID é obrigatório.", details: null };
  if (!nome) throw { code: "USUARIOS_NOME_OBRIGATORIO", message: "Nome é obrigatório.", details: null };
  if (!login) throw { code: "USUARIOS_LOGIN_OBRIGATORIO", message: "Login é obrigatório.", details: null };

  var sheet = getUsuariosSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) throw { code: "USUARIOS_NAO_ENCONTRADO", message: "Usuário não encontrado.", details: { id: id } };

  var header = values[0].map(function (h) { return (h || "").toString().trim(); });

  var idx = {
    id: header.indexOf("ID_Usuario"),
    nome: header.indexOf("Nome"),
    login: header.indexOf("Login"),
    email: header.indexOf("Email"),
    perfil: header.indexOf("Perfil"),
    ativo: header.indexOf("Ativo"),
    atualizadoEm: header.indexOf("AtualizadoEm")
  };

  if (idx.id < 0 || idx.login < 0) {
    throw { code: "USUARIOS_BAD_SCHEMA", message: "Cabeçalho da aba Usuarios incompleto.", details: idx };
  }

  var linha = -1;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row[idx.id] && String(row[idx.id]) === id) {
      linha = i + 1; // 1-based
      break;
    }
  }

  if (linha === -1) {
    throw { code: "USUARIOS_NAO_ENCONTRADO", message: "Usuário não encontrado.", details: { id: id } };
  }

  // login duplicado em outro ID
  var loginLower = login.toLowerCase();
  for (var j = 1; j < values.length; j++) {
    var r = values[j];
    if (!r[idx.id]) continue;

    var idCheck = String(r[idx.id]);
    var loginCheck = (r[idx.login] || "").toString().trim().toLowerCase();

    if (idCheck !== id && loginCheck === loginLower) {
      throw { code: "USUARIOS_LOGIN_DUPLICADO", message: "Já existe outro usuário com este login.", details: { login: login } };
    }
  }

  var agora = new Date();
  var rowValues = sheet.getRange(linha, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (idx.nome >= 0) rowValues[idx.nome] = nome;
  if (idx.login >= 0) rowValues[idx.login] = login;
  if (idx.email >= 0) rowValues[idx.email] = email;
  if (idx.perfil >= 0) rowValues[idx.perfil] = perfil;
  if (idx.ativo >= 0) rowValues[idx.ativo] = ativo;
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
