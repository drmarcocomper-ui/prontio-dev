/**
 * ============================================================
 * PRONTIO - Cache.gs (FASE 6)
 * ============================================================
 * CacheService wrapper:
 * - padroniza keys (prefix)
 * - serializa JSON com segurança
 * - TTL configurável
 *
 * Uso típico:
 *   Cache_getJson_("config:all")
 *   Cache_setJson_("config:all", obj, 300)
 */

var CACHE_PREFIX = "PRONTIO_CACHE_";
var CACHE_DEFAULT_TTL_SECONDS = 60; // padrão curto (ajustável por uso)
var CACHE_MAX_TTL_SECONDS = 60 * 60 * 6; // 6h (limite prudente)

/**
 * Cria chave completa de cache.
 */
function Cache_key_(key) {
  key = String(key || "").trim();
  if (!key) throw new Error("Cache_key_: key obrigatória.");
  return CACHE_PREFIX + key;
}

/**
 * Set string.
 */
function Cache_set_(key, value, ttlSeconds) {
  var fullKey = Cache_key_(key);
  var ttl = _cacheNormalizeTtl_(ttlSeconds);

  CacheService.getScriptCache().put(fullKey, String(value === undefined ? "" : value), ttl);
  return { ok: true, key: key, ttlSeconds: ttl };
}

/**
 * Get string.
 */
function Cache_get_(key) {
  var fullKey = Cache_key_(key);
  return CacheService.getScriptCache().get(fullKey);
}

/**
 * Remove key.
 */
function Cache_remove_(key) {
  var fullKey = Cache_key_(key);
  CacheService.getScriptCache().remove(fullKey);
  return { ok: true, key: key };
}

/**
 * Set JSON.
 */
function Cache_setJson_(key, obj, ttlSeconds) {
  var ttl = _cacheNormalizeTtl_(ttlSeconds);
  var raw;
  try {
    raw = JSON.stringify(obj === undefined ? null : obj);
  } catch (e) {
    // não cacheia se não serializa
    return { ok: false, key: key, error: "JSON_SERIALIZE_FAILED", details: String(e) };
  }

  return Cache_set_(key, raw, ttl);
}

/**
 * Get JSON (retorna null se não existir ou parse falhar).
 */
function Cache_getJson_(key) {
  var raw = Cache_get_(key);
  if (raw === null || raw === undefined) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    // se corrompeu, remove para não ficar quebrando
    try { Cache_remove_(key); } catch (_) {}
    return null;
  }
}

function _cacheNormalizeTtl_(ttlSeconds) {
  var ttl = (ttlSeconds === undefined || ttlSeconds === null) ? CACHE_DEFAULT_TTL_SECONDS : Number(ttlSeconds);
  if (isNaN(ttl) || ttl <= 0) ttl = CACHE_DEFAULT_TTL_SECONDS;
  if (ttl > CACHE_MAX_TTL_SECONDS) ttl = CACHE_MAX_TTL_SECONDS;
  return Math.floor(ttl);
}
