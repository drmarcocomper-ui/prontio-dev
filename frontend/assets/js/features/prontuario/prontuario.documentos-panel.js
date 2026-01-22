(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.prontuario = PRONTIO.features.prontuario || {};

  const { qs, qsa, escapeHtml_ } = PRONTIO.features.prontuario.utils;
  const { callApiDataTry_ } = PRONTIO.features.prontuario.api;

  let documentosPanel = null;
  let documentosPanelAside = null;
  let documentosPanelLastFocus = null;
  let docTipoAtual = "";

  let docSuggestTimer = null;

  const docState = {
    atestado: { cidObj: null },
    encaminhamento: { pick: null },
  };

  function docTipoLabel_(t) {
    const tipo = String(t || "").toLowerCase();
    if (tipo === "atestado") return "Atestado médico";
    if (tipo === "comparecimento") return "Declaração de comparecimento";
    if (tipo === "laudo") return "Laudo";
    if (tipo === "encaminhamento") return "Encaminhamento";
    return "Documentos";
  }

  function setMensagemDocumentos_(obj) {
    const el = qs("#mensagemDocumentos");
    if (!el) return;
    el.classList.remove("is-hidden", "msg-erro", "msg-sucesso");
    el.textContent = (obj && obj.texto) || "";
    if (obj && obj.tipo === "erro") el.classList.add("msg-erro");
    if (obj && obj.tipo === "sucesso") el.classList.add("msg-sucesso");
  }

  function looksLikeCidCode_(s) {
    const up = String(s || "").trim().toUpperCase();
    if (!up) return false;
    return /^[A-Z]\d{2}(\.\d{1,2})?$/.test(up) || /^[A-Z]\d{1,2}(\.\d{1,2})?$/.test(up);
  }

  function ensureSuggestSlot_(wrapEl, className) {
    if (!wrapEl) return null;
    let slot = wrapEl.querySelector("." + className);
    if (slot) return slot;

    slot = document.createElement("div");
    slot.className = className;
    slot.style.marginTop = "6px";
    slot.style.border = "1px solid var(--cor-borda-suave, #e5e7eb)";
    slot.style.borderRadius = "10px";
    slot.style.overflow = "hidden";
    slot.style.display = "none";
    slot.style.background = "var(--cor-fundo, #fff)";
    wrapEl.appendChild(slot);
    return slot;
  }

  function hideSuggestSlot_(slot) {
    if (!slot) return;
    slot.innerHTML = "";
    slot.style.display = "none";
  }

  function renderSuggestList_(slot, items, renderItemHtml, onPick) {
    if (!slot) return;
    slot.innerHTML = "";
    if (!items || !items.length) {
      slot.style.display = "none";
      return;
    }

    const ul = document.createElement("ul");
    ul.style.listStyle = "none";
    ul.style.margin = "0";
    ul.style.padding = "0";

    items.slice(0, 12).forEach((it) => {
      const li = document.createElement("li");
      li.style.borderTop = "1px solid var(--cor-borda-suave, #e5e7eb)";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.width = "100%";
      btn.style.textAlign = "left";
      btn.style.padding = "10px 12px";
      btn.style.border = "0";
      btn.style.background = "transparent";
      btn.style.cursor = "pointer";

      btn.innerHTML = renderItemHtml(it);
      btn.addEventListener("click", () => onPick(it));

      li.appendChild(btn);
      ul.appendChild(li);
    });

    if (ul.firstChild) ul.firstChild.style.borderTop = "0";
    slot.appendChild(ul);
    slot.style.display = "block";
  }

  async function buscarCid_(q) {
    const data = await callApiDataTry_(["Prontuario.CID.Buscar"], { q, limit: 12 });
    const items = (data && data.items) ? data.items : [];
    return Array.isArray(items) ? items : [];
  }

  async function buscarEncaminhamento_(q) {
    const data = await callApiDataTry_(["Prontuario.Encaminhamento.Buscar"], { q, limit: 12 });
    const items = (data && data.items) ? data.items : [];
    return Array.isArray(items) ? items : [];
  }

  function wireCidAutocomplete_() {
    const input = qs("#docCidBusca");
    const hint = qs("#docCidHint");
    if (!input) return;

    const row = input.closest(".form-row");
    const slot = ensureSuggestSlot_(row, "doc-suggest-slot");

    document.addEventListener("click", (ev) => {
      if (!row) return;
      if (!row.contains(ev.target)) hideSuggestSlot_(slot);
    });

    input.addEventListener("input", () => {
      const q = String(input.value || "").trim();

      docState.atestado.cidObj = null;
      if (hint) hint.textContent = "";

      if (docSuggestTimer) clearTimeout(docSuggestTimer);
      hideSuggestSlot_(slot);

      if (q.length < 2) return;

      docSuggestTimer = setTimeout(async () => {
        let items = [];
        try { items = await buscarCid_(q); } catch (_) { items = []; }

        renderSuggestList_(
          slot,
          items,
          (it) => {
            const cid = escapeHtml_(it.cid || "");
            const desc = escapeHtml_(it.descricao || "");
            return `<div style="font-weight:700;font-size:13px;">${cid}</div><div style="font-size:12px;color:#6b7280;margin-top:2px;">${desc}</div>`;
          },
          (picked) => {
            hideSuggestSlot_(slot);
            const cid = String(picked.cid || "").trim().toUpperCase();
            const desc = String(picked.descricao || "").trim();

            docState.atestado.cidObj = { codigo: cid, descricao: desc };
            input.value = cid + (desc ? " - " + desc : "");
            if (hint) hint.textContent = cid ? `Selecionado: ${cid}${desc ? " — " + desc : ""}` : "";
          }
        );
      }, 180);
    });
  }

  function wireEncaminhamentoAutocomplete_() {
    const input = qs("#docEncBusca");
    if (!input) return;

    const row = input.closest(".form-row");
    const slot = ensureSuggestSlot_(row, "doc-suggest-slot");

    document.addEventListener("click", (ev) => {
      if (!row) return;
      if (!row.contains(ev.target)) hideSuggestSlot_(slot);
    });

    input.addEventListener("input", () => {
      const q = String(input.value || "").trim();
      docState.encaminhamento.pick = null;

      if (docSuggestTimer) clearTimeout(docSuggestTimer);
      hideSuggestSlot_(slot);

      if (q.length < 2) return;

      docSuggestTimer = setTimeout(async () => {
        let items = [];
        try { items = await buscarEncaminhamento_(q); } catch (_) { items = []; }

        renderSuggestList_(
          slot,
          items,
          (it) => {
            const enc = escapeHtml_(it.encaminhamento || "");
            const nome = escapeHtml_(it.nomeProfissional || "");
            const tel = escapeHtml_(it.telefone || "");
            const line2 = [nome, tel].filter(Boolean).join(" • ");
            return `<div style="font-weight:700;font-size:13px;">${enc || "(sem título)"}</div>${
              line2 ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${line2}</div>` : ""
            }`;
          },
          (picked) => {
            hideSuggestSlot_(slot);
            docState.encaminhamento.pick = picked || null;

            const enc = String(picked.encaminhamento || "").trim();
            const nome = String(picked.nomeProfissional || "").trim();
            const tel = String(picked.telefone || "").trim();
            const aval = String(picked.avaliacao || "").trim();

            const fEnc = qs("#docEncEncaminhamento");
            const fNome = qs("#docEncNome");
            const fTel = qs("#docEncTelefone");
            const fAval = qs("#docEncAvaliacao");

            if (fEnc) fEnc.value = enc;
            if (fNome) fNome.value = nome;
            if (fTel) fTel.value = tel;
            if (fAval) fAval.value = aval;

            input.value = enc || nome || "";
          }
        );
      }, 180);
    });
  }

  function resetDocumentosUi_() {
    const chooser = qs("#documentosChooser");
    const formWrap = qs("#documentosFormWrap");
    const title = qs("#documentosPanelTitulo");
    const container = qs("#documentosFormContainer");
    const msg = qs("#mensagemDocumentos");

    docTipoAtual = "";
    docState.atestado.cidObj = null;
    docState.encaminhamento.pick = null;

    if (title) title.textContent = "Documentos";
    if (container) container.innerHTML = "";
    if (msg) msg.classList.add("is-hidden");
    if (chooser) chooser.style.display = "";
    if (formWrap) formWrap.style.display = "none";
  }

  function fecharDocumentosPanel_() {
    if (!documentosPanel) return;

    documentosPanel.setAttribute("aria-hidden", "true");
    documentosPanel.style.display = "none";

    resetDocumentosUi_();

    try {
      if (documentosPanelLastFocus && typeof documentosPanelLastFocus.focus === "function") {
        documentosPanelLastFocus.focus();
      }
    } catch (_) {}

    documentosPanelLastFocus = null;
  }

  function abrirDocumentosPanel_() {
    documentosPanel = documentosPanel || qs("#documentosPanel");
    if (!documentosPanel) {
      global.alert("Painel de documentos não encontrado no HTML (#documentosPanel).");
      return;
    }

    documentosPanelAside = documentosPanelAside || documentosPanel.querySelector(".slide-panel");
    documentosPanelLastFocus = document.activeElement;

    resetDocumentosUi_();

    documentosPanel.style.display = "flex";
    documentosPanel.setAttribute("aria-hidden", "false");

    const chooser = qs("#documentosChooser");
    const first = chooser ? chooser.querySelector("button") : null;
    if (first && typeof first.focus === "function") setTimeout(() => first.focus(), 0);
  }

  function renderDocForm_(tipo) {
    const t = String(tipo || "").toLowerCase();
    const title = qs("#documentosPanelTitulo");
    const chooser = qs("#documentosChooser");
    const formWrap = qs("#documentosFormWrap");
    const container = qs("#documentosFormContainer");
    if (!chooser || !formWrap || !container) return;

    docTipoAtual = t;
    if (title) title.textContent = docTipoLabel_(t);

    chooser.style.display = "none";
    formWrap.style.display = "";

    const hoje = new Date().toISOString().slice(0, 10);

    let html = `
      <div class="form-row">
        <label for="docData">Data</label>
        <input type="date" id="docData" value="${hoje}">
      </div>

      <div class="form-row">
        <label for="docTexto">Texto</label>
        <textarea id="docTexto" rows="6" placeholder="Digite o conteúdo do documento..."></textarea>
      </div>
    `;

    if (t === "atestado") {
      html = `
        <div class="form-row">
          <label for="docData">Data</label>
          <input type="date" id="docData" value="${hoje}">
        </div>

        <div class="form-row">
          <label for="docDias">Dias de afastamento (opcional)</label>
          <input type="number" id="docDias" min="0" step="1" placeholder="Ex: 2">
          <small class="texto-menor texto-suave">O texto principal será gerado automaticamente.</small>
        </div>

        <div class="form-row">
          <label for="docCidBusca">CID ou doença (opcional)</label>
          <input type="text" id="docCidBusca" placeholder="Ex: N20.0 ou 'cálculo do rim'">
          <small id="docCidHint" class="texto-menor texto-suave"></small>
        </div>

        <div class="form-row">
          <label class="texto-menor texto-suave" style="display:flex;align-items:center;gap:.5rem;">
            <input type="checkbox" id="docExibirCid" checked>
            Exibir CID no documento (se selecionado)
          </label>
        </div>

        <div class="form-row">
          <label for="docObs">Observações (opcional)</label>
          <textarea id="docObs" rows="3" placeholder="Campo opcional para observações adicionais."></textarea>
        </div>
      `;
    } else if (t === "comparecimento") {
      html = `
        <div class="form-row">
          <label for="docData">Data</label>
          <input type="date" id="docData" value="${hoje}">
        </div>

        <div class="form-row">
          <label for="docEntrada">Horário de entrada (opcional)</label>
          <input type="time" id="docEntrada">
        </div>

        <div class="form-row">
          <label for="docSaida">Horário de saída (opcional)</label>
          <input type="time" id="docSaida">
        </div>

        <div class="form-row">
          <label for="docTexto">Declaração</label>
          <textarea id="docTexto" rows="6" placeholder="Ex: Declaro que o paciente compareceu..."></textarea>
        </div>
      `;
    } else if (t === "laudo") {
      html = `
        <div class="form-row">
          <label for="docData">Data</label>
          <input type="date" id="docData" value="${hoje}">
        </div>

        <div class="form-row">
          <label for="docTitulo">Título</label>
          <input type="text" id="docTitulo" placeholder="Ex: Laudo clínico">
        </div>

        <div class="form-row">
          <label for="docTexto">Conteúdo</label>
          <textarea id="docTexto" rows="8" placeholder="Digite o laudo..."></textarea>
        </div>
      `;
    } else if (t === "encaminhamento") {
      html = `
        <div class="form-row">
          <label for="docData">Data</label>
          <input type="date" id="docData" value="${hoje}">
        </div>

        <div class="form-row">
          <label for="docEncBusca">Buscar profissional/serviço</label>
          <input type="text" id="docEncBusca" placeholder="Digite nome, serviço, telefone...">
          <small class="texto-menor texto-suave">Sugestões vêm da aba "Encaminhamento".</small>
        </div>

        <div class="form-row">
          <label for="docEncEncaminhamento">Encaminhamento</label>
          <input type="text" id="docEncEncaminhamento" placeholder="Ex: Ortopedia / Fisioterapia / Cardiologia">
        </div>

        <div class="form-row">
          <label for="docEncNome">Nome do profissional (opcional)</label>
          <input type="text" id="docEncNome" placeholder="Nome do profissional">
        </div>

        <div class="form-row">
          <label for="docEncTelefone">Telefone (opcional)</label>
          <input type="text" id="docEncTelefone" placeholder="(xx) xxxxx-xxxx">
        </div>

        <div class="form-row">
          <label for="docPrioridade">Prioridade (opcional)</label>
          <select id="docPrioridade">
            <option value="">—</option>
            <option value="Eletivo">Eletivo</option>
            <option value="Prioritário">Prioritário</option>
            <option value="Urgente">Urgente</option>
          </select>
        </div>

        <div class="form-row">
          <label for="docEncAvaliacao">Avaliação / Motivo</label>
          <textarea id="docEncAvaliacao" rows="6" placeholder="Ex: Encaminho para avaliação de..."></textarea>
        </div>

        <div class="form-row">
          <label for="docObs">Observações (opcional)</label>
          <textarea id="docObs" rows="3" placeholder="Campo opcional para observações adicionais."></textarea>
        </div>
      `;
    }

    container.innerHTML = html;

    if (t === "atestado") wireCidAutocomplete_();
    if (t === "encaminhamento") wireEncaminhamentoAutocomplete_();

    const focusEl = container.querySelector("input, textarea, select, button");
    if (focusEl && typeof focusEl.focus === "function") setTimeout(() => focusEl.focus(), 0);
  }

  function collectDocPayload_(ctx) {
    const t = String(docTipoAtual || "").toLowerCase();
    const payload = {
      idPaciente: String(ctx.idPaciente || ctx.ID_Paciente || "").trim(),
      idAgenda: String(ctx.idAgenda || ctx.ID_Agenda || "").trim(),
      tipoDocumento: t,
      data: qs("#docData")?.value || "",
      texto: qs("#docTexto")?.value || "",
    };

    if (t === "atestado") {
      payload.dias = Number(qs("#docDias")?.value || 0);
      payload.exibirCid = !!qs("#docExibirCid")?.checked;
      payload.observacoes = String(qs("#docObs")?.value || "").trim();
      payload.texto = "";

      if (docState.atestado.cidObj) {
        payload.cidObj = {
          codigo: String(docState.atestado.cidObj.codigo || "").trim(),
          descricao: String(docState.atestado.cidObj.descricao || "").trim(),
        };
        payload.cid = payload.cidObj.codigo || "";
      } else {
        const raw = String(qs("#docCidBusca")?.value || "").trim();
        const token = raw.split("-")[0].trim().split(/\s+/)[0].trim();
        payload.cid = looksLikeCidCode_(token) ? token.toUpperCase() : "";
      }

      return payload;
    }

    if (t === "comparecimento") {
      payload.entrada = String(qs("#docEntrada")?.value || "").trim();
      payload.saida = String(qs("#docSaida")?.value || "").trim();
      payload.horario = String(qs("#docHorario")?.value || "").trim();
      return payload;
    }

    if (t === "laudo") {
      payload.titulo = String(qs("#docTitulo")?.value || "").trim();
      return payload;
    }

    if (t === "encaminhamento") {
      payload.prioridade = String(qs("#docPrioridade")?.value || "").trim();
      payload.observacoes = String(qs("#docObs")?.value || "").trim();

      payload.encaminhamento = String(qs("#docEncEncaminhamento")?.value || "").trim();
      payload.nomeProfissional = String(qs("#docEncNome")?.value || "").trim();
      payload.telefone = String(qs("#docEncTelefone")?.value || "").trim();
      payload.avaliacao = String(qs("#docEncAvaliacao")?.value || "").trim();

      payload.destino = payload.encaminhamento;
      payload.texto = payload.avaliacao || payload.texto;

      return payload;
    }

    return payload;
  }

  async function gerarDocumento_(ctx) {
    const t = String(docTipoAtual || "").toLowerCase();
    if (!t) return;

    const payload = collectDocPayload_(ctx);
    if (!payload.idPaciente) {
      setMensagemDocumentos_({ tipo: "erro", texto: "Paciente não identificado." });
      return;
    }

    const ACTIONS_BY_TYPE = {
      atestado: [
        "Prontuario.Atestado.GerarPdf",
        "Atestado.GerarPdf",
        "Atestado.GerarPDF",
        "Documentos.Atestado.GerarPdf",
        "Documentos.GerarPdfAtestado",
      ],
      comparecimento: [
        "Prontuario.Comparecimento.GerarPdf",
        "Comparecimento.GerarPdf",
        "Comparecimento.GerarPDF",
        "Documentos.Comparecimento.GerarPdf",
        "Documentos.GerarPdfComparecimento",
      ],
      laudo: [
        "Prontuario.Laudo.GerarPdf",
        "Laudo.GerarPdf",
        "Laudo.GerarPDF",
        "Laudos.GerarPdf",
        "Documentos.Laudo.GerarPdf",
      ],
      encaminhamento: [
        "Prontuario.Encaminhamento.GerarPdf",
        "Encaminhamento.GerarPdf",
        "Encaminhamento.GerarPDF",
        "Documentos.Encaminhamento.GerarPdf",
        "Documentos.GerarPdfEncaminhamento",
      ],
    };

    setMensagemDocumentos_({ tipo: "sucesso", texto: "Gerando documento..." });

    try {
      const data = await callApiDataTry_(ACTIONS_BY_TYPE[t] || [], payload);

      const html =
        (data && data.html) ||
        (data && data.documento && data.documento.html) ||
        (data && data.pdf && data.pdf.html) ||
        "";

      if (!html) {
        setMensagemDocumentos_({ tipo: "erro", texto: "A API não retornou HTML para impressão." });
        return;
      }

      const win = global.open("", "_blank");
      if (!win) {
        setMensagemDocumentos_({ tipo: "erro", texto: "Pop-up bloqueado. Libere para imprimir o documento." });
        return;
      }

      win.document.open();
      win.document.write(String(html));
      win.document.close();
      win.focus();

      setMensagemDocumentos_({ tipo: "sucesso", texto: "Documento gerado." });
    } catch (e) {
      setMensagemDocumentos_({ tipo: "erro", texto: "Erro ao gerar documento." });
    }
  }

  function setupDocumentosPanelEvents_(ctx) {
    documentosPanel = qs("#documentosPanel");
    if (!documentosPanel) return;

    documentosPanelAside = documentosPanel.querySelector(".slide-panel");

    qsa("[data-close-documentos]").forEach((btn) => {
      btn.addEventListener("click", () => fecharDocumentosPanel_());
    });

    documentosPanel.addEventListener("click", (ev) => {
      if (!documentosPanelAside) return;
      if (ev.target === documentosPanel) fecharDocumentosPanel_();
    });

    qsa("#documentosChooser .doc-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tipo = btn.getAttribute("data-doc") || "";
        renderDocForm_(tipo);
      });
    });

    qs("#btnDocVoltar")?.addEventListener("click", () => {
      resetDocumentosUi_();
      const chooser = qs("#documentosChooser");
      const first = chooser ? chooser.querySelector("button") : null;
      if (first && typeof first.focus === "function") first.focus();
    });

    qs("#formDocumentoProntuario")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      gerarDocumento_(ctx);
    });
  }

  PRONTIO.features.prontuario.documentos = {
    setupDocumentosPanelEvents_,
    abrirDocumentosPanel_,
    fecharDocumentosPanel_,
    getPanelRefs: () => ({ panel: documentosPanel, aside: documentosPanelAside }),
  };
})(window, document);
