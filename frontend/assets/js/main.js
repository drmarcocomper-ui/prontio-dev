(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO.ui = PRONTIO.ui || {};
  PRONTIO.ui.modals = PRONTIO.ui.modals || {};

  /**
   * ============================================================
   * COMPAT: DOMContentLoaded para scripts lazy-loaded
   * ============================================================
   */
  (function patchDOMContentLoadedOnce_() {
    if (PRONTIO._domContentLoadedPatched) return;
    PRONTIO._domContentLoadedPatched = true;

    const alreadyLoaded = document.readyState !== "loading";
    PRONTIO._domContentAlreadyLoaded = alreadyLoaded;

    const origAdd = document.addEventListener.bind(document);

    document.addEventListener = function (type, listener, options) {
      origAdd(type, listener, options);

      if (type === "DOMContentLoaded" && PRONTIO._domContentAlreadyLoaded) {
        try {
          if (listener && typeof listener === "function") {
            const key = "__prontio_dcl_" + String(listener);
            PRONTIO._dclOnce = PRONTIO._dclOnce || {};
            if (PRONTIO._dclOnce[key]) return;
            PRONTIO._dclOnce[key] = true;

            global.setTimeout(function () {
              try { listener.call(document, new Event("DOMContentLoaded")); } catch (_) {}
            }, 0);
          }
        } catch (_) {}
      }
    };

    if (!alreadyLoaded) {
      origAdd("DOMContentLoaded", function () {
        PRONTIO._domContentAlreadyLoaded = true;
      });
    }
  })();

  // ============================================================
  // Registry de páginas
  // ============================================================
  PRONTIO.registerPage = function registerPage(pageId, initFn) {
    if (!pageId || typeof initFn !== "function") return;
    PRONTIO.pages[pageId] = { init: initFn };
  };

  PRONTIO.registerPageInitializer = function registerPageInitializer(pageId, initFn) {
    PRONTIO.registerPage(pageId, initFn);
  };

  function getPageId_() {
    return (document.body && document.body.getAttribute("data-page-id")) || "";
  }

  function getDataPage_() {
    try {
      const body = document.body;
      const pid = (body && body.dataset && (body.dataset.pageId || body.dataset.page)) || "";
      return String(pid || "").toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function isLoginPage_() {
    const p = getDataPage_();
    if (p === "login") return true;

    const path = (global.location && global.location.pathname)
      ? global.location.pathname.toLowerCase()
      : "";

    return (
      path.endsWith("/index.html") ||
      path.endsWith("index.html") ||
      path.endsWith("/login.html") ||
      path.endsWith("login.html")
    );
  }

  function isChatStandalone_() {
    try {
      return document.body && document.body.getAttribute("data-chat-standalone") === "true";
    } catch (e) {
      return false;
    }
  }

  // ============================================================
  // Loader util
  // ============================================================
  function loadScript_(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  PRONTIO._loadedScripts = PRONTIO._loadedScripts || {};
  async function loadOnce_(src) {
    if (PRONTIO._loadedScripts[src]) return true;
    const ok = await loadScript_(src);
    if (ok) PRONTIO._loadedScripts[src] = true;
    return ok;
  }

  // ============================================================
  // Infra
  // ============================================================
  async function ensureApiLoaded_() {
    const hasApi =
      PRONTIO.api &&
      typeof PRONTIO.api.callApiEnvelope === "function" &&
      typeof PRONTIO.api.callApiData === "function";

    if (hasApi) return true;

    await loadOnce_("assets/js/core/config.js");
    const ok = await loadOnce_("assets/js/core/api.js");

    const hasApiAfter =
      ok &&
      PRONTIO.api &&
      typeof PRONTIO.api.callApiEnvelope === "function" &&
      typeof PRONTIO.api.callApiData === "function";

    return !!hasApiAfter;
  }

  async function ensureAuthLoaded_() {
    const hasAuth =
      PRONTIO.auth &&
      typeof PRONTIO.auth.requireAuth === "function" &&
      typeof PRONTIO.auth.bindLogoutButtons === "function";

    if (hasAuth) return true;

    const ok = await loadOnce_("assets/js/core/auth.js");

    const hasAuthAfter =
      ok &&
      PRONTIO.auth &&
      typeof PRONTIO.auth.requireAuth === "function" &&
      typeof PRONTIO.auth.bindLogoutButtons === "function";

    return !!hasAuthAfter;
  }

  async function ensureSessionIfAvailable_() {
    if (isLoginPage_()) return true;
    if (!PRONTIO.auth || typeof PRONTIO.auth.ensureSession !== "function") return true;

    try {
      const ok = await PRONTIO.auth.ensureSession({ redirect: true });
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  // ============================================================
  // Modais (mantém compat com sidebar-loader)
  // ============================================================
  function bindModalTriggers_(doc) {
    const root = doc || document;

    root.querySelectorAll("[data-modal-open]").forEach(function (opener) {
      opener.addEventListener("click", function (ev) {
        ev.preventDefault();
        const id = opener.getAttribute("data-modal-open");
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add("is-open");
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
      });
    });

    root.querySelectorAll("[data-modal-close]").forEach(function (closer) {
      closer.addEventListener("click", function (ev) {
        ev.preventDefault();
        const id = closer.getAttribute("data-modal-close");
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove("is-open");
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
      });
    });

    root.querySelectorAll(".modal-backdrop").forEach(function (modal) {
      modal.addEventListener("click", function (ev) {
        if (ev.target !== modal) return;
        modal.classList.remove("is-open");
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
      });
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape" && ev.key !== "Esc") return;
      document.querySelectorAll(".modal-backdrop.is-open").forEach(function (modal) {
        modal.classList.remove("is-open");
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
      });
    });
  }

  PRONTIO.ui.modals.bindTriggers = bindModalTriggers_;

  // ============================================================
  // Tema (exposto para widget-topbar rebind)
  // ============================================================
  function initThemeToggle_() {
    const btn = document.querySelector(".js-toggle-theme");
    if (!btn) return;

    function apply(theme) {
      document.body.setAttribute("data-theme", theme);
      try { localStorage.setItem("prontio_theme", theme); } catch (e) {}

      const sun = document.querySelector(".js-theme-icon-sun");
      const moon = document.querySelector(".js-theme-icon-moon");
      if (sun && moon) {
        if (theme === "dark") {
          sun.style.display = "none";
          moon.style.display = "";
        } else {
          sun.style.display = "";
          moon.style.display = "none";
        }
      }
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    }

    let theme = "light";
    try {
      theme = localStorage.getItem("prontio_theme") || (document.body.getAttribute("data-theme") || "light");
    } catch (e) {
      theme = document.body.getAttribute("data-theme") || "light";
    }

    apply(theme);

    btn.addEventListener("click", function () {
      const cur = document.body.getAttribute("data-theme") || "light";
      apply(cur === "dark" ? "light" : "dark");
    });
  }

  // ✅ Para o widget-topbar conseguir rebind:
  PRONTIO.ui.initTheme = initThemeToggle_;

  // ============================================================
  // Anti-flash (esconde UI até sidebar + topbar prontas)
  // ============================================================
  function ensureShellLoadingStyle_() {
    if (document.getElementById("prontio-shell-loading-style")) return;

    const style = document.createElement("style");
    style.id = "prontio-shell-loading-style";
    style.textContent = `
      html.prontio-shell-loading body { visibility: hidden; }
      html.prontio-shell-loading .app-shell { visibility: hidden; }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  // Bootstrap
  // ============================================================
  async function bootstrap_() {
    if (PRONTIO._bootstrapRunning) return;
    if (PRONTIO._bootstrapDone) return;
    PRONTIO._bootstrapRunning = true;

    PRONTIO._mainBootstrapped = true;

    try {
      // ✅ esconde o shell logo de cara (evita aparecer miolo antes do menu/topo)
      if (!isLoginPage_()) {
        ensureShellLoadingStyle_();
        document.documentElement.classList.add("prontio-shell-loading");
      }

      // 1) Infra
      await ensureApiLoaded_();
      await ensureAuthLoaded_();

      // 2) Guard local
      if (!isLoginPage_() && PRONTIO.auth && typeof PRONTIO.auth.requireAuth === "function") {
        const ok = PRONTIO.auth.requireAuth({ redirect: true });
        if (!ok) return;
      }

      // 3) Guard server-side
      const okSession = await ensureSessionIfAvailable_();
      if (!okSession) return;

      // 4) UI (sidebar + topbar via widgets)
      if (!isLoginPage_()) {
        // Sidebar (controlador + loader)
        await loadOnce_("assets/js/ui/sidebar.js");
        await loadOnce_("assets/js/ui/sidebar-loader.js");

        // Aguarda sidebar carregar para evitar flash
        if (PRONTIO.ui && PRONTIO.ui.sidebarLoader && typeof PRONTIO.ui.sidebarLoader.load === "function") {
          await PRONTIO.ui.sidebarLoader.load();
        }

        // Topbar: ✅ consolidado via widget + partial
        if (!isChatStandalone_()) {
          await loadOnce_("assets/js/widgets/widget-topbar.js");
          if (PRONTIO.widgets && PRONTIO.widgets.topbar && typeof PRONTIO.widgets.topbar.init === "function") {
            await PRONTIO.widgets.topbar.init();
          }

          // bind modais (conteúdo da página) – sidebar-loader já rebinda o que ele injeta
          bindModalTriggers_(document);
        }
      }

      // ✅ revela a UI após montar sidebar/topbar
      if (!isLoginPage_()) {
        document.documentElement.classList.remove("prontio-shell-loading");
      }

      // 5) Logout + label
      if (!isLoginPage_() && PRONTIO.auth) {
        try {
          if (typeof PRONTIO.auth.bindLogoutButtons === "function") PRONTIO.auth.bindLogoutButtons();
          if (typeof PRONTIO.auth.renderUserLabel === "function") PRONTIO.auth.renderUserLabel();
        } catch (e) {}
      }

      const pageId = getPageId_();
      if (!pageId) return;

      // 6) Lazy load page script
      if (!PRONTIO.pages[pageId]) {
        let ok = await loadOnce_("assets/js/pages/page-" + pageId + ".js");
        if (!ok) ok = await loadOnce_("assets/js/page-" + pageId + ".js");
      }

      // 7) Compat legado específico
      if (pageId === "prontuario") {
        await loadOnce_("assets/js/pages/page-receita.js");
      }

      // 8) Se a página registrou init, executa
      const page = PRONTIO.pages[pageId];
      if (page && typeof page.init === "function") {
        try { page.init(); } catch (e) {}
      }

    } finally {
      PRONTIO._bootstrapRunning = false;
      PRONTIO._bootstrapDone = true;

      // fallback: se algo der ruim no meio, não deixe a UI invisível pra sempre
      if (!isLoginPage_()) {
        document.documentElement.classList.remove("prontio-shell-loading");
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap_);
  } else {
    bootstrap_();
  }
})(window, document);
