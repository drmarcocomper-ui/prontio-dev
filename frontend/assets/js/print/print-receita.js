// =====================================
// PRONTIO - print/print-receita.js
// Impressão de receitas
//
// Convenções:
// - Área principal: .receita-secao
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const printNS = (PRONTIO.print = PRONTIO.print || {});

  function printReceita(options) {
    const opts = options || {};
    const selector = opts.selector || ".receita-secao";

    const el = document.querySelector(selector);
    if (!el) {
      console.warn(
        "[PRONTIO.print.receita] Elemento da seção de receita não encontrado:",
        selector
      );
    }

    try {
      global.print();
    } catch (e) {
      console.error("[PRONTIO.print.receita] Erro ao chamar print():", e);
    }
  }

  function bindPrintButton(buttonId) {
    const id = buttonId || "btnImprimirReceita";
    const btn = document.getElementById(id);
    if (!btn) return;

    if (btn.dataset.boundPrint === "true") return;
    btn.dataset.boundPrint = "true";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      printReceita();
    });
  }

  printNS.receita = {
    print: printReceita,
    bindButton: bindPrintButton,
  };
})(window, document);
