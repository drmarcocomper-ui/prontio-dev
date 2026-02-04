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
//  - Botão de menu (topbar) abre/fecha o drawer.
//  - Botão .js-toggle-compact também atua como toggle do drawer em mobile.
//  - Clicar no backdrop ou em um link do menu fecha o drawer.
//  - ✅ Swipe gestures para abrir/fechar
//
// Em todas as larguras:
//  - Destaca o link ativo com base em data-page-id do <body>.
//  - PRONTUÁRIO só aparece quando body.dataset.hasProntuario === "true".
//
// Observação:
//  - Tema claro/escuro é responsabilidade da TOPBAR (não desta sidebar).
//
// ✅ Funcionalidades:
//  - Event delegation para toggle do drawer
//  - Tooltips no modo compacto (data-tooltip)
//  - Keyboard navigation (setas, Home, End, Escape)
//  - Accessibility (aria-label dinâmico)
//  - Swipe gestures (mobile)
//  - Submenu colapsável
//  - Badges de notificação (API)
// =====================================

(function (global, document) {
  var PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.widgets = PRONTIO.widgets || {};
  PRONTIO.ui = PRONTIO.ui || {};

  var STORAGE_KEY_COMPACT = "prontio.sidebar.compact";
  var MOBILE_MEDIA = "(max-width: 900px)";
  var DOC_FLAG_DELEGATION_BOUND = "prontioSidebarDelegationBound";
  var DOC_FLAG_KEYBOARD_BOUND = "prontioSidebarKeyboardBound";
  var DOC_FLAG_SWIPE_BOUND = "prontioSidebarSwipeBound";

  // Swipe config
  var SWIPE_THRESHOLD = 50;
  var SWIPE_EDGE_ZONE = 30;

  function getSidebarElement() {
    return document.getElementById("sidebar");
  }

  function isMobile_() {
    return !!(global.matchMedia && global.matchMedia(MOBILE_MEDIA).matches);
  }

  /* -------- helpers de estado compacto (desktop) -------- */

  function setCompact(isCompactFlag) {
    var body = document.body;
    if (!body) return;

    if (isCompactFlag) {
      body.classList.add("sidebar-compact");
    } else {
      body.classList.remove("sidebar-compact");
    }

    // Atualiza aria-label dos links quando muda modo compacto
    updateAriaLabels_();
  }

  function isCompact() {
    var body = document.body;
    if (!body) return false;
    return body.classList.contains("sidebar-compact");
  }

  function isDrawerOpen() {
    var body = document.body;
    if (!body) return false;
    return body.classList.contains("sidebar-open");
  }

  function syncToggleButtonAria(btn, isCompactFlag) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", isCompactFlag ? "true" : "false");
    btn.setAttribute("aria-label", isCompactFlag ? "Expandir menu" : "Recolher menu");
  }

  function loadCompactFromStorage() {
    try {
      if (!global.localStorage) return false;
      var stored = global.localStorage.getItem(STORAGE_KEY_COMPACT);
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
      // ambiente sem localStorage -> ignorar
    }
  }

  /* -------- helpers de drawer (mobile) -------- */

  function openDrawer() {
    var body = document.body;
    if (!body) return;
    body.classList.add("sidebar-open");

    // Announce to screen readers
    var sidebar = getSidebarElement();
    if (sidebar) {
      sidebar.setAttribute("aria-hidden", "false");
    }
  }

  function closeDrawer() {
    var body = document.body;
    if (!body) return;
    body.classList.remove("sidebar-open");

    var sidebar = getSidebarElement();
    if (sidebar && isMobile_()) {
      sidebar.setAttribute("aria-hidden", "true");
    }
  }

  function toggleDrawer() {
    var body = document.body;
    if (!body) return;
    var open = body.classList.contains("sidebar-open");
    if (open) closeDrawer();
    else openDrawer();
  }

  /* -------- swipe gestures (mobile) -------- */

  function setupSwipeGestures_() {
    if (!document || !document.documentElement) return;

    // Idempotência
    if (document.documentElement.dataset[DOC_FLAG_SWIPE_BOUND] === "1") return;
    document.documentElement.dataset[DOC_FLAG_SWIPE_BOUND] = "1";

    var touchStartX = 0;
    var touchStartY = 0;
    var touchEndX = 0;
    var touchEndY = 0;
    var isSwiping = false;

    document.addEventListener("touchstart", function (ev) {
      if (!isMobile_()) return;

      var touch = ev.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      isSwiping = false;

      // Só permite swipe da borda esquerda para abrir
      // ou de qualquer lugar para fechar se o drawer está aberto
      var isFromEdge = touchStartX <= SWIPE_EDGE_ZONE;
      var drawerOpen = isDrawerOpen();

      if (isFromEdge || drawerOpen) {
        isSwiping = true;
      }
    }, { passive: true });

    document.addEventListener("touchmove", function (ev) {
      if (!isSwiping || !isMobile_()) return;

      var touch = ev.touches[0];
      touchEndX = touch.clientX;
      touchEndY = touch.clientY;
    }, { passive: true });

    document.addEventListener("touchend", function () {
      if (!isSwiping || !isMobile_()) return;

      var deltaX = touchEndX - touchStartX;
      var deltaY = touchEndY - touchStartY;

      // Só considera swipe horizontal (deltaX > deltaY)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
        var drawerOpen = isDrawerOpen();

        if (deltaX > 0 && !drawerOpen) {
          // Swipe right: abrir drawer
          openDrawer();
        } else if (deltaX < 0 && drawerOpen) {
          // Swipe left: fechar drawer
          closeDrawer();
        }
      }

      // Reset
      touchStartX = 0;
      touchStartY = 0;
      touchEndX = 0;
      touchEndY = 0;
      isSwiping = false;
    }, { passive: true });
  }

  /* -------- destacar link ativo -------- */

  function highlightActiveNavLink(sidebar) {
    if (!sidebar || !document.body) return;

    var pageId = document.body.dataset.pageId || "";
    if (!pageId) return;

    var links = sidebar.querySelectorAll(".nav-link[data-page-id]");
    links.forEach(function (link) {
      var linkPageId = link.getAttribute("data-page-id") || "";
      var isActiveLink = linkPageId === pageId;

      if (isActiveLink) {
        link.classList.add("active");
        link.classList.add("is-active");
        link.setAttribute("data-active", "true");
        if (!link.hasAttribute("aria-current")) {
          link.setAttribute("aria-current", "page");
        }

        // Se está em submenu, expandir o submenu pai
        var submenu = link.closest(".sidebar-submenu");
        if (submenu) {
          submenu.classList.add("is-open");
          var parent = submenu.previousElementSibling;
          if (parent && parent.classList.contains("nav-link-parent")) {
            parent.setAttribute("aria-expanded", "true");
          }
        }
      } else {
        link.classList.remove("active");
        link.classList.remove("is-active");
        link.removeAttribute("data-active");
        if (link.getAttribute("aria-current") === "page") {
          link.removeAttribute("aria-current");
        }
      }
    });
  }

  /* -------- visibilidade do PRONTUÁRIO -------- */

  function updateProntuarioVisibility(sidebar) {
    if (!sidebar || !document.body) return;

    var link = sidebar.querySelector("[data-nav-section='prontuario']");
    if (!link) return;

    var hasProntuario =
      document.body.dataset && document.body.dataset.hasProntuario === "true";

    link.style.display = hasProntuario ? "" : "none";
  }

  /* -------- tratar ações especiais (Sistema) -------- */

  function setupSystemActions(sidebar) {
    if (!sidebar) return;

    // Ação "Sair"
    var logoutBtn = sidebar.querySelector("[data-nav-action='logout']");
    if (logoutBtn) {
      if (logoutBtn.getAttribute("data-sidebar-logout-bound") === "1") return;
      logoutBtn.setAttribute("data-sidebar-logout-bound", "1");

      logoutBtn.addEventListener("click", function () {
        if (isMobile_()) closeDrawer();
      });
    }
  }

  /* -------- submenu colapsável -------- */

  function setupSubmenus_(sidebar) {
    if (!sidebar) return;

    var parentLinks = sidebar.querySelectorAll(".nav-link-parent");

    parentLinks.forEach(function (parent) {
      if (parent.getAttribute("data-submenu-bound") === "1") return;
      parent.setAttribute("data-submenu-bound", "1");

      // Estado inicial
      if (!parent.hasAttribute("aria-expanded")) {
        parent.setAttribute("aria-expanded", "false");
      }

      parent.addEventListener("click", function (ev) {
        ev.preventDefault();

        // Em modo compacto, não permite expandir submenu
        if (isCompact() && !isMobile_()) return;

        var expanded = parent.getAttribute("aria-expanded") === "true";
        var submenu = parent.nextElementSibling;

        if (submenu && submenu.classList.contains("sidebar-submenu")) {
          if (expanded) {
            submenu.classList.remove("is-open");
            parent.setAttribute("aria-expanded", "false");
          } else {
            submenu.classList.add("is-open");
            parent.setAttribute("aria-expanded", "true");
          }
        }
      });
    });
  }

  /* -------- event delegation: toggle sidebar (topbar) -------- */

  function bindGlobalSidebarToggleDelegation_() {
    if (!document || !document.documentElement) return;

    // Idempotência global: 1 listener por página
    if (document.documentElement.dataset[DOC_FLAG_DELEGATION_BOUND] === "1") return;
    document.documentElement.dataset[DOC_FLAG_DELEGATION_BOUND] = "1";

    document.addEventListener("click", function (ev) {
      var target = ev.target;

      var trigger =
        target && target.closest
          ? target.closest("[data-sidebar-toggle], .js-toggle-sidebar")
          : null;

      if (!trigger) return;

      // Só faz sentido no comportamento de drawer em mobile.
      if (!isMobile_()) return;

      ev.preventDefault();
      toggleDrawer();
    });
  }

  /* -------- bloquear itens "Em breve" (defensivo) -------- */

  function setupSoonLinks(sidebar) {
    if (!sidebar) return;

    var soonLinks = sidebar.querySelectorAll(
      ".nav-link[data-soon='true'], .nav-link[aria-disabled='true']"
    );

    soonLinks.forEach(function (el) {
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      });
    });
  }

  /* -------- versão do app -------- */

  function applyAppVersion_(sidebar) {
    if (!sidebar) return;

    var el = sidebar.querySelector("#appVersion");
    if (!el) return;

    try {
      var v = (global.PRONTIO && global.PRONTIO.APP_VERSION) ? String(global.PRONTIO.APP_VERSION) : "";
      if (v) el.textContent = "v" + v;
    } catch (_) {}
  }

  /* -------- ano atual no footer -------- */

  function applyCurrentYear_(sidebar) {
    if (!sidebar) return;

    var el = sidebar.querySelector("#anoAtualSidebar");
    if (!el) return;

    try {
      el.textContent = String(new Date().getFullYear());
    } catch (_) {}
  }

  /* -------- tooltips para modo compacto -------- */

  function setupTooltips_(sidebar) {
    if (!sidebar) return;

    // Links da navegação principal
    var navLinks = sidebar.querySelectorAll(".sidebar-nav .nav-link");
    navLinks.forEach(function (link) {
      var label = link.querySelector(".label");
      if (label && label.textContent) {
        link.setAttribute("data-tooltip", label.textContent.trim());
      }
    });

    // Links do grupo Sistema (exceto Sair que mostra label)
    var groupLinks = sidebar.querySelectorAll(".sidebar-group .nav-link-sub");
    groupLinks.forEach(function (link) {
      var label = link.querySelector(".label");
      if (label && label.textContent) {
        link.setAttribute("data-tooltip", label.textContent.trim());
      }
    });
  }

  /* -------- aria-labels dinâmicos -------- */

  function updateAriaLabels_() {
    var sidebar = getSidebarElement();
    if (!sidebar) return;

    var compact = isCompact();

    // Links da navegação principal
    var navLinks = sidebar.querySelectorAll(".sidebar-nav .nav-link, .sidebar-group .nav-link-sub");
    navLinks.forEach(function (link) {
      var label = link.querySelector(".label");
      if (!label) return;

      var text = label.textContent.trim();
      if (!text) return;

      if (compact) {
        // Em modo compacto, adiciona aria-label para leitores de tela
        link.setAttribute("aria-label", text);
      } else {
        // Em modo expandido, remove aria-label (texto já visível)
        link.removeAttribute("aria-label");
      }
    });
  }

  /* -------- keyboard navigation -------- */

  function setupKeyboardNavigation_(sidebar) {
    if (!sidebar) return;

    // Idempotência
    if (document.documentElement.dataset[DOC_FLAG_KEYBOARD_BOUND] === "1") return;
    document.documentElement.dataset[DOC_FLAG_KEYBOARD_BOUND] = "1";

    sidebar.addEventListener("keydown", function (ev) {
      var target = ev.target;
      if (!target) return;

      // Só processa se o foco estiver em um link/botão da sidebar
      var isNavItem = target.matches(".nav-link, .nav-link-sub, .nav-link-action");
      if (!isNavItem) return;

      var key = ev.key;
      var handled = false;

      // Coleta todos os itens navegáveis (visíveis)
      var allItems = Array.from(
        sidebar.querySelectorAll(".nav-link:not([style*='display: none']), .nav-link-sub, .nav-link-action")
      ).filter(function (el) {
        // Filtra elementos ocultos
        return el.offsetParent !== null;
      });

      var currentIndex = allItems.indexOf(target);
      if (currentIndex === -1) return;

      switch (key) {
        case "ArrowDown":
        case "Down":
          // Próximo item
          if (currentIndex < allItems.length - 1) {
            allItems[currentIndex + 1].focus();
            handled = true;
          }
          break;

        case "ArrowUp":
        case "Up":
          // Item anterior
          if (currentIndex > 0) {
            allItems[currentIndex - 1].focus();
            handled = true;
          }
          break;

        case "Home":
          // Primeiro item
          if (allItems.length > 0) {
            allItems[0].focus();
            handled = true;
          }
          break;

        case "End":
          // Último item
          if (allItems.length > 0) {
            allItems[allItems.length - 1].focus();
            handled = true;
          }
          break;

        case "Escape":
          // Fecha drawer em mobile
          if (isMobile_()) {
            closeDrawer();
            handled = true;
          }
          break;

        case "ArrowRight":
        case "Right":
          // Expandir submenu
          if (target.classList.contains("nav-link-parent")) {
            var submenu = target.nextElementSibling;
            if (submenu && submenu.classList.contains("sidebar-submenu")) {
              submenu.classList.add("is-open");
              target.setAttribute("aria-expanded", "true");
              var firstChild = submenu.querySelector(".nav-link");
              if (firstChild) firstChild.focus();
              handled = true;
            }
          }
          break;

        case "ArrowLeft":
        case "Left":
          // Colapsar submenu ou voltar ao pai
          var parentSubmenu = target.closest(".sidebar-submenu");
          if (parentSubmenu) {
            var parentLink = parentSubmenu.previousElementSibling;
            if (parentLink && parentLink.classList.contains("nav-link-parent")) {
              parentSubmenu.classList.remove("is-open");
              parentLink.setAttribute("aria-expanded", "false");
              parentLink.focus();
              handled = true;
            }
          }
          break;
      }

      if (handled) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    });
  }

  /* -------- API de badges de notificação -------- */

  function setBadge(pageId, count, options) {
    var sidebar = getSidebarElement();
    if (!sidebar) return;

    options = options || {};
    var pulse = options.pulse || false;

    var link = sidebar.querySelector(".nav-link[data-page-id='" + pageId + "']");
    if (!link) return;

    var badge = link.querySelector(".nav-notification-badge");

    if (count <= 0) {
      // Remover badge
      if (badge) badge.remove();
      return;
    }

    if (!badge) {
      // Criar badge
      badge = document.createElement("span");
      badge.className = "nav-notification-badge";
      link.appendChild(badge);
    }

    // Atualizar valor
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.setAttribute("data-count", String(count));

    // Pulse animation
    if (pulse) {
      badge.setAttribute("data-pulse", "true");
    } else {
      badge.removeAttribute("data-pulse");
    }
  }

  function clearBadge(pageId) {
    setBadge(pageId, 0);
  }

  function clearAllBadges() {
    var sidebar = getSidebarElement();
    if (!sidebar) return;

    var badges = sidebar.querySelectorAll(".nav-notification-badge");
    badges.forEach(function (badge) {
      badge.remove();
    });
  }

  // -----------------------------------------------------
  // Inicializador público (idempotente)
  // -----------------------------------------------------

  function initSidebar() {
    var sidebar = getSidebarElement();
    if (!sidebar) {
      console.warn("PRONTIO.sidebar: #sidebar não encontrado.");
      return;
    }

    var body = document.body;
    if (!body) {
      console.warn("PRONTIO.sidebar: document.body não disponível.");
      return;
    }

    // ✅ Delegation do toggle do menu é global e não depende do DOM pronto
    bindGlobalSidebarToggleDelegation_();

    // ✅ Swipe gestures (mobile)
    setupSwipeGestures_();

    // Idempotência: não duplicar listeners se init for chamado novamente
    if (sidebar.dataset && sidebar.dataset.sidebarInited === "true") {
      highlightActiveNavLink(sidebar);
      updateProntuarioVisibility(sidebar);
      applyAppVersion_(sidebar);
      applyCurrentYear_(sidebar);
      updateAriaLabels_();
      return;
    }
    sidebar.dataset.sidebarInited = "true";

    // Estado inicial global: drawer fechado
    body.classList.remove("sidebar-open");

    // Em mobile, sidebar começa como aria-hidden
    if (isMobile_()) {
      sidebar.setAttribute("aria-hidden", "true");
    }

    // Estado compacto padrão: restaurado do storage
    var initialCompact = loadCompactFromStorage();
    setCompact(initialCompact);

    // Botão de modo compacto (desktop) / toggle drawer (mobile)
    var btnCompact = sidebar.querySelector(".js-toggle-compact");
    if (btnCompact) {
      syncToggleButtonAria(btnCompact, initialCompact);

      btnCompact.addEventListener("click", function () {
        if (isMobile_()) {
          toggleDrawer();
          return;
        }

        var next = !isCompact();
        setCompact(next);
        syncToggleButtonAria(btnCompact, next);
        saveCompactToStorage(next);
      });
    }

    // Backdrop do drawer (fecha ao clicar)
    var backdrop = document.querySelector("[data-sidebar-backdrop]");
    if (backdrop) {
      if (!(backdrop.dataset && backdrop.dataset.sidebarBackdropBound === "true")) {
        backdrop.dataset.sidebarBackdropBound = "true";
        backdrop.addEventListener("click", function () {
          closeDrawer();
        });
      }
    }

    // Ao clicar em qualquer item de menu, fecha o drawer em mobile
    var navLinks = sidebar.querySelectorAll(".nav-link:not(.nav-link-parent)");
    navLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        if (!isMobile_()) return;

        var isDisabled =
          link.getAttribute("aria-disabled") === "true" ||
          link.getAttribute("data-soon") === "true";

        if (!isDisabled) closeDrawer();
      });
    });

    highlightActiveNavLink(sidebar);
    updateProntuarioVisibility(sidebar);
    setupSystemActions(sidebar);
    setupSoonLinks(sidebar);

    // ✅ versão dinâmica
    applyAppVersion_(sidebar);

    // ✅ ano atual no footer
    applyCurrentYear_(sidebar);

    // ✅ tooltips para modo compacto
    setupTooltips_(sidebar);

    // ✅ aria-labels dinâmicos
    updateAriaLabels_();

    // ✅ keyboard navigation
    setupKeyboardNavigation_(sidebar);

    // ✅ submenus colapsáveis
    setupSubmenus_(sidebar);
  }

  // API pública
  PRONTIO.widgets.sidebar = {
    init: initSidebar,
    setBadge: setBadge,
    clearBadge: clearBadge,
    clearAllBadges: clearAllBadges,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    toggleDrawer: toggleDrawer,
    setCompact: setCompact,
    isCompact: isCompact
  };

  // Retrocompat
  try {
    PRONTIO.ui.sidebar = PRONTIO.ui.sidebar || {};
    PRONTIO.ui.sidebar.init = initSidebar;
    PRONTIO.ui.sidebar.setBadge = setBadge;
    PRONTIO.ui.sidebar.clearBadge = clearBadge;
    global.initSidebar = global.initSidebar || initSidebar;
  } catch (e) {}
})(window, document);
