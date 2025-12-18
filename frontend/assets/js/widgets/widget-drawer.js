// assets/js/widgets/widget-drawer.js
// Drawer lateral (painel deslizante) para detalhes de paciente,
// evoluções, filtros, etc.
//
// Uso típico:
// const drawer = PRONTIO.widgets.drawer.create({
//   side: "right", // ou "left"
//   width: "420px"
// });
//
// drawer.open("<h1>Conteúdo</h1>");
// drawer.close();

(function (global) {
  "use strict";

  const PRONTIO = global.PRONTIO = global.PRONTIO || {};
  PRONTIO.widgets = PRONTIO.widgets || {};

  function createDrawer(options) {
    const side = (options && options.side) === "left" ? "left" : "right";
    const width = (options && options.width) || "420px";

    const overlay = document.createElement("div");
    overlay.className = "prontio-drawer-overlay";

    const panel = document.createElement("div");
    panel.className = "prontio-drawer-panel";
    panel.style.width = width;
    panel.dataset.side = side;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let isOpen = false;

    function open(content) {
      if (typeof content === "string") {
        panel.innerHTML = content;
      } else if (content instanceof Node) {
        panel.innerHTML = "";
        panel.appendChild(content);
      }
      overlay.classList.add("open");
      panel.classList.add("open");
      document.body.classList.add("prontio-drawer-open");
      isOpen = true;
    }

    function close() {
      overlay.classList.remove("open");
      panel.classList.remove("open");
      document.body.classList.remove("prontio-drawer-open");
      isOpen = false;
    }

    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) {
        close();
      }
    });

    global.addEventListener("keydown", function (ev) {
      if (!isOpen) return;
      if (ev.key === "Escape") {
        close();
      }
    });

    return {
      open,
      close,
      isOpen() {
        return isOpen;
      },
      setContent(content) {
        if (typeof content === "string") {
          panel.innerHTML = content;
        } else if (content instanceof Node) {
          panel.innerHTML = "";
          panel.appendChild(content);
        }
      },
      getPanelElement() {
        return panel;
      }
    };
  }

  PRONTIO.widgets.drawer = {
    create: createDrawer
  };

})(window);
