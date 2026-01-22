/**
 * ============================================================
 * PRONTIO - Repository.gs (FASE 1)
 * ============================================================
 * Único ponto de acesso ao Google Sheets.
 *
 * Fornece as funções usadas pela Agenda nova:
 * - Repo_list_(sheetName)
 * - Repo_getById_(sheetName, idField, idValue)
 * - Repo_insert_(sheetName, obj)
 * - Repo_update_(sheetName, idField, idValue, patch)
 * - Repo_softDelete_(sheetName, idField, idValue)  (opcional)
 *
 * Observações:
 * - Usa PRONTIO_getDb_() (Utils.gs) para selecionar DEV/PROD.
 * - As abas/headers são internas (backend-only).
 * - Header é garantido conforme Migrations.gs (MIGRATIONS_SHEETS) quando disponível.
 *
 * ✅ FIX (SEM QUEBRAR):
 * - Repo_getById_ e Repo_update_ agora são mais eficientes:
 *   procuram linha pelo ID lendo apenas a coluna do ID + uma linha (não a tabela inteira).
 * - Cache best-effort (ScriptCache) de idValue -> rowIndex com TTL curto, reduzindo leituras repetidas.
 * - Mantém assinaturas e comportamento esperado (incluindo erro em insert quando header vazio).
 *
 * ✅ PASSO 2 (padronização global, sem quebrar):
 * - Repo_update_ invalida cache do índice (sheetName+idField) após escrita, evitando “cache fantasma”.
 * - Repo_insert_ usa setValues ao invés de appendRow (mais previsível) e normaliza undefined/null -> "".
 *
 * ✅ ATUALIZAÇÃO (robustez sem quebrar):
 * - Quando usa cache (id->rowIndex), valida se o ID naquela linha ainda confere.
 *   Isso evita retornar linha errada se o cache estiver obsoleto.
 */

// ======================
// Config interno (cache)
// ======================
var _REPO_CACHE_PREFIX = typeof _REPO_CACHE_PREFIX !== "undefined" ? _REPO_CACHE_PREFIX : "PRONTIO_REPO_IDX_";
var _REPO_CACHE_TTL_SEC = typeof _REPO_CACHE_TTL_SEC !== "undefined" ? _REPO_CACHE_TTL_SEC : 60 * 5; // 5 min

function Repo_getDb_() {
  if (typeof PRONTIO_getDb_ !== "function") {
    throw new Error("Repo_getDb_: PRONTIO_getDb_ não encontrado (Utils.gs).");
  }
  return PRONTIO_getDb_();
}

/**
 * Normalização de célula para escrita:
 * - undefined/null vira string vazia (padrão do Sheets no PRONTIO)
 * - demais valores são mantidos
 */
function _repoCell_(v) {
  return (v === undefined || v === null) ? "" : v;
}

/**
 * Garante que a aba exista e que tenha header.
 * Se MIGRATIONS_SHEETS existir, usa o header definido lá.
 */
function Repo_getSheet_(sheetName) {
  var db = Repo_getDb_();
  var sheet = db.getSheetByName(sheetName);
  if (!sheet) sheet = db.insertSheet(sheetName);

  // Garantir header (preferir migrations)
  var expected = null;
  try {
    if (typeof MIGRATIONS_SHEETS !== "undefined" && MIGRATIONS_SHEETS && MIGRATIONS_SHEETS[sheetName]) {
      expected = MIGRATIONS_SHEETS[sheetName];
    }
  } catch (_) {
    expected = null;
  }

  if (expected && expected.length) {
    _repoEnsureHeader_(sheet, expected);
  } else {
    // Se header estiver vazio, não cria automaticamente (para não inventar schema).
    // Mantém comportamento existente.
  }

  return sheet;
}

