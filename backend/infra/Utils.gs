/**
 * PRONTIO - Utils.gs
 * Banco por ambiente (DEV/PROD) via IDs fixos.
 *
 * ID é o trecho entre /d/ e /edit na URL da planilha.
 *
 * ✅ FIX (SEM QUEBRAR):
 * - Aceita override por Script Properties (opcional):
 *     PRONTIO_ENV, PRONTIO_DB_ID_DEV, PRONTIO_DB_ID_PROD
 * - Normaliza env (DEV/PROD) aceitando variações comuns.
 * - Cache em memória do Spreadsheet aberto (melhora performance dentro da mesma execução).
 */

var PRONTIO_DB_ID_DEV = "1h6zr6ultbjK8Dx0c1hrlI0K8UF45plzJE8vHQe7JMck";
var PRONTIO_DB_ID_PROD = "1Gy84gjpf0pGHqUzuYpY6xaEYBlvf-8oztUE5D8_hjew";

/**
 * Cria resposta padronizada da API (usado por handlers legados).
 * @param {boolean} success - Se a operação foi bem sucedida
 * @param {Object|null} data - Dados da resposta
 * @param {Array<string>} errors - Lista de mensagens de erro
 * @returns {Object} Envelope de resposta
 */
function createApiResponse_(success, data, errors) {
  return {
    success: !!success,
    data: data || null,
    errors: Array.isArray(errors) ? errors : []
  };
}

// cache em memória (por execução)
var _PRONTIO_DB_CACHE_ = _PRONTIO_DB_CACHE_ || {};

function _prontioGetScriptProp_(key) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (!props) return "";
    var v = props.getProperty(String(key || ""));
    return v ? String(v).trim() : "";
  } catch (_) {
    return "";
  }
}

function _prontioNormalizeEnv_(envRaw) {
  var s = String(envRaw || "").trim().toUpperCase();
  if (!s) return "DEV";

  // aceita aliases comuns
  if (s === "PROD" || s === "PRODUCTION" || s === "PRD") return "PROD";
  if (s === "DEV" || s === "DEVELOPMENT" || s === "HML" || s === "HOMOLOG" || s === "HOMOLOGACAO") return "DEV";

  // fallback seguro (mantém comportamento anterior: default DEV)
  return "DEV";
}

function PRONTIO_getDb_() {
  // 1) ENV: Script Property tem prioridade (opcional), depois variável global PRONTIO_ENV
  var envFromProps = _prontioGetScriptProp_("PRONTIO_ENV");
  var envGlobal = (typeof PRONTIO_ENV !== "undefined" ? String(PRONTIO_ENV) : "");
  var env = _prontioNormalizeEnv_(envFromProps || envGlobal || "DEV");

  // 2) IDs: Script Properties (opcional) sobrescrevem constantes
  var devId = _prontioGetScriptProp_("PRONTIO_DB_ID_DEV") || PRONTIO_DB_ID_DEV;
  var prodId = _prontioGetScriptProp_("PRONTIO_DB_ID_PROD") || PRONTIO_DB_ID_PROD;

  var id = (env === "PROD") ? prodId : devId;

  if (!id) {
    throw new Error("PRONTIO_getDb_: ID da planilha não configurado para env=" + env);
  }

  // 3) Cache em memória (na mesma execução)
  var cacheKey = "DB@" + env + ":" + id;
  if (_PRONTIO_DB_CACHE_[cacheKey]) return _PRONTIO_DB_CACHE_[cacheKey];

  var ss = SpreadsheetApp.openById(id);
  _PRONTIO_DB_CACHE_[cacheKey] = ss;
  return ss;
}
