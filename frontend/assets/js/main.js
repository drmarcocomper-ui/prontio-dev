(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};

  PRONTIO.registerPage = function registerPage(pageId, initFn) {
    if (!pageId || typeof initFn !== "function") return;
    PRONTIO.pages[pageId] = { init: initFn };
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

    // ✅ agora reconhece index.html como login (e mantém login.html por compat)
    return (
      path.endsWith("/index.html") ||
      path.endsWith("index.html") ||
      path.endsWith("/login.html") ||
      path.endsWith("login.html")
    );
  }

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

  function initSidebar_() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.querySelector("[data-sidebar-backdrop]");
    const btnCompact = document.querySelector(".js-toggle-compact");
    const btnMobile = document.querySelector(".js-toggle-sidebar");

    function openMobile() {
      if (!sidebar) return;
      sidebar.classList.add("is-open");
      if (backdrop) {
        backdrop.hidden = false;
        backdrop.setAttribute("aria-hidden", "false");
      }
    }

    function closeMobile() {
      if (!sidebar) return;
      sidebar.classList.remove("is-open");
      if (backdrop) {
        backdrop.hidden = true;
        backdrop.setAttribute("aria-hidden", "true");
      }
    }

    if (btnMobile) btnMobile.addEventListener("click", openMobile);
    if (backdrop) backdrop.addEventListener("click", closeMobile);

    if (btnCompact && sidebar) {
      btnCompact.addEventListener("click", function () {
        sidebar.classList.toggle("is-compact");
        btnCompact.setAttribute(
          "aria-pressed",
          sidebar.classList.contains("is-compact") ? "true" : "false"
        );
      });
    }
  }

  function initModals_() {
    document.querySelectorAll("[data-modal-open]").forEach(function (opener) {
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

    document.querySelectorAll("[data-modal-close]").forEach(function (closer) {
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

    document.querySelectorAll(".modal-backdrop").forEach(function (modal) {
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

  function mountTopbar_() {
    const mount = document.getElementById("topbarMount");
    if (!mount) return;
    if (mount.children && mount.children.length) return;

    const title = (document.title || "")
      .replace("PRONTIO - ", "")
      .replace("PRONTIO — ", "")
      .trim();

    const subtitle = document.body.getAttribute("data-subtitle") || "";
    const tag = document.body.getAttribute("data-tag") || "";
    const context = document.body.getAttribute("data-context") || "";

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();

    mount.innerHTML = `
      <header class="topbar" data-component="topbar">
        <div class="topbar-col-left">
          <div class="topbar-left-header">
            <button type="button" class="icon-button topbar-menu-button js-toggle-sidebar" aria-label="Abrir menu de navegação">
              <svg viewBox="0 0 24 24" aria-hidden="true" class="icon-svg">
                <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" fill="currentColor" />
              </svg>
            </button>
            <div id="topbar-breadcrumb" class="topbar-breadcrumb"></div>
          </div>

          <div class="topbar-title-main">
            <h1 id="topbar-title-text">${escapeHtml_(title)}</h1>
            <span id="topbar-tag" class="topbar-tag">${escapeHtml_(tag)}</span>
          </div>

          <p id="topbar-subtitle" class="topbar-subtitle">${escapeHtml_(subtitle)}</p>
        </div>

        <div class="topbar-col-right">
          <div id="topbar-extra" class="topbar-extra"></div>

          <div class="topbar-meta">
            <span id="topbar-meta-date" class="topbar-meta-item">${dd}/${mm}/${yyyy}</span>
            <span id="topbar-meta-context" class="topbar-meta-item">${escapeHtml_(context)}</span>
          </div>

          <button id="btn-theme-toggle" class="theme-toggle-btn js-toggle-theme" title="Alternar tema" aria-pressed="false">
            <svg class="icon-svg js-theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m14.95-6.95l1.414-1.414M4.636 19.364l1.414-1.414M4.636 4.636L3.222 3.222M19.364 19.364l1.414 1.414" stroke="currentColor" fill="none"/>
            </svg>
            <svg class="icon-svg js-theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true" style="display:none">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" fill="none"/>
            </svg>
          </button>
        </div>
      </header>
    `;
  }

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

  function escapeHtml_(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ✅ valida sessão no backend usando Auth_Me (conforme seu Auth.gs)
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

  async function bootstrap_() {
    // ✅ 1) Infra primeiro
    await ensureApiLoaded_();
    await ensureAuthLoaded_();

    // ✅ 2) Guard local
    if (!isLoginPage_() && PRONTIO.auth && typeof PRONTIO.auth.requireAuth === "function") {
      const ok = PRONTIO.auth.requireAuth({ redirect: true });
      if (!ok) return;
    }

    // ✅ 3) Guard server-side (Auth_Me)
    const okSession = await ensureSessionIfAvailable_();
    if (!okSession) return;

    // ✅ 4) Só depois monta UI (evita "flash" em página protegida)
    if (!isLoginPage_()) {
      mountTopbar_();
      initSidebar_();
      initModals_();
      initThemeToggle_();
    }

    // ✅ 5) Logout + label
    if (!isLoginPage_() && PRONTIO.auth) {
      try {
        if (typeof PRONTIO.auth.bindLogoutButtons === "function") PRONTIO.auth.bindLogoutButtons();
        if (typeof PRONTIO.auth.renderUserLabel === "function") PRONTIO.auth.renderUserLabel();
      } catch (e) {}
    }

    const pageId = getPageId_();
    if (!pageId) return;

    if (!PRONTIO.pages[pageId]) {
      let ok = await loadOnce_("assets/js/pages/page-" + pageId + ".js");
      if (!ok) ok = await loadOnce_("assets/js/page-" + pageId + ".js");
    }

    if (pageId === "prontuario") {
      await loadOnce_("assets/js/pages/page-receita.js");
    }

    const page = PRONTIO.pages[pageId];
    if (page && typeof page.init === "function") {
      try { page.init(); } catch (e) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap_);
  } else {
    bootstrap_();
  }
})(window, document);
