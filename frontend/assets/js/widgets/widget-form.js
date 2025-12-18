// assets/js/forms.js
// Lógica genérica de drawers para formulários (ou qualquer conteúdo)
//
// Convenção:
// - Container do drawer:  <div class="drawer" data-drawer="agenda">...</div>
// - Botão que abre:       <button data-drawer-open="agenda">...</button>
// - Overlay interno:      <div data-drawer-overlay></div>
// - Botões de fechar:     qualquer elemento com data-drawer-close dentro do drawer

(function () {
  function getFirstFocusable(root) {
    if (!root) return null;
    const selectors = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];
    const first = root.querySelector(selectors.join(','));
    return first || null;
  }

  function initDrawers() {
    const drawers = document.querySelectorAll('.drawer[data-drawer]');
    if (!drawers.length) return;

    let activeDrawer = null;

    function openDrawer(drawer) {
      if (!drawer) return;

      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-drawer-open');
      activeDrawer = drawer;

      // Focar primeiro campo/elemento interativo para acessibilidade
      const firstFocusable = getFirstFocusable(drawer);
      if (firstFocusable) {
        setTimeout(() => {
          try {
            firstFocusable.focus();
          } catch (e) {
            // ignore erros de foco
          }
        }, 150);
      }
    }

    function closeDrawer(drawer) {
      if (!drawer) return;

      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');

      // Se não houver mais drawers abertos, libera o scroll do body
      const anyOpen = document.querySelector('.drawer.is-open');
      if (!anyOpen) {
        document.body.classList.remove('is-drawer-open');
        activeDrawer = null;
      } else if (drawer === activeDrawer) {
        activeDrawer = anyOpen;
      }
    }

    drawers.forEach((drawer) => {
      const id = drawer.getAttribute('data-drawer');
      if (!id) return;

      // Botões que abrem este drawer
      const openButtons = document.querySelectorAll(
        `[data-drawer-open="${id}"]`
      );

      openButtons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          openDrawer(drawer);
        });
      });

      // Overlay fecha o drawer
      const overlay = drawer.querySelector('[data-drawer-overlay]');
      if (overlay) {
        overlay.addEventListener('click', () => {
          closeDrawer(drawer);
        });
      }

      // Qualquer elemento com data-drawer-close fecha o drawer
      const closeButtons = drawer.querySelectorAll('[data-drawer-close]');
      closeButtons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          closeDrawer(drawer);
        });
      });
    });

    // Esc global fecha o drawer ativo
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        if (activeDrawer && activeDrawer.classList.contains('is-open')) {
          closeDrawer(activeDrawer);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrawers);
  } else {
    initDrawers();
  }
})();
