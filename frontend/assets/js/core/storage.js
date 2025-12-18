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
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const core = (PRONTIO.core = PRONTIO.core || {});
  const storageNS = (core.storage = core.storage || {});

  const PREFIX = "prontio.";

  function getFullKey(key) {
    return PREFIX + String(key);
  }

  function hasLocalStorage() {
    try {
      return !!global.localStorage;
    } catch (e) {
      return false;
    }
  }

  // -----------------------------------------
  // Métodos base (string)
// -----------------------------------------
  function setItem(key, value) {
    if (!hasLocalStorage()) return;
    const fullKey = getFullKey(key);
    try {
      if (value === null || value === undefined) {
        global.localStorage.removeItem(fullKey);
      } else {
        global.localStorage.setItem(fullKey, String(value));
      }
    } catch (e) {
      // ignorar erros (modo privado, etc.)
    }
  }

  function getItem(key) {
    if (!hasLocalStorage()) return null;
    const fullKey = getFullKey(key);
    try {
      return global.localStorage.getItem(fullKey);
    } catch (e) {
      return null;
    }
  }

  function removeItem(key) {
    if (!hasLocalStorage()) return;
    const fullKey = getFullKey(key);
    try {
      global.localStorage.removeItem(fullKey);
    } catch (e) {
      // ignore
    }
  }

  // -----------------------------------------
  // JSON helpers
  // -----------------------------------------
  function setJSON(key, obj) {
    if (obj === undefined) {
      removeItem(key);
      return;
    }
    try {
      const json = JSON.stringify(obj);
      setItem(key, json);
    } catch (e) {
      // ignore
    }
  }

  function getJSON(key) {
    const raw = getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
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

  // Última data de agenda visualizada (ISO)
  function setUltimaDataAgenda(isoDate) {
    setItem("prefs.ultimaDataAgenda", isoDate || "");
  }

  function getUltimaDataAgenda() {
    return getItem("prefs.ultimaDataAgenda");
  }

  // -----------------------------------------
  // Exposição pública
  // -----------------------------------------
  storageNS.setItem = setItem;
  storageNS.getItem = getItem;
  storageNS.removeItem = removeItem;
  storageNS.setJSON = setJSON;
  storageNS.getJSON = getJSON;

  storageNS.setThemePreference = setThemePreference;
  storageNS.getThemePreference = getThemePreference;

  storageNS.setSidebarCompact = setSidebarCompact;
  storageNS.isSidebarCompact = isSidebarCompact;

  storageNS.setUltimaDataAgenda = setUltimaDataAgenda;
  storageNS.getUltimaDataAgenda = getUltimaDataAgenda;
})(window);
