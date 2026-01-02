/**
 * ============================================================
 * PRONTIO - Migrations.gs (FASE 4)
 * ============================================================
 * - Bootstrap/criação de abas e cabeçalhos mínimos
 * - Versionamento do schema
 * - Estado do banco (DbStatus)
 *
 * Regras:
 * - Front NÃO conhece Sheets.
 * - Aqui é backend-only. Nomes de abas/colunas são internos.
 * - Usa PRONTIO_getDb_() (Utils.gs) para selecionar DEV/PROD.
 *
 * ✅ FIX (SEM QUEBRAR):
 * - Não sobrescreve cabeçalho existente automaticamente (evita “trocar colunas do nada”).
 * - Mantém criação de header apenas quando a aba está vazia.
 *
 * ✅ ALINHAMENTO PROFISSIONAL (Pacientes):
 * - Como o sistema ainda não tem pacientes, padronizamos a aba única "Pacientes"
 *   no schema v2 (compatível com Pacientes.gs).
 */

var MIGRATIONS_LATEST_VERSION = 2;

var MIGRATIONS_META_SHEET = "__meta";
var MIGRATIONS_META_HEADERS = ["key", "value", "updatedAt"];

/**
 * ============================================================
 * MIGRATIONS_SHEETS
 * ============================================================
 * IMPORTANTE:
 * - Estes nomes/campos são internos do backend.
 * - Ajuste de headers aqui NÃO quebra o front (front não conhece Sheets).
 *
 * Estratégia profissional (agora):
 * - "Pacientes" passa a ser v2 (uma aba só).
 * - "Agenda" já está no formato novo (DTO).
 */
var MIGRATIONS_SHEETS = {
  "__meta": MIGRATIONS_META_HEADERS,

  // =========================
  // AGENDA (novo DTO)
  // =========================
  "Agenda": [
    "idAgenda",
    "idPaciente",
    "inicio",
    "fim",
    "titulo",
    "notas",
    "tipo",
    "status",
    "origem",
    "criadoEm",
    "atualizadoEm",
    "canceladoEm",
    "canceladoMotivo"
  ],

  // =========================
  // PACIENTES (v2 - ABA ÚNICA OFICIAL)
  // =========================
  "Pacientes": [
    "idPaciente",
    "status",
    "nomeCompleto",
    "nomeSocial",
    "sexo",
    "dataNascimento",
    "estadoCivil",
    "cpf",
    "rg",
    "rgOrgaoEmissor",
    "telefonePrincipal",
    "telefoneSecundario",
    "email",
    "planoSaude",
    "numeroCarteirinha",
    "profissao",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "tipoSanguineo",
    "alergias",
    "observacoesClinicas",
    "observacoesAdministrativas",
    "criadoEm",
    "atualizadoEm"
  ],

  // =========================
  // LEGADO (mantido)
  // =========================
  "Evolucao": [
    "idEvolucao",
    "idPaciente",
    "data",
    "texto",
    "criadoEm",
    "atualizadoEm",
    "ativo"
  ],

  // Preparado para uso futuro (Audit.gs poderá persistir aqui)
  "Audit": [
    "ts",
    "requestId",
    "action",
    "env",
    "apiVersion",
    "userId",
    "userLogin",
    "userPerfil",
    "outcome",
    "entity",
    "entityId",
    "durationMs",
    "error",
    "extra"
  ],

  // =========================
  // NOVO (Fase 4 módulos)
  // =========================
  "Clinica": [
    "idClinica",
    "nome",
    "endereco",
    "telefone",
    "email",
    "logoUrl",
    "timezone",
    "templatesDocumentos",
    "parametrosGlobais",
    "criadoEm",
    "atualizadoEm",
    "ativo"
  ],

  "Profissionais": [
    "idProfissional",
    "idClinica",
    "tipoProfissional",
    "nomeCompleto",
    "documentoRegistro",
    "especialidade",
    "assinaturaDigitalBase64",
    "corInterface",
    "ativo",
    "criadoEm",
    "atualizadoEm"
  ],

  "Usuarios": [
    "ID_Usuario",
    "Nome",
    "Login",
    "Email",
    "Perfil",
    "Ativo",
    "SenhaHash",
    "CriadoEm",
    "AtualizadoEm",
    "UltimoLoginEm",

    "idClinica",
    "idProfissional",
    "permissoesCustomizadas"
  ],

  "AgendaDisponibilidade": [
    "idDisponibilidade",
    "idClinica",
    "idProfissional",
    "diaSemana",
    "horaInicio",
    "horaFim",
    "intervaloMinutos",
    "localSala",
    "ativo",
    "criadoEm",
    "atualizadoEm"
  ],

  "AgendaExcecoes": [
    "idExcecao",
    "idClinica",
    "idProfissional",
    "dataInicio",
    "dataFim",
    "tipo",
    "blocosEspeciais",
    "motivo",
    "criadoEm",
    "atualizadoEm",
    "ativo"
  ],

  "AgendaEventos": [
    "idEvento",
    "idClinica",
    "idProfissional",
    "idPaciente",
    "inicioDateTime",
    "fimDateTime",
    "tipo",
    "status",
    "titulo",
    "notas",
    "permiteEncaixe",
    "canceladoEm",
    "canceladoMotivo",
    "criadoEm",
    "atualizadoEm",
    "ativo"
  ],

  "AgendaAcl": [
    "idAcesso",
    "idClinica",
    "idUsuario",
    "idProfissional",
    "permissoes",
    "ativo",
    "criadoEm",
    "atualizadoEm"
  ],

  // =========================
  // CONFIG / AUTH (SEM QUEBRAR)
  // =========================
  "AuthSessions": [
    "Token",
    "UserJson",
    "ExpiresAtIso",
    "RevokedAtIso",
    "UserId"
  ],

  "AgendaConfig": [
    "Chave",
    "Valor"
  ],

  // =========================
  // DOCUMENTOS (buscas / autocomplete)
  // =========================
  "Encaminhamento": [
    "Encaminhamento",
    "NomeDoProfissional",
    "Avaliação",
    "Telefone"
  ],

  "CID": [
    "CID",
    "Descricao",
    "Sinonimos"
  ]
};

