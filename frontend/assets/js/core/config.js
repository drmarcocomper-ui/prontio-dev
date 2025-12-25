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

    // Observação: qualquer outro host cai em "prod" (como já era)
    return "prod";
  }

  const ENV = detectEnv_();

  const API_URLS = {
    dev: "https://script.google.com/macros/s/AKfycby835V_xMDYbUUsJ_nWzJrgUCmxUTiFQfHmge--WQCRSPuvIlcsBNbu5arATeehmxCezA/exec",
    prod: "https://script.google.com/macros/s/AKfycbwGwSrgphYjR374ftYwbMczqnJzWTZvQXyyfcDGhyHsCGfuxbjd7FfhBEkUHoKrKC6AWQ/exec"
  };

  PRONTIO.config.env = ENV;

  // ✅ prioridade: meta prontio-api-url (se preenchido) -> senão, usa ENV
  const metaUrl = metaApiUrl_();
  PRONTIO.config.apiUrl = metaUrl || API_URLS[ENV] || API_URLS.dev;

  PRONTIO.config.apiTimeout = 20000;

  if (global.console) {
    console.info("[PRONTIO.config]", "ENV =", PRONTIO.config.env, "| API =", PRONTIO.config.apiUrl);
  }
})(window);
