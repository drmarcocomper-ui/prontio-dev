(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.prontuario = PRONTIO.features.prontuario || {};

  const { qs, qsa, setBtnMais_, escapeHtml_, formatDataHoraCompleta_, createPagingState_, showToast_, extractErrorMessage_ } =
    PRONTIO.features.prontuario.utils;
  const { callApiData, callApiDataTry_ } = PRONTIO.features.prontuario.api;

  // Estado do panel
  let anamnesePanel = null;
  let anamnesePanelAside = null;
  let anamnesePanelLastFocus = null;
  let anamnesePaging = createPagingState_();

  // ============================================================
  // PANEL OPEN/CLOSE
  // ============================================================

  function fecharAnamnesePanel_() {
    if (!anamnesePanel) return;

    anamnesePanel.setAttribute("aria-hidden", "true");
    anamnesePanel.setAttribute("inert", "");
    anamnesePanel.style.display = "none";

    try {
      if (anamnesePanelLastFocus && typeof anamnesePanelLastFocus.focus === "function") {
        anamnesePanelLastFocus.focus();
      }
    } catch (_) {}

    anamnesePanelLastFocus = null;
  }

  function abrirAnamnesePanel_(ctx) {
    anamnesePanel = anamnesePanel || qs("#anamnesePanel");
    if (!anamnesePanel) {
      showToast_("Painel de anamnese nao encontrado no HTML.", "error");
      return;
    }

    anamnesePanelAside = anamnesePanelAside || anamnesePanel.querySelector(".slide-panel");
    anamnesePanelLastFocus = document.activeElement;

    anamnesePanel.style.display = "flex";
    anamnesePanel.setAttribute("aria-hidden", "false");
    anamnesePanel.removeAttribute("inert");

    // Limpa formulario
    const form = qs("#formAnamnese");
    if (form) form.reset();

    // Carrega historico
    carregarHistoricoAnamneses_(ctx);

    // Foco no primeiro campo
    const focusTarget = qs("#anamnese-titulo");
    if (focusTarget && typeof focusTarget.focus === "function") {
      setTimeout(() => focusTarget.focus(), 0);
    }
  }

  function setupAnamnesePanelEvents_(ctx) {
    anamnesePanel = qs("#anamnesePanel");
    if (!anamnesePanel) return;

    anamnesePanelAside = anamnesePanel.querySelector(".slide-panel");

    // Botoes de fechar
    qsa("[data-close-anamnese]").forEach((btn) => {
      btn.addEventListener("click", () => fecharAnamnesePanel_());
    });

    // Clique no backdrop fecha
    anamnesePanel.addEventListener("click", (ev) => {
      if (!anamnesePanelAside) return;
      if (ev.target === anamnesePanel) fecharAnamnesePanel_();
    });

    // Submit do formulario
    const formAnamnese = qs("#formAnamnese");
    if (formAnamnese) {
      formAnamnese.addEventListener("submit", (ev) => onSubmitAnamnese_(ev, ctx));
    }

    // Botao carregar mais
    const btnMais = qs("#btnMaisAnamneses");
    if (btnMais) {
      anamnesePaging.btnMais = btnMais;
      btnMais.addEventListener("click", () => carregarHistoricoAnamnesesPaged_(ctx, { append: true }));
    }
  }

  // ============================================================
  // SUBMIT - SALVAR ANAMNESE (TITULO + TEXTO)
  // ============================================================

  async function onSubmitAnamnese_(ev, ctx) {
    ev.preventDefault();

    const idPaciente = String(ctx.idPaciente || ctx.ID_Paciente || "").trim();
    if (!idPaciente) {
      showToast_("Paciente nao identificado.", "error");
      return;
    }

    const tituloEl = qs("#anamnese-titulo");
    const textoEl = qs("#anamnese-texto");

    const titulo = tituloEl ? tituloEl.value.trim() : "";
    const texto = textoEl ? textoEl.value.trim() : "";

    if (!titulo) {
      showToast_("Informe o titulo da anamnese.", "error");
      if (tituloEl) tituloEl.focus();
      return;
    }

    if (!texto) {
      showToast_("Informe o texto da anamnese.", "error");
      if (textoEl) textoEl.focus();
      return;
    }

    const payload = {
      idPaciente: idPaciente,
      idProfissional: ctx.idProfissional || "",
      nomeTemplate: titulo,
      dados: {
        titulo: titulo,
        texto: texto
      }
    };

    const btnSubmit = ev.submitter || qs("#formAnamnese button[type='submit']");
    if (btnSubmit) btnSubmit.disabled = true;

    try {
      await callApiData({ action: "Anamnese.Salvar", payload: payload });

      showToast_("Anamnese salva com sucesso!", "success");

      // Limpa formulario
      const form = qs("#formAnamnese");
      if (form) form.reset();

      // Recarrega historico
      carregarHistoricoAnamneses_(ctx);

    } catch (err) {
      console.error("[PRONTIO] Erro ao salvar anamnese:", err);
      showToast_("Erro ao salvar anamnese: " + extractErrorMessage_(err), "error");
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
    }
  }

  // ============================================================
  // HISTORICO DE ANAMNESES
  // ============================================================

  async function carregarHistoricoAnamneses_(ctx) {
    return carregarHistoricoAnamnesesPaged_(ctx, { append: false, limit: 10 });
  }

  async function carregarHistoricoAnamnesesPaged_(ctx, opts) {
    const append = !!(opts && opts.append);
    const limit = opts && opts.limit ? Number(opts.limit) : 10;

    const lista = qs("#anamnese-lista");
    const vazio = qs("#anamnese-historico-vazio");

    if (!lista) return;

    if (anamnesePaging.loading) return;
    anamnesePaging.loading = true;
    setBtnMais_(anamnesePaging.btnMais, anamnesePaging.hasMore, true);

    const idPaciente = String(ctx.idPaciente || ctx.ID_Paciente || "").trim();
    if (!idPaciente) {
      if (vazio) {
        vazio.textContent = "Nenhum paciente selecionado.";
        vazio.classList.remove("is-hidden");
      }
      lista.innerHTML = "";
      anamnesePaging.loading = false;
      anamnesePaging.hasMore = false;
      setBtnMais_(anamnesePaging.btnMais, false, false);
      return;
    }

    if (!append) {
      if (vazio) {
        vazio.textContent = "Carregando historico...";
        vazio.classList.remove("is-hidden");
      }
      lista.innerHTML = "";
      anamnesePaging.lista = [];
      anamnesePaging.cursor = null;
      anamnesePaging.hasMore = false;
    }

    try {
      const payload = { idPaciente: idPaciente, limit: limit };
      if (append && anamnesePaging.cursor) payload.cursor = anamnesePaging.cursor;

      const data = await callApiDataTry_(
        ["Anamnese.ListarPorPacientePaged", "Anamnese.ListarPorPaciente"],
        payload
      );

      const items = data && (data.items || data.anamneses || []);
      const hasMore = !!(data && data.hasMore);
      const nextCursor = data && data.nextCursor ? data.nextCursor : null;

      if (!append) anamnesePaging.lista = items.slice();
      else anamnesePaging.lista = anamnesePaging.lista.concat(items);

      renderListaAnamneses_(anamnesePaging.lista, lista, vazio);

      anamnesePaging.cursor = nextCursor;
      anamnesePaging.hasMore = hasMore && !!nextCursor;

    } catch (err) {
      console.error("[PRONTIO] Erro ao carregar historico de anamneses:", err);
      if (vazio) {
        vazio.textContent = "Erro ao carregar historico.";
        vazio.classList.remove("is-hidden");
      }
      anamnesePaging.hasMore = false;
    } finally {
      anamnesePaging.loading = false;
      setBtnMais_(anamnesePaging.btnMais, anamnesePaging.hasMore, false);
    }
  }

  function renderListaAnamneses_(lista, ul, vazio) {
    ul.innerHTML = "";

    if (!lista || !lista.length) {
      if (vazio) {
        vazio.textContent = "Nenhuma anamnese registrada para este paciente.";
        vazio.classList.remove("is-hidden");
      }
      return;
    }

    if (vazio) vazio.classList.add("is-hidden");

    lista.forEach((anamnese) => {
      const item = document.createElement("div");
      item.className = "anamnese-historico-item";
      item.dataset.idAnamnese = anamnese.idAnamnese;

      const titulo = anamnese.nomeTemplate || (anamnese.dados && anamnese.dados.titulo) || "Anamnese";

      // Resumo do texto
      let resumo = "";
      if (anamnese.dados && anamnese.dados.texto) {
        resumo = String(anamnese.dados.texto).substring(0, 100);
        if (anamnese.dados.texto.length > 100) resumo += "...";
      }

      item.innerHTML = `
        <div class="anamnese-historico-item__header">
          <span class="anamnese-historico-item__titulo">${escapeHtml_(titulo)}</span>
        </div>
        ${resumo ? `<div class="anamnese-historico-item__resumo texto-menor">${escapeHtml_(resumo)}</div>` : ""}
        <div class="anamnese-historico-item__actions">
          <button type="button" class="btn btn-secondary btn-sm js-anamnese-ver">Ver</button>
        </div>
      `;

      const btnVer = item.querySelector(".js-anamnese-ver");
      if (btnVer) {
        btnVer.addEventListener("click", (ev) => {
          ev.preventDefault();
          abrirDetalheAnamnese_(anamnese);
        });
      }

      ul.appendChild(item);
    });
  }

  function abrirDetalheAnamnese_(anamnese) {
    const modal = document.createElement("div");
    modal.className = "modal-backdrop anamnese-detalhe-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const titulo = anamnese.nomeTemplate || (anamnese.dados && anamnese.dados.titulo) || "Anamnese";
    const texto = (anamnese.dados && anamnese.dados.texto) || "";

    modal.innerHTML = `
      <div class="modal modal--lg">
        <div class="modal-header">
          <h2 class="modal-title">${escapeHtml_(titulo)}</h2>
          <div class="modal-header-actions">
            <button type="button" class="modal-close" aria-label="Fechar">X</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="anamnese-texto-completo" style="white-space: pre-wrap;">${escapeHtml_(texto)}</div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary js-fechar-modal">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Eventos de fechar
    modal.querySelector(".modal-close")?.addEventListener("click", () => modal.remove());
    modal.querySelector(".js-fechar-modal")?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) modal.remove();
    });

    // ESC fecha
    const handleEsc = (ev) => {
      if (ev.key === "Escape") {
        modal.remove();
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);
  }

  // ============================================================
  // EXPORTS
  // ============================================================

  PRONTIO.features.prontuario.anamnese = {
    setupAnamnesePanelEvents_,
    abrirAnamnesePanel_: abrirAnamnesePanel_,
    fecharAnamnesePanel_,
    carregarHistoricoAnamneses_,
    getPanelRefs: () => ({ panel: anamnesePanel, aside: anamnesePanelAside }),
    getAnamnesePaging: () => anamnesePaging,
    setBtnMaisRef: (btn) => (anamnesePaging.btnMais = btn)
  };

})(window, document);