function _repoEnsureHeader_(sheet, headers) {
  var lastCol = Math.max(1, headers.length);
  var row1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var isBlank = true;
  for (var i = 0; i < row1.length; i++) {
    if (String(row1[i] || "").trim() !== "") { isBlank = false; break; }
  }

  if (isBlank) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  // Se difere, atualiza linha 1 (idempotente)
  var differs = false;
  for (var c = 0; c < headers.length; c++) {
    if (String(row1[c] || "") !== String(headers[c])) { differs = true; break; }
  }
  if (differs) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function Repo_getHeader_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol || lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || "").trim();
  }).filter(function (h) { return !!h; }); // evita colunas “fantasmas” vazias
}

// ======================
// Cache helpers (best-effort)
// ======================

function _repoCacheKey_(sheetName, idField) {
  return _REPO_CACHE_PREFIX + String(sheetName || "") + "|" + String(idField || "");
}

function _repoCacheGetMap_(sheetName, idField) {
  try {
    var cache = CacheService.getScriptCache();
    var raw = cache.get(_repoCacheKey_(sheetName, idField));
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj;
  } catch (_) {
    return null;
  }
}

function _repoCacheSetMap_(sheetName, idField, mapObj) {
  try {
    var cache = CacheService.getScriptCache();
    cache.put(_repoCacheKey_(sheetName, idField), JSON.stringify(mapObj || {}), _REPO_CACHE_TTL_SEC);
  } catch (_) {}
}

function _repoCacheInvalidate_(sheetName, idField) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove(_repoCacheKey_(sheetName, idField));
  } catch (_) {}
}

/**
 * Busca rowIndex (1-based) para um idValue na planilha.
 * Usa cache best-effort; se não achar, faz scan da coluna de ID.
 */
function _repoFindRowIndexById_(sheet, sheetName, idField, header, idValue) {
  var target = String(idValue);

  // acha coluna de ID
  var idxId = header.indexOf(String(idField));
  if (idxId < 0) {
    throw new Error("Repo: campo ID não encontrado no header: " + idField + " (sheet=" + sheetName + ")");
  }

  // 1) tenta cache de mapa (id->rowIndex)
  var cached = _repoCacheGetMap_(sheetName, idField);
  if (cached && cached[target]) {
    var ri = parseInt(cached[target], 10);
    if (isFinite(ri) && ri >= 2 && ri <= sheet.getLastRow()) {
      // ✅ ATUALIZAÇÃO: valida se a linha ainda corresponde ao ID (evita cache obsoleto)
      try {
        var cellVal = sheet.getRange(ri, idxId + 1, 1, 1).getValues()[0][0];
        if (String(cellVal) === target) {
          return ri;
        }
      } catch (_) {
        // ignora e faz scan abaixo
      }
    }
    // cache ruim/obsoleto
  }

  // 2) scan da coluna do ID
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var ids = sheet.getRange(2, idxId + 1, lastRow - 1, 1).getValues();
  var foundRowIndex = null;

  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === target) {
      foundRowIndex = i + 2; // +2 por causa do header e índice 0
      break;
    }
  }

  // 3) reconstroi cache (best-effort) só quando precisa (scan já leu ids)
  try {
    var mapObj = {};
    for (var j = 0; j < ids.length; j++) {
      var v = String(ids[j][0]);
      if (!v) continue;
      mapObj[v] = j + 2;
    }
    _repoCacheSetMap_(sheetName, idField, mapObj);
  } catch (_) {}

  return foundRowIndex;
}

// ======================
// CRUD
// ======================

function Repo_list_(sheetName) {
  var sheet = Repo_getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  var header = Repo_getHeader_(sheet);
  if (!header.length) return [];

  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();

  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      obj[header[c]] = row[c];
    }
    out.push(obj);
  }
  return out;
}

function Repo_getById_(sheetName, idField, idValue) {
  var sheet = Repo_getSheet_(sheetName);
  var header = Repo_getHeader_(sheet);
  if (!header.length) return null;

  var rowIndex = _repoFindRowIndexById_(sheet, sheetName, idField, header, idValue);
  if (!rowIndex) return null;

  var row = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];
  var obj = {};
  for (var c = 0; c < header.length; c++) obj[header[c]] = row[c];
  return obj;
}

