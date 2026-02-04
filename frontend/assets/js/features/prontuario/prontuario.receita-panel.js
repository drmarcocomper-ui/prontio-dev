(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.prontuario = PRONTIO.features.prontuario || {};

  const { qs, qsa, setBtnMais_, parseDataHora, formatIsoDateToBR_, formatTipoReceitaLabel_, escapeHtml_ } =
    PRONTIO.features.prontuario.utils;
  const { callApiData, callApiDataTry_ } = PRONTIO.features.prontuario.api;

  let receitaPanel = null;
  let receitaPanelAside = null;
  let receitaPanelLastFocus = null;

  let receitaMedCounter = 0;

  // ✅ P0-2: Map de timers por input para evitar race condition entre múltiplos campos
  const medSuggestTimers = new Map();

  // ✅ P0-1: Único listener global para fechar sugestões (evita memory leak)
  let globalClickListenerAttached = false;
  const activeAutocompleteBlocos = new Set();

  function attachGlobalClickListener_() {
    if (globalClickListenerAttached) return;
    globalClickListenerAttached = true;

    document.addEventListener("click", (ev) => {
      activeAutocompleteBlocos.forEach((bloco) => {
        if (bloco && !bloco.contains(ev.target)) {
          clearSugestoes_(bloco);
        }
      });
    });
  }

  let recPaging = {
    btnMais: null,
    cursor: null,
    hasMore: false,
    loading: false,
    lista: [],
  };

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
  // Medicamentos (mini-cards + autocomplete)
  // ============================================================

  function splitPosologias_(raw) {
    const s = String(raw || "").trim();
    if (!s) return [];
    let parts = [];
    if (s.includes("\n")) parts = s.split("\n");
    else if (s.includes(";")) parts = s.split(";");
    else parts = [s];
    return parts.map((p) => String(p || "").trim()).filter(Boolean).slice(0, 8);
  }

  function highlightHtml_(text, term) {
    const t = String(term || "").trim();
    const s = String(text || "");
    if (!t) return escapeHtml_(s);

    const idx = s.toLowerCase().indexOf(t.toLowerCase());
    if (idx < 0) return escapeHtml_(s);

    const before = s.slice(0, idx);
    const hit = s.slice(idx, idx + t.length);
    const after = s.slice(idx + t.length);
    return `${escapeHtml_(before)}<span class="rx-hl">${escapeHtml_(hit)}</span>${escapeHtml_(after)}`;
  }

  function atualizarTituloMedicamentos_() {
    const cards = document.querySelectorAll(".receita-med-card");
    cards.forEach((card, index) => {
      const titulo = card.querySelector(".receita-med-titulo");
      if (titulo) titulo.textContent = `Medicamento ${index + 1}`;
    });
  }

  function clearSugestoes_(bloco) {
    if (!bloco) return;
    const slot = bloco.querySelector(".receita-item-sugestoes");
    if (slot) slot.innerHTML = "";
  }

  function renderSugestoes_(bloco, query, items, onPick) {
    clearSugestoes_(bloco);
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
        <div class="rx-sug-title">${highlightHtml_(nome, query)}</div>
        ${sub ? `<div class="rx-sug-sub">${escapeHtml_(sub)}</div>` : ""}
      `;

      btn.addEventListener("click", () => onPick(it));
      li.appendChild(btn);
      ul.appendChild(li);
    });

    slot.appendChild(ul);
  }

  function renderPosologiaChips_(cardEl, posologias, posologiaInput) {
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

  // ✅ P1: Flag para evitar múltiplos avisos de erro em sequência
  let lastAutocompleteErrorTime = 0;
  const AUTOCOMPLETE_ERROR_DEBOUNCE_MS = 5000;

  async function buscarSugestoesMedicamento_(q) {
    try {
      const data = await callApiDataTry_(
        ["Medicamentos.ListarAtivos", "Medicamentos_ListarAtivos", "Remedios.ListarAtivos", "Remedios_ListarAtivos"],
        { q: q, limit: 50 }
      );

      const meds = data && data.medicamentos ? data.medicamentos : [];
      return (meds || [])
        .map((m) => {
          const nome = String(m.Nome_Medicacao || m.nome || "").trim();
          const posologias = splitPosologias_(m.Posologia || "");
          const quantidade = String(m.Quantidade || m.quantidade || "").trim();
          const via = String(m.Via_Administracao || m.via || m.viaAdministracao || "").trim();
          return { nome, posologias, quantidade, via };
        })
        .filter((x) => x.nome);
    } catch (err) {
      console.warn("[PRONTIO] Autocomplete Medicamentos falhou:", err);

      // ✅ P1: Mostra feedback ao usuário (com debounce para evitar spam)
      const now = Date.now();
      if (now - lastAutocompleteErrorTime > AUTOCOMPLETE_ERROR_DEBOUNCE_MS) {
        lastAutocompleteErrorTime = now;
        // Mostra mensagem discreta no slot de sugestões em vez de alert
        const container = qs("#receitaItensContainer");
        if (container) {
          const slots = container.querySelectorAll(".receita-item-sugestoes");
          slots.forEach((slot) => {
            if (slot) {
              slot.innerHTML = `<div class="texto-menor texto-suave" style="padding:8px;color:var(--cor-perigo,#b91c1c);">Erro ao buscar medicamentos. Tente novamente.</div>`;
            }
          });
        }
      }

      return [];
    }
  }

  function wireAutocompleteOnCard_(cardEl) {
    const bloco = cardEl.querySelector(".receita-item-bloco");
    const nomeInput = cardEl.querySelector(".med-nome");
    const posologiaInput = cardEl.querySelector(".med-posologia");
    const qtdInput = cardEl.querySelector(".med-quantidade");
    const viaSelect = cardEl.querySelector(".med-via");

    if (!bloco || !nomeInput || !posologiaInput) return;

    // ✅ P0-1: Registra bloco para o listener global (evita memory leak)
    activeAutocompleteBlocos.add(bloco);
    attachGlobalClickListener_();

    // ✅ P0-2: Gera ID único para este input para o Map de timers
    const inputId = `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    nomeInput.dataset.autocompleteId = inputId;

    nomeInput.addEventListener("input", () => {
      const q = (nomeInput.value || "").trim();
      clearSugestoes_(bloco);

      // ✅ P0-2: Limpa timer específico deste input
      const existingTimer = medSuggestTimers.get(inputId);
      if (existingTimer) clearTimeout(existingTimer);

      if (q.length < 2) return;

      // ✅ P0-2: Armazena timer específico no Map
      const timer = setTimeout(async () => {
        medSuggestTimers.delete(inputId);

        const items = await buscarSugestoesMedicamento_(q);

        renderSugestoes_(bloco, q, items, (picked) => {
          clearSugestoes_(bloco);

          nomeInput.value = picked.nome || nomeInput.value;

          renderPosologiaChips_(cardEl, picked.posologias || [], posologiaInput);

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

      medSuggestTimers.set(inputId, timer);
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
      // ✅ P0-1: Remove bloco do Set ao remover card (evita referências órfãs)
      const bloco = card.querySelector(".receita-item-bloco");
      if (bloco) activeAutocompleteBlocos.delete(bloco);

      // ✅ P0-2: Limpa timer do input se existir
      const nomeInput = card.querySelector(".med-nome");
      if (nomeInput && nomeInput.dataset.autocompleteId) {
        const timerId = nomeInput.dataset.autocompleteId;
        const timer = medSuggestTimers.get(timerId);
        if (timer) {
          clearTimeout(timer);
          medSuggestTimers.delete(timerId);
        }
      }

      card.remove();
      atualizarTituloMedicamentos_();
    });

    container.appendChild(card);
    atualizarTituloMedicamentos_();
    wireAutocompleteOnCard_(card);
  }

  function ensurePrimeiroMedicamento_() {
    const container = qs("#receitaItensContainer");
    if (!container) return;
    if (container.children.length === 0) criarMedicamentoCard_();
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

  function collectItensFromCards_() {
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

  async function onSubmitReceita_(ev, ctx) {
    ev.preventDefault();

    const idPaciente = String(ctx.idPaciente || ctx.ID_Paciente || "").trim();
    if (!idPaciente) return global.alert("Paciente não identificado.");

    const itens = collectItensFromCards_();
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

    // ✅ P0-4: Envolver chamada de API em try-catch para evitar estado inconsistente
    let resp;
    try {
      resp = await callApiData({ action: acao, payload: payload });
    } catch (err) {
      console.error("[PRONTIO] Erro ao salvar receita:", err);
      global.alert("Erro ao salvar receita: " + (err && err.message ? err.message : String(err || "Erro desconhecido")));
      return; // ✅ Não limpa formulário se falhou
    }

    const idReceita =
      (resp && (resp.idReceita || resp.ID_Receita)) ||
      (resp && resp.receita && (resp.receita.idReceita || resp.receita.ID_Receita)) ||
      "";

    if (acao === "Receita.SalvarFinal" && idReceita) {
      try {
        const pdf = await callApiData({ action: "Receita.GerarPdf", payload: { idReceita } });
        const win = global.open("", "_blank");
        if (!win) {
          global.alert("Pop-up bloqueado. Libere para imprimir a receita.");
        } else {
          win.document.open();
          win.document.write(pdf && pdf.html ? pdf.html : "");
          win.document.close();
        }
      } catch (pdfErr) {
        console.warn("[PRONTIO] Erro ao gerar PDF da receita:", pdfErr);
        global.alert("Receita salva, mas ocorreu um erro ao gerar o PDF.");
      }
    }

    // ✅ Só limpa formulário após sucesso
    if (qs("#receitaObservacoes")) qs("#receitaObservacoes").value = "";
    if (qs("#receitaItensContainer")) qs("#receitaItensContainer").innerHTML = "";
    receitaMedCounter = 0;
    ensurePrimeiroMedicamento_();

    try {
      carregarReceitasPaginadas_(ctx, { append: false, limit: 1 });
    } catch (_) {}

    fecharReceitaPanel_();
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

  // ============================================================
  // PDF + Lista/paginação de receitas
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
          ? `Criada em ${dataCriacaoFmt || "—"} · Data da receita: ${dataReceitaFmt || (dataCriacaoFmt ? dataCriacaoFmt.split(" ")[0] : "—")}`
          : "";

      li.innerHTML = `
        <div class="receita-header">
          <span class="receita-data">${dataLinha || ""}</span>
          ${tipo ? `<span class="receita-tipo badge">${tipo}</span>` : ""}
          ${status ? `<span class="receita-status texto-menor">${escapeHtml_(status)}</span>` : ""}
        </div>

        <div class="receita-resumo texto-menor">
          ${escapeHtml_(primeiraLinha ? primeiraLinha : "(sem descrição de medicamentos)")}
        </div>

        <div class="receita-actions">
          <button type="button" class="btn btn-secondary btn-sm js-receita-modelo">Usar como modelo</button>
          <button type="button" class="btn btn-secondary btn-sm js-receita-pdf">Abrir PDF</button>
        </div>

        <div class="receita-meta texto-menor texto-suave">
          ID Receita: ${escapeHtml_(idRec || "—")}
        </div>
        ${metaExtra ? `<div class="receita-meta texto-menor texto-suave">${escapeHtml_(metaExtra)}</div>` : ""}
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
    setBtnMais_(recPaging.btnMais, recPaging.hasMore, true);

    if (!ctx.idPaciente) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = "Nenhum paciente selecionado.";
      recPaging.loading = false;
      recPaging.cursor = null;
      recPaging.hasMore = false;
      recPaging.lista = [];
      setBtnMais_(recPaging.btnMais, false, false);
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
      setBtnMais_(recPaging.btnMais, recPaging.hasMore, false);
    }
  }

  PRONTIO.features.prontuario.receitas = {
    setupReceitaPanelEvents_,
    abrirReceitaNoPainel_,
    fecharReceitaPanel_,
    resetFormReceitaPanel_,
    criarMedicamentoCard_,
    ensurePrimeiroMedicamento_,
    onSubmitReceita_,
    abrirPdfReceita,
    abrirReceitaNoPainelComoModelo_,
    carregarReceitasPaginadas_,
    setBtnMaisRef: (btn) => (recPaging.btnMais = btn),
    getPanelRefs: () => ({ panel: receitaPanel, aside: receitaPanelAside }),
    getRecPaging: () => recPaging,
  };
})(window, document);