/**
 * ============================================================
 * ✅ Handler esperado pelo Registry (Meta_BootstrapDb)
 * ============================================================
 */
function Meta_BootstrapDb(ctx, payload) {
  return Migrations_bootstrap_();
}

/**
 * ✅ FIX (SEM QUEBRAR):
 * Wrapper esperado no Registry: Meta_DbStatus
 */
function Meta_DbStatus(ctx, payload) {
  return Migrations_getDbStatus_();
}

/**
 * Retorna o status do banco, sem alterar nada.
 */
function Migrations_getDbStatus_() {
  var db = _migGetDb_();
  var existingSheets = db.getSheets().map(function (s) { return s.getName(); });

  var missing = [];
  var present = [];
  Object.keys(MIGRATIONS_SHEETS).forEach(function (name) {
    if (existingSheets.indexOf(name) >= 0) present.push(name);
    else missing.push(name);
  });

  var meta = _migTryReadMeta_();
  var currentVersion = meta.dbVersion !== null ? Number(meta.dbVersion) : null;
  var latest = Number(MIGRATIONS_LATEST_VERSION);

  var ok = (missing.length === 0) && (currentVersion !== null) && (currentVersion >= latest);

  return {
    ok: ok,
    latestVersion: latest,
    currentVersion: currentVersion,
    needsBootstrap: (missing.length > 0) || (currentVersion === null),
    needsMigration: (currentVersion !== null) ? (currentVersion < latest) : true,
    missingSheets: missing,
    presentSheets: present,
    env: (typeof PRONTIO_ENV !== "undefined") ? PRONTIO_ENV : null,
    dbId: _migTryGetDbId_()
  };
}

/**
 * Executa bootstrap/migrations até a última versão.
 */
