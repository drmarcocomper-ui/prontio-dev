// assets/js/widgets/widget-searchbar.js
// Barra de busca reutilizável com debounce.
//
// Uso típico:
// const search = PRONTIO.widgets.searchbar.init({
//   container: document.getElementById("pacientes-search"),
//   placeholder: "Buscar paciente...",
//   onChange: (text) => { ... },   // chamado com debounce
//   onSubmit: (text) => { ... }    // chamado no Enter
// });

(function (global) {
  "use strict";

  const PRONTIO = global.PRONTIO = global.PRONTIO || {};
  PRONTIO.widgets = PRONTIO.widgets || {};

  function debounce(fn, delay) {
    let timer = null;
    return function () {
      const ctx = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(ctx, args), delay);
    };
  }

  function initSearchbar(options) {
    const container = options && options.container;
    if (!container) {
      throw new Error("[SearchbarWidget] container é obrigatório");
    }

    const placeholder = options.placeholder || "Buscar...";
    const initialValue = options.initialValue || "";
    const onChange = typeof options.onChange === "function"
      ? options.onChange
      : function () {};
    const onSubmit = typeof options.onSubmit === "function"
      ? options.onSubmit
      : function () {};

    container.classList.add("prontio-searchbar");

    const input = document.createElement("input");
    input.type = "search";
    input.className = "prontio-searchbar-input";
    input.placeholder = placeholder;
    input.value = initialValue;

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "prontio-searchbar-clear";
    clearBtn.textContent = "×";

    container.appendChild(input);
    container.appendChild(clearBtn);

    const debouncedChange = debounce(function () {
      onChange(input.value.trim());
    }, options.debounceMs || 300);

    input.addEventListener("input", debouncedChange);

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        onSubmit(input.value.trim());
      }
    });

    clearBtn.addEventListener("click", function () {
      input.value = "";
      onChange("");
      input.focus();
    });

    return {
      setValue(text) {
        input.value = text || "";
        onChange(input.value.trim());
      },
      getValue() {
        return input.value.trim();
      },
      focus() {
        input.focus();
      }
    };
  }

  PRONTIO.widgets.searchbar = {
    init: initSearchbar
  };

})(window);
