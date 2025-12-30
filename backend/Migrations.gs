// backend/Migrations.gs
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
 * - Ajuste de headers aqui NÃO quebra o front.
 * - Pode impactar módulos que leem planilha direto (ex.: Usuarios.gs legado).
 *
 * Estratégia:
 * - Manter abas legadas (Agenda, Pacientes, Evolucao) intactas.
 * - Adicionar novas abas para os 4 módulos:
 *   Clinica, Profissionais, Usuarios (compatível com Usuarios.gs),
 *   AgendaDisponibilidade, AgendaExcecoes, AgendaEventos, AgendaAcl.
 *
 * ✅ UPDATE (Documentos):
 * - Adiciona aba "Encaminhamento" para busca (formulário) com header garantido.
 * - Adiciona aba "CID" para autocomplete de CID / doença com header garantido.
 */
var MIGRATIONS_SHEETS = {
  "__meta": MIGRATIONS_META_HEADERS,

  // =========================
  // LEGADO (mantido)
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

  "Pacientes": [
    "idPaciente",
    "ativo",
    "nome",
    "nascimento",
    "sexo",
    "cpf",
    "telefone",
    "email",
    "endereco",
    "observacoes",
    "criadoEm",
    "atualizadoEm"
  ],

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

  /**
   * Clínica (single clinic mode, pronto para multi-clínica)
   * Observação: no modo 1 clínica, teremos só 1 linha.
   */
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

  /**
   * Profissionais
   */
  "Profissionais": [
    "idProfissional",
    "idClinica",
    "tipoProfissional",          // MEDICO | NUTRICIONISTA | OUTRO
    "nomeCompleto",
    "documentoRegistro",         // CRM/CRN/etc
    "especialidade",
    "assinaturaDigitalBase64",
    "corInterface",
    "ativo",
    "criadoEm",
    "atualizadoEm"
  ],

  /**
   * Usuarios
   * Compatível com Usuarios.gs atual (que procura cabeçalhos em PT-BR com maiúsculas).
   * Mantemos colunas "ID_Usuario", "Nome", etc.
   *
   * Campos novos para estratégia (idClinica/idProfissional) são opcionais e não quebram o legado.
   */
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

    // novos (estratégia)
    "idClinica",
    "idProfissional",
    "permissoesCustomizadas"
  ],

  /**
   * Agenda 4.1 - Disponibilidade semanal
   */
  "AgendaDisponibilidade": [
    "idDisponibilidade",
    "idClinica",
    "idProfissional",
    "diaSemana",                 // SEG, TER, QUA, QUI, SEX, SAB, DOM
    "horaInicio",                // "08:00"
    "horaFim",                   // "12:00"
    "intervaloMinutos",          // number
    "localSala",                 // opcional
    "ativo",
    "criadoEm",
    "atualizadoEm"
  ],

  /**
   * Agenda 4.2 - Exceções
   */
  "AgendaExcecoes": [
    "idExcecao",
    "idClinica",
    "idProfissional",
    "dataInicio",                // ISO date/datetime
    "dataFim",                   // ISO date/datetime
    "tipo",                      // BLOQUEIO_TOTAL | HORARIO_ESPECIAL
    "blocosEspeciais",           // JSON string ou objeto serializado
    "motivo",
    "criadoEm",
    "atualizadoEm",
    "ativo"
  ],

  /**
   * Agenda 4.3 - Eventos
   */
  "AgendaEventos": [
    "idEvento",
    "idClinica",
    "idProfissional",
    "idPaciente",
    "inicioDateTime",
    "fimDateTime",
    "tipo",                      // CONSULTA | RETORNO | PROCEDIMENTO | BLOQUEIO
    "status",                    // MARCADO | CONFIRMADO | ATENDIDO | CANCELADO | FALTOU
    "titulo",
    "notas",
    "permiteEncaixe",
    "canceladoEm",
    "canceladoMotivo",
    "criadoEm",
    "atualizadoEm",
    "ativo"
  ],

  /**
   * ACL - Acesso à agenda
   */
  "AgendaAcl": [
    "idAcesso",
    "idClinica",
    "idUsuario",
    "idProfissional",
    "permissoes",                // JSON string ou "VER|CRIAR|EDITAR|CANCELAR"
    "ativo",
    "criadoEm",
    "atualizadoEm"
  ],

  // =========================
  // DOCUMENTOS (buscas / autocomplete)
  // =========================

  /**
   * Encaminhamento (para autocomplete no painel Documentos)
   * Colunas exatamente como você descreveu (inclui acento em "Avaliação").
   */
  "Encaminhamento": [
    "Encaminhamento",
    "NomeDoProfissional",
    "Avaliação",
    "Telefone"
  ],

  /**
   * CID (autocomplete por CID ou nome da doença)
   */
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
 * Registry.gs já registra "Meta_BootstrapDb" apontando para Meta_BootstrapDb.
 * Este wrapper conecta a action ao bootstrap real (Migrations_bootstrap_).
 */
function Meta_BootstrapDb(ctx, payload) {
  return Migrations_bootstrap_();
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
 * OBS: função interna (não exposta como action por padrão).
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

  // 3) Aplica migrations incrementais (placeholder para evolução futura)
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

/**
 * Aplica mudanças específicas de versão.
 * Nesta versão (v2), o bootstrap já garante as novas abas.
 */
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

/**
 * Define/atualiza uma chave no __meta.
 */
function _migSetMeta_(key, value) {
  var db = _migGetDb_();
  var sheet = db.getSheetByName(MIGRATIONS_META_SHEET);
  if (!sheet) sheet = db.insertSheet(MIGRATIONS_META_SHEET);

  // Garante header
  _migEnsureHeader_(sheet, MIGRATIONS_META_HEADERS);

  var values = sheet.getDataRange().getValues();
  var header = values[0];
  var idxKey = header.indexOf("key");
  var idxVal = header.indexOf("value");
  var idxUpd = header.indexOf("updatedAt");

  // Procura key
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idxKey]) === String(key)) {
      sheet.getRange(i + 1, idxVal + 1).setValue(value);
      sheet.getRange(i + 1, idxUpd + 1).setValue(new Date());
      return true;
    }
  }

  // Insere nova linha
  sheet.appendRow([key, value, new Date()]);
  return true;
}

/**
 * Garante aba com cabeçalho correto.
 * Se existir e header estiver vazio/diferente, ajusta apenas a primeira linha.
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

  // Se está em branco: escreve header completo
  if (isBlank) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return true;
  }

  // Se não está em branco, mas difere, atualiza a linha 1 (idempotente)
  var differs = false;
  for (var c = 0; c < headers.length; c++) {
    if (String(firstRow[c] || "") !== String(headers[c])) { differs = true; break; }
  }
  if (differs) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

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
