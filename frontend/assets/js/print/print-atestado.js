// =====================================
// PRONTIO - print/print-atestado.js
// Impressão de atestados
//
// Responsabilidades:
// - Preparar a página para impressão do atestado
// - Chamar window.print() com layout adequado
//
// Convenções de HTML/CSS:
// - Área a ser impressa deve estar dentro de .atestado-secao
// - Classes .print-only / .no-print controladas pelo CSS de impressão
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const printNS = (PRONTIO.print = PRONTIO.print || {});

  /**
   * Prepara a tela e dispara a impressão do atestado.
   *
   * @param {Object} [options]
   * @param {string} [options.selector=".atestado-secao"]
   */
  function printAtestado(options) {
    const opts = options || {};
    const selector = opts.selector || ".atestado-secao";

    const el = document.querySelector(selector);
    if (!el) {
      console.warn(
        "[PRONTIO.print.atestado] Elemento da seção de atestado não encontrado:",
        selector
      );
    }

    // Aqui você pode fazer ajustes visuais antes da impressão, se necessário.
    // Ex: forçar remoção de estados temporários, validar campos obrigatórios etc.

    try {
      global.print();
    } catch (e) {
      console.error("[PRONTIO.print.atestado] Erro ao chamar print():", e);
    }
  }

  /**
   * Associa um botão de impressão (se existir) usando um id padrão.
   * Exemplo: <button id="btnImprimirAtestado">Imprimir</button>
   */
  function bindPrintButton(buttonId) {
    const id = buttonId || "btnImprimirAtestado";
    const btn = document.getElementById(id);
    if (!btn) return;

    if (btn.dataset.boundPrint === "true") return;
    btn.dataset.boundPrint = "true";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      printAtestado();
    });
  }

  // Expor no namespace
  printNS.atestado = {
    print: printAtestado,
    bindButton: bindPrintButton,
  };
})(window, document);
