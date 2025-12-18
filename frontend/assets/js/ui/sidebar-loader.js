// frontend/assets/js/ui/sidebar-loader.js
// -------------------------------------
// Carrega o partial frontend/partials/sidebar.html
// em um placeholder da página e, depois de injetar,
// inicializa a sidebar (PRONTIO.widgets.sidebar.init)
// e reexecuta o bind dos modais (para data-modal-open).
// -------------------------------------

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  function loadSidebarPartial() {
    // Placeholder genérico: você coloca <div data-include-sidebar></div> na página
    const placeholder = document.querySelector("[data-include-sidebar]");
    if (!placeholder) {
      // Página sem sidebar dinâmica – não faz nada
      return;
    }

    // Caminho relativo a partir das páginas (ex.: index.html, prontuario.html, etc.)
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
        // Criamos um container temporário para segurar o HTML do partial
        const temp = document.createElement("div");
        temp.innerHTML = html;

        // Substitui o placeholder pelos nós reais do partial
        // (isso mantém o <aside id="sidebar"> conforme esperado por ui/sidebar.js)
        const parent = placeholder.parentNode;
        if (!parent) return;

        // Inserir todos os filhos do temp antes de remover o placeholder
        while (temp.firstChild) {
          parent.insertBefore(temp.firstChild, placeholder);
        }
        parent.removeChild(placeholder);

        // Agora a sidebar existe no DOM -> podemos inicializá-la
        try {
          if (
            PRONTIO.widgets &&
            PRONTIO.widgets.sidebar &&
            typeof PRONTIO.widgets.sidebar.init === "function"
          ) {
            PRONTIO.widgets.sidebar.init();
          } else if (typeof global.initSidebar === "function") {
            // fallback para compatibilidade
            global.initSidebar();
          }
        } catch (e) {
          console.warn(
            "[PRONTIO.sidebar-loader] Erro ao inicializar sidebar:",
            e
          );
        }

        // Reexecuta a ligação de triggers de modais,
        // para garantir que o "Sobre / Versão" (data-modal-open)
        // funcione mesmo sendo carregado depois do DOMContentLoaded.
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
          console.warn(
            "[PRONTIO.sidebar-loader] Erro ao re-inicializar modais:",
            e
          );
        }
      })
      .catch(function (err) {
        console.error(
          "[PRONTIO.sidebar-loader] Falha ao carregar partial da sidebar:",
          err
        );
      });
  }

  // Auto-init simples
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadSidebarPartial);
  } else {
    loadSidebarPartial();
  }
})(window, document);
