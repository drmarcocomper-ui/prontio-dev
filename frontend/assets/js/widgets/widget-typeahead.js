// frontend/assets/js/widgets/widget-typeahead.js
/**
 * PRONTIO — Widget Typeahead (genérico / design system)
 * ------------------------------------------------------------
 * Objetivo:
 * - Reutilizável em qualquer módulo (Agenda, Pacientes, Receita, etc.)
 * - Não conhece domínio e não chama API diretamente
 *
 * API:
 *   const detach = PRONTIO.widgets.typeahead.attach({
 *     inputEl,
 *     minChars: 2,
 *     debounceMs: 220,
 *     fetchItems: async (query) => items[],
 *     renderItem: (item) => ({ title, subtitle }),
 *     onSelect: (item) => void,
 *     onInputChanged: (value) => void, // opcional
 *   });
 *
 * Retorno:
 * - detach(): remove listeners e painel
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.widgets = PRONTIO.widgets || {};

  function attach(opts) {
    const inputEl = opts && opts.inputEl;
    if (!inputEl) return () => {};

    const fetchItems = typeof opts.fetchItems === "function" ? opts.fetchItems : async () => [];
    const renderItem = typeof opts.renderItem === "function" ? opts.renderItem : () => ({ title: "", subtitle: "" });
    const onSelect = typeof opts.onSelect === "function" ? opts.onSelect : () => {};
    const onInputChanged = typeof opts.onInputChanged === "function" ? opts.onInputChanged : null;

    const minChars = typeof opts.minChars === "number" ? opts.minChars : 2;
    const debounceMs = typeof opts.debounceMs === "number" ? opts.debounceMs : 220;

    const doc = inputEl.ownerDocument || document;

    let panel = doc.createElement("div");
    panel.className = "typeahead-panel hidden";
    panel.setAttribute("role", "listbox");

    let items = [];
    let activeIndex = -1;
    let debounceTimer = null;
    let lastQuery = "";
    let mounted = false;

    function ensureMounted() {
      if (mounted) return;
      const parent = inputEl.parentElement || inputEl.parentNode;
      if (inputEl.parentElement) inputEl.parentElement.style.position = inputEl.parentElement.style.position || "relative";
      parent.appendChild(panel);
      mounted = true;
    }

    function hide() {
      panel.classList.add("hidden");
      panel.innerHTML = "";
      items = [];
      activeIndex = -1;
    }

    function show() {
      panel.classList.remove("hidden");
    }

    function render() {
      if (!items.length) return hide();

      panel.innerHTML = "";
      items.forEach((it, idx) => {
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "typeahead-item";
        btn.setAttribute("role", "option");
        btn.dataset.index = String(idx);
        if (idx === activeIndex) btn.classList.add("active");

        const r = renderItem(it) || {};
        const title = doc.createElement("div");
        title.className = "typeahead-item-nome";
        title.textContent = r.title || "(sem título)";
        btn.appendChild(title);

        if (r.subtitle) {
          const sub = doc.createElement("div");
          sub.className = "typeahead-item-detalhes";
          sub.textContent = r.subtitle;
          btn.appendChild(sub);
        }

        btn.addEventListener("mousedown", (e) => e.preventDefault());
        btn.addEventListener("click", () => {
          onSelect(it);
          hide();
        });

        panel.appendChild(btn);
      });

      show();
    }

    async function fetchAndRender(q) {
      const query = String(q || "").trim();
      lastQuery = query;

      if (query.length < minChars) return hide();

      try {
        const result = await fetchItems(query);
        if (String(inputEl.value || "").trim() !== lastQuery) return;

        items = Array.isArray(result) ? result : [];
        activeIndex = items.length ? 0 : -1;
        render();
      } catch (err) {
        console.warn("[typeahead] erro ao buscar:", err);
        hide();
      }
    }

    function onInput() {
      const v = String(inputEl.value || "");
      if (onInputChanged) onInputChanged(v);

      const q = v.trim();
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchAndRender(q), debounceMs);
    }

    function onFocus() {
      ensureMounted();
      const q = String(inputEl.value || "").trim();
      if (q.length >= minChars) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchAndRender(q), 10);
      }
    }

    function onBlur() {
      setTimeout(() => hide(), 180);
    }

    function onKeyDown(e) {
      if (panel.classList.contains("hidden")) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!items.length) return;
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        render();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        activeIndex = Math.max(activeIndex - 1, 0);
        render();
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && items[activeIndex]) {
          e.preventDefault();
          onSelect(items[activeIndex]);
          hide();
        }
      } else if (e.key === "Escape") {
        hide();
      }
    }

    ensureMounted();

    inputEl.addEventListener("input", onInput);
    inputEl.addEventListener("focus", onFocus);
    inputEl.addEventListener("blur", onBlur);
    inputEl.addEventListener("keydown", onKeyDown);

    return function detach() {
      try {
        if (debounceTimer) clearTimeout(debounceTimer);
        inputEl.removeEventListener("input", onInput);
        inputEl.removeEventListener("focus", onFocus);
        inputEl.removeEventListener("blur", onBlur);
        inputEl.removeEventListener("keydown", onKeyDown);
        if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
      } catch (_) {}
    };
  }

  PRONTIO.widgets.typeahead = { attach };
})(window);
