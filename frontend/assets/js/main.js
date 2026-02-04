(function (global, document) {
  "use strict";

  // evita rodar 2x
  global.PRONTIO = global.PRONTIO || {};
  if (global.PRONTIO._mainBootstrapRan === true) return;
  global.PRONTIO._mainBootstrapRan = true;

  function loadScript_(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function boot_() {
    // Cache-bust para core scripts (força reload após deploy)
    const cb = "?_t=" + Date.now();

    // 1) Manifest (APP_VERSION + PAGE_MANIFEST)
    await loadScript_("assets/js/core/manifest.js" + cb);

    // 2) Loader (PRONTIO.loader)
    await loadScript_("assets/js/core/loader.js" + cb);

    // 3) Bootstrap (PRONTIO.bootstrap)
    await loadScript_("assets/js/core/bootstrap.js" + cb);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot_);
  } else {
    boot_();
  }
})(window, document);
