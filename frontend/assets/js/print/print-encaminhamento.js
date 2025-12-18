// =====================================
// PRONTIO - print/print-encaminhamento.js
// Impressão de encaminhamentos
//
// Convenções:
// - Área principal: .encaminhamento-secao
// - CSS de impressão tratado em print-encaminhamento.css + print-base.css
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const printNS = (PRONTIO.print = PRONTIO.print || {});

  function printEncaminhamento(options) {
    const opts = options || {};
    const selector = opts.selector || ".encaminhamento-secao";

    const el = document.querySelector(selector);
    if (!el) {
      console.warn(
        "[PRONTIO.print.encaminhamento] Elemento da seção de encaminhamento não encontrado:",
        selector
      );
    }

    try {
      global.print();
    } catch (e) {
      console.error("[PRONTIO.print.encaminhamento] Erro ao chamar print():", e);
    }
  }

  function bindPrintButton(buttonId) {
    const id = buttonId || "btnImprimirEncaminhamento";
    const btn = document.getElementById(id);
    if (!btn) return;

    if (btn.dataset.boundPrint === "true") return;
    btn.dataset.boundPrint = "true";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      printEncaminhamento();
    });
  }

  printNS.encaminhamento = {
    print: printEncaminhamento,
    bindButton: bindPrintButton,
  };
})(window, document);
