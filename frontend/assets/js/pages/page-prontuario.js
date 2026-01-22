(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO._pageInited = PRONTIO._pageInited || {};
  PRONTIO._featuresLoaded = PRONTIO._featuresLoaded || {};

  // ✅ Guard: não inicializa fora da página Prontuário
  try {
    const body = document && document.body;
    const pageId = body && body.dataset ? String(body.dataset.pageId || body.getAttribute("data-page-id") || "") : "";
    if (pageId && pageId !== "prontuario") return;
  } catch (_) {}

  // ------------------------------------------------------------
  // Loader simples (sem bundler / sem mexer no HTML)
  // - Carrega os módulos do prontuário em ordem
  // - Depois registra PRONTIO.pages.prontuario.init via prontuario.entry.js
  // ------------------------------------------------------------

  function _loadScript_(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = false;
      el.defer = false;
      el.onload = () => resolve(true);
      el.onerror = () => reject(new Error("Falha ao carregar script: " + src));
      document.head.appendChild(el);
    });
  }

  async function _ensureProntuarioModulesLoaded_() {
    if (PRONTIO._featuresLoaded.prontuario === true) return true;

    const base = "assets/js/features/prontuario/";
    const files = [
      "prontuario.utils.js",
      "prontuario.api.js",
      "prontuario.context.js",
      "prontuario.paciente.js",
      "prontuario.receita-panel.js",
      "prontuario.documentos-panel.js",
      "prontuario.evolucoes.js",
      "prontuario.entry.js",
    ];

    for (const f of files) {
      await _loadScript_(base + f);
    }

    PRONTIO._featuresLoaded.prontuario = true;
    return true;
  }

  async function _boot_() {
    try {
      await _ensureProntuarioModulesLoaded_();
      // prontuario.entry.js registra PRONTIO.pages.prontuario.init
      if (PRONTIO.pages && PRONTIO.pages.prontuario && typeof PRONTIO.pages.prontuario.init === "function") {
        PRONTIO.pages.prontuario.init();
      }
    } catch (e) {
      console.error("[PRONTIO] Falha ao bootar módulos do Prontuário:", e);
      try {
        global.alert("Erro ao carregar módulo do Prontuário.\n\n" + (e && e.message ? e.message : String(e || "")));
      } catch (_) {}
    }
  }

  // ✅ fallback: se main.js não rodar, inicializa sozinho
  if (!PRONTIO._mainBootstrapped) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _boot_);
    else _boot_();
  } else {
    // Se main.js chama PRONTIO.pages[pageId].init(), garantimos que init existe
    // carregando módulos antes e delegando o init.
    PRONTIO.pages.prontuario = PRONTIO.pages.prontuario || {};
    PRONTIO.pages.prontuario.init = function () {
      _boot_();
    };
  }
})(window, document);
