// frontend/assets/js/ui/responsive-shell.js
// ============================================================
// PRONTIO - Shell Responsivo (Profissional)
// ============================================================
// Objetivo:
// - Sidebar off-canvas em telas estreitas (split screen).
// - Botão ☰ no topbar (injeção segura).
// - Overlay + ESC para fechar.
// - Não depende da estrutura interna da planilha / backend.
// ============================================================

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.ui = PRONTIO.ui || {};
  PRONTIO.ui.responsiveShell = PRONTIO.ui.responsiveShell || {};

  const BODY_OPEN_CLASS = "prontio-sidebar-open";
  const OVERLAY_ID = "prontioSidebarOverlay";
  const TOGGLE_BTN_ID = "prontioSidebarToggleBtn";

  function qs(sel, root) {
    try { return (root || document).querySelector(sel); } catch (_) { return null; }
  }

  function qsa(sel, root) {
    try { return Array.from((root || document).querySelectorAll(sel)); } catch (_) { return []; }
  }

  function ensureSidebarId_(sidebarEl) {
    if (!sidebarEl) return null;
    if (sidebarEl.id) return sidebarEl.id;
    sidebarEl.id = "prontioSidebar";
    return sidebarEl.id;
  }

  function findSidebar_() {
    // Tentativas comuns
    return (
      qs("#prontioSidebar") ||
      qs("#sidebar") ||
      qs("[data-sidebar]") ||
      qs("aside.sidebar") ||
      qs(".sidebar")
    );
  }

  function findTopbar_() {
    return qs(".topbar") || qs("#topbarMount .topbar") || qs("#topbarMount");
  }

  function ensureOverlay_() {
    let ov = document.getElementById(OVERLAY_ID);
    if (ov) return ov;

    ov = document.createElement("div");
    ov.id = OVERLAY_ID;
    ov.className = "prontio-sidebar-overlay";
    ov.setAttribute("aria-hidden", "true");
    ov.addEventListener("click", function () {
      closeSidebar_();
    });

    document.body.appendChild(ov);
    return ov;
  }

  function isOpen_() {
    return document.body.classList.contains(BODY_OPEN_CLASS);
  }

  function openSidebar_() {
    document.body.classList.add(BODY_OPEN_CLASS);
    const ov = ensureOverlay_();
    ov.setAttribute("aria-hidden", "false");
  }

  function closeSidebar_() {
    document.body.classList.remove(BODY_OPEN_CLASS);
    const ov = document.getElementById(OVERLAY_ID);
    if (ov) ov.setAttribute("aria-hidden", "true");
  }

  function toggleSidebar_() {
    if (isOpen_()) closeSidebar_();
    else openSidebar_();
  }

  function ensureToggleButton_() {
    // Se já existe no DOM, reaproveita
    let btn = document.getElementById(TOGGLE_BTN_ID);
    if (btn) return btn;

    const topbar = findTopbar_();
    if (!topbar) return null;

    // local para inserir: começo do topbar
    const container =
      qs(".topbar__left", topbar) ||
      qs(".topbar-left", topbar) ||
      topbar;

    btn = document.createElement("button");
    btn.id = TOGGLE_BTN_ID;
    btn.type = "button";
    btn.className = "prontio-sidebar-toggle";
    btn.setAttribute("aria-label", "Abrir menu");
    btn.setAttribute("aria-expanded", "false");

    // Ícone simples (sem dependência)
    btn.innerHTML = `
      <span class="prontio-sidebar-toggle__icon" aria-hidden="true">☰</span>
    `;

    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      toggleSidebar_();
      btn.setAttribute("aria-expanded", isOpen_() ? "true" : "false");
    });

    // Tenta inserir antes do primeiro elemento
    try {
      container.insertBefore(btn, container.firstChild);
    } catch (_) {
      try { topbar.insertBefore(btn, topbar.firstChild); } catch (_) {}
    }

    return btn;
  }

  function bindCloseOnEsc_() {
    if (document.body.getAttribute("data-prontio-esc-bound") === "1") return;
    document.body.setAttribute("data-prontio-esc-bound", "1");

    document.addEventListener("keydown", function (ev) {
      if (!ev) return;
      if (ev.key === "Escape" && isOpen_()) {
        closeSidebar_();
      }
    });
  }

  function bindAutoCloseOnNavClick_() {
    // Em telas pequenas: clicar em qualquer link dentro da sidebar fecha o menu
    const sidebar = findSidebar_();
    if (!sidebar) return;

    if (sidebar.getAttribute("data-prontio-autoclose-bound") === "1") return;
    sidebar.setAttribute("data-prontio-autoclose-bound", "1");

    sidebar.addEventListener("click", function (ev) {
      const t = ev && ev.target ? ev.target : null;
      if (!t) return;
      const a = t.closest ? t.closest("a") : null;
      if (!a) return;

      // fecha só se estiver aberto
      if (isOpen_()) closeSidebar_();
    });
  }

  function normalizeTables_() {
    // Ajuda UX: garante que tabelas possam rolar dentro do card em viewport estreita
    // Sem depender de classes específicas: aplica em containers comuns.
    const candidates = qsa(".card, .panel, .table-card, .content-card, .widget-card");
    candidates.forEach(function (card) {
      if (!card) return;
      const hasTable = !!qs("table", card);
      if (!hasTable) return;
      if (card.getAttribute("data-prontio-table-scroll") === "1") return;
      card.setAttribute("data-prontio-table-scroll", "1");
      card.classList.add("prontio-table-scroll");
    });
  }

  function init() {
    // trava
    if (PRONTIO.ui.responsiveShell._inited === true) return;
    PRONTIO.ui.responsiveShell._inited = true;

    // Sidebar e overlay
    const sidebar = findSidebar_();
    if (sidebar) ensureSidebarId_(sidebar);
    ensureOverlay_();
    ensureToggleButton_();
    bindCloseOnEsc_();
    bindAutoCloseOnNavClick_();

    // Ajuste de tabelas (best-effort)
    normalizeTables_();

    // Re-aplica quando widgets carregarem (topbar/sidebar async)
    let tries = 0;
    const timer = global.setInterval(function () {
      tries += 1;
      ensureToggleButton_();
      bindAutoCloseOnNavClick_();
      normalizeTables_();
      if (tries >= 12) global.clearInterval(timer);
    }, 350);
  }

  PRONTIO.ui.responsiveShell.init = init;
  PRONTIO.ui.responsiveShell.open = openSidebar_;
  PRONTIO.ui.responsiveShell.close = closeSidebar_;
  PRONTIO.ui.responsiveShell.toggle = toggleSidebar_;

})(window, document);
