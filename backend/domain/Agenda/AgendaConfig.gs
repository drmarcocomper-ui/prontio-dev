// backend/AgendaConfig.gs
/**
 * PRONTIO - Módulo de Configuração da Agenda / Sistema
 *
 * Aba esperada: "AgendaConfig"
 *
 * Colunas (linha 1):
 *  Chave | Valor
 *
 * Chaves utilizadas na planilha:
 *  - MEDICO_NOME_COMPLETO
 *  - MEDICO_CRM
 *  - MEDICO_ESPECIALIDADE
 *
 *  - CLINICA_NOME
 *  - CLINICA_ENDERECO
 *  - CLINICA_TELEFONE
 *  - CLINICA_EMAIL
 *
 *  - LOGO_URL
 *
 *  - HORA_INICIO_PADRAO      (ex.: "08:00")
 *  - HORA_FIM_PADRAO         (ex.: "18:00")
 *  - DURACAO_GRADE_MINUTOS   (ex.: "15")
 *  - DIAS_ATIVOS             (ex.: "SEG,TER,QUA,QUI,SEX")
 *
 * ✅ (NOVO - BACKEND PARAMS, sem quebrar contrato do front)
 *  - AGENDA_DURACAO_PADRAO_MIN     (ex.: "30")   -> usado no Agenda.gs
 *  - AGENDA_SLOT_MIN              (ex.: "10")   -> usado no Agenda.gs
 *  - AGENDA_PERMITE_SOBREPOSICAO  (ex.: "false" ou "true") -> usado no Agenda.gs
 *
 * IMPORTANTE (contrato com o FRONT):
 *
 *  AgendaConfig_Obter → retorna:
 *  {
 *    medicoNomeCompleto: "...",
 *    medicoCRM: "...",
 *    medicoEspecialidade: "...",
 *    clinicaNome: "...",
 *    clinicaEndereco: "...",
 *    clinicaTelefone: "...",
 *    clinicaEmail: "...",
 *    logoUrl: "...",
 *    hora_inicio_padrao: "08:00",
 *    hora_fim_padrao: "18:00",
 *    duracao_grade_minutos: 15,
 *    dias_ativos: ["SEG","TER","QUA","QUI","SEX"]
 *  }
 *
 *  AgendaConfig_Salvar ← recebe payload:
 *  {
 *    medicoNomeCompleto,
 *    medicoCRM,
 *    medicoEspecialidade,
 *    clinicaNome,
 *    clinicaEndereco,
 *    clinicaTelefone,
 *    clinicaEmail,
 *    logoUrl,
 *    hora_inicio_padrao,
 *    hora_fim_padrao,
 *    duracao_grade_minutos,
 *    dias_ativos: ["SEG","TER",...]
 *  }
 *
 * ✅ Atualização segura:
 * - Cache (se Cache.gs existir) para reduzir leitura da planilha
 * - Invalida cache no salvar
 * - Mantém contrato e comportamento existentes
 *
 * ✅ FIX (SEM QUEBRAR):
 * - Aceita aliases de action: AgendaConfig.Obter / AgendaConfig.Salvar (além de AgendaConfig_*)
 * - Valida e normaliza HH:MM, duração e dias_ativos
 * - Normaliza dias_ativos para UPPER e apenas valores permitidos (SEG..DOM)
 *
 * ✅ PASSO 1 (Agenda):
 * - Exporta AgendaConfig_getAgendaParams_() para o backend consumir parâmetros reais (slotMin, duracaoPadraoMin, permiteSobreposicao)
 */

var AGENDA_CONFIG_SHEET_NAME = "AgendaConfig";
var AGENDA_CONFIG_HEADER = ["Chave", "Valor"];

// cache keys (script cache)
var _AGENDA_CFG_CACHE_KEY_MAP_ = "agendaConfig:map:v1";
var _AGENDA_CFG_CACHE_KEY_CFG_ = "agendaConfig:cfg:v1";
var _AGENDA_CFG_CACHE_KEY_PARAMS_ = "agendaConfig:params:v1";
var _AGENDA_CFG_CACHE_TTL_SEC_ = 60 * 10; // 10 min (seguro)

// ============================================================
// Router (Registry / legado)
// ============================================================

