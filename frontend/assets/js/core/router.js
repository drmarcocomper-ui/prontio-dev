// assets/js/core/router.js
// Responsável por descobrir qual página está sendo carregada
// e disparar a função de inicialização registrada para ela.
//
// Uso típico em page-pacientes.js:
// PRONTIO.core.router.register("pacientes", initPacientesPage);
//
// No HTML da página (ex.: pacientes.html):
// <body data-page="pacientes">

(function (global) {
  "use strict";

  const PRONTIO = global.PRONTIO = global.PRONTIO || {};
  PRONTIO.core = PRONTIO.core || {};

  const Router = {
    routes: {},
    currentPageId: null,
    started: false,

    /**
     * Registra uma função de inicialização para uma página.
     * @param {string} pageId - identificador da página (ex.: "pacientes")
     * @param {Function} initFn - função que inicializa a página
     */
    register(pageId, initFn) {
      if (!pageId || typeof initFn !== "function") {
        console.warn("[Router] register chamado com parâmetros inválidos", pageId, initFn);
        return;
      }
      this.routes[pageId] = initFn;
    },

    /**
     * Descobre o ID da página baseado no atributo data-page do body
     * ou, em último caso, pelo nome do arquivo da URL.
     */
    detectPageId() {
      const body = document.body;
      if (body && body.dataset && body.dataset.page) {
        return body.dataset.page;
      }

      // fallback: tenta extrair do caminho da URL, ex.: /pacientes.html -> "pacientes"
      const path = global.location.pathname || "";
      const fileName = path.split("/").pop() || "";
      const withoutExt = fileName.replace(/\.[^/.]+$/, ""); // remove extensão
      return withoutExt || "index";
    },

    /**
     * Inicializa o router: descobre página atual e chama a função registrada.
     * Deve ser chamado uma única vez (idealmente em main.js, no DOMContentLoaded).
     */
    start() {
      if (this.started) return;
      this.started = true;

      const pageId = this.detectPageId();
      this.currentPageId = pageId;

      const initFn = this.routes[pageId];
      if (typeof initFn === "function") {
        try {
          initFn();
        } catch (err) {
          console.error(`[Router] Erro ao inicializar página '${pageId}'`, err);
        }
      } else {
        console.warn(`[Router] Nenhuma rota registrada para a página '${pageId}'`);
      }
    }
  };

  PRONTIO.core.router = Router;

})(window);
