// frontend/assets/js/ui/sidebar-loader.js
// -------------------------------------
// ✅ FIX DEFINITIVO (VERSÃO FINAL):
// - Não injeta sidebar se já existir #sidebar (evita duplicação)
// - load() idempotente: se já carregou, resolve imediatamente
// - Evita corrida de múltiplos fetches concorrentes
// - Auto-init só se main NÃO estiver controlando (compat)
// - Cache SOMENTE do HTML partial com versionamento (NÃO é JS)
// -------------------------------------

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.ui = PRONTIO.ui || {};
  PRONTIO.ui.sidebarLoader = PRONTIO.ui.sidebarLoader || {};

  // 🔒 Estados internos (defensivo)
  PRONTIO.ui.sidebarLoader._loaded = PRONTIO.ui.sidebarLoader._loaded === true;
  PRONTIO.ui.sidebarLoader._loadingPromise = PRONTIO.ui.sidebarLoader._loadingPromise || null;

  // Bump quando mudar APENAS o HTML do partial.
  // ⚠️ NÃO usar para JS — cache-busting de JS é centralizado no main.js (APP_VERSION).
  const PARTIAL_VERSION = "1.0.5";

  function sidebarAlreadyMounted_() {
    return !!document.getElementById("sidebar");
  }

  function initSidebarWidget_() {
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
  }

  function loadSidebarPartial() {
    // ✅ Sidebar já existe no DOM (inline) - só precisa inicializar
    if (sidebarAlreadyMounted_()) {
      PRONTIO.ui.sidebarLoader._loaded = true;
      initSidebarWidget_();
      return Promise.resolve(true);
    }

    // ✅ Já carregado anteriormente nesta página
    if (PRONTIO.ui.sidebarLoader._loaded) {
      return Promise.resolve(true);
    }

    // ✅ Já existe um carregamento em andamento
    if (PRONTIO.ui.sidebarLoader._loadingPromise) {
      return PRONTIO.ui.sidebarLoader._loadingPromise;
    }

    PRONTIO.ui.sidebarLoader._loadingPromise = new Promise(function (resolve) {
      const placeholder = document.querySelector("[data-include-sidebar]");
      if (!placeholder) {
        // Página sem sidebar → comportamento esperado
        resolve(false);
        return;
      }

      // ✅ Versionamento SOMENTE do HTML partial
      const url = "partials/sidebar.html?v=" + encodeURIComponent(PARTIAL_VERSION);

      function doFetch(cacheMode) {
        return fetch(url, { cache: cacheMode }).then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.text();
        });
      }

      // 🔁 Tenta cache normal; fallback para no-store
      doFetch("default")
        .catch(function () {
          return doFetch("no-store");
        })
        .then(function (html) {
          // ✅ Checagem final (condição de corrida)
          if (sidebarAlreadyMounted_()) {
            PRONTIO.ui.sidebarLoader._loaded = true;
            resolve(true);
            return;
          }

          const parent = placeholder.parentNode;
          if (!parent) {
            resolve(false);
            return;
          }

          const temp = document.createElement("div");
          temp.innerHTML = html;

          // Injeta todos os nós antes do placeholder
          while (temp.firstChild) {
            parent.insertBefore(temp.firstChild, placeholder);
          }

          // Remove placeholder
          parent.removeChild(placeholder);

          // ▶ Init sidebar
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

          // ▶ Rebind modais
          try {
            if (
              PRONTIO.ui &&
              PRONTIO.ui.modals &&
              typeof PRONTIO.ui.modals.bindTriggers === "function"
            ) {
              PRONTIO.ui.modals.bindTriggers(document);
            }
          } catch (e) {
            console.warn("[PRONTIO.sidebar-loader] Erro ao rebind modais:", e);
          }

          // ▶ Rebind logout (sidebar é dinâmico)
          try {
            if (
              PRONTIO.auth &&
              typeof PRONTIO.auth.bindLogoutButtons === "function"
            ) {
              PRONTIO.auth.bindLogoutButtons(document);
            }
          } catch (e) {
            console.warn("[PRONTIO.sidebar-loader] Erro ao rebind logout:", e);
          }

          PRONTIO.ui.sidebarLoader._loaded = true;
          resolve(true);
        })
        .catch(function (err) {
          console.error("[PRONTIO.sidebar-loader] Falha ao carregar sidebar partial:", err);
          resolve(false);
        })
        .finally(function () {
          PRONTIO.ui.sidebarLoader._loadingPromise = null;
        });
    });

    return PRONTIO.ui.sidebarLoader._loadingPromise;
  }

  PRONTIO.ui.sidebarLoader.load = loadSidebarPartial;

  // ▶ Auto-init compat (somente se main.js NÃO estiver controlando)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (!PRONTIO._mainBootstrapped) loadSidebarPartial();
    });
  } else {
    if (!PRONTIO._mainBootstrapped) loadSidebarPartial();
  }
})(window, document);
