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
  // Core bootstrap (otimizado para carregamento paralelo)
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

    // ✅ Carrega scripts base em paralelo (não têm dependências entre si)
    await Promise.all([
      loader.loadOnce("assets/js/core/config.js"),
      loader.loadOnce("assets/js/core/supabase.js"),
      loader.loadOnce("assets/js/core/dom.js"),
      loader.loadOnce("assets/js/core/utils.js"),
      loader.loadOnce("assets/js/core/state.js")
    ]);

    // ✅ Carrega serviços Supabase em paralelo
    await Promise.all([
      loader.loadOnce("assets/js/services/supabase/auth.service.js"),
      loader.loadOnce("assets/js/services/supabase/pacientes.service.js"),
      loader.loadOnce("assets/js/services/supabase/agenda.service.js"),
      loader.loadOnce("assets/js/services/supabase/profissionais.service.js"),
      loader.loadOnce("assets/js/services/supabase/evolucoes.service.js"),
      loader.loadOnce("assets/js/services/supabase/receitas.service.js"),
      loader.loadOnce("assets/js/services/supabase/anamnese.service.js")
    ]);

    // ✅ Aguarda recuperação da sessão Supabase (se existir)
    try {
      if (PRONTIO.services?.auth?.recuperarSessao) {
        await PRONTIO.services.auth.recuperarSessao();
      }
    } catch (_) {}

    // ✅ Carrega API (base para auth/session)
    const okApi = await loader.loadOnce("assets/js/core/api.js");

    // ✅ Carrega auth, session, theme em paralelo
    await Promise.all([
      loader.loadOnce("assets/js/core/session.js"),
      loader.loadOnce("assets/js/core/auth.js"),
      loader.loadOnce("assets/js/core/theme.js")
    ]);

    try {
      if (PRONTIO.core?.session?.init) {
        PRONTIO.core.session.init();
      }
    } catch (_) {}

    // App depende de auth
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

    // Carrega scripts em paralelo
    await Promise.all([
      loader.loadOnce("assets/js/widgets/widget-sidebar.js"),
      loader.loadOnce("assets/js/ui/sidebar-loader.js"),
      isChatStandalone_() ? Promise.resolve() : loader.loadOnce("assets/js/widgets/widget-topbar.js")
    ]);

    // Inicializa sidebar e topbar em paralelo
    const initPromises = [];

    if (PRONTIO.ui?.sidebarLoader?.load) {
      initPromises.push(PRONTIO.ui.sidebarLoader.load().catch(() => {}));
    }

    if (!isChatStandalone_() && PRONTIO.widgets?.topbar?.init) {
      initPromises.push(PRONTIO.widgets.topbar.init().catch(() => {}));
    }

    await Promise.all(initPromises);

    if (!isChatStandalone_()) {

      // tema + modais
      try {
        if (PRONTIO.ui?.initTheme) PRONTIO.ui.initTheme();
        if (PRONTIO.ui?.modals?.bindTriggers) {
          PRONTIO.ui.modals.bindTriggers(document);
        }
      } catch (_) {}

      // ✅ Chat carrega LAZY (após 2s ou no primeiro clique)
      // Melhora performance do carregamento inicial
      const loadChatLazy = async () => {
        if (PRONTIO.widgets?.chat?._inited) return;
        await loader.loadOnce("assets/js/widgets/widget-chat.js");
        try {
          if (PRONTIO.widgets?.chat?.init && !PRONTIO.widgets.chat._inited) {
            await PRONTIO.widgets.chat.init();
            PRONTIO.widgets.chat._inited = true;
          }
        } catch (_) {}
      };

      // Carrega chat após 2 segundos (não bloqueia carregamento inicial)
      setTimeout(loadChatLazy, 2000);

      // Ou carrega imediatamente se clicar no botão do chat
      const chatBtn = document.getElementById("prontio-chat-topbtn");
      if (chatBtn) {
        chatBtn.addEventListener("click", loadChatLazy, { once: true });
      }
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
        const scripts = entry.js;

        // ✅ Separa scripts: módulos (paralelo) vs entry points (sequencial no final)
        const entryScripts = scripts.filter(s => s.includes(".entry.js") || s.includes("page-"));
        const moduleScripts = scripts.filter(s => !s.includes(".entry.js") && !s.includes("page-"));

        // ✅ Carrega módulos em paralelo (muito mais rápido)
        if (moduleScripts.length > 0) {
          await Promise.all(moduleScripts.map(s => loader.loadOnce(s)));
        }

        // ✅ Carrega entry points em sequência (dependem dos módulos)
        for (const s of entryScripts) {
          await loader.loadOnce(s);
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
