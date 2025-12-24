// frontend/assets/js/ui/sidebar-loader.js
// -------------------------------------
// Carrega o partial frontend/partials/sidebar.html
// em um placeholder da página e, depois de injetar,
// inicializa a sidebar (PRONTIO.widgets.sidebar.init)
// e reexecuta o bind dos modais (para data-modal-open).
//
// ✅ Agora expõe PRONTIO.ui.sidebarLoader.load(): Promise
// para o main.js poder aguardar e evitar "flash".
// -------------------------------------

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.ui = PRONTIO.ui || {};
  PRONTIO.ui.sidebarLoader = PRONTIO.ui.sidebarLoader || {};

  function loadSidebarPartial() {
    return new Promise(function (resolve) {
      const placeholder = document.querySelector("[data-include-sidebar]");
      if (!placeholder) {
        // Página sem sidebar dinâmica – não faz nada
        resolve(false);
        return;
      }

      const url = "partials/sidebar.html";

      fetch(url)
        .then(function (response) {
          if (!response.ok) {
            throw new Error(
              "[PRONTIO.sidebar-loader] Erro ao buscar " +
                url +
                " (" +
                response.status +
                ")"
            );
          }
          return response.text();
        })
        .then(function (html) {
          const temp = document.createElement("div");
          temp.innerHTML = html;

          const parent = placeholder.parentNode;
          if (!parent) {
            resolve(false);
            return;
          }

          while (temp.firstChild) {
            parent.insertBefore(temp.firstChild, placeholder);
          }
          parent.removeChild(placeholder);

          // Inicializa sidebar
          try {
            if (
              PRONTIO.widgets &&
              PRONTIO.widgets.sidebar &&
              typeof PRONTIO.widgets.sidebar.init === "function"
            ) {
              PRONTIO.widgets.sidebar.init();
            } else if (typeof global.initSidebar === "function") {
              global.initSidebar();
            }
          } catch (e) {
            console.warn("[PRONTIO.sidebar-loader] Erro ao inicializar sidebar:", e);
          }

          // Rebind modais (para triggers carregados depois)
          try {
            if (
              PRONTIO.widgets &&
              PRONTIO.widgets.modais &&
              typeof PRONTIO.widgets.modais.init === "function"
            ) {
              PRONTIO.widgets.modais.init();
            } else if (
              PRONTIO.ui &&
              PRONTIO.ui.modals &&
              typeof PRONTIO.ui.modals.bindTriggers === "function"
            ) {
              PRONTIO.ui.modals.bindTriggers(document);
            }
          } catch (e) {
            console.warn("[PRONTIO.sidebar-loader] Erro ao re-inicializar modais:", e);
          }

          resolve(true);
        })
        .catch(function (err) {
          console.error("[PRONTIO.sidebar-loader] Falha ao carregar partial da sidebar:", err);
          resolve(false);
        });
    });
  }

  // ✅ API pública (Promise)
  PRONTIO.ui.sidebarLoader.load = loadSidebarPartial;

  // Auto-init (mantém compat)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      loadSidebarPartial();
    });
  } else {
    loadSidebarPartial();
  }
})(window, document);
