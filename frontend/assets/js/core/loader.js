(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO._debug = PRONTIO._debug || { loaded: [], failed: [] };
  PRONTIO._loadedScripts = PRONTIO._loadedScripts || {};
  PRONTIO._loadedCss = PRONTIO._loadedCss || {};

  const APP_VERSION = PRONTIO.APP_VERSION || "1.0.0";

  function _stripQuery_(url) {
    try { return String(url || "").split("?")[0]; } catch (_) { return String(url || ""); }
  }

  function withVersion_(src) {
    const s = String(src || "");
    if (!s) return s;
    if (s.includes("?")) return s;
    if (!s.startsWith("assets/js/")) return s;
    return s + "?v=" + encodeURIComponent(APP_VERSION);
  }

  function _hasScriptAlready_(src) {
    try {
      const target = _stripQuery_(src);
      const scripts = document.querySelectorAll("script[src]");
      for (let i = 0; i < scripts.length; i++) {
        const s = scripts[i].getAttribute("src") || "";
        if (_stripQuery_(s) === target) return true;
      }
    } catch (_) {}
    return false;
  }

  function _debugMarkLoaded_(src) {
    try { PRONTIO._debug.loaded.push(String(src)); } catch (_) {}
  }

  function _debugMarkFailed_(src) {
    try { PRONTIO._debug.failed.push(String(src)); } catch (_) {}
  }

  function loadScript_(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = withVersion_(src);
      s.defer = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  async function loadOnce_(src) {
    const raw = String(src || "");
    if (!raw) return false;

    // já existe no DOM
    if (_hasScriptAlready_(raw)) {
      _debugMarkLoaded_(raw + " (already)");
      return true;
    }

    // já carregado pelo loader
    const key = withVersion_(raw);
    if (PRONTIO._loadedScripts[key]) {
      _debugMarkLoaded_(raw + " (cache)");
      return true;
    }

    const ok = await loadScript_(raw);
    if (ok) {
      PRONTIO._loadedScripts[key] = true;
      _debugMarkLoaded_(raw);
    } else {
      _debugMarkFailed_(raw);
    }
    return ok;
  }

  function loadCssOnce_(href, tag) {
    try {
      const key = String(href || "");
      if (!key) return;

      if (PRONTIO._loadedCss[key]) return;

      const exists = document.querySelector('link[rel="stylesheet"][href="' + key + '"]');
      if (exists) {
        PRONTIO._loadedCss[key] = true;
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = key;
      if (tag) link.setAttribute("data-page-css", String(tag));
      link.onload = function () { PRONTIO._loadedCss[key] = true; };
      link.onerror = function () { PRONTIO._loadedCss[key] = true; };
      document.head.appendChild(link);
    } catch (_) {}
  }

  function ensurePageCss_(pageId) {
    const pid = String(pageId || "").toLowerCase().trim();
    const manifest = PRONTIO.PAGE_MANIFEST || {};
    const entry = manifest[pid];
    if (!entry || !entry.css) return;

    try {
      (entry.css || []).forEach(function (href) {
        loadCssOnce_(href, pid);
      });
    } catch (_) {}
  }

  PRONTIO.loader = {
    withVersion: withVersion_,
    loadOnce: loadOnce_,
    loadCssOnce: loadCssOnce_,
    ensurePageCss: ensurePageCss_,
    stripQuery: _stripQuery_
  };
})(window, document);
