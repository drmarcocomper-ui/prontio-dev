// =====================================
// PRONTIO - core/app.js
// - Cria/garante o namespace global PRONTIO
// - Compatibilidade com o modelo antigo de
//   registro de páginas (registerPageInitializer)
// - NÃO define mais PRONTIO.initPage aqui;
//   o main.js é o responsável por isso.
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  // Garante subnamespaces
  PRONTIO.core = PRONTIO.core || {};
  PRONTIO.pages = PRONTIO.pages || {};

  /**
   * Compatibilidade: registra função que inicializa uma página.
   *
   * Uso legado:
   *   PRONTIO.registerPageInitializer("agenda", function initAgenda() { ... });
   *
   * Agora:
   *   - Salva em PRONTIO.pages[pageName] (modelo antigo).
   *   - Se PRONTIO.registerPage existir (definido em main.js),
   *     também registra no novo modelo, que espera um initFn.
   *
   * @param {string} pageName - nome lógico da página (ex: "pacientes", "agenda")
   * @param {Function} initFn - função sem argumentos que inicializa a página
   */
  function registerPageInitializer(pageName, initFn) {
    if (!pageName || typeof pageName !== "string") {
      console.warn(
        "[PRONTIO.core.app] registerPageInitializer: pageName inválido:",
        pageName
      );
      return;
    }
    if (typeof initFn !== "function") {
      console.warn(
        "[PRONTIO.core.app] registerPageInitializer: initFn deve ser função. pageName=",
        pageName
      );
      return;
    }

    // Modelo antigo: PRONTIO.pages[pageName] = initFn
    PRONTIO.pages[pageName] = initFn;

    // Modelo novo (main.js): PRONTIO.registerPage("agenda", initFn)
    if (typeof PRONTIO.registerPage === "function") {
      try {
        PRONTIO.registerPage(pageName, initFn);
      } catch (err) {
        console.error(
          "[PRONTIO.core.app] Erro ao registrar página via registerPage:",
          pageName,
          err
        );
      }
    }
  }

  // Expõe no namespace (para páginas antigas que ainda usam isso)
  PRONTIO.registerPageInitializer = registerPageInitializer;

  // IMPORTANTE:
  // NÃO definimos PRONTIO.initPage aqui.
  // O main.js já define PRONTIO.initPage(pageName)
  // no formato novo, que procura PRONTIO.pages[pageName].init.
})(window);