function Repo_insert_(sheetName, obj) {
  obj = obj || {};
  var sheet = Repo_getSheet_(sheetName);
  var header = Repo_getHeader_(sheet);

  if (!header.length) {
    throw new Error("Repo_insert_: header vazio na aba " + sheetName + ". Rode Meta_BootstrapDb/Migrations_bootstrap_.");
  }

  var row = new Array(header.length);
  for (var c = 0; c < header.length; c++) {
    var k = header[c];
    row[c] = _repoCell_(obj[k]);
  }

  // ✅ mais previsível que appendRow em alguns casos (filtros/linhas vazias)
  var newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1, 1, header.length).setValues([row]);

  // Não sabemos idField aqui; cache é por (sheetName+idField).
  // TTL curto cobre inserts; updates invalidam quando conhecem idField.
  return obj;
}

function Repo_update_(sheetName, idField, idValue, patch) {
  patch = patch || {};
  var sheet = Repo_getSheet_(sheetName);
  var header = Repo_getHeader_(sheet);
  if (!header.length) return false;

  var rowIndex = _repoFindRowIndexById_(sheet, sheetName, idField, header, idValue);
  if (!rowIndex) return false;

  // lê a linha inteira uma única vez
  var row = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];

  // aplica patch por header
  var changed = false;
  for (var c = 0; c < header.length; c++) {
    var k = header[c];
    if (patch[k] !== undefined) {
      row[c] = _repoCell_(patch[k]);
      changed = true;
    }
  }

  if (!changed) return true; // nada a fazer, mas "ok"

  // escreve apenas a linha alterada
  sheet.getRange(rowIndex, 1, 1, header.length).setValues([row]);

  // ✅ PASSO 2: invalida cache do índice dessa entidade para evitar cache fantasma
  _repoCacheInvalidate_(sheetName, idField);

  return true;
}

/**
 * SoftDelete genérico (se existir colunas "ativo" ou "status")
 */
function Repo_softDelete_(sheetName, idField, idValue) {
  var patch = {};
  // padrões comuns
  patch.ativo = false;
  patch.status = "INATIVO";
  return Repo_update_(sheetName, idField, idValue, patch);
}
function DEBUG_REPO_SHEETS() {
  var ss = null;

  try {
    if (typeof Repository_getSpreadsheet_ === "function") {
      ss = Repository_getSpreadsheet_();
    }
  } catch (_) {}

  // fallback: tenta SpreadsheetApp padrão
  if (!ss) {
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  }

  if (!ss) {
    Logger.log("ERRO: não consegui obter Spreadsheet.");
    return;
  }

  var sheets = ss.getSheets().map(function (sh) { return sh.getName(); });

  Logger.log(JSON.stringify({
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    sheets: sheets
  }, null, 2));

  Logger.log("AGENDA_ENTITY=" + (typeof AGENDA_ENTITY !== "undefined" ? AGENDA_ENTITY : "undefined"));
  Logger.log("ATENDIMENTO_ENTITY=" + (typeof ATENDIMENTO_ENTITY !== "undefined" ? ATENDIMENTO_ENTITY : "undefined"));
}
function DEBUG_SHEET_STATS_(sheetName) {
  var sh = Repo_getSheet_(sheetName);
  var header = Repo_getHeader_(sh);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  var sample = [];
  if (lastRow >= 2 && header.length > 0) {
    var n = Math.min(5, lastRow - 1);
    sample = sh.getRange(2, 1, n, Math.min(header.length, 12)).getValues(); // amostra 5 linhas, até 12 colunas
  }

  Logger.log(JSON.stringify({
    sheet: sheetName,
    lastRow: lastRow,
    lastCol: lastCol,
    headerLen: header.length,
    header: header,
    sampleRows: sample
  }, null, 2));
}

function DEBUG_AGENDA_ATENDIMENTO_STATS() {
  DEBUG_SHEET_STATS_("Agenda");
  DEBUG_SHEET_STATS_("Atendimento");
  DEBUG_SHEET_STATS_("AgendaEventos"); // só pra conferir onde estão os dados
}