function handleAgendaConfigAction(action, payload) {
  var a = String(action || "").trim();

  // ✅ aliases sem quebrar
  if (a === "AgendaConfig.Obter") a = "AgendaConfig_Obter";
  if (a === "AgendaConfig.Salvar") a = "AgendaConfig_Salvar";

  switch (a) {
    case "AgendaConfig_Obter":
      return agendaConfigObter_();

    case "AgendaConfig_Salvar":
      return agendaConfigSalvar_(payload);

    default:
      var err = new Error("Ação de configuração de agenda desconhecida: " + a);
      err.code = "AGENDA_CONFIG_UNKNOWN_ACTION";
      err.details = { action: String(action || "") };
      throw err;
  }
}

// ============================================================
// Infra
// ============================================================

function _agendaConfigGetDb_() {
  if (typeof Repo_getDb_ !== "function") {
    var e = new Error("AgendaConfig: Repo_getDb_ não disponível (Repository.gs não carregado?).");
    e.code = "INTERNAL_ERROR";
    e.details = { missing: "Repo_getDb_" };
    throw e;
  }
  return Repo_getDb_();
}

function _agendaConfigGetSheet_() {
  var db = _agendaConfigGetDb_();

  var sheet = db.getSheetByName(AGENDA_CONFIG_SHEET_NAME);
  if (!sheet) sheet = db.insertSheet(AGENDA_CONFIG_SHEET_NAME);

  _agendaConfigEnsureHeader_(sheet);
  return sheet;
}

function _agendaConfigEnsureHeader_(sheet) {
  var lastCol = Math.max(2, sheet.getLastColumn() || 0);

  var row1 = sheet.getRange(1, 1, 1, Math.max(2, lastCol)).getValues()[0] || [];
  var h1 = String(row1[0] || "").trim();
  var h2 = String(row1[1] || "").trim();

  var isBlank = (!h1 && !h2);
  if (isBlank) {
    sheet.getRange(1, 1, 1, 2).setValues([AGENDA_CONFIG_HEADER]);
    return;
  }

  if (h1 !== AGENDA_CONFIG_HEADER[0] || h2 !== AGENDA_CONFIG_HEADER[1]) {
    sheet.getRange(1, 1, 1, 2).setValues([AGENDA_CONFIG_HEADER]);
  }
}

// ============================================================
// Cache helpers (opcionais)
// ============================================================

function _agendaCfgCacheGet_(key) {
  try {
    if (typeof Cache_getJson_ === "function") return Cache_getJson_(key);
  } catch (_) {}
  return null;
}

function _agendaCfgCacheSet_(key, obj, ttl) {
  try {
    if (typeof Cache_setJson_ === "function") Cache_setJson_(key, obj, ttl);
  } catch (_) {}
}

function _agendaCfgCacheRemove_(key) {
  try {
    if (typeof Cache_remove_ === "function") Cache_remove_(key);
  } catch (_) {}
}

function _agendaCfgCacheInvalidateAll_() {
  _agendaCfgCacheRemove_(_AGENDA_CFG_CACHE_KEY_MAP_);
  _agendaCfgCacheRemove_(_AGENDA_CFG_CACHE_KEY_CFG_);
  _agendaCfgCacheRemove_(_AGENDA_CFG_CACHE_KEY_PARAMS_);
}

// ============================================================
// Normalizações/validações (sem quebrar)
// ============================================================

function _agendaCfgNormalizeHHMM_(v, fallback) {
  var s = String(v || "").trim();
  if (!s) return fallback;

  // aceita "8:00" e normaliza para "08:00"
  var m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;

  var hh = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);
  if (!isFinite(hh) || !isFinite(mm)) return fallback;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return fallback;

  return (hh < 10 ? "0" : "") + hh + ":" + m[2];
}

function _agendaCfgNormalizeDuracao_(v, fallback) {
  var n = parseInt(String(v || "").trim(), 10);
  if (!isFinite(n) || n <= 0) return fallback;
  // evita valores absurdos
  if (n > 240) return fallback; // 4h por slot é improvável; fallback seguro
  return n;
}

function _agendaCfgNormalizeBool_(v, fallback) {
  if (typeof v === "boolean") return v;
  var s = String(v || "").trim().toLowerCase();
  if (!s) return fallback;
  if (s === "true" || s === "1" || s === "sim" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "nao" || s === "não" || s === "no") return false;
  return fallback;
}

