// =====================================
// PRONTIO - print/print-laudo.js
// Impressão de laudos
//
// Convenções:
// - Área principal: .laudo-secao
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const printNS = (PRONTIO.print = PRONTIO.print || {});

  function printLaudo(options) {
    const opts = options || {};
    const selector = opts.selector || ".laudo-secao";

    const el = document.querySelector(selector);
    if (!el) {
      console.warn(
        "[PRONTIO.print.laudo] Elemento da seção de laudo não encontrado:",
        selector
      );
    }

    try {
      global.print();
    } catch (e) {
      console.error("[PRONTIO.print.laudo] Erro ao chamar print():", e);
    }
  }

  function bindPrintButton(buttonId) {
    const id = buttonId || "btnImprimirLaudo";
    const btn = document.getElementById(id);
    if (!btn) return;

    if (btn.dataset.boundPrint === "true") return;
    btn.dataset.boundPrint = "true";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      printLaudo();
    });
  }

  printNS.laudo = {
    print: printLaudo,
    bindButton: bindPrintButton,
  };
})(window, document);
