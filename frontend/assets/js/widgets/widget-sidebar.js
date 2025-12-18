// =====================================
// PRONTIO - ui/sidebar.js
// Controle da sidebar (menu lateral) do PRONTIO.
//
// Desktop:
//  - Sempre inicia com modo "compacto" restaurado do localStorage.
//  - Botão .js-toggle-compact alterna body.sidebar-compact (recolhe/expande).
//
// Mobile (max-width: 900px):
//  - Sidebar funciona como drawer (off-canvas), controlado por body.sidebar-open.
//  - Botão .js-toggle-sidebar (na topbar) abre/fecha o drawer.
//  - Botão .js-toggle-compact também atua como toggle do drawer em mobile.
//  - Clicar no backdrop ou em um link do menu fecha o drawer.
//
// Em todas as larguras:
//  - Destaca o link ativo com base em data-page-id do <body>.
//  - PRONTUÁRIO só aparece quando body.dataset.hasProntuario === "true".
//
// Observação:
//  - Tema claro/escuro é responsabilidade da TOPBAR (não desta sidebar).
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.widgets = PRONTIO.widgets || {};
  PRONTIO.ui = PRONTIO.ui || {};

  const STORAGE_KEY_COMPACT = "prontio.sidebar.compact";

  function getSidebarElement() {
    return document.getElementById("sidebar");
  }

  /* -------- helpers de estado compacto (desktop) -------- */

  /**
   * Aplica estado compacto / expandido usando APENAS body.sidebar-compact.
   * @param {boolean} isCompactFlag
   */
  function setCompact(isCompactFlag) {
    const body = document.body;
    if (!body) return;

    if (isCompactFlag) {
      body.classList.add("sidebar-compact");
    } else {
      body.classList.remove("sidebar-compact");
    }
  }

  function isCompact() {
    const body = document.body;
    if (!body) return false;
    return body.classList.contains("sidebar-compact");
  }

  /**
   * Ajusta aria-pressed no botão de toggle compacto.
   * @param {HTMLElement} btn
   * @param {boolean} isCompactFlag
   */
  function syncToggleButtonAria(btn, isCompactFlag) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", isCompactFlag ? "true" : "false");
  }

  function loadCompactFromStorage() {
    try {
      if (!global.localStorage) return false;
      const stored = global.localStorage.getItem(STORAGE_KEY_COMPACT);
      return stored === "1";
    } catch (e) {
      return false;
    }
  }

  function saveCompactToStorage(isCompactFlag) {
    try {
      if (!global.localStorage) return;
      global.localStorage.setItem(STORAGE_KEY_COMPACT, isCompactFlag ? "1" : "0");
    } catch (e) {
      // ambiente sem localStorage (ex.: modo privado extremamente restrito) -> ignorar
    }
  }

  /* -------- helpers de drawer (mobile) -------- */

  function openDrawer() {
    const body = document.body;
    if (!body) return;
    body.classList.add("sidebar-open");
  }

  function closeDrawer() {
    const body = document.body;
    if (!body) return;
    body.classList.remove("sidebar-open");
  }

  function toggleDrawer() {
    const body = document.body;
    if (!body) return;
    const open = body.classList.contains("sidebar-open");
    if (open) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  /* -------- destacar link ativo -------- */

  /**
   * Destaca o link ativo conforme data-page-id do <body>.
   * Usa classe .active e aria-current="page".
   */
  function highlightActiveNavLink(sidebar) {
    if (!sidebar || !document.body) return;

    const pageId = document.body.dataset.pageId || "";
    if (!pageId) return;

    const links = sidebar.querySelectorAll(".nav-link[data-page-id]");
    links.forEach(function (link) {
      const linkPageId = link.getAttribute("data-page-id") || "";
      const isActiveLink = linkPageId === pageId;

      if (isActiveLink) {
        link.classList.add("active");
        if (!link.hasAttribute("aria-current")) {
          link.setAttribute("aria-current", "page");
        }
      } else {
        link.classList.remove("active");
        if (link.getAttribute("aria-current") === "page") {
          link.removeAttribute("aria-current");
        }
      }
    });
  }

  /* -------- visibilidade do PRONTUÁRIO -------- */

  /**
   * Mostra/oculta o item PRONTUÁRIO conforme body.dataset.hasProntuario.
   * Esperado:
   *   <body data-has-prontuario="true"> quando um paciente estiver aberto.
   */
  function updateProntuarioVisibility(sidebar) {
    if (!sidebar || !document.body) return;

    const link = sidebar.querySelector("[data-nav-section='prontuario']");
    if (!link) return;

    const hasProntuario =
      document.body.dataset && document.body.dataset.hasProntuario === "true";

    link.style.display = hasProntuario ? "" : "none";
  }

  /* -------- tratar ações especiais (Sistema) -------- */

  function setupSystemActions(sidebar) {
    if (!sidebar) return;

    // Ações do grupo SISTEMA que tenham data-nav-target
    // (vamos usar isso só para "tema"; "sobre" fica com data-modal-open)
    const systemButtons = sidebar.querySelectorAll(
      ".sidebar-group [data-nav-target]"
    );

    systemButtons.forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        const target = btn.getAttribute("data-nav-target");
        if (!target) return;

        // Se existir um handler global, usamos
        if (PRONTIO.ui && typeof PRONTIO.ui.handleSystemNav === "function") {
          PRONTIO.ui.handleSystemNav(target);
        } else {
          // Fallback padrão:
          // - "tema" agora apenas aciona o botão de tema da TOPBAR
          if (target === "tema") {
            event.preventDefault();
            const themeBtn = document.getElementById("btn-theme-toggle");
            if (themeBtn && typeof themeBtn.click === "function") {
              themeBtn.click();
            }
          }

          // "sobre" NÃO é mais tratado aqui.
          // Ele deve usar data-modal-open="modalSobreSistema"
          // + sistema de modais (ui/modals.js / widget-modais.js).
        }

        const isMobile = global.matchMedia("(max-width: 900px)").matches;
        if (isMobile) {
          closeDrawer();
        }
      });
    });

    // Ação "Sair"
    const logoutBtn = sidebar.querySelector("[data-nav-action='logout']");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        if (PRONTIO.ui && typeof PRONTIO.ui.handleLogout === "function") {
          PRONTIO.ui.handleLogout();
        } else {
          // fallback: confirm + redirecionamento simples (página de login futura)
          const ok = global.confirm("Deseja realmente sair do PRONTIO?");
          if (ok) {
            // ajuste a URL quando houver tela de login
            global.location.href = "index.html";
          }
        }

        const isMobile = global.matchMedia("(max-width: 900px)").matches;
        if (isMobile) {
          closeDrawer();
        }
      });
    }
  }

  // -----------------------------------------------------
  // Inicializador público
  // -----------------------------------------------------

  function initSidebar() {
    const sidebar = getSidebarElement();
    if (!sidebar) {
      console.warn("PRONTIO.sidebar: #sidebar não encontrado.");
      return;
    }

    const body = document.body;
    if (!body) {
      console.warn("PRONTIO.sidebar: document.body não disponível.");
      return;
    }

    // Estado inicial global:
    // - drawer fechado
    body.classList.remove("sidebar-open");

    // Estado compacto padrão: expandido (false),
    // mas se houver valor em localStorage, usamos ele.
    const initialCompact = loadCompactFromStorage();
    setCompact(initialCompact);

    // 1) Botão de modo compacto (desktop) / toggle drawer (mobile)
    const btnCompact = sidebar.querySelector(".js-toggle-compact");
    if (btnCompact) {
      // Sincroniza ARIA com estado inicial
      syncToggleButtonAria(btnCompact, initialCompact);

      btnCompact.addEventListener("click", function () {
        const isMobile = global.matchMedia("(max-width: 900px)").matches;

        // Em mobile, esse botão atua como toggle do drawer
        if (isMobile) {
          toggleDrawer();
          return;
        }

        // Desktop: alterna modo compacto + salva estado
        const next = !isCompact();
        setCompact(next);
        syncToggleButtonAria(btnCompact, next);
        saveCompactToStorage(next);
      });
    }

    // 2) Botões .js-toggle-sidebar (normalmente na topbar)
    const toggleSidebarButtons = document.querySelectorAll(".js-toggle-sidebar");
    toggleSidebarButtons.forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        toggleDrawer();
      });
    });

    // 3) Backdrop do drawer (fecha ao clicar)
    const backdrop = document.querySelector("[data-sidebar-backdrop]");
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        closeDrawer();
      });
    }

    // 4) Ao clicar em qualquer item de menu, fecha o drawer em mobile
    const navLinks = sidebar.querySelectorAll(".nav-link");
    navLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        const isMobile = global.matchMedia("(max-width: 900px)").matches;
        if (isMobile) {
          closeDrawer();
        }
      });
    });

    // 5) Destacar link ativo
    highlightActiveNavLink(sidebar);

    // 6) Visibilidade do PRONTUÁRIO (dinâmico)
    updateProntuarioVisibility(sidebar);

    // 7) Ações especiais do grupo SISTEMA
    setupSystemActions(sidebar);

    console.log(
      "PRONTIO.sidebar: initSidebar concluído. Compacto? =",
      isCompact(),
      "| Drawer aberto? =",
      body.classList.contains("sidebar-open")
    );
  }

  // -----------------------------------------------------
  // Registro no namespace PRONTIO (padrão widgets)
  // -----------------------------------------------------

  PRONTIO.widgets.sidebar = {
    init: initSidebar
  };

  // Retrocompat: window.initSidebar e PRONTIO.ui.sidebar.init
  try {
    PRONTIO.ui.sidebar = PRONTIO.ui.sidebar || {};
    PRONTIO.ui.sidebar.init = initSidebar;

    // função global antiga, se alguma página ainda chamar direto
    global.initSidebar = global.initSidebar || initSidebar;
  } catch (e) {
    // ambiente sem window (ex.: testes), ignorar
  }
})(window, document);
