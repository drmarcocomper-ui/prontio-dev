// frontend/assets/js/core/storage.js
// =====================================
// PRONTIO - core/storage.js
// Wrapper para localStorage / sessionStorage
//
// Objetivos:
// - Evitar espalhar "localStorage.setItem" no código
// - Centralizar prefixo de chave
// - Suportar JSON automaticamente
//
// Convenções:
// - Chaves sempre começam com "prontio."
//
// ✅ PASSO 3:
// - storage.js fica para preferências e utilitários de armazenamento.
// - Estado de contexto (paciente/agenda atual) fica em PRONTIO.core.state.
// =====================================

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const core = (PRONTIO.core = PRONTIO.core || {});
  const storageNS = (core.storage = core.storage || {});

  const PREFIX = "prontio.";

  function getFullKey(key) {
    const k = String(key || "").trim();
    return PREFIX + k;
  }

  function hasStorage_(kind) {
    try {
      const s = (kind === "session") ? global.sessionStorage : global.localStorage;
      if (!s) return false;

      // teste rápido (modo privado pode falhar)
      const testKey = PREFIX + "__test__";
      s.setItem(testKey, "1");
      s.removeItem(testKey);
      return true;
    } catch (_) {
      return false;
    }
  }

  function getStore_(kind) {
    return (kind === "session") ? global.sessionStorage : global.localStorage;
  }

  // -----------------------------------------
  // Métodos base (string) - local/session
  // -----------------------------------------
  function setItem(key, value, opts) {
    opts = opts || {};
    const kind = (opts.session === true) ? "session" : "local";
    if (!hasStorage_(kind)) return;

    const fullKey = getFullKey(key);
    try {
      const store = getStore_(kind);
      if (!store) return;

      if (value === null || value === undefined) {
        store.removeItem(fullKey);
      } else {
        store.setItem(fullKey, String(value));
      }
    } catch (_) {}
  }

  function getItem(key, opts) {
    opts = opts || {};
    const kind = (opts.session === true) ? "session" : "local";
    if (!hasStorage_(kind)) return null;

    const fullKey = getFullKey(key);
    try {
      const store = getStore_(kind);
      if (!store) return null;
      return store.getItem(fullKey);
    } catch (_) {
      return null;
    }
  }

  function removeItem(key, opts) {
    opts = opts || {};
    const kind = (opts.session === true) ? "session" : "local";
    if (!hasStorage_(kind)) return;

    const fullKey = getFullKey(key);
    try {
      const store = getStore_(kind);
      if (!store) return;
      store.removeItem(fullKey);
    } catch (_) {}
  }

  // -----------------------------------------
  // JSON helpers
  // -----------------------------------------
  function setJSON(key, obj, opts) {
    if (obj === undefined) {
      removeItem(key, opts);
      return;
    }
    try {
      const json = JSON.stringify(obj);
      setItem(key, json, opts);
    } catch (_) {}
  }

  function getJSON(key, opts) {
    const raw = getItem(key, opts);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  /**
   * Merge JSON (shallow) sem quebrar:
   * - Lê objeto atual (ou {}), aplica patch, salva de volta.
   */
  function mergeJSON(key, patch, opts) {
    const cur = getJSON(key, opts) || {};
    const p = (patch && typeof patch === "object") ? patch : {};
    const next = Object.assign({}, cur, p);
    setJSON(key, next, opts);
    return next;
  }

  // -----------------------------------------
  // Preferências comuns
  // -----------------------------------------

  // Tema (light/dark)
  function setThemePreference(theme) {
    setItem("prefs.theme", theme);
  }

  function getThemePreference() {
    return getItem("prefs.theme");
  }

  // Sidebar compacta (true/false)
  function setSidebarCompact(isCompact) {
    setItem("prefs.sidebarCompact", isCompact ? "1" : "0");
  }

  function isSidebarCompact() {
    return getItem("prefs.sidebarCompact") === "1";
  }

  /**
   * Última data de agenda visualizada
   * ✅ PASSO 1: a agenda trabalha em data local "YYYY-MM-DD"
   * - Mantemos compat: se vier algo que pareça ISO, tentamos extrair YYYY-MM-DD.
   */
  function setUltimaDataAgenda(dateStr) {
    const s = String(dateStr || "").trim();
    setItem("prefs.ultimaDataAgenda", s);
  }

  function getUltimaDataAgenda() {
    const raw = String(getItem("prefs.ultimaDataAgenda") || "").trim();
    if (!raw) return null;

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    // ISO -> extrai data local aproximada (mantém compat; não usa para regra de negócio)
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];

    return raw;
  }

  // -----------------------------------------
  // Exposição pública
  // -----------------------------------------
  storageNS.setItem = setItem;
  storageNS.getItem = getItem;
  storageNS.removeItem = removeItem;

  storageNS.setJSON = setJSON;
  storageNS.getJSON = getJSON;
  storageNS.mergeJSON = mergeJSON;

  storageNS.setThemePreference = setThemePreference;
  storageNS.getThemePreference = getThemePreference;

  storageNS.setSidebarCompact = setSidebarCompact;
  storageNS.isSidebarCompact = isSidebarCompact;

  storageNS.setUltimaDataAgenda = setUltimaDataAgenda;
  storageNS.getUltimaDataAgenda = getUltimaDataAgenda;

})(window);
