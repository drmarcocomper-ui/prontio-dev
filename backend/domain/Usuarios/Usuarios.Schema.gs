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

function _uBuildIdx_(header) {
  var idx = {
    id: _uFindCol_(header, ["ID_Usuario", "idUsuario", "id_usuario", "id"]),
    nome: _uFindCol_(header, ["NomeCompleto", "Nome", "nome", "nomeCompleto"]),
    login: _uFindCol_(header, ["Login", "login", "emailLogin"]),
    email: _uFindCol_(header, ["Email", "E-mail", "email"]),
    perfil: _uFindCol_(header, ["Perfil", "perfil", "Role", "role"]),
    ativo: _uFindCol_(header, ["Ativo", "ativo", "Ativa"]),
    senhaHash: _uFindCol_(header, ["SenhaHash", "senhaHash", "PasswordHash", "passwordHash"]),

    registroProfissional: _uFindCol_(header, ["RegistroProfissional", "DocumentoRegistro", "documentoRegistro", "Registro", "registro"]),
    conselhoProfissional: _uFindCol_(header, ["ConselhoProfissional", "Conselho", "conselho"]),
    especialidade: _uFindCol_(header, ["Especialidade", "especialidade"]),
    assinaturaDigitalBase64: _uFindCol_(header, ["AssinaturaDigitalBase64", "assinaturaDigitalBase64"]),
    corInterface: _uFindCol_(header, ["CorInterface", "corInterface"]),
    permissoesCustomizadas: _uFindCol_(header, ["PermissoesCustomizadasJson", "PermissoesCustomizadas", "permissoesCustomizadas"]),

    idClinica: _uFindCol_(header, ["ID_Clinica", "idClinica", "idClinicaRef", "idClinicaUsuario", "idClinica"]),
    idProfissional: _uFindCol_(header, ["ID_Profissional", "idProfissional", "idProfissionalRef", "idProfissional"]),

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
 * ✅ ENSURE SCHEMA (repo-first)
 * - Não usa SpreadsheetApp diretamente
 * - Usa Usuarios_getSheet_() (que usa PRONTIO_getDb_ / Repo_getDb_)
 * ============================================================
 */
function Usuarios_EnsureSchema_(payload) {
  var sheet = Usuarios_getSheet_();
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
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }

  return { ok: true, added: added, totalCols: header.length };
}
