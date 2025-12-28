// frontend/assets/js/ui/responsive-shell.js
// ============================================================
// PRONTIO - Shell Responsivo (Profissional)
// ============================================================
// Ajustes desta versão:
// ✅ 1 toggle profissional (topbar ou fallback fixo)
// ✅ Não cria duplicado se já existir botão equivalente
// ✅ Se topbar não existir ainda, cria botão FIXO (sempre visível)
// ✅ Overlay + ESC + clique fora
// ============================================================

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.ui = PRONTIO.ui || {};
  PRONTIO.ui.responsiveShell = PRONTIO.ui.responsiveShell || {};

  const BODY_OPEN_CLASS = "prontio-sidebar-open";
  const OVERLAY_ID = "prontioSidebarOverlay";
  const TOGGLE_BTN_ID = "prontioSidebarToggleBtn";
  const FIXED_BTN_ID = "prontioSidebarToggleBtnFixed";

  function qs(sel, root) {
    try { return (root || document).querySelector(sel); } catch (_) { return null; }
  }

  function findSidebar_() {
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
    syncToggleAria_();
  }

  function closeSidebar_() {
    document.body.classList.remove(BODY_OPEN_CLASS);
    const ov = document.getElementById(OVERLAY_ID);
    if (ov) ov.setAttribute("aria-hidden", "true");
    syncToggleAria_();
  }

  function toggleSidebar_() {
    if (isOpen_()) closeSidebar_();
    else openSidebar_();
  }

  function syncToggleAria_() {
    const btn1 = document.getElementById(TOGGLE_BTN_ID);
    const btn2 = document.getElementById(FIXED_BTN_ID);
    const expanded = isOpen_() ? "true" : "false";
    if (btn1) btn1.setAttribute("aria-expanded", expanded);
    if (btn2) btn2.setAttribute("aria-expanded", expanded);
  }

  // Se o projeto já tiver um botão “hamburger” no topbar, usamos ele (evita duplicado)
  function findExistingTopbarToggle_() {
    const topbar = findTopbar_();
    if (!topbar) return null;

    // seletores comuns (bastante tolerante)
    return (
      qs("#" + TOGGLE_BTN_ID, topbar) ||
      qs('[data-nav-action="toggle-sidebar"]', topbar) ||
      qs('[data-action="toggle-sidebar"]', topbar) ||
      qs(".js-sidebar-toggle", topbar) ||
      qs(".sidebar-toggle", topbar) ||
      qs('button[aria-label*="menu" i]', topbar)
    );
  }

  function wireToggle_(btn) {
    if (!btn) return;
    if (btn.getAttribute("data-prontio-toggle-bound") === "1") return;
    btn.setAttribute("data-prontio-toggle-bound", "1");

    btn.addEventListener("click", function (ev) {
      try { ev.preventDefault(); } catch (_) {}
      toggleSidebar_();
    });

    // aria
    if (!btn.getAttribute("aria-label")) btn.setAttribute("aria-label", "Abrir menu");
    btn.setAttribute("aria-expanded", isOpen_() ? "true" : "false");
  }

  function ensureTopbarToggleButton_() {
    // 1) se já existe um botão equivalente no topbar, usa ele e NÃO cria outro
    const existing = findExistingTopbarToggle_();
    if (existing && existing.id !== TOGGLE_BTN_ID) {
      wireToggle_(existing);
      return existing;
    }

    // 2) se já criamos, retorna
    let btn = document.getElementById(TOGGLE_BTN_ID);
    if (btn) return btn;

    const topbar = findTopbar_();
    if (!topbar) return null;

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
    btn.innerHTML = `<span class="prontio-sidebar-toggle__icon" aria-hidden="true">☰</span>`;

    wireToggle_(btn);

    try { container.insertBefore(btn, container.firstChild); }
    catch (_) { try { topbar.insertBefore(btn, topbar.firstChild); } catch (_) {} }

    return btn;
  }

  // Fallback: se não existe topbar (ou ainda não carregou), cria botão fixo sempre visível
  function ensureFixedToggleButton_() {
    // se já existe topbar, não precisa do fixo
    if (findTopbar_()) {
      const fixed = document.getElementById(FIXED_BTN_ID);
      if (fixed && fixed.parentNode) fixed.parentNode.removeChild(fixed);
      return null;
    }

    let btn = document.getElementById(FIXED_BTN_ID);
    if (btn) return btn;

    btn = document.createElement("button");
    btn.id = FIXED_BTN_ID;
    btn.type = "button";
    btn.className = "prontio-sidebar-toggle prontio-sidebar-toggle--fixed";
    btn.setAttribute("aria-label", "Abrir menu");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = `<span class="prontio-sidebar-toggle__icon" aria-hidden="true">☰</span>`;

    wireToggle_(btn);

    document.body.appendChild(btn);
    return btn;
  }

  function bindCloseOnEsc_() {
    if (document.body.getAttribute("data-prontio-esc-bound") === "1") return;
    document.body.setAttribute("data-prontio-esc-bound", "1");

    document.addEventListener("keydown", function (ev) {
      if (!ev) return;
      if (ev.key === "Escape" && isOpen_()) closeSidebar_();
    });
  }

  function init() {
    if (PRONTIO.ui.responsiveShell._inited === true) return;
    PRONTIO.ui.responsiveShell._inited = true;

    ensureOverlay_();
    bindCloseOnEsc_();

    // tenta criar/usar o botão no topbar; se não existir topbar ainda, cria fixo
    ensureTopbarToggleButton_();
    ensureFixedToggleButton_();

    // re-tenta algumas vezes porque topbar/sidebar costumam carregar async
    let tries = 0;
    const timer = global.setInterval(function () {
      tries += 1;
      ensureTopbarToggleButton_();
      ensureFixedToggleButton_();
      if (tries >= 16) global.clearInterval(timer);
    }, 300);
  }

  PRONTIO.ui.responsiveShell.init = init;
  PRONTIO.ui.responsiveShell.open = openSidebar_;
  PRONTIO.ui.responsiveShell.close = closeSidebar_;
  PRONTIO.ui.responsiveShell.toggle = toggleSidebar_;

})(window, document);
