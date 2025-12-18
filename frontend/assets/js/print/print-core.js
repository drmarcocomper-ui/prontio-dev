// assets/js/print/print-core.js
// Funções compartilhadas para geração de documentos de impressão
// (receita, laudo, atestado, encaminhamento, etc.).
//
// Ideia: cada arquivo print-*.js monta apenas o "miolo" do documento
// (conteúdo clínico) e delega header/footer e janela de impressão
// para este módulo.

(function (global) {
  "use strict";

  const PRONTIO = global.PRONTIO = global.PRONTIO || {};
  PRONTIO.print = PRONTIO.print || {};

  function defaultHeaderRenderer(meta) {
    // meta pode conter: medicoNome, medicoCRM, logoUrl, tituloDocumento, data
    const doctorName = (meta && meta.medicoNome) || "Dr(a). Nome do Médico";
    const doctorCRM = (meta && meta.medicoCRM) || "CRM 000000";
    const title = (meta && meta.tituloDocumento) || "";
    const data = (meta && meta.data) || "";

    return `
      <header class="prontio-print-header">
        <div class="prontio-print-header-left">
          ${meta && meta.logoUrl ? `<img src="${meta.logoUrl}" class="prontio-print-logo" />` : ""}
        </div>
        <div class="prontio-print-header-center">
          <div class="prontio-print-medico">${doctorName}</div>
          <div class="prontio-print-crm">${doctorCRM}</div>
          ${title ? `<div class="prontio-print-titulo">${title}</div>` : ""}
        </div>
        <div class="prontio-print-header-right">
          ${data ? `<div class="prontio-print-data">${data}</div>` : ""}
        </div>
      </header>
    `;
  }

  function defaultFooterRenderer(meta) {
    const assinatura = (meta && meta.assinaturaTexto) || "";
    const cidadeData = (meta && meta.cidadeData) || "";

    return `
      <footer class="prontio-print-footer">
        ${cidadeData ? `<div class="prontio-print-cidade-data">${cidadeData}</div>` : ""}
        <div class="prontio-print-assinatura">
          ${meta && meta.assinaturaImagemUrl ? `<img src="${meta.assinaturaImagemUrl}" class="prontio-print-assinatura-img" />` : ""}
          ${assinatura ? `<div class="prontio-print-assinatura-texto">${assinatura}</div>` : ""}
        </div>
      </footer>
    `;
  }

  const PrintCore = {
    headerRenderer: defaultHeaderRenderer,
    footerRenderer: defaultFooterRenderer,

    /**
     * Permite sobrescrever o renderer de header globalmente.
     */
    setHeaderRenderer(fn) {
      if (typeof fn === "function") {
        this.headerRenderer = fn;
      }
    },

    /**
     * Permite sobrescrever o renderer de footer globalmente.
     */
    setFooterRenderer(fn) {
      if (typeof fn === "function") {
        this.footerRenderer = fn;
      }
    },

    /**
     * Gera HTML completo da página de impressão.
     * @param {Object} options
     * @param {string} options.title - título da aba/janela
     * @param {string} options.contentHtml - conteúdo do documento (miolo)
     * @param {Object} options.meta - metadados usados em header/footer
     */
    buildHtml(options) {
      const title = (options && options.title) || "Documento";
      const contentHtml = (options && options.contentHtml) || "";
      const meta = (options && options.meta) || {};

      const headerHtml = this.headerRenderer(meta);
      const footerHtml = this.footerRenderer(meta);

      // Estilos básicos. Idealmente extrair para CSS específico de impressão.
      const styles = `
        <style>
          @page { margin: 20mm; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12pt;
            color: #000;
          }
          .prontio-print-header, .prontio-print-footer {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
          }
          .prontio-print-header-center {
            text-align: center;
            flex: 1;
          }
          .prontio-print-medico {
            font-weight: bold;
            font-size: 14pt;
          }
          .prontio-print-crm {
            font-size: 11pt;
          }
          .prontio-print-titulo {
            font-size: 13pt;
            margin-top: 8px;
            text-transform: uppercase;
          }
          .prontio-print-logo {
            max-height: 60px;
          }
          .prontio-print-assinatura {
            margin-top: 40px;
            text-align: center;
          }
          .prontio-print-assinatura-img {
            max-height: 80px;
            display: block;
            margin: 0 auto 8px;
          }
          .prontio-print-container {
            page-break-after: auto;
          }
        </style>
      `;

      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>${title}</title>
          ${styles}
        </head>
        <body>
          <div class="prontio-print-container">
            ${headerHtml}
            <main class="prontio-print-content">
              ${contentHtml}
            </main>
            ${footerHtml}
          </div>
        </body>
        </html>
      `;

      return html;
    },

    /**
     * Abre uma nova janela com o HTML gerado e dispara window.print().
     * @param {Object} options - mesmos parâmetros de buildHtml
     */
    openPrintWindow(options) {
      const html = this.buildHtml(options);
      const win = global.open("", "_blank");

      if (!win) {
        console.error("[PrintCore] Não foi possível abrir janela de impressão (popup bloqueado?).");
        return;
      }

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();

      // pequeno delay para garantir que o conteúdo seja renderizado
      setTimeout(() => {
        win.print();
        // opcional: fechar a janela após print
        // win.close();
      }, 300);
    }
  };

  PRONTIO.print.core = PrintCore;

})(window);