function Migrations_bootstrap_() {
  var db = _migGetDb_();

  // 1) Garante abas + headers
  Object.keys(MIGRATIONS_SHEETS).forEach(function (sheetName) {
    _migEnsureSheetWithHeader_(db, sheetName, MIGRATIONS_SHEETS[sheetName]);
  });

  // 2) Garante meta keys e versão
  var meta = _migTryReadMeta_();
  var currentVersion = meta.dbVersion !== null ? Number(meta.dbVersion) : 0;

  if (!currentVersion || currentVersion < 0) currentVersion = 0;

  // 3) Aplica migrations incrementais
  var target = Number(MIGRATIONS_LATEST_VERSION);
  for (var v = currentVersion + 1; v <= target; v++) {
    _migApplyVersion_(v);
  }

  _migSetMeta_("dbVersion", String(target));
  _migSetMeta_("dbUpdatedAt", new Date().toISOString());

  return {
    ok: true,
    appliedToVersion: target,
    status: Migrations_getDbStatus_()
  };
}

function _migApplyVersion_(version) {
  _migSetMeta_("lastMigrationVersion", String(version));
  _migSetMeta_("lastMigrationAt", new Date().toISOString());
}

/**
 * Leitura segura do meta.
 */
function _migTryReadMeta_() {
  var db = _migGetDb_();
  var sheet = db.getSheetByName(MIGRATIONS_META_SHEET);
  if (!sheet) return { dbVersion: null };

  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return { dbVersion: null };

  var header = values[0];
  var idxKey = header.indexOf("key");
  var idxVal = header.indexOf("value");
  if (idxKey < 0 || idxVal < 0) return { dbVersion: null };

  var map = {};
  for (var i = 1; i < values.length; i++) {
    var k = values[i][idxKey];
    var v = values[i][idxVal];
    if (k) map[String(k)] = v;
  }

  return {
    dbVersion: map.dbVersion !== undefined ? map.dbVersion : null
  };
}

function _migSetMeta_(key, value) {
  var db = _migGetDb_();
  var sheet = db.getSheetByName(MIGRATIONS_META_SHEET);
  if (!sheet) sheet = db.insertSheet(MIGRATIONS_META_SHEET);

  _migEnsureHeader_(sheet, MIGRATIONS_META_HEADERS);

  var values = sheet.getDataRange().getValues();
  var header = values[0];
  var idxKey = header.indexOf("key");
  var idxVal = header.indexOf("value");
  var idxUpd = header.indexOf("updatedAt");

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idxKey]) === String(key)) {
      sheet.getRange(i + 1, idxVal + 1).setValue(value);
      sheet.getRange(i + 1, idxUpd + 1).setValue(new Date());
      return true;
    }
  }

  sheet.appendRow([key, value, new Date()]);
  return true;
}

/**
 * Garante aba com cabeçalho correto.
 * ✅ Profissional: só escreve header se a aba estiver sem header.
 * ❌ Não sobrescreve headers existentes (evita mudanças “mágicas”).
 */
function _migEnsureSheetWithHeader_(db, sheetName, headers) {
  var sheet = db.getSheetByName(sheetName);
  if (!sheet) sheet = db.insertSheet(sheetName);

  _migEnsureHeader_(sheet, headers);
  return sheet;
}

function _migEnsureHeader_(sheet, headers) {
  var lastCol = Math.max(1, headers.length);
  var firstRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var isBlank = true;
  for (var i = 0; i < firstRow.length; i++) {
    if (String(firstRow[i] || "").trim() !== "") { isBlank = false; break; }
  }

  // ✅ Se está em branco: escreve header completo
  if (isBlank) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return true;
  }

  // ✅ Se não está em branco, NÃO sobrescreve.
  // (opcional) registra divergência para debug em __meta
  try {
    var differs = false;
    for (var c = 0; c < headers.length; c++) {
      if (String(firstRow[c] || "") !== String(headers[c])) { differs = true; break; }
    }
    if (differs) {
      _migSetMeta_("warnHeaderMismatch:" + sheet.getName(), new Date().toISOString());
    }
  } catch (_) {}

  return true;
}

function _migGetDb_() {
  if (typeof PRONTIO_getDb_ !== "function") {
    throw new Error("Migrations: PRONTIO_getDb_ não encontrado (Utils.gs).");
  }
  return PRONTIO_getDb_();
}

function _migTryGetDbId_() {
  try {
    return null;
  } catch (_) {
    return null;
  }
}
