(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO.ui = PRONTIO.ui || {};
  PRONTIO.ui.modals = PRONTIO.ui.modals || {};

  // ✅ marca cedo para impedir auto-init duplicado em loaders
  PRONTIO._mainBootstrapped = true;

  // ✅ Bump quando fizer mudanças em JS e quiser quebrar cache do GitHub Pages
  const APP_VERSION = "1.0.7";

  // ============================================================
  // Skeleton (mantido) + breakpoint alinhado com JS (900px)
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
    return !!document.querySelector("[data-include-sidebar]") || !!document.getElementById("topbarMount");
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
    const key = withVersion_(src);
    if (PRONTIO._loadedScripts[key]) return true;
    const ok = await loadScript_(src);
    if (ok) PRONTIO._loadedScripts[key] = true;
    return ok;
  }

  // ============================================================
  // ✅ Core: garante API e AUTH antes de rodar pages
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

    // Base do core (ordem segura)
    await loadOnce_("assets/js/core/config.js");
    await loadOnce_("assets/js/core/dom.js");
    await loadOnce_("assets/js/core/utils.js");
    await loadOnce_("assets/js/core/state.js");

    const okApi = await loadOnce_("assets/js/core/api.js");

    // ✅ FIX: auth.js precisa existir antes do login/page scripts
    await loadOnce_("assets/js/core/auth.js");

    // app.js (compat)
    await loadOnce_("assets/js/core/app.js");

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
  // Modais (rebind usado pelo sidebar-loader)
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
  }

  PRONTIO.ui.modals.bindTriggers = bindModalTriggers_;

  // ============================================================
  // ✅ Tema: inicializa botão sol/lua (mantido)
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
  // ✅ Chat Widget global: carrega depois que topbar existir
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
    if (!isLoginPage_()) showSkeleton_();

    const safety = global.setTimeout(hideSkeleton_, 1800);

    try {
      // ✅ garante core/api/auth antes de qualquer page script
      await ensureCoreLoaded_();

      if (!isLoginPage_()) {
        await loadOnce_("assets/js/ui/sidebar.js");
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

      const pageId = getPageId_();
      if (pageId && !PRONTIO.pages[pageId]) {
        let ok = await loadOnce_("assets/js/pages/page-" + pageId + ".js");
        if (!ok) ok = await loadOnce_("assets/js/page-" + pageId + ".js");
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