function _agendaCfgNormalizeDiasAtivos_(raw, fallbackArr) {
  var allowed = { SEG: true, TER: true, QUA: true, QUI: true, SEX: true, SAB: true, DOM: true };

  var list = [];
  if (Array.isArray(raw)) {
    list = raw.map(function (x) { return String(x || "").trim().toUpperCase(); });
  } else {
    var s = String(raw || "").trim();
    if (s) {
      list = s.split(",").map(function (x) { return String(x || "").trim().toUpperCase(); });
    }
  }

  list = list.filter(function (d) { return d && allowed[d] === true; });

  // remove duplicados preservando ordem
  var seen = {};
  var uniq = [];
  for (var i = 0; i < list.length; i++) {
    var d = list[i];
    if (!seen[d]) { seen[d] = true; uniq.push(d); }
  }

  if (!uniq.length) return (fallbackArr || []).slice();
  return uniq;
}

function _agendaCfgMinutesFromHHMM_(hhmm) {
  var s = String(hhmm || "").trim();
  var m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  var hh = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);
  if (!isFinite(hh) || !isFinite(mm)) return null;
  return hh * 60 + mm;
}

// ============================================================
// Read/Write
// ============================================================

function _agendaConfigReadMap_() {
  // tenta cache do mapa
  var cached = _agendaCfgCacheGet_(_AGENDA_CFG_CACHE_KEY_MAP_);
  if (cached && typeof cached === "object") return cached;

  var sheet = _agendaConfigGetSheet_();
  var lastRow = sheet.getLastRow();
  if (!lastRow || lastRow < 2) {
    var empty = {};
    _agendaCfgCacheSet_(_AGENDA_CFG_CACHE_KEY_MAP_, empty, _AGENDA_CFG_CACHE_TTL_SEC_);
    return empty;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var map = {};

  for (var i = 0; i < values.length; i++) {
    var chave = String(values[i][0] || "").trim();
    var valor = values[i][1];
    if (!chave) continue;
    map[chave] = valor;
  }

  _agendaCfgCacheSet_(_AGENDA_CFG_CACHE_KEY_MAP_, map, _AGENDA_CFG_CACHE_TTL_SEC_);
  return map;
}

function _agendaConfigUpsert_(sheet, rowByKey, key, value) {
  if (typeof value === "undefined") return;

  var k = String(key || "").trim();
  if (!k) return;

  var rowIndex = rowByKey[k];
  if (rowIndex) {
    sheet.getRange(rowIndex, 2).setValue(value);
  } else {
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, 2).setValues([[k, value]]);
    rowByKey[k] = newRow;
  }
}

// ============================================================
// Public API (FRONT CONTRACT)
// ============================================================

function agendaConfigObter_() {
  // tenta cache do cfg pronto (já normalizado)
  var cachedCfg = _agendaCfgCacheGet_(_AGENDA_CFG_CACHE_KEY_CFG_);
  if (cachedCfg && typeof cachedCfg === "object") return cachedCfg;

  var defaults = {
    medicoNomeCompleto: "",
    medicoCRM: "",
    medicoEspecialidade: "",
    clinicaNome: "",
    clinicaEndereco: "",
    clinicaTelefone: "",
    clinicaEmail: "",
    logoUrl: "",
    hora_inicio_padrao: "08:00",
    hora_fim_padrao: "18:00",
    duracao_grade_minutos: 15,
    dias_ativos: ["SEG", "TER", "QUA", "QUI", "SEX"]
  };

  var map = {};
  try {
    map = _agendaConfigReadMap_();
  } catch (e) {
    // se falhar acesso, devolve defaults sem quebrar
    return defaults;
  }

  var diasAtivosArr = _agendaCfgNormalizeDiasAtivos_(map.DIAS_ATIVOS, defaults.dias_ativos);
  var duracao = _agendaCfgNormalizeDuracao_(map.DURACAO_GRADE_MINUTOS, defaults.duracao_grade_minutos);

  var hi = _agendaCfgNormalizeHHMM_(map.HORA_INICIO_PADRAO, defaults.hora_inicio_padrao);
  var hf = _agendaCfgNormalizeHHMM_(map.HORA_FIM_PADRAO, defaults.hora_fim_padrao);

  // ✅ Consistência básica: se fim <= inicio, mantém fallback seguro
  var mi = _agendaCfgMinutesFromHHMM_(hi);
  var mf = _agendaCfgMinutesFromHHMM_(hf);
  if (mi !== null && mf !== null && mf <= mi) {
    hi = defaults.hora_inicio_padrao;
    hf = defaults.hora_fim_padrao;
  }

  var cfg = {
    medicoNomeCompleto: String(map.MEDICO_NOME_COMPLETO || defaults.medicoNomeCompleto || "").trim(),
    medicoCRM: String(map.MEDICO_CRM || defaults.medicoCRM || "").trim(),
    medicoEspecialidade: String(map.MEDICO_ESPECIALIDADE || defaults.medicoEspecialidade || "").trim(),

    clinicaNome: String(map.CLINICA_NOME || defaults.clinicaNome || "").trim(),
    clinicaEndereco: String(map.CLINICA_ENDERECO || defaults.clinicaEndereco || "").trim(),
    clinicaTelefone: String(map.CLINICA_TELEFONE || defaults.clinicaTelefone || "").trim(),
    clinicaEmail: String(map.CLINICA_EMAIL || defaults.clinicaEmail || "").trim(),

    logoUrl: String(map.LOGO_URL || defaults.logoUrl || "").trim(),

    hora_inicio_padrao: hi,
    hora_fim_padrao: hf,
    duracao_grade_minutos: duracao,
    dias_ativos: diasAtivosArr
  };

  _agendaCfgCacheSet_(_AGENDA_CFG_CACHE_KEY_CFG_, cfg, _AGENDA_CFG_CACHE_TTL_SEC_);
  return cfg;
}

