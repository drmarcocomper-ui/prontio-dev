// =====================================
// PRONTIO - core/theme.js
// Controle de tema (claro/escuro)
//
// Responsabilidades:
// - Ler tema salvo (localStorage)
// - Aplicar tema no <body> via data-theme
// - Conectar evento no botão .js-toggle-theme
//
// OBS IMPORTANTE:
// - A troca de ícone sol/lua passa a ser 100% via CSS
//   (theme-toggle.css), baseada em body[data-theme].
// =====================================

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const themeNS = (PRONTIO.theme = PRONTIO.theme || {});

  const STORAGE_KEY = "prontio.theme"; // 'light' | 'dark'

  function detectarTemaInicial() {
    try {
      const salvo = global.localStorage.getItem(STORAGE_KEY);
      if (salvo === "light" || salvo === "dark") return salvo;
    } catch (e) {}

    if (global.matchMedia) {
      const prefereEscuro = global.matchMedia("(prefers-color-scheme: dark)");
      if (prefereEscuro.matches) return "dark";
    }

    return "light";
  }

  /**
   * Aplica tema no body
   * @param {'light'|'dark'} tema
   */
  function aplicarTema(tema) {
    const body = document.body;
    if (!body) return;

    const temaFinal = tema === "dark" ? "dark" : "light";
    body.dataset.theme = temaFinal;

    // aria-pressed nos toggles (o ícone é via CSS)
    const botoesToggle = document.querySelectorAll(".js-toggle-theme");
    botoesToggle.forEach((btn) => {
      btn.setAttribute("aria-pressed", temaFinal === "dark" ? "true" : "false");
    });
  }

  function alternarTema() {
    const body = document.body;
    const temaAtual = body && body.dataset.theme === "dark" ? "dark" : "light";
    const novoTema = temaAtual === "dark" ? "light" : "dark";

    aplicarTema(novoTema);

    try {
      global.localStorage.setItem(STORAGE_KEY, novoTema);
    } catch (e) {}
  }

  function initTheme() {
    // 1) aplica tema inicial - SEMPRE prioriza localStorage
    const temaInicial = detectarTemaInicial();
    aplicarTema(temaInicial);

    // 2) bind do toggle (idempotente por botão)
    const botoesToggle = document.querySelectorAll(".js-toggle-theme");
    botoesToggle.forEach((btn) => {
      if (btn.dataset.themeBound === "true") return;
      btn.dataset.themeBound = "true";

      btn.addEventListener("click", function (event) {
        event.preventDefault();
        alternarTema();
      });
    });
  }

  // Expor no namespace PRONTIO
  themeNS.init = initTheme;
  themeNS.apply = aplicarTema;
  themeNS.toggle = alternarTema;
  themeNS.detectInitial = detectarTemaInicial;

  // Retrocompat
  try {
    PRONTIO.ui = PRONTIO.ui || {};
    PRONTIO.ui.initTheme = initTheme;
  } catch (e) {}

  // ✅ Auto-aplica tema IMEDIATAMENTE quando script carrega
  // Isso evita flash de tema errado ao navegar entre páginas
  try {
    const temaImediato = detectarTemaInicial();
    if (document.body) {
      document.body.dataset.theme = temaImediato;
    } else {
      // Body ainda não existe, aplica assim que existir
      document.addEventListener("DOMContentLoaded", function() {
        aplicarTema(detectarTemaInicial());
      }, { once: true });
    }
  } catch (e) {}

})(window, document);
