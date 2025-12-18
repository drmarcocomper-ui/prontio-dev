// =====================================
// PRONTIO - core/dom.js
// Helpers genéricos de DOM
//
// Responsabilidades:
// - Seletores (qs, qsa)
// - Eventos (on)
// - Criação de elementos (createEl)
// - Mostrar/ocultar/toggle (show, hide, toggle)
//
// OBS:
// - NÃO usa ES Modules.
// - Exposto via PRONTIO.core.dom
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const core = (PRONTIO.core = PRONTIO.core || {});
  const dom = (core.dom = core.dom || {});

  // -----------------------------------------
  // Funções internas
  // -----------------------------------------

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function qsa(selector, scope) {
    return Array.from((scope || document).querySelectorAll(selector));
  }

  function on(elOrSelector, event, handler) {
    const el =
      typeof elOrSelector === "string"
        ? document.querySelector(elOrSelector)
        : elOrSelector;

    if (el) el.addEventListener(event, handler);
  }

  function createEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);

    Object.entries(attrs).forEach(([key, value]) => {
      if (key === "class") {
        el.className = value;
      } else if (key === "dataset") {
        Object.entries(value).forEach(([k, v]) => (el.dataset[k] = v));
      } else if (key in el) {
        el[key] = value;
      } else {
        el.setAttribute(key, value);
      }
    });

    (Array.isArray(children) ? children : [children]).forEach((child) => {
      if (child == null) return;
      if (typeof child === "string") {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    });

    return el;
  }

  function show(el) {
    if (!el) return;
    el.style.display = "";
    el.classList.remove("hidden");
  }

  function hide(el) {
    if (!el) return;
    el.style.display = "none";
    el.classList.add("hidden");
  }

  function toggle(el) {
    if (!el) return;
    if (el.classList.contains("hidden") || el.style.display === "none") {
      show(el);
    } else {
      hide(el);
    }
  }

  // -----------------------------------------
  // Expor API pública
  // -----------------------------------------

  dom.qs = qs;
  dom.qsa = qsa;
  dom.on = on;
  dom.createEl = createEl;
  dom.show = show;
  dom.hide = hide;
  dom.toggle = toggle;

})(window, document);
