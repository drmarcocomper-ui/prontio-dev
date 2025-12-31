(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.config = PRONTIO.config || {};

  function metaApiUrl_() {
    try {
      const doc = global.document;
      if (!doc || !doc.querySelector) return "";
      const meta = doc.querySelector('meta[name="prontio-api-url"]');
      const v = meta && meta.content ? String(meta.content).trim() : "";
      return v || "";
    } catch (e) {
      return "";
    }
  }

  function detectEnv_() {
    const host = (global.location && global.location.hostname) || "";
    const path = (global.location && global.location.pathname) || "";

    if (host === "localhost" || host === "127.0.0.1") return "dev";

    if (host.endsWith("github.io")) {
      if (path.startsWith("/prontio-dev/")) return "dev";
      if (path.startsWith("/prontio-prod/")) return "prod";
      return "dev";
    }

    // Qualquer outro host assume produção
    return "prod";
  }

  const ENV = detectEnv_();

  const API_URLS = {
    dev: "https://script.google.com/macros/s/AKfycbyk_50k1K-xr1R1S498B0dj6oosfRsEXkQtkSYm4kVk0a9EVBd5eV2eVnvN_ixmFwhDlg/exec",
    prod: "https://script.google.com/macros/s/AKfycbwGwSrgphYjR374ftYwbMczqnJzWTZvQXyyfcDGhyHsCGfuxbjd7FfhBEkUHoKrKC6AWQ/exec"
  };

  // ENV normalizado
  PRONTIO.config.env = ENV === "prod" ? "prod" : "dev";

  // ✅ prioridade:
  // 1) <meta name="prontio-api-url">
  // 2) URL pelo ENV
  // 3) fallback DEV
  const metaUrl = metaApiUrl_();
  PRONTIO.config.apiUrl =
    metaUrl ||
    API_URLS[PRONTIO.config.env] ||
    API_URLS.dev;

  // =========================
  // TIMEOUT DA API
  // =========================

  // Valor oficial (usado pelo api.js)
  PRONTIO.config.apiTimeoutMs = 20000;

  // Alias retrocompatível (não usado pelo api.js, mas mantido)
  PRONTIO.config.apiTimeout = PRONTIO.config.apiTimeoutMs;

  if (global.console) {
    console.info(
      "[PRONTIO.config]",
      "ENV =", PRONTIO.config.env,
      "| API =", PRONTIO.config.apiUrl,
      "| TIMEOUT =", PRONTIO.config.apiTimeoutMs + "ms"
    );
  }
})(window);
