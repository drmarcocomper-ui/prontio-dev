// frontend/assets/js/pages/page-prontuario.js
(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO._pageInited = PRONTIO._pageInited || {};

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      return Promise.reject(
        new Error(
          "API não disponível (callApiData indefinido). Verifique se assets/js/core/api.js foi carregado antes."
        )
      );
    };

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

  // ============================================================
  // Estado geral
  // ============================================================

  let idEvolucaoEmEdicao = null;
  let historicoCompletoCarregado = false;

  // Evoluções paginadas
  let evoPaging = {
    btnMais: null,
    cursor: null,
    hasMore: false,
    loading: false,
    lista: [],
    lastLimit: 10,
  };

  // Receitas paginadas
  let recPaging = {
    btnMais: null,
    cursor: null,
    hasMore: false,
    loading: false,
    lista: [],
  };

  // Painel Receita
  let receitaPanel = null;
  let receitaPanelAside = null;
  let receitaPanelLastFocus = null;

  // Painel Documentos
  let documentosPanel = null;
  let documentosPanelAside = null;
  let documentosPanelLastFocus = null;
  let docTipoAtual = ""; // atestado | comparecimento | laudo | encaminhamento

  // Mini-cards de medicamento
  let receitaMedCounter = 0;

  // Autocomplete (debounce)
  let medSuggestTimer = null;

  // ============================================================
  // Helpers de API
  // ============================================================

  async function callApiDataTry_(actions, payload) {
    const list = Array.isArray(actions) ? actions : [actions];
    let lastErr = null;

    for (let i = 0; i < list.length; i++) {
      const action = list[i];
      try {
        const data = await callApiData({ action, payload: payload || {} });
        return data;
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Falha ao chamar API (todas as actions falharam).");
  }

  // ============================================================
  // Contexto
  // ============================================================

  function getQueryParams() {
    const params = new URLSearchParams(global.location.search || "");
    const obj = {};
    params.forEach((v, k) => (obj[k] = v));
    return obj;
  }

  function carregarContextoProntuario() {
    const params = getQueryParams();
    let ctxStorage = null;
    let ctxState = null;

    try {
      const raw = global.localStorage.getItem("prontio.prontuarioContexto");
      if (raw) ctxStorage = JSON.parse(raw);
    } catch (e) {}

    try {
      if (PRONTIO.core && PRONTIO.core.state && PRONTIO.core.state.getPacienteAtual) {
        ctxState = PRONTIO.core.state.getPacienteAtual();
      } else if (PRONTIO.state && PRONTIO.state.getPacienteAtual) {
        ctxState = PRONTIO.state.getPacienteAtual();
      }
    } catch (e) {}

    return {
      idPaciente:
        params.idPaciente ||
        params.pacienteId ||
        params.id ||
        (ctxStorage && (ctxStorage.ID_Paciente || ctxStorage.idPaciente)) ||
        (ctxState && (ctxState.ID_Paciente || ctxState.idPaciente)) ||
        "",
      idAgenda:
        params.idAgenda ||
        params.agendaId ||
        (ctxStorage && (ctxStorage.ID_Agenda || ctxStorage.idAgenda)) ||
        (ctxState && (ctxState.ID_Agenda || ctxState.idAgenda)) ||
        "",
      nome:
        params.nome ||
        params.pacienteNome ||
        (ctxStorage && (ctxStorage.nome_paciente || ctxStorage.nome)) ||
        (ctxState && (ctxState.nome || ctxState.nomeCompleto)) ||
        "—",
    };
  }

  // ============================================================
  // Datas / Formatos
  // ============================================================

  function parseDataHora(raw) {
    if (!raw) return null;
    let d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    d = new Date(String(raw).replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  }

  function formatIsoDateToBR_(iso) {
    if (!iso) return "";
    const partes = String(iso).split("-");
    if (partes.length !== 3) return "";
    const [ano, mes, dia] = partes;
    if (!ano || !mes || !dia) return "";
    return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
  }

  function formatTipoReceitaLabel_(raw) {
    const s = String(raw || "").trim();
    if (!s) return "Comum";
    const up = s.toUpperCase();
    if (up === "COMUM") return "Comum";
    if (up === "ESPECIAL") return "Especial";
    if (s === "Comum" || s === "Especial") return s;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function _setBtnMais_(btn, hasMore, loading) {
    if (!btn) return;
    btn.style.display = hasMore ? "inline-flex" : "none";
    btn.disabled = !!loading;
  }

  function _escapeHtml_(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ============================================================
  // Topo do paciente
  // ============================================================

  function setTextOrDash_(selector, value) {
    const el = qs(selector);
    if (!el) return;
    const s = value === null || value === undefined ? "" : String(value).trim();
    el.textContent = s ? s : "—";
  }

  async function carregarResumoPaciente_(ctx) {
    setTextOrDash_("#prontuario-paciente-nome", ctx.nome || "—");

    if (!ctx.idPaciente) {
      setTextOrDash_("#prontuario-paciente-idade", "—");
      setTextOrDash_("#prontuario-paciente-profissao", "—");
      setTextOrDash_("#prontuario-paciente-plano", "—");
      setTextOrDash_("#prontuario-paciente-carteirinha", "—");
      return;
    }

    try {
      const data = await callApiDataTry_(
        ["Prontuario.Paciente.ObterResumo", "Pacientes.ObterPorId", "Pacientes_ObterPorId"],
        { idPaciente: ctx.idPaciente }
      );

      const pac = data && data.paciente ? data.paciente : data;

      const nome = (pac && (pac.nomeCompleto || pac.nomeExibicao || pac.nome || pac.Nome)) || ctx.nome || "—";
      const idade = pac && (pac.idade || pac.Idade);
      const profissao = pac && (pac.profissao || pac.Profissao);
      const plano = pac && (pac.planoSaude || pac.convenio || pac.PlanoSaude || pac.Convenio || pac.plano);
      const carteirinha = pac && (pac.carteirinha || pac.numeroCarteirinha || pac.NumeroCarteirinha || pac.Carteirinha);

      setTextOrDash_("#prontuario-paciente-nome", nome);
      setTextOrDash_("#prontuario-paciente-idade", idade);
      setTextOrDash_("#prontuario-paciente-profissao", profissao);
      setTextOrDash_("#prontuario-paciente-plano", plano);
      setTextOrDash_("#prontuario-paciente-carteirinha", carteirinha);
    } catch (e) {
      setTextOrDash_("#prontuario-paciente-idade", "—");
      setTextOrDash_("#prontuario-paciente-profissao", "—");
      setTextOrDash_("#prontuario-paciente-plano", "—");
      setTextOrDash_("#prontuario-paciente-carteirinha", "—");
    }
  }

  // ============================================================
  // Trap Focus (painéis)
  // ============================================================

  function _trapFocusInPanel_(panelAside, e) {
    if (!panelAside) return;
    if (e.key !== "Tab") return;

    const focusables = panelAside.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const list = Array.from(focusables).filter((el) => el.offsetParent !== null);
    if (!list.length) return;

    const first = list[0];
    const last = list[list.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ============================================================
  // Painel Receita (existente)
  // ============================================================

  function fecharReceitaPanel_() {
    if (!receitaPanel) return;

    receitaPanel.setAttribute("aria-hidden", "true");
    receitaPanel.style.display = "none";

    try {
      if (receitaPanelLastFocus && typeof receitaPanelLastFocus.focus === "function") {
        receitaPanelLastFocus.focus();
      }
    } catch (_) {}

    receitaPanelLastFocus = null;
  }

  function abrirReceitaPanel_() {
    receitaPanel = receitaPanel || qs("#receitaPanel");
    if (!receitaPanel) {
      global.alert("Painel de receita não encontrado no HTML (#receitaPanel).");
      return;
    }

    receitaPanelAside = receitaPanelAside || receitaPanel.querySelector(".slide-panel");
    receitaPanelLastFocus = document.activeElement;

    receitaPanel.style.display = "flex";
    receitaPanel.setAttribute("aria-hidden", "false");

    const focusTarget =
      qs("#receitaData") ||
      (receitaPanelAside ? receitaPanelAside.querySelector("input, textarea, button") : null);

    if (focusTarget && typeof focusTarget.focus === "function") {
      setTimeout(() => focusTarget.focus(), 0);
    }
  }

  function setupReceitaPanelEvents_() {
    receitaPanel = qs("#receitaPanel");
    if (!receitaPanel) return;

    receitaPanelAside = receitaPanel.querySelector(".slide-panel");

    qsa("[data-close-receita]").forEach((btn) => {
      btn.addEventListener("click", () => fecharReceitaPanel_());
    });

    receitaPanel.addEventListener("click", (ev) => {
      if (!receitaPanelAside) return;
      if (ev.target === receitaPanel) fecharReceitaPanel_();
    });
  }

  // ============================================================
  // Painel Documentos (submenu + formulário)
  // ============================================================

  function _docTipoLabel_(t) {
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

  function _resetDocumentosUi_() {
    const chooser = qs("#documentosChooser");
    const formWrap = qs("#documentosFormWrap");
    const title = qs("#documentosPanelTitulo");
    const container = qs("#documentosFormContainer");
    const msg = qs("#mensagemDocumentos");

    docTipoAtual = "";
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

    _resetDocumentosUi_();

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

    _resetDocumentosUi_();

    documentosPanel.style.display = "flex";
    documentosPanel.setAttribute("aria-hidden", "false");

    const chooser = qs("#documentosChooser");
    const first = chooser ? chooser.querySelector("button") : null;
    if (first && typeof first.focus === "function") setTimeout(() => first.focus(), 0);
  }

  function _renderDocForm_(tipo) {
    const t = String(tipo || "").toLowerCase();
    const title = qs("#documentosPanelTitulo");
    const chooser = qs("#documentosChooser");
    const formWrap = qs("#documentosFormWrap");
    const container = qs("#documentosFormContainer");
    if (!chooser || !formWrap || !container) return;

    docTipoAtual = t;
    if (title) title.textContent = _docTipoLabel_(t);

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
          <label for="docDias">Dias de afastamento</label>
          <input type="number" id="docDias" min="0" step="1" placeholder="Ex: 2">
        </div>

        <div class="form-row">
          <label for="docTexto">Observações</label>
          <textarea id="docTexto" rows="5" placeholder="Ex: Atesto para os devidos fins..."></textarea>
        </div>
      `;
    } else if (t === "comparecimento") {
      html = `
        <div class="form-row">
          <label for="docData">Data</label>
          <input type="date" id="docData" value="${hoje}">
        </div>

        <div class="form-row">
          <label for="docHorario">Horário (opcional)</label>
          <input type="text" id="docHorario" placeholder="Ex: 14:00 às 15:30">
        </div>

        <div class="form-row">
          <label for="docTexto">Declaração</label>
          <textarea id="docTexto" rows="5" placeholder="Ex: Declaro que o paciente compareceu..."></textarea>
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
          <textarea id="docTexto" rows="7" placeholder="Digite o laudo..."></textarea>
        </div>
      `;
    } else if (t === "encaminhamento") {
      html = `
        <div class="form-row">
          <label for="docData">Data</label>
          <input type="date" id="docData" value="${hoje}">
        </div>

        <div class="form-row">
          <label for="docDestino">Encaminhar para</label>
          <input type="text" id="docDestino" placeholder="Ex: Ortopedia / Fisioterapia / Cardiologia">
        </div>

        <div class="form-row">
          <label for="docTexto">Motivo / Observações</label>
          <textarea id="docTexto" rows="5" placeholder="Ex: Encaminho para avaliação de..."></textarea>
        </div>
      `;
    }

    container.innerHTML = html;

    const focusEl = container.querySelector("input, textarea, button");
    if (focusEl && typeof focusEl.focus === "function") setTimeout(() => focusEl.focus(), 0);
  }

  function _collectDocPayload_(ctx) {
    const t = String(docTipoAtual || "").toLowerCase();
    const payload = {
      idPaciente: String(ctx.idPaciente || "").trim(),
      idAgenda: String(ctx.idAgenda || "").trim(),
      tipoDocumento: t,
      data: qs("#docData")?.value || "",
      texto: qs("#docTexto")?.value || "",
    };

    if (t === "atestado") payload.dias = Number(qs("#docDias")?.value || 0);
    if (t === "comparecimento") payload.horario = qs("#docHorario")?.value || "";
    if (t === "laudo") payload.titulo = qs("#docTitulo")?.value || "";
    if (t === "encaminhamento") payload.destino = qs("#docDestino")?.value || "";

    return payload;
  }

  async function _gerarDocumento_(ctx) {
    const t = String(docTipoAtual || "").toLowerCase();
    if (!t) return;

    const payload = _collectDocPayload_(ctx);
    if (!payload.idPaciente) {
      setMensagemDocumentos_({ tipo: "erro", texto: "Paciente não identificado." });
      return;
    }

    // ✅ fallbacks (não quebra o que já existe)
    const ACTIONS_BY_TYPE = {
      atestado: ["Atestado.GerarPdf", "Atestado.GerarPDF", "Documentos.Atestado.GerarPdf", "Prontuario.Atestado.GerarPdf"],
      comparecimento: ["Comparecimento.GerarPdf", "Comparecimento.GerarPDF", "Documentos.Comparecimento.GerarPdf", "Prontuario.Comparecimento.GerarPdf"],
      laudo: ["Laudo.GerarPdf", "Laudo.GerarPDF", "Laudos.GerarPdf", "Prontuario.Laudo.GerarPdf"],
      encaminhamento: ["Encaminhamento.GerarPdf", "Encaminhamento.GerarPDF", "Documentos.Encaminhamento.GerarPdf", "Prontuario.Encaminhamento.GerarPdf"],
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

    // fechar
    qsa("[data-close-documentos]").forEach((btn) => {
      btn.addEventListener("click", () => fecharDocumentosPanel_());
    });

    // clique fora
    documentosPanel.addEventListener("click", (ev) => {
      if (!documentosPanelAside) return;
      if (ev.target === documentosPanel) fecharDocumentosPanel_();
    });

    // submenu -> formulário
    qsa("#documentosChooser .doc-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tipo = btn.getAttribute("data-doc") || "";
        _renderDocForm_(tipo);
      });
    });

    // voltar
    qs("#btnDocVoltar")?.addEventListener("click", () => {
      _resetDocumentosUi_();
      const chooser = qs("#documentosChooser");
      const first = chooser ? chooser.querySelector("button") : null;
      if (first && typeof first.focus === "function") first.focus();
    });

    // submit
    qs("#formDocumentoProntuario")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      _gerarDocumento_(ctx);
    });
  }

  // ============================================================
  // Receita — mini-cards + autocomplete (mantido)
  // ============================================================

  function _splitPosologias_(raw) {
    const s = String(raw || "").trim();
    if (!s) return [];
    let parts = [];
    if (s.includes("\n")) parts = s.split("\n");
    else if (s.includes(";")) parts = s.split(";");
    else parts = [s];
    return parts.map((p) => String(p || "").trim()).filter(Boolean).slice(0, 8);
  }

  function _highlightHtml_(text, term) {
    const t = String(term || "").trim();
    const s = String(text || "");
    if (!t) return _escapeHtml_(s);

    const idx = s.toLowerCase().indexOf(t.toLowerCase());
    if (idx < 0) return _escapeHtml_(s);

    const before = s.slice(0, idx);
    const hit = s.slice(idx, idx + t.length);
    const after = s.slice(idx + t.length);
    return `${_escapeHtml_(before)}<span class="rx-hl">${_escapeHtml_(hit)}</span>${_escapeHtml_(after)}`;
  }

  function atualizarTituloMedicamentos_() {
    const cards = document.querySelectorAll(".receita-med-card");
    cards.forEach((card, index) => {
      const titulo = card.querySelector(".receita-med-titulo");
      if (titulo) titulo.textContent = `Medicamento ${index + 1}`;
    });
  }

  function _clearSugestoes_(bloco) {
    if (!bloco) return;
    const slot = bloco.querySelector(".receita-item-sugestoes");
    if (slot) slot.innerHTML = "";
  }

  function _renderSugestoes_(bloco, query, items, onPick) {
    _clearSugestoes_(bloco);
    if (!items || !items.length) return;

    const slot = bloco.querySelector(".receita-item-sugestoes");
    if (!slot) return;

    const ul = document.createElement("ul");
    ul.className = "receita-sugestoes-lista";

    items.slice(0, 10).forEach((it) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";

      const nome = it.nome || "";
      const sub = it.posologias && it.posologias.length ? it.posologias[0] : "";

      btn.innerHTML = `
        <div class="rx-sug-title">${_highlightHtml_(nome, query)}</div>
        ${sub ? `<div class="rx-sug-sub">${_escapeHtml_(sub)}</div>` : ""}
      `;

      btn.addEventListener("click", () => onPick(it));
      li.appendChild(btn);
      ul.appendChild(li);
    });

    slot.appendChild(ul);
  }

  function _renderPosologiaChips_(cardEl, posologias, posologiaInput) {
    const old = cardEl.querySelector(".med-posologias");
    if (old) old.remove();
    if (!posologias || !posologias.length) return;

    const wrap = document.createElement("div");
    wrap.className = "med-posologias";

    posologias.slice(0, 6).forEach((p) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "med-chip";
      chip.textContent = String(p);
      chip.addEventListener("click", () => {
        posologiaInput.value = String(p);
        posologiaInput.focus();
      });
      wrap.appendChild(chip);
    });

    const fullBlock = posologiaInput.closest(".full");
    if (fullBlock) fullBlock.appendChild(wrap);
  }

  async function _buscarSugestoesMedicamento_(q) {
    try {
      const data = await callApiDataTry_(
        ["Medicamentos.ListarAtivos", "Medicamentos_ListarAtivos", "Remedios.ListarAtivos", "Remedios_ListarAtivos"],
        { q: q, limit: 50 }
      );

      const meds = data && data.medicamentos ? data.medicamentos : [];
      return (meds || [])
        .map((m) => {
          const nome = String(m.Nome_Medicacao || m.nome || "").trim();
          const posologias = _splitPosologias_(m.Posologia || "");
          const quantidade = String(m.Quantidade || m.quantidade || "").trim();
          const via = String(m.Via_Administracao || m.via || m.viaAdministracao || "").trim();
          return { nome, posologias, quantidade, via };
        })
        .filter((x) => x.nome);
    } catch (err) {
      console.warn("[PRONTIO] Autocomplete Medicamentos falhou:", err);
      return [];
    }
  }

  function _wireAutocompleteOnCard_(cardEl) {
    const bloco = cardEl.querySelector(".receita-item-bloco");
    const nomeInput = cardEl.querySelector(".med-nome");
    const posologiaInput = cardEl.querySelector(".med-posologia");
    const qtdInput = cardEl.querySelector(".med-quantidade");
    const viaSelect = cardEl.querySelector(".med-via");

    if (!bloco || !nomeInput || !posologiaInput) return;

    document.addEventListener("click", (ev) => {
      if (!bloco.contains(ev.target)) _clearSugestoes_(bloco);
    });

    nomeInput.addEventListener("input", () => {
      const q = (nomeInput.value || "").trim();
      _clearSugestoes_(bloco);

      if (medSuggestTimer) clearTimeout(medSuggestTimer);
      if (q.length < 2) return;

      medSuggestTimer = setTimeout(async () => {
        const items = await _buscarSugestoesMedicamento_(q);

        _renderSugestoes_(bloco, q, items, (picked) => {
          _clearSugestoes_(bloco);

          nomeInput.value = picked.nome || nomeInput.value;

          _renderPosologiaChips_(cardEl, picked.posologias || [], posologiaInput);

          if (qtdInput && picked.quantidade) qtdInput.value = picked.quantidade;
          if (viaSelect && picked.via) {
            const val = String(picked.via).trim();
            const opt = Array.from(viaSelect.options || []).find(
              (o) => String(o.value).trim().toLowerCase() === val.toLowerCase()
            );
            if (opt) viaSelect.value = opt.value;
            else {
              const dyn = document.createElement("option");
              dyn.value = val;
              dyn.textContent = val;
              viaSelect.insertBefore(dyn, viaSelect.firstChild);
              viaSelect.value = val;
            }
          }

          posologiaInput.focus();
        });
      }, 180);
    });

    nomeInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        posologiaInput.focus();
      }
    });
  }

  function criarMedicamentoCard_(dados) {
    receitaMedCounter++;

    const container = qs("#receitaItensContainer");
    if (!container) return;

    const card = document.createElement("div");
    card.className = "receita-med-card";

    card.innerHTML = `
      <div class="receita-med-header">
        <span class="receita-med-titulo">Medicamento ${receitaMedCounter}</span>
        <button type="button" class="receita-med-remover">Remover</button>
      </div>

      <div class="receita-med-grid">
        <div class="full receita-item-bloco">
          <label class="texto-menor texto-suave">Medicamento *</label>
          <input type="text" class="med-nome" placeholder="Ex: Dipirona 500mg" required>
          <div class="receita-item-sugestoes texto-menor" aria-live="polite"></div>
        </div>

        <div class="full">
          <label class="texto-menor texto-suave">Posologia *</label>
          <input type="text" class="med-posologia" placeholder="Ex: 1 cp 6/6h" required>
        </div>

        <div>
          <label class="texto-menor texto-suave">Quantidade</label>
          <input type="text" class="med-quantidade" placeholder="Ex: 30 comprimidos">
        </div>

        <div>
          <label class="texto-menor texto-suave">Via</label>
          <select class="med-via">
            <option value="">—</option>
            <option value="VO">VO</option>
            <option value="IM">IM</option>
            <option value="EV">EV</option>
            <option value="SL">SL</option>
            <option value="Tópico">Tópico</option>
          </select>
        </div>
      </div>
    `;

    if (dados) {
      if (dados.nome) card.querySelector(".med-nome").value = dados.nome;
      if (dados.posologia) card.querySelector(".med-posologia").value = dados.posologia;
      if (dados.quantidade) card.querySelector(".med-quantidade").value = dados.quantidade;
      if (dados.via) card.querySelector(".med-via").value = dados.via;
    }

    card.querySelector(".receita-med-remover").addEventListener("click", () => {
      card.remove();
      atualizarTituloMedicamentos_();
    });

    container.appendChild(card);
    atualizarTituloMedicamentos_();
    _wireAutocompleteOnCard_(card);
  }

  function ensurePrimeiroMedicamento_() {
    const container = qs("#receitaItensContainer");
    if (!container) return;
    if (container.children.length === 0) criarMedicamentoCard_();
  }

  function _collectItensFromCards_() {
    const cards = qsa("#receitaItensContainer .receita-med-card");
    const out = [];

    cards.forEach((card) => {
      const nome = String(card.querySelector(".med-nome")?.value || "").trim();
      const posologia = String(card.querySelector(".med-posologia")?.value || "").trim();
      const quantidade = String(card.querySelector(".med-quantidade")?.value || "").trim();
      const via = String(card.querySelector(".med-via")?.value || "").trim();

      if (!nome && !posologia) return;

      out.push({
        remedio: nome,
        posologia: posologia,
        via: via,
        quantidade: quantidade,
        observacao: "",
      });
    });

    return out;
  }

  async function onSubmitReceita_(ev) {
    ev.preventDefault();

    const ctx = PRONTIO.prontuarioContexto || {};
    const idPaciente = String(ctx.idPaciente || ctx.ID_Paciente || "").trim();
    if (!idPaciente) return global.alert("Paciente não identificado.");

    const itens = _collectItensFromCards_();
    if (!itens.length) return global.alert("Informe ao menos um medicamento.");

    const payload = {
      idPaciente: idPaciente,
      idAgenda: String(ctx.idAgenda || ctx.ID_Agenda || "").trim(),
      dataReceita: qs("#receitaData")?.value || "",
      observacoes: qs("#receitaObservacoes")?.value || "",
      itens: itens,
    };

    const acao =
      ev.submitter?.dataset?.acaoReceita === "rascunho"
        ? "Receita.SalvarRascunho"
        : "Receita.SalvarFinal";

    const resp = await callApiData({ action: acao, payload: payload });

    const idReceita =
      (resp && (resp.idReceita || resp.ID_Receita)) ||
      (resp && resp.receita && (resp.receita.idReceita || resp.receita.ID_Receita)) ||
      "";

    if (acao === "Receita.SalvarFinal" && idReceita) {
      const pdf = await callApiData({ action: "Receita.GerarPdf", payload: { idReceita } });
      const win = global.open("", "_blank");
      if (!win) return global.alert("Pop-up bloqueado. Libere para imprimir a receita.");
      win.document.open();
      win.document.write(pdf && pdf.html ? pdf.html : "");
      win.document.close();
    }

    if (qs("#receitaObservacoes")) qs("#receitaObservacoes").value = "";
    if (qs("#receitaItensContainer")) qs("#receitaItensContainer").innerHTML = "";
    receitaMedCounter = 0;
    ensurePrimeiroMedicamento_();

    try {
      const ctx2 = PRONTIO.prontuarioContexto || ctx;
      carregarReceitasPaginadas_(ctx2, { append: false, limit: 1 });
    } catch (_) {}

    fecharReceitaPanel_();
  }

  // ============================================================
  // Ações clínicas
  // ============================================================

  function abrirNovaEvolucao_() {
    const card = qs("#cardNovaEvolucao");
    if (!card) return;
    card.style.display = "";
    const txt = qs("#textoEvolucao");
    if (txt) txt.focus();
  }

  function resetFormReceitaPanel_() {
    const inputData = qs("#receitaData");
    if (inputData) inputData.value = new Date().toISOString().slice(0, 10);

    const obs = qs("#receitaObservacoes");
    if (obs) obs.value = "";

    const cont = qs("#receitaItensContainer");
    if (cont) cont.innerHTML = "";

    receitaMedCounter = 0;
    ensurePrimeiroMedicamento_();
  }

  function abrirReceitaNoPainelComoModelo_(rec) {
    abrirReceitaPanel_();

    const inputData = qs("#receitaData");
    if (inputData) {
      const iso = String(rec?.dataReceita || rec?.DataReceita || "").trim();
      inputData.value = iso && iso.length >= 10 ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10);
    }

    const obs = qs("#receitaObservacoes");
    if (obs) obs.value = String(rec?.observacoes || rec?.Observacoes || "").trim();

    const cont = qs("#receitaItensContainer");
    if (cont) cont.innerHTML = "";
    receitaMedCounter = 0;

    const itens = Array.isArray(rec?.itens) ? rec.itens : [];
    if (itens.length) {
      itens.forEach((it) => {
        criarMedicamentoCard_({
          nome: String(it?.nomeRemedio || it?.remedio || it?.nome || "").trim(),
          posologia: String(it?.posologia || "").trim(),
          quantidade: String(it?.quantidade || "").trim(),
          via: String(it?.viaAdministracao || it?.via || "").trim(),
        });
      });
    } else {
      ensurePrimeiroMedicamento_();
    }
  }

  function abrirReceitaNoPainel_(ctx) {
    abrirReceitaPanel_();
    resetFormReceitaPanel_();
  }

  function abrirExames_(ctx) {
    try {
      const base = new URL("exames.html", global.location.origin);
      if (ctx.idPaciente) base.searchParams.set("pacienteId", ctx.idPaciente);
      if (ctx.nome) base.searchParams.set("pacienteNome", ctx.nome);
      if (ctx.idAgenda) base.searchParams.set("agendaId", ctx.idAgenda);
      global.location.href = base.toString();
    } catch (e) {
      global.alert("Não foi possível abrir Exames.");
    }
  }

  // ============================================================
  // Evoluções (lista + paginação)
  // ============================================================

  function ordenarEvolucoes(lista) {
    return (lista || [])
      .slice()
      .sort((a, b) => {
        const da = parseDataHora(a.dataHoraRegistro || a.dataHora || a.data || a.criadoEm) || new Date(0);
        const db = parseDataHora(b.dataHoraRegistro || b.dataHora || a.data || b.criadoEm) || new Date(0);
        return db - da;
      });
  }

  function renderListaEvolucoes(lista, ul, vazio) {
    ul.innerHTML = "";

    if (!lista || !lista.length) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = "Nenhuma evolução registrada para este paciente.";
      return;
    }

    vazio.classList.add("is-hidden");

    lista.forEach((ev, index) => {
      const li = document.createElement("li");
      li.className = "evolucao-item";

      const idEvo = ev.idEvolucao || ev.ID_Evolucao || ev.id || "";
      const autor = ev.autor || ev.profissional || "";
      const origem = ev.origem || "";
      const dataRaw = ev.dataHoraRegistro || ev.dataHora || ev.data || ev.criadoEm || "";

      let dataFmt = "";
      const dt = parseDataHora(dataRaw);
      if (dt) {
        const dia = String(dt.getDate()).padStart(2, "0");
        const mes = String(dt.getMonth() + 1).padStart(2, "0");
        const ano = dt.getFullYear();
        const hora = String(dt.getHours()).padStart(2, "0");
        const min = String(dt.getMinutes()).padStart(2, "0");
        dataFmt = `${dia}/${mes}/${ano} ${hora}:${min}`;
      } else {
        dataFmt = String(dataRaw || "");
      }

      let botoesHTML = "";
      if (index === 0) {
        botoesHTML = `
          <div class="evo-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-evo-usar-modelo" data-id="${idEvo}">Usar como modelo</button>
            <button type="button" class="btn btn-secondary btn-sm btn-evo-editar" data-id="${idEvo}">Editar evolução</button>
          </div>
        `;
      }

      li.innerHTML = `
        <div class="evo-header">
          <span class="evo-data">${dataFmt || ""}</span>
          ${autor ? `<span class="evo-autor">${_escapeHtml_(autor)}</span>` : ""}
          ${origem ? `<span class="evo-origem badge">${_escapeHtml_(origem)}</span>` : ""}
        </div>
        <div class="evo-texto">${String(ev.texto || "").replace(/\n/g, "<br>")}</div>
        ${botoesHTML}
      `;

      ul.appendChild(li);

      if (index === 0) {
        const btnModelo = li.querySelector(".btn-evo-usar-modelo");
        const btnEditar = li.querySelector(".btn-evo-editar");

        if (btnModelo) {
          btnModelo.addEventListener("click", () => {
            abrirNovaEvolucao_();
            const txt = qs("#textoEvolucao");
            if (txt) {
              txt.value = ev.texto || "";
              idEvolucaoEmEdicao = null;
              txt.focus();
            }
          });
        }

        if (btnEditar) {
          btnEditar.addEventListener("click", () => {
            abrirNovaEvolucao_();
            const txt = qs("#textoEvolucao");
            if (txt) {
              txt.value = ev.texto || "";
              idEvolucaoEmEdicao = idEvo;
              txt.focus();
            }
          });
        }
      }
    });
  }

  async function carregarEvolucoesPaginadas_(ctx, opts) {
    opts = opts || {};
    const append = !!opts.append;
    const ul = qs("#listaEvolucoesPaciente");
    const vazio = qs("#listaEvolucoesPacienteVazia");
    if (!ul || !vazio) return;

    if (evoPaging.loading) return;
    evoPaging.loading = true;

    let limit = Number(opts.limit);
    if (!limit || isNaN(limit) || limit < 1) limit = 10;
    if (limit > 200) limit = 200;
    evoPaging.lastLimit = limit;

    _setBtnMais_(evoPaging.btnMais, evoPaging.hasMore, true);

    if (!ctx.idPaciente) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = "Nenhum paciente selecionado.";
      evoPaging.loading = false;
      evoPaging.cursor = null;
      evoPaging.hasMore = false;
      evoPaging.lista = [];
      _setBtnMais_(evoPaging.btnMais, false, false);
      return;
    }

    if (!append) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = limit === 1 ? "Carregando última evolução clínica..." : "Carregando evoluções...";
      ul.innerHTML = "";
      evoPaging.lista = [];
      evoPaging.cursor = null;
      evoPaging.hasMore = false;
    }

    try {
      const payload = { idPaciente: ctx.idPaciente, limit: limit };
      if (append && evoPaging.cursor) payload.cursor = evoPaging.cursor;

      const data = await callApiDataTry_(
        ["Prontuario.Evolucao.ListarPorPacientePaged", "Prontuario.Evolucao.ListarPorPaciente", "Evolucao.ListarPorPaciente"],
        payload
      );

      const itemsPaged = data && (data.items || data.evolucoes || data.lista);
      let lista = Array.isArray(itemsPaged) ? itemsPaged : Array.isArray(data) ? data : [];
      lista = ordenarEvolucoes(lista);

      const nextCursor =
        data && (data.nextCursor || (data.page && data.page.nextCursor))
          ? data.nextCursor || data.page.nextCursor
          : null;
      const hasMore = !!(data && (data.hasMore || (data.page && data.page.hasMore)));

      if (!append) evoPaging.lista = lista.slice();
      else evoPaging.lista = evoPaging.lista.concat(lista);

      renderListaEvolucoes(evoPaging.lista, ul, vazio);

      evoPaging.cursor = nextCursor || null;
      evoPaging.hasMore = !!(hasMore && evoPaging.cursor);

      historicoCompletoCarregado = true;
    } catch (e) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = "Erro ao carregar evoluções.";
      evoPaging.cursor = null;
      evoPaging.hasMore = false;
    } finally {
      evoPaging.loading = false;
      _setBtnMais_(evoPaging.btnMais, evoPaging.hasMore, false);
    }
  }

  // ============================================================
  // Salvar evolução
  // ============================================================

  function setMensagemEvolucao(obj) {
    const el = qs("#mensagemEvolucao");
    if (!el) return;
    el.classList.remove("is-hidden", "msg-erro", "msg-sucesso");
    el.textContent = (obj && obj.texto) || "";
    if (obj && obj.tipo === "erro") el.classList.add("msg-erro");
    if (obj && obj.tipo === "sucesso") el.classList.add("msg-sucesso");
  }

  async function salvarEvolucao(ctx, ev) {
    ev.preventDefault();

    const txt = qs("#textoEvolucao");
    const texto = txt && txt.value ? txt.value.trim() : "";
    if (!texto) {
      setMensagemEvolucao({ tipo: "erro", texto: "Digite a evolução." });
      return;
    }

    const payload = { idPaciente: ctx.idPaciente, idAgenda: ctx.idAgenda, texto, origem: "PRONTUARIO" };
    if (idEvolucaoEmEdicao) payload.idEvolucao = idEvolucaoEmEdicao;

    try {
      await callApiDataTry_(["Prontuario.Evolucao.Salvar", "Evolucao.Salvar"], payload);

      setMensagemEvolucao({
        tipo: "sucesso",
        texto: idEvolucaoEmEdicao ? "Evolução atualizada." : "Evolução registrada.",
      });

      if (txt) txt.value = "";
      idEvolucaoEmEdicao = null;

      carregarResumoPaciente_(ctx);

      if (historicoCompletoCarregado) {
        const currentLimit = evoPaging.lastLimit && evoPaging.lastLimit > 0 ? evoPaging.lastLimit : 1;
        carregarEvolucoesPaginadas_(ctx, { append: false, limit: currentLimit });
      }
    } catch (e) {
      setMensagemEvolucao({ tipo: "erro", texto: "Erro ao salvar evolução." });
    }
  }

  // ============================================================
  // Receitas (lista + paginação + PDF)
  // ============================================================

  async function abrirPdfReceita(idReceita) {
    if (!idReceita) {
      global.alert("ID da receita não encontrado.");
      return;
    }

    try {
      const data = await callApiDataTry_(
        ["Prontuario.Receita.GerarPDF", "Prontuario.Receita.GerarPdf", "Receita.GerarPDF", "Receita.GerarPdf"],
        { idReceita }
      );

      const html = data && data.html ? String(data.html) : "";
      if (!html) throw new Error("API retornou resposta sem HTML da receita.");

      const win = global.open("", "_blank");
      if (!win) {
        global.alert("Não foi possível abrir a janela de impressão (pop-up bloqueado?).");
        return;
      }

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (err) {
      global.alert("Erro ao abrir o PDF da receita:\n\n" + (err && err.message ? err.message : String(err || "")));
    }
  }

  function renderListaReceitas(lista, ul, vazio) {
    ul.innerHTML = "";

    if (!lista || !lista.length) {
      vazio.textContent = "Nenhuma receita encontrada para este paciente.";
      vazio.classList.remove("is-hidden");
      return;
    }

    vazio.classList.add("is-hidden");

    lista.forEach((rec) => {
      const li = document.createElement("li");
      li.className = "receita-item-timeline is-clickable";

      const idRec = rec.idReceita || rec.ID_Receita || rec.id || "";
      const dataRawCriacao = rec.dataHoraCriacao || rec.dataHora || rec.data || rec.criadoEm || "";
      const dataReceitaIso = rec.dataReceita || rec.DataReceita || "";

      const tipoRaw = rec.tipoReceita || rec.TipoReceita || "COMUM";
      const tipo = formatTipoReceitaLabel_(tipoRaw);

      const status = rec.status || rec.Status || "";
      const texto = rec.textoMedicamentos || rec.TextoMedicamentos || "";

      const dataReceitaFmt = formatIsoDateToBR_(dataReceitaIso);

      const dtCriacao = parseDataHora(dataRawCriacao) || new Date(0);
      let dataCriacaoFmt = "";
      if (dtCriacao.getTime()) {
        const diaC = ("0" + dtCriacao.getDate()).slice(-2);
        const mesC = ("0" + (dtCriacao.getMonth() + 1)).slice(-2);
        const anoC = dtCriacao.getFullYear();
        const horaC = ("0" + dtCriacao.getHours()).slice(-2) + ":" + ("0" + dtCriacao.getMinutes()).slice(-2);
        dataCriacaoFmt = `${diaC}/${mesC}/${anoC} ${horaC}`;
      }

      let dataLinha = "";
      if (dataReceitaFmt) dataLinha = dataReceitaFmt;
      else if (dataCriacaoFmt) dataLinha = dataCriacaoFmt.split(" ")[0];

      const primeiraLinha = String(texto || "").split("\n")[0] || "";
      li.dataset.idReceita = idRec;

      const metaExtra =
        dataCriacaoFmt || dataReceitaFmt
          ? `Criada em ${dataCriacaoFmt || "—"} · Data da receita: ${
              dataReceitaFmt || (dataCriacaoFmt ? dataCriacaoFmt.split(" ")[0] : "—")
            }`
          : "";

      li.innerHTML = `
        <div class="receita-header">
          <span class="receita-data">${dataLinha || ""}</span>
          ${tipo ? `<span class="receita-tipo badge">${tipo}</span>` : ""}
          ${status ? `<span class="receita-status texto-menor">${status}</span>` : ""}
        </div>

        <div class="receita-resumo texto-menor">
          ${primeiraLinha ? primeiraLinha : "(sem descrição de medicamentos)"}
        </div>

        <div class="receita-actions">
          <button type="button" class="btn btn-secondary btn-sm js-receita-modelo">Usar como modelo</button>
          <button type="button" class="btn btn-secondary btn-sm js-receita-pdf">Abrir PDF</button>
        </div>

        <div class="receita-meta texto-menor texto-suave">
          ID Receita: ${idRec || "—"}
        </div>
        ${metaExtra ? `<div class="receita-meta texto-menor texto-suave">${metaExtra}</div>` : ""}
      `;

      const btnModelo = li.querySelector(".js-receita-modelo");
      const btnPdf = li.querySelector(".js-receita-pdf");

      if (btnModelo) {
        btnModelo.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          abrirReceitaNoPainelComoModelo_(rec);
        });
      }

      if (btnPdf) {
        btnPdf.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          abrirPdfReceita(idRec);
        });
      }

      li.addEventListener("click", () => abrirPdfReceita(li.dataset.idReceita || idRec));
      ul.appendChild(li);
    });
  }

  async function carregarReceitasPaginadas_(ctx, opts) {
    const append = !!(opts && opts.append);
    const ul = qs("#listaReceitasPaciente");
    const vazio = qs("#listaReceitasPacienteVazia");
    if (!ul || !vazio) return;

    if (recPaging.loading) return;
    recPaging.loading = true;
    _setBtnMais_(recPaging.btnMais, recPaging.hasMore, true);

    if (!ctx.idPaciente) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = "Nenhum paciente selecionado.";
      recPaging.loading = false;
      recPaging.cursor = null;
      recPaging.hasMore = false;
      recPaging.lista = [];
      _setBtnMais_(recPaging.btnMais, false, false);
      return;
    }

    if (!append) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = "Carregando receitas...";
      ul.innerHTML = "";
      recPaging.lista = [];
      recPaging.cursor = null;
      recPaging.hasMore = false;
    }

    try {
      const limit = opts && opts.limit ? Number(opts.limit) : 25;
      const payload = { idPaciente: ctx.idPaciente, limit: limit };
      if (append && recPaging.cursor) payload.cursor = recPaging.cursor;

      const data = await callApiDataTry_(
        ["Prontuario.Receita.ListarPorPacientePaged", "Prontuario.Receita.ListarPorPaciente", "Receita.ListarPorPaciente"],
        payload
      );

      const itemsPaged = data && (data.items || data.receitas || data.lista);
      let lista = Array.isArray(itemsPaged) ? itemsPaged : Array.isArray(data) ? data : [];

      lista = (lista || []).slice().sort((a, b) => {
        const da = parseDataHora(a.dataHoraCriacao || a.dataHora || a.data || a.criadoEm) || new Date(0);
        const db = parseDataHora(b.dataHoraCriacao || b.dataHora || b.data || b.criadoEm) || new Date(0);
        return db - da;
      });

      const nextCursor =
        data && (data.nextCursor || (data.page && data.page.nextCursor))
          ? data.nextCursor || data.page.nextCursor
          : null;
      const hasMore = !!(data && (data.hasMore || (data.page && data.page.hasMore)));

      if (!append) recPaging.lista = lista.slice();
      else recPaging.lista = recPaging.lista.concat(lista);

      renderListaReceitas(recPaging.lista, ul, vazio);

      recPaging.cursor = nextCursor || null;
      recPaging.hasMore = !!(hasMore && recPaging.cursor);
    } catch (e) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = "Erro ao carregar receitas.";
      recPaging.cursor = null;
      recPaging.hasMore = false;
    } finally {
      recPaging.loading = false;
      _setBtnMais_(recPaging.btnMais, recPaging.hasMore, false);
    }
  }

  // ============================================================
  // Init
  // ============================================================

  function initProntuario() {
    if (PRONTIO._pageInited.prontuario === true) return;
    PRONTIO._pageInited.prontuario = true;

    const ctx = carregarContextoProntuario();
    PRONTIO.prontuarioContexto = ctx;

    carregarResumoPaciente_(ctx);

    // Painéis
    setupReceitaPanelEvents_();
    setupDocumentosPanelEvents_(ctx);

    // Ações clínicas
    qs("#btnAcaoNovaEvolucao")?.addEventListener("click", abrirNovaEvolucao_);
    qs("#btnAcaoReceita")?.addEventListener("click", () => abrirReceitaNoPainel_(ctx));
    qs("#btnAcaoExames")?.addEventListener("click", () => abrirExames_(ctx));

    // ✅ Documentos agora abre o painel (não navega)
    qs("#btnAcaoDocumentos")?.addEventListener("click", () => abrirDocumentosPanel_());

    // Evolução salvar
    qs("#formEvolucao")?.addEventListener("submit", (ev) => salvarEvolucao(ctx, ev));

    // Receita (painel)
    qs("#btnAdicionarMedicamento")?.addEventListener("click", () => criarMedicamentoCard_());
    qs("#formReceitaProntuario")?.addEventListener("submit", onSubmitReceita_);

    // Evoluções (paginadas)
    evoPaging.btnMais = qs("#btnCarregarMaisEvolucoes");
    _setBtnMais_(evoPaging.btnMais, false, false);

    const btnHistorico = qs("#btnCarregarHistoricoPaciente");
    if (btnHistorico) btnHistorico.textContent = "Carregar 10 últimas";

    btnHistorico?.addEventListener("click", () => {
      historicoCompletoCarregado = true;
      carregarEvolucoesPaginadas_(ctx, { append: false, limit: 10 });
    });

    evoPaging.btnMais?.addEventListener("click", () =>
      carregarEvolucoesPaginadas_(ctx, { append: true, limit: 10 })
    );

    carregarEvolucoesPaginadas_(ctx, { append: false, limit: 1 });

    // Receitas (lista)
    recPaging.btnMais = qs("#btnCarregarMaisReceitas");
    _setBtnMais_(recPaging.btnMais, false, false);

    carregarReceitasPaginadas_(ctx, { append: false, limit: 1 });

    const btn10 = qs("#btnCarregarReceitasPaciente");
    if (btn10) btn10.textContent = "Carregar 10 últimas";
    btn10?.addEventListener("click", () => carregarReceitasPaginadas_(ctx, { append: false, limit: 10 }));

    recPaging.btnMais?.addEventListener("click", () => carregarReceitasPaginadas_(ctx, { append: true }));

    // ✅ ESC + TrapFocus para painel aberto (Receita / Documentos)
    document.addEventListener("keydown", (ev) => {
      const receitaOpen = receitaPanel && receitaPanel.style.display !== "none";
      const docsOpen = documentosPanel && documentosPanel.style.display !== "none";
      if (!receitaOpen && !docsOpen) return;

      if (ev.key === "Escape") {
        ev.preventDefault();
        if (docsOpen) fecharDocumentosPanel_();
        else if (receitaOpen) fecharReceitaPanel_();
        return;
      }

      if (docsOpen) _trapFocusInPanel_(documentosPanelAside, ev);
      if (receitaOpen) _trapFocusInPanel_(receitaPanelAside, ev);
    });
  }

  PRONTIO.pages.prontuario = PRONTIO.pages.prontuario || {};
  PRONTIO.pages.prontuario.init = initProntuario;

  try {
    if (PRONTIO.core && PRONTIO.core.router && typeof PRONTIO.core.router.register === "function") {
      PRONTIO.core.router.register("prontuario", initProntuario);
    }
  } catch (_) {}

  if (typeof PRONTIO.registerPage === "function") {
    PRONTIO.registerPage("prontuario", initProntuario);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProntuario);
  } else {
    initProntuario();
  }
})(window, document);
