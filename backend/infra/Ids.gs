/**
 * ============================================================
 * PRONTIO - Ids.gs (FASE 1)
 * ============================================================
 * Gerador centralizado de IDs por entidade.
 *
 * IMPORTANTE:
 * - Mantém compatibilidade com o formato atual:
 *   Ids_nextId_("Agenda") -> ID_AGENDA_000001
 *
 * Melhorias aplicadas:
 * - Proteção contra concorrência (race condition) usando Lock.
 * - Opção de UUID quando sequencial não for necessário.
 *
 * ✅ FIX (SEM QUEBRAR):
 * - Tolerância a JSON corrompido em IDS_COUNTERS (não quebra execução).
 * - Normaliza contador para número válido (evita NaN/negativo).
 * - Mantém exatamente o formato ID_<ENTITY>_%06d.
 */

var IDS_META_KEY = "IDS_COUNTERS";

/**
 * Gera próximo ID para uma entidade (sequencial).
 *
 * Compatível:
 * - assinatura: Ids_nextId_(entity)
 * - formato: "ID_" + ENTITY + "_" + 6 dígitos
 *
 * Observação:
 * - entity é normalizada para UPPERCASE.
 */
function Ids_nextId_(entity) {
  entity = String(entity || "").trim().toUpperCase();
  if (!entity) throw new Error("Entidade inválida para geração de ID.");

  // Chave de lock específica por entidade (reduz contenção)
  var lockKey = "IDS_NEXT_" + entity;

  // Se existir Locks_withLock_, usa o padrão do projeto
  if (typeof Locks_withLock_ === "function") {
    // ctx pode ser null aqui; Locks_withLock_ deve suportar isso
    return Locks_withLock_(null, lockKey, function () {
      return _Ids_nextIdUnsafe_(entity);
    });
  }

  // Fallback seguro: LockService (Apps Script)
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // até 30s
  try {
    return _Ids_nextIdUnsafe_(entity);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/**
 * Implementação sem lock (NÃO chamar direto fora de um lock).
 */
function _Ids_nextIdUnsafe_(entityUpper) {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(IDS_META_KEY);

  var counters;
  try {
    counters = raw ? JSON.parse(raw) : {};
  } catch (_) {
    // ✅ FIX: se JSON estiver corrompido, não quebra; reinicia mapa
    counters = {};
  }
  if (!counters || typeof counters !== "object") counters = {};

  var current = Number(counters[entityUpper] || 0);

  // ✅ FIX: normalização defensiva
  if (!isFinite(current) || current < 0) current = 0;

  current++;

  counters[entityUpper] = current;

  // best-effort: salvar (não deve falhar, mas evita quebrar execução por exceção rara)
  try {
    props.setProperty(IDS_META_KEY, JSON.stringify(counters));
  } catch (_) {
    // se falhar o setProperty, ainda assim devolvemos o ID gerado (compat)
  }

  return "ID_" + entityUpper + "_" + Utilities.formatString("%06d", current);
}

/**
 * Gera um ID UUID (não sequencial).
 * Útil quando você não quer depender de contador (ex.: ids distribuídos,
 * logs, chaves temporárias etc.).
 */
function Ids_uuid_(prefix) {
  prefix = (prefix || "").toString().trim();
  var u = Utilities.getUuid().toUpperCase();
  return prefix ? (prefix + "_" + u) : u;
}

/**
 * (Opcional) Reseta contador de uma entidade.
 * NÃO expor como action em produção.
 */
function Ids_resetCounter_(entity) {
  entity = String(entity || "").trim().toUpperCase();
  if (!entity) throw new Error("Entidade inválida para reset de ID.");

  var lockKey = "IDS_RESET_" + entity;

  if (typeof Locks_withLock_ === "function") {
    return Locks_withLock_(null, lockKey, function () {
      return _Ids_resetUnsafe_(entity);
    });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return _Ids_resetUnsafe_(entity);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function _Ids_resetUnsafe_(entityUpper) {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(IDS_META_KEY);

  var counters;
  try {
    counters = raw ? JSON.parse(raw) : {};
  } catch (_) {
    counters = {};
  }
  if (!counters || typeof counters !== "object") counters = {};

  counters[entityUpper] = 0;

  try {
    props.setProperty(IDS_META_KEY, JSON.stringify(counters));
  } catch (_) {}

  return { ok: true, entity: entityUpper, resetTo: 0 };
}
