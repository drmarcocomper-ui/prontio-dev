// frontend/assets/js/main.js
(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO.ui = PRONTIO.ui || {};
  PRONTIO.ui.modals = PRONTIO.ui.modals || {};

  // ✅ marca cedo para impedir auto-init duplicado em loaders
  PRONTIO._mainBootstrapped = true;

  // ✅ Se main.js for incluído 2x, não roda bootstrap de novo
  if (PRONTIO._mainBootstrapRan === true) return;
  PRONTIO._mainBootstrapRan = true;

  // ✅ Bump quando fizer mudanças em JS e quiser quebrar cache do GitHub Pages
  const APP_VERSION = PRONTIO.APP_VERSION || "1.0.7.9";
  PRONTIO.APP_VERSION = APP_VERSION;

  // ============================================================
  // ✅ Manifest explícito (evita tentar carregar páginas que não existem)
  // ============================================================
  const PAGE_MANIFEST = {
    login: {
      js: ["assets/js/widgets/widget-toast.js", "assets/js/pages/page-login.js"],
      css: ["assets/css/pages/page-login.css"]
    },

    atendimento: { js: ["assets/js/pages/page-atendimento.js"], css: ["assets/css/pages/page-atendimento.css"] },
    agenda: { js: ["assets/js/pages/page-agenda.js"], css: ["assets/css/pages/page-agenda.css"] },
    chat: { js: ["assets/js/pages/page-chat.js"], css: ["assets/css/pages/page-chat.css"] },
    configuracoes: { js: ["assets/js/pages/page-configuracoes.js"], css: ["assets/css/pages/page-configuracoes.css"] },
    exames: { js: ["assets/js/pages/page-exames.js"], css: ["assets/css/pages/page-exames.css"] },
    laudo: { js: ["assets/js/pages/page-laudo.js"], css: ["assets/css/pages/page-laudo.css"] },
    pacientes: { js: ["assets/js/pages/page-pacientes.js"], css: ["assets/css/pages/page-pacientes.css"] },
    prontuario: { js: ["assets/js/pages/page-prontuario.js"], css: ["assets/css/pages/page-prontuario.css"] },
    receita: { js: ["assets/js/pages/page-receita.js"], css: ["assets/css/pages/page-receita.css"] },
    relatorios: { js: ["assets/js/pages/page-relatorios.js"], css: ["assets/css/pages/page-relatorios.css"] },
    usuarios: { js: ["assets/js/pages/page-usuarios.js"], css: ["assets/css/pages/page-usuarios.css"] },

    "alterar-senha": { js: ["assets/js/pages/page-alterar-senha.js"], css: [] },
    "forgot-password": { js: ["assets/js/pages/page-forgot-password.js"], css: [] },
    "reset-password": { js: ["assets/js/pages/page-reset-password.js"], css: [] }
  };

  // ============================================================
  // Shell responsivo (profissional) - GLOBAL
  // ============================================================
  const RESPONSIVE_SHELL = {
    css: "assets/css/components/responsive-shell.css",
    js: "assets/js/ui/responsive-shell.js"
  };

  // ============================================================
  // Skeleton (mantido)
  // ============================================================
  function ensureSkeletonStyle_() {
    if (document.getElementById("prontio-skeleton-style")) return;

    const style = document.createElement("style");
    style.id = "prontio-skeleton-style";
    style.textContent = `
      .prontio-skeleton{position:fixed;inset:0;z-index:9999;background:var(--cor-fundo-app,#0f1115);display:grid;grid-template-columns:240px 1fr;pointer-events:none}
      .prontio-skeleton__sidebar{border-right:1px solid rgba(255,255,255,.06);background:var(--cor-fundo-card,#14161c);padding:16px;display:flex;flex-direction:column;gap:12px}
      .prontio-skeleton__brand{height:18px;width:120px;border-radius:8px;background:rgba(255,255,255,.10)}
      .prontio-skeleton__navitem{height:14px;border-radius:8px;background:rgba(255,255,255,.10)}
      .prontio-skeleton__main{display:flex;flex-direction:column;min-width:0}
      .prontio-skeleton__topbar{height:64px;border-bottom:1px solid rgba(255,255,255,.06);background:var(--cor-fundo-card,#14161c)}
      .prontio-skeleton__content{padding:24px;display:grid;gap:14px}
      .prontio-skeleton__card{height:120px;border-radius:14px;background:rgba(255,255,255,.08)}
      .prontio-skeleton__brand,.prontio-skeleton__navitem,.prontio-skeleton__card{background-image:linear-gradient(90deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,.12) 40%,rgba(255,255,255,.06) 80%);background-size:220% 100%;animation:prontioShimmer 1s ease-in-out infinite}
      @keyframes prontioShimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}
      @media (max-width:900px){.prontio-skeleton{grid-template-columns:1fr}.prontio-skeleton__sidebar{display:none}}
    `;
    document.head.appendChild(style);
  }

  function shouldUseShell_() {
    return (
      !!document.querySelector("[data-include-sidebar]") ||
      !!document.getElementById("topbarMount") ||
      !!document.querySelector(".sidebar") ||
      !!document.querySelector(".topbar")
    );
  }

  function showSkeleton_() {
    if (!shouldUseShell_()) return;
    if (document.getElementById("prontioSkeleton")) return;

    ensureSkeletonStyle_();

    const el = document.createElement("div");
    el.id = "prontioSkeleton";
    el.className = "prontio-skeleton";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <div class="prontio-skeleton__sidebar">
        <div class="prontio-skeleton__brand"></div>
        <div class="prontio-skeleton__navitem"></div>
        <div class="prontio-skeleton__navitem"></div>
        <div class="prontio-skeleton__navitem"></div>
        <div class="prontio-skeleton__navitem"></div>
        <div class="prontio-skeleton__navitem"></div>
      </div>
      <div class="prontio-skeleton__main">
        <div class="prontio-skeleton__topbar"></div>
        <div class="prontio-skeleton__content">
          <div class="prontio-skeleton__card"></div>
          <div class="prontio-skeleton__card" style="height:180px"></div>
          <div class="prontio-skeleton__card" style="height:140px"></div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  function hideSkeleton_() {
    const el = document.getElementById("prontioSkeleton");
    if (el && el.parentNode) el.parentNode.removeChild(el);
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
    return getDataPage_() === "login";
  }

  function isChatStandalone_() {
    try {
      return document.body && document.body.getAttribute("data-chat-standalone") === "true";
    } catch (e) {
      return false;
    }
  }

  function getPageId_() {
    return (document.body && document.body.getAttribute("data-page-id")) || "";
  }

  // ============================================================
  // Loader util (cache-busting p/ GitHub Pages)
  // ============================================================
  function withVersion_(src) {
    if (!src || src.includes("?")) return src;
    if (!src.startsWith("assets/js/")) return src;
    return src + "?v=" + encodeURIComponent(APP_VERSION);
  }

  function _stripQuery_(url) {
    try { return String(url || "").split("?")[0]; } catch (_) { return String(url || ""); }
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

  PRONTIO._loadedScripts = PRONTIO._loadedScripts || {};
  async function loadOnce_(src) {
    const raw = String(src || "");
    if (!raw) return false;

    if (_hasScriptAlready_(raw)) return true;

    const key = withVersion_(raw);
    if (PRONTIO._loadedScripts[key]) return true;

    const ok = await loadScript_(raw);
    if (ok) PRONTIO._loadedScripts[key] = true;
    return ok;
  }

  // ============================================================
  // CSS loader seguro
  // ============================================================
  PRONTIO._loadedCss = PRONTIO._loadedCss || {};
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
      if (tag) link.setAttribute("data-page-css", tag);
      link.onload = function () { PRONTIO._loadedCss[key] = true; };
      link.onerror = function () { PRONTIO._loadedCss[key] = true; };
      document.head.appendChild(link);
    } catch (_) {}
  }

  function ensurePageAssets_(pageId) {
    const pid = String(pageId || "").toLowerCase().trim();
    if (!pid) return;

    const entry = PAGE_MANIFEST[pid];
    if (!entry) return;

    try {
      (entry.css || []).forEach(function (href) {
        loadCssOnce_(href, pid);
      });
    } catch (_) {}
  }

  // ============================================================
  // Core
  // ============================================================
  async function ensureCoreLoaded_() {
    const hasApi =
      PRONTIO.api &&
      typeof PRONTIO.api.callApiEnvelope === "function" &&
      typeof PRONTIO.api.callApiData === "function";

    const hasAuth =
      PRONTIO.auth &&
      typeof PRONTIO.auth.getToken === "function";

    if (hasApi && hasAuth) return true;

    await loadOnce_("assets/js/core/config.js");
    await loadOnce_("assets/js/core/dom.js");
    await loadOnce_("assets/js/core/utils.js");
    await loadOnce_("assets/js/core/state.js");

    const okApi = await loadOnce_("assets/js/core/api.js");

    await loadOnce_("assets/js/core/session.js");
    try {
      if (PRONTIO.core && PRONTIO.core.session && typeof PRONTIO.core.session.init === "function") {
        PRONTIO.core.session.init();
      }
    } catch (_) {}

    await loadOnce_("assets/js/core/auth.js");
    await loadOnce_("assets/js/core/app.js");

    // ✅ Se existir PRONTIO.app.init, chama (best-effort)
    try {
      if (PRONTIO.app && typeof PRONTIO.app.init === "function") {
        await PRONTIO.app.init();
      }
    } catch (_) {}

    // ✅ Shell responsivo: JS global (toggle sidebar + overlay + ESC)
    try {
      await loadOnce_(RESPONSIVE_SHELL.js);
      if (PRONTIO.ui && PRONTIO.ui.responsiveShell && typeof PRONTIO.ui.responsiveShell.init === "function") {
        PRONTIO.ui.responsiveShell.init();
      }
    } catch (_) {}

    const hasApiAfter =
      okApi &&
      PRONTIO.api &&
      typeof PRONTIO.api.callApiEnvelope === "function" &&
      typeof PRONTIO.api.callApiData === "function";

    const hasAuthAfter =
      PRONTIO.auth &&
      typeof PRONTIO.auth.getToken === "function";

    return !!(hasApiAfter && hasAuthAfter);
  }

  // ============================================================
  // Modais
  // ============================================================
  function _openModal_(modal) {
    if (!modal) return;

    // Suporta 2 padrões (sem quebrar):
    // 1) .modal-overlay.hidden/.visible + aria-hidden (Agenda)
    // 2) .modal.is-open + modal.hidden (Usuários antigo)
    const hasHiddenClass = modal.classList.contains("hidden");
    const hasOverlay = modal.classList.contains("modal-overlay") || modal.classList.contains("modal-backdrop");

    if (hasHiddenClass || hasOverlay) {
      modal.classList.remove("hidden");
      modal.classList.add("visible");
      modal.setAttribute("aria-hidden", "false");
      return;
    }

    modal.classList.add("is-open");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
  }

  function _closeModal_(modal) {
    if (!modal) return;

    // padrão 1
    if (modal.classList.contains("visible") || modal.classList.contains("modal-overlay") || modal.classList.contains("hidden")) {
      modal.classList.remove("visible");
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      return;
    }

    // padrão 2
    modal.classList.remove("is-open");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function bindModalTriggers_(doc) {
    const root = doc || document;

    // OPEN
    root.querySelectorAll("[data-modal-open]").forEach(function (opener) {
      if (opener.getAttribute("data-modal-bound") === "1") return;
      opener.setAttribute("data-modal-bound", "1");

      opener.addEventListener("click", function (ev) {
        ev.preventDefault();
        const id = opener.getAttribute("data-modal-open");
        const modal = document.getElementById(id);
        if (!modal) return;
        _openModal_(modal);
      });
    });

    // CLOSE (botões)
    root.querySelectorAll("[data-modal-close]").forEach(function (closer) {
      if (closer.getAttribute("data-modal-bound") === "1") return;
      closer.setAttribute("data-modal-bound", "1");

      closer.addEventListener("click", function (ev) {
        ev.preventDefault();
        const id = closer.getAttribute("data-modal-close");
        const modal = document.getElementById(id);
        if (!modal) return;
        _closeModal_(modal);
      });
    });

    // CLOSE (clique fora) — compat com modal-overlay/backdrop
    root.querySelectorAll(".modal-overlay, .modal-backdrop").forEach(function (overlay) {
      if (overlay.getAttribute("data-modal-overlay-bound") === "1") return;
      overlay.setAttribute("data-modal-overlay-bound", "1");

      overlay.addEventListener("click", function (ev) {
        // se clicar no próprio overlay/backdrop, fecha
        if (ev.target !== overlay) return;

        // tenta achar um modal pai conhecido:
        // - overlay pode ser o próprio modal (.modal-overlay)
        // - ou pode ser um child (.modal-backdrop) dentro de #modalX
        let modal = overlay;
        if (!modal.id) {
          const parent = overlay.closest(".modal-overlay, .modal");
          if (parent) modal = parent;
          else {
            // fallback: tenta subir para um elemento com id
            const idParent = overlay.closest("[id]");
            if (idParent) modal = idParent;
          }
        }
        _closeModal_(modal);
      });
    });

    // ESC fecha modal aberto (best-effort)
    if (root === document) {
      if (document.body.getAttribute("data-modals-esc-bound") === "1") return;
      document.body.setAttribute("data-modals-esc-bound", "1");

      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;

        // tenta achar o primeiro modal visível
        const open1 = document.querySelector(".modal-overlay.visible:not(.hidden)");
        if (open1) return _closeModal_(open1);

        const open2 = document.querySelector(".modal.is-open");
        if (open2) return _closeModal_(open2);
      });
    }
  }

  PRONTIO.ui.modals.bindTriggers = bindModalTriggers_;

  // ============================================================
  // Tema
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

    if (btn.getAttribute("data-theme-bound") === "1") return;
    btn.setAttribute("data-theme-bound", "1");

    btn.addEventListener("click", function () {
      const cur = document.body.getAttribute("data-theme") || "light";
      apply(cur === "dark" ? "light" : "dark");
    });
  }

  PRONTIO.ui.initTheme = initThemeToggle_;

  // ============================================================
  // Chat widget
  // ============================================================
  async function ensureChatWidgetLoaded_() {
    if (isChatStandalone_()) return true;

    const hasTopbar = !!document.getElementById("topbarMount") || !!document.querySelector(".topbar");
    if (!hasTopbar) return true;

    const ok = await loadOnce_("assets/js/widgets/widget-chat.js");
    if (!ok) return false;

    PRONTIO.widgets = PRONTIO.widgets || {};
    if (PRONTIO.widgets.chat && typeof PRONTIO.widgets.chat.init === "function") {
      if (PRONTIO.widgets.chat._inited === true) return true;
      try {
        await PRONTIO.widgets.chat.init();
        PRONTIO.widgets.chat._inited = true;
      } catch (e) {}
    }

    return true;
  }

  // ============================================================
  // Bootstrap
  // ============================================================
  async function bootstrap_() {
    // ✅ CSS global do shell responsivo (sidebar off-canvas + tabelas responsivas)
    loadCssOnce_(RESPONSIVE_SHELL.css, "global");

    if (!isLoginPage_()) showSkeleton_();
    const safety = global.setTimeout(hideSkeleton_, 1800);

    try {
      await ensureCoreLoaded_();

      if (!isLoginPage_()) {
        await loadOnce_("assets/js/widgets/widget-sidebar.js");
        await loadOnce_("assets/js/ui/sidebar-loader.js");

        if (PRONTIO.ui && PRONTIO.ui.sidebarLoader && typeof PRONTIO.ui.sidebarLoader.load === "function") {
          await PRONTIO.ui.sidebarLoader.load();
        }

        if (!isChatStandalone_()) {
          await loadOnce_("assets/js/widgets/widget-topbar.js");
          if (PRONTIO.widgets && PRONTIO.widgets.topbar && typeof PRONTIO.widgets.topbar.init === "function") {
            await PRONTIO.widgets.topbar.init();
          }

          initThemeToggle_();
          bindModalTriggers_(document);
          await ensureChatWidgetLoaded_();
        }
      }

      const pageId = String(getPageId_() || "").toLowerCase().trim();

      ensurePageAssets_(pageId);

      const entry = PAGE_MANIFEST[pageId];
      if (entry && entry.js && entry.js.length) {
        for (let i = 0; i < entry.js.length; i++) {
          await loadOnce_(entry.js[i]);
        }
      }

      const page = PRONTIO.pages[pageId];
      if (page && typeof page.init === "function") {
        try { page.init(); } catch (e) {}
      }
    } finally {
      global.clearTimeout(safety);
      hideSkeleton_();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap_);
  } else {
    bootstrap_();
  }
})(window, document);
