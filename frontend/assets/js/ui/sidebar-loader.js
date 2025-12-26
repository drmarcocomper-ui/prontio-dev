// frontend/assets/js/ui/sidebar-loader.js
// -------------------------------------
// ✅ FIX DEFINITIVO:
// - Não injeta sidebar se já existir #sidebar (evita duplicação)
// - load() idempotente: se já carregou, resolve imediatamente
// - Auto-init só se main NÃO estiver controlando (compat)
// - Cache com versionamento do partial
// -------------------------------------

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.ui = PRONTIO.ui || {};
  PRONTIO.ui.sidebarLoader = PRONTIO.ui.sidebarLoader || {};

  // Bump quando mudar o HTML do partial
  const PARTIAL_VERSION = "1.0.5";

  function sidebarAlreadyMounted_() {
    return !!document.getElementById("sidebar");
  }

  function loadSidebarPartial() {
    // ✅ Se já existe sidebar no DOM, não faz nada
    if (sidebarAlreadyMounted_()) {
      PRONTIO.ui.sidebarLoader._loaded = true;
      return Promise.resolve(true);
    }

    // ✅ Se já carregou antes (nesta página), não faz nada
    if (PRONTIO.ui.sidebarLoader._loaded) {
      return Promise.resolve(true);
    }

    // ✅ Se já está carregando, reaproveita
    if (PRONTIO.ui.sidebarLoader._loadingPromise) {
      return PRONTIO.ui.sidebarLoader._loadingPromise;
    }

    PRONTIO.ui.sidebarLoader._loadingPromise = new Promise(function (resolve) {
      const placeholder = document.querySelector("[data-include-sidebar]");
      if (!placeholder) {
        resolve(false);
        return;
      }

      const url = "partials/sidebar.html?v=" + encodeURIComponent(PARTIAL_VERSION);

      function doFetch(cacheMode) {
        return fetch(url, { cache: cacheMode }).then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.text();
        });
      }

      // ✅ tenta cache normal; se falhar, no-store
      doFetch("default")
        .catch(function () { return doFetch("no-store"); })
        .then(function (html) {
          // ✅ Checagem final antes de injetar (evita corrida)
          if (sidebarAlreadyMounted_()) {
            PRONTIO.ui.sidebarLoader._loaded = true;
            resolve(true);
            return;
          }

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

          // init sidebar
          try {
            if (PRONTIO.widgets && PRONTIO.widgets.sidebar && typeof PRONTIO.widgets.sidebar.init === "function") {
              PRONTIO.widgets.sidebar.init();
            } else if (typeof global.initSidebar === "function") {
              global.initSidebar();
            }
          } catch (e) {
            console.warn("[PRONTIO.sidebar-loader] Erro ao inicializar sidebar:", e);
          }

          // rebind modais (se existir)
          try {
            if (PRONTIO.ui && PRONTIO.ui.modals && typeof PRONTIO.ui.modals.bindTriggers === "function") {
              PRONTIO.ui.modals.bindTriggers(document);
            }
          } catch (e) {
            console.warn("[PRONTIO.sidebar-loader] Erro ao rebind modais:", e);
          }

          // ✅ REBIND LOGOUT (Sair) — sidebar é injetado dinamicamente
          try {
            if (PRONTIO.auth && typeof PRONTIO.auth.bindLogoutButtons === "function") {
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

  // Auto-init compat (só se main NÃO estiver controlando)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (!PRONTIO._mainBootstrapped) loadSidebarPartial();
    });
  } else {
    if (!PRONTIO._mainBootstrapped) loadSidebarPartial();
  }
})(window, document);