function agendaConfigSalvar_(payload) {
  payload = payload || {};

  var sheet = _agendaConfigGetSheet_();

  var lastRow = sheet.getLastRow();
  if (!lastRow || lastRow < 1) {
    sheet.getRange(1, 1, 1, 2).setValues([AGENDA_CONFIG_HEADER]);
    lastRow = 1;
  }

  var values = [];
  if (lastRow >= 2) {
    values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  }

  var rowByKey = {};
  for (var i = 0; i < values.length; i++) {
    var chave = String(values[i][0] || "").trim();
    if (!chave) continue;
    rowByKey[chave] = i + 2;
  }

  // Campos texto (mantém como veio)
  _agendaConfigUpsert_(sheet, rowByKey, "MEDICO_NOME_COMPLETO", payload.medicoNomeCompleto);
  _agendaConfigUpsert_(sheet, rowByKey, "MEDICO_CRM", payload.medicoCRM);
  _agendaConfigUpsert_(sheet, rowByKey, "MEDICO_ESPECIALIDADE", payload.medicoEspecialidade);

  _agendaConfigUpsert_(sheet, rowByKey, "CLINICA_NOME", payload.clinicaNome);
  _agendaConfigUpsert_(sheet, rowByKey, "CLINICA_ENDERECO", payload.clinicaEndereco);
  _agendaConfigUpsert_(sheet, rowByKey, "CLINICA_TELEFONE", payload.clinicaTelefone);
  _agendaConfigUpsert_(sheet, rowByKey, "CLINICA_EMAIL", payload.clinicaEmail);

  _agendaConfigUpsert_(sheet, rowByKey, "LOGO_URL", payload.logoUrl);

  // ✅ Normaliza e valida campos críticos (sem quebrar: se inválido, salva o fallback atual)
  var current = agendaConfigObter_();

  var hi = _agendaCfgNormalizeHHMM_(payload.hora_inicio_padrao, current.hora_inicio_padrao);
  var hf = _agendaCfgNormalizeHHMM_(payload.hora_fim_padrao, current.hora_fim_padrao);
  var dur = _agendaCfgNormalizeDuracao_(payload.duracao_grade_minutos, current.duracao_grade_minutos);

  // consistência fim > inicio (fallback seguro)
  var mi = _agendaCfgMinutesFromHHMM_(hi);
  var mf = _agendaCfgMinutesFromHHMM_(hf);
  if (mi !== null && mf !== null && mf <= mi) {
    hi = current.hora_inicio_padrao;
    hf = current.hora_fim_padrao;
  }

  _agendaConfigUpsert_(sheet, rowByKey, "HORA_INICIO_PADRAO", hi);
  _agendaConfigUpsert_(sheet, rowByKey, "HORA_FIM_PADRAO", hf);
  _agendaConfigUpsert_(sheet, rowByKey, "DURACAO_GRADE_MINUTOS", dur);

  if (typeof payload.dias_ativos !== "undefined") {
    var diasArr = _agendaCfgNormalizeDiasAtivos_(payload.dias_ativos, current.dias_ativos);
    var diasAtivosValue = diasArr.join(",");
    _agendaConfigUpsert_(sheet, rowByKey, "DIAS_ATIVOS", diasAtivosValue);
  }

  // ✅ (NOVO - opcional): permite salvar parâmetros do backend se vierem no payload (não quebra front)
  if (typeof payload.agendaDuracaoPadraoMin !== "undefined") {
    var dpm = _agendaCfgNormalizeDuracao_(payload.agendaDuracaoPadraoMin, null);
    if (dpm !== null) _agendaConfigUpsert_(sheet, rowByKey, "AGENDA_DURACAO_PADRAO_MIN", dpm);
  }
  if (typeof payload.agendaSlotMin !== "undefined") {
    var sm = _agendaCfgNormalizeDuracao_(payload.agendaSlotMin, null);
    if (sm !== null) _agendaConfigUpsert_(sheet, rowByKey, "AGENDA_SLOT_MIN", sm);
  }
  if (typeof payload.agendaPermiteSobreposicao !== "undefined") {
    var ps = _agendaCfgNormalizeBool_(payload.agendaPermiteSobreposicao, null);
    if (ps !== null) _agendaConfigUpsert_(sheet, rowByKey, "AGENDA_PERMITE_SOBREPOSICAO", ps ? "true" : "false");
  }

  // ✅ invalida cache
  _agendaCfgCacheInvalidateAll_();

  return agendaConfigObter_();
}

