/**
 * PRONTIO - Agenda Prefs (persistência leve)
 * - Usa PRONTIO.core.storage quando disponível
 * - Fallback localStorage
 * - Mantém chaves legadas (retrocompat)
 */
(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.agenda = PRONTIO.agenda || {};

  const coreStorage = PRONTIO.core && PRONTIO.core.storage ? PRONTIO.core.storage : null;

  const KEYS = {
    CORE_PREFS: "prontio.ui.agenda.prefs.v1",
    CORE_FILTERS: "prontio.ui.agenda.filtros.v1",
    LEGACY_MODO: "prontio.agenda.modoVisao",
    LEGACY_FILTERS: "prontio.agenda.filtros.v1"
  };

  function getJSON_(key, fallback) {
    try {
      if (coreStorage && typeof coreStorage.getJSON === "function") {
        return coreStorage.getJSON(key, fallback);
      }
    } catch (_) {}
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function setJSON_(key, obj) {
    try {
      if (coreStorage && typeof coreStorage.setJSON === "function") {
        coreStorage.setJSON(key, obj);
        return;
      }
    } catch (_) {}
    try {
      global.localStorage.setItem(key, JSON.stringify(obj));
    } catch (_) {}
  }

  function getString_(key, fallback) {
    try {
      if (coreStorage && typeof coreStorage.getItem === "function") {
        const v = coreStorage.getItem(key);
        return v == null ? fallback : String(v);
      }
    } catch (_) {}
    try {
      const v = global.localStorage.getItem(key);
      return v == null ? fallback : String(v);
    } catch (_) {
      return fallback;
    }
  }

  function setString_(key, value) {
    try {
      if (coreStorage && typeof coreStorage.setItem === "function") {
        coreStorage.setItem(key, String(value));
        return;
      }
    } catch (_) {}
    try {
      global.localStorage.setItem(key, String(value));
    } catch (_) {}
  }

  function loadPrefs() {
    const core = getJSON_(KEYS.CORE_PREFS, null) || {};
    const legacyModo = getString_(KEYS.LEGACY_MODO, null);
    const legacyFiltros = getJSON_(KEYS.LEGACY_FILTERS, null);

    const prefs = {
      modoVisao: core.modoVisao || legacyModo || "dia",
      filtros: Object.assign({ nome: "", status: "" }, core.filtros || {})
    };

    if ((!core.filtros || !Object.keys(core.filtros || {}).length) && legacyFiltros) {
      prefs.filtros.nome = String(legacyFiltros.nome || "");
      prefs.filtros.status = String(legacyFiltros.status || "");
    }

    if (prefs.modoVisao !== "dia" && prefs.modoVisao !== "semana") prefs.modoVisao = "dia";
    return prefs;
  }

  function savePrefs(patch) {
    const current = loadPrefs();
    const merged = Object.assign({}, current, patch || {});
    if (patch && patch.filtros) merged.filtros = Object.assign({}, current.filtros || {}, patch.filtros);

    setJSON_(KEYS.CORE_PREFS, merged);
    setJSON_(KEYS.CORE_FILTERS, merged.filtros || { nome: "", status: "" });

    // retrocompat
    setString_(KEYS.LEGACY_MODO, merged.modoVisao);
    setJSON_(KEYS.LEGACY_FILTERS, merged.filtros || { nome: "", status: "" });

    return merged;
  }

  PRONTIO.agenda.prefs = {
    KEYS,
    load: loadPrefs,
    save: savePrefs
  };
})(window);
