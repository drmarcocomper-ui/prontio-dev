(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};

  // ============================================================
  // Helpers de página
  // ============================================================
  function getPageId_() {
    try {
      return String(document.body?.getAttribute("data-page-id") || "")
        .toLowerCase()
        .trim();
    } catch (_) {
      return "";
    }
  }

  function isLoginPage_() {
    return getPageId_() === "login";
  }

  function isChatStandalone_() {
    try {
      return document.body?.getAttribute("data-chat-standalone") === "true";
    } catch (_) {
      return false;
    }
  }

  // ============================================================
  // Core bootstrap
  // ============================================================
  async function ensureCoreLoaded_() {
    const loader = PRONTIO.loader;
    if (!loader) {
      console.error("[PRONTIO] loader não inicializado.");
      return false;
    }

    const hasApi =
      PRONTIO.api &&
      typeof PRONTIO.api.callApiEnvelope === "function" &&
      typeof PRONTIO.api.callApiData === "function";

    const hasAuth =
      PRONTIO.auth &&
      typeof PRONTIO.auth.getToken === "function";

    if (hasApi && hasAuth) return true;

    await loader.loadOnce("assets/js/core/config.js");
    await loader.loadOnce("assets/js/core/dom.js");
    await loader.loadOnce("assets/js/core/utils.js");
    await loader.loadOnce("assets/js/core/state.js");

    const okApi = await loader.loadOnce("assets/js/core/api.js");

    await loader.loadOnce("assets/js/core/session.js");
    try {
      if (PRONTIO.core?.session?.init) {
        PRONTIO.core.session.init();
      }
    } catch (_) {}

    await loader.loadOnce("assets/js/core/auth.js");
    await loader.loadOnce("assets/js/core/app.js");

    try {
      if (PRONTIO.app?.init) {
        await PRONTIO.app.init();
      }
    } catch (_) {}

    return !!(
      okApi &&
      PRONTIO.api &&
      typeof PRONTIO.api.callApiData === "function"
    );
  }

  // ============================================================
  // Shell / UI global
  // ============================================================
  async function ensureShell_() {
    const loader = PRONTIO.loader;
    if (!loader) return;

    await loader.loadCssOnce("assets/css/components/responsive-shell.css", "global");
    await loader.loadOnce("assets/js/ui/responsive-shell.js");

    try {
      if (PRONTIO.ui?.responsiveShell?.init) {
        PRONTIO.ui.responsiveShell.init();
      }
    } catch (_) {}
  }

  async function ensureWidgets_() {
    const loader = PRONTIO.loader;

    await loader.loadOnce("assets/js/widgets/widget-sidebar.js");
    await loader.loadOnce("assets/js/ui/sidebar-loader.js");

    try {
      if (PRONTIO.ui?.sidebarLoader?.load) {
        await PRONTIO.ui.sidebarLoader.load();
      }
    } catch (_) {}

    if (!isChatStandalone_()) {
      await loader.loadOnce("assets/js/widgets/widget-topbar.js");
      try {
        if (PRONTIO.widgets?.topbar?.init) {
          await PRONTIO.widgets.topbar.init();
        }
      } catch (_) {}

      // tema + modais
      try {
        if (PRONTIO.ui?.initTheme) PRONTIO.ui.initTheme();
        if (PRONTIO.ui?.modals?.bindTriggers) {
          PRONTIO.ui.modals.bindTriggers(document);
        }
      } catch (_) {}

      // chat
      await loader.loadOnce("assets/js/widgets/widget-chat.js");
      try {
        if (PRONTIO.widgets?.chat?.init && !PRONTIO.widgets.chat._inited) {
          await PRONTIO.widgets.chat.init();
          PRONTIO.widgets.chat._inited = true;
        }
      } catch (_) {}
    }
  }

  // ============================================================
  // Bootstrap principal
  // ============================================================
  async function bootstrap_() {
    const loader = PRONTIO.loader;
    if (!loader) {
      console.error("[PRONTIO] loader ausente no bootstrap.");
      return;
    }

    try {
      await ensureCoreLoaded_();

      if (!isLoginPage_()) {
        await ensureShell_();
        await ensureWidgets_();
      }

      const pageId = getPageId_();
      loader.ensurePageCss(pageId);

      const manifest = PRONTIO.PAGE_MANIFEST || {};
      const entry = manifest[pageId];

      if (entry?.js?.length) {
        for (let i = 0; i < entry.js.length; i++) {
          await loader.loadOnce(entry.js[i]);
        }
      }

      const page = PRONTIO.pages[pageId];
      if (page?.init) {
        page.init();
      }
    } catch (e) {
      console.error("[PRONTIO] Erro no bootstrap:", e);
    }
  }

  // ============================================================
  // Start
  // ============================================================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap_);
  } else {
    bootstrap_();
  }

  PRONTIO.bootstrap = bootstrap_;
})(window, document);
