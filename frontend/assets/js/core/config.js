(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.config = PRONTIO.config || {};

  function detectEnv_() {
    const host = (global.location && global.location.hostname) || "";
    const path = (global.location && global.location.pathname) || "";

    if (host === "localhost" || host === "127.0.0.1") return "dev";
    if (host.endsWith("github.io")) {
      if (path.startsWith("/prontio-dev/")) return "dev";
      if (path.startsWith("/prontio-prod/")) return "prod";
      return "dev";
    }
    return "prod";
  }

  const ENV = detectEnv_();

  const API_URLS = {
    dev: "https://script.google.com/macros/s/AKfycbwaCsKAIEtDQh1_0e27VBIB591h2yBd7OoDK3xorhwfigS9c7_rGuCaF1lkprzEQvewow/exec",
    prod: "https://script.google.com/macros/s/AKfycbwGwSrgphYjR374ftYwbMczqnJzWTZvQXyyfcDGhyHsCGfuxbjd7FfhBEkUHoKrKC6AWQ/exec"
  };

  PRONTIO.config.env = ENV;
  PRONTIO.config.apiUrl = API_URLS[ENV] || API_URLS.dev;
  PRONTIO.config.apiTimeout = 20000;

  if (global.console) {
    console.info("[PRONTIO.config]", "ENV =", PRONTIO.config.env, "| API =", PRONTIO.config.apiUrl);
  }
})(window);