// ============================================================
// Public API (BACKEND PARAMS - PASSO 1)
// ============================================================

/**
 * Retorna parâmetros usados pelo Agenda.gs, sem afetar contrato do front.
 * Pode ser consumido pelo Config_getAgendaParams_() ou direto no Agenda.gs.
 *
 * Shape:
 * {
 *   duracaoPadraoMin: number,
 *   slotMin: number,
 *   permiteSobreposicao: boolean
 * }
 */
function AgendaConfig_getAgendaParams_() {
  var cached = _agendaCfgCacheGet_(_AGENDA_CFG_CACHE_KEY_PARAMS_);
  if (cached && typeof cached === "object") return cached;

  var defaults = {
    duracaoPadraoMin: 30,
    slotMin: 10,
    permiteSobreposicao: false
  };

  var map = {};
  try {
    map = _agendaConfigReadMap_();
  } catch (_) {
    _agendaCfgCacheSet_(_AGENDA_CFG_CACHE_KEY_PARAMS_, defaults, _AGENDA_CFG_CACHE_TTL_SEC_);
    return defaults;
  }

  // limites seguros para parâmetros do backend (slotMin e duracaoPadraoMin podem ser menores que 15)
  function normMin_(v, fallback, max) {
    var n = parseInt(String(v || "").trim(), 10);
    if (!isFinite(n) || n <= 0) return fallback;
    if (typeof max === "number" && isFinite(max) && n > max) return fallback;
    return n;
  }

  var duracaoPadraoMin = normMin_(map.AGENDA_DURACAO_PADRAO_MIN, defaults.duracaoPadraoMin, 240);
  var slotMin = normMin_(map.AGENDA_SLOT_MIN, defaults.slotMin, 120);
  var permiteSobreposicao = _agendaCfgNormalizeBool_(map.AGENDA_PERMITE_SOBREPOSICAO, defaults.permiteSobreposicao);

  var out = {
    duracaoPadraoMin: duracaoPadraoMin,
    slotMin: slotMin,
    permiteSobreposicao: permiteSobreposicao
  };

  _agendaCfgCacheSet_(_AGENDA_CFG_CACHE_KEY_PARAMS_, out, _AGENDA_CFG_CACHE_TTL_SEC_);
  return out;
}
/**
 * Alias para padronizar consumo dentro do backend.
 * A Agenda hoje tenta usar Config_getAgendaParams_() se existir.
 *
 * ✅ Segurança:
 * - só define o alias se ainda não existir em outro arquivo.
 */
if (typeof Config_getAgendaParams_ !== "function") {
  function Config_getAgendaParams_() {
    return AgendaConfig_getAgendaParams_();
  }
}
