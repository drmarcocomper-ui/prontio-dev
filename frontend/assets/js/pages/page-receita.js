// frontend/assets/js/pages/page-receita.js
/**
 * PRONTIO - Receita (página receita.html)
 *
 * ✅ PROFISSIONAL:
 * - Este script roda SOMENTE em body[data-page-id="receita"]
 * - Integra com main.js via PRONTIO.pages.receita.init
 * - Fallback DOMContentLoaded só se main.js não rodar
 *
 * Features:
 * - Sugestões legíveis (nome + detalhes)
 * - Navegação por teclado (↑ ↓ Enter Esc)
 * - Debounce leve
 * - Fecha sugestões ao clicar fora
 * - Submit: rascunho/final + impressão via PDF
 */

(function (global, document) {
  // ✅ Guard: não inicializa fora da página Receita
  try {
    const body = document && document.body;
    const pageId = body && body.dataset ? String(body.dataset.pageId || "") : "";
    if (pageId !== "receita") return;
  } catch (_) {
    return;
  }

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO.pages.receita = PRONTIO.pages.receita || {};
  PRONTIO._pageInited = PRONTIO._pageInited || {};

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      return Promise.reject(new Error("callApiData não disponível (API não carregada)."));
    };

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

  // ============================================================
  // Estado do formulário
  // ============================================================

  let itens = [];
  let nextItemId = 1;

  let catalogo = [];
  let catalogoCarregado = false;

  // ✅ P0: Map de timers por input para evitar race condition
  const debounceTimers = new Map();

  // estado para teclado
  let activeListEl = null;
  let activeInputEl = null;
  let activeIndex = -1;

  // ============================================================
  // Contexto (página Receita pode ser acessada direto)
  // ============================================================

  function getQueryParams_() {
    const params = new URLSearchParams(global.location.search || "");
    const obj = {};
    params.forEach((v, k) => (obj[k] = v));
    return obj;
  }

  function getContextoPaciente_() {
    const params = getQueryParams_();
    let ctxStorage = null;

    try {
      const raw = global.localStorage.getItem("prontio.prontuarioContexto");
      if (raw) ctxStorage = JSON.parse(raw);
    } catch (_) {}

    const idPaciente =
      params.idPaciente ||
      params.pacienteId ||
      (ctxStorage && (ctxStorage.ID_Paciente || ctxStorage.idPaciente)) ||
      (PRONTIO.prontuarioContexto && (PRONTIO.prontuarioContexto.idPaciente || PRONTIO.prontuarioContexto.ID_Paciente)) ||
      "";

    const idAgenda =
      params.idAgenda ||
      params.agendaId ||
      (ctxStorage && (ctxStorage.ID_Agenda || ctxStorage.idAgenda)) ||
      (PRONTIO.prontuarioContexto && (PRONTIO.prontuarioContexto.idAgenda || PRONTIO.prontuarioContexto.ID_Agenda)) ||
      "";

    return {
      idPaciente: String(idPaciente || "").trim(),
      idAgenda: String(idAgenda || "").trim()
    };
  }

  // ============================================================
  // Helpers de medicamento (normalização)
  // ============================================================

  function getNome_(r) {
    return String(
      (r && (r.Nome_Remedio || r.Nome_Medicacao || r.nomeRemedio || r.nome || r.remedio)) || ""
    ).trim();
  }

  function getId_(r) {
    return String(r.idRemedio || r.ID_Remedio || r.idMedicamento || r.ID_Medicamento || "").trim();
  }

  function getVia_(r) {
    return String(r.Via_Administracao || r.viaAdministracao || r.via || "").trim();
  }

  function getQtd_(r) {
    return String(r.Quantidade || r.quantidade || r.apresentacao || "").trim();
  }

  function getTipo_(r) {
    return String(r.Tipo_Receita || r.tipoReceita || "").trim();
  }

  function buildSub_(r) {
    const parts = [];
    const qtd = getQtd_(r);
    const via = getVia_(r);
    const tipo = getTipo_(r);

    if (qtd) parts.push(qtd);
    if (via) parts.push("Via: " + via);
    if (tipo) parts.push("Tipo: " + tipo);

    return parts.join(" • ");
  }

  // ============================================================
  // Catálogo (aba Medicamentos via API)
  // ============================================================

  // ✅ P0: try-catch + P1: feedback visual
  async function carregarCatalogo_() {
    if (catalogoCarregado) return catalogo;

    try {
      const data = await callApiData({
        action: "Medicamentos.ListarAtivos",
        payload: { q: "", limit: 800 }
      });

      const lista =
        (data && (data.medicamentos || data.remedios || data.lista || data.items)) ||
        (Array.isArray(data) ? data : []);

      catalogo = Array.isArray(lista) ? lista : [];
      catalogoCarregado = true;
      return catalogo;
    } catch (e) {
      console.error("[PRONTIO] Erro ao carregar catálogo de medicamentos:", e);
      // Não bloqueia - usuário pode digitar manualmente
      return [];
    }
  }

  // ✅ P1: Função para exibir mensagens de feedback
  function setMensagem_(obj) {
    let el = qs("#mensagemReceita");

    // Cria o elemento se não existir
    if (!el) {
      const form = qs("#formReceita") || qs("#formReceitaProntuario");
      if (!form) return;

      el = document.createElement("div");
      el.id = "mensagemReceita";
      el.className = "is-hidden";
      form.parentNode.insertBefore(el, form.nextSibling);
    }

    el.classList.remove("is-hidden", "msg-erro", "msg-sucesso", "msg-loading");
    el.textContent = (obj && obj.texto) || "";
    if (obj && obj.tipo === "erro") el.classList.add("msg-erro");
    if (obj && obj.tipo === "sucesso") el.classList.add("msg-sucesso");
    if (obj && obj.tipo === "loading") el.classList.add("msg-loading");
    if (!obj || !obj.texto) el.classList.add("is-hidden");
  }

  // ============================================================
  // Itens
  // ============================================================

  function novoItem() {
    return {
      id: "MED_" + nextItemId++,
      idRemedio: "",
      remedio: "",
      posologia: "",
      via: "",
      quantidade: "",
      observacao: ""
    };
  }

  function garantirItem() {
    if (!itens.length) itens.push(novoItem());
  }

  function adicionarItem() {
    itens.push(novoItem());
    renderItens();
  }

  function removerItem(id) {
    // ✅ P0: Limpa timer do item removido
    const timer = debounceTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(id);
    }

    itens = itens.filter((i) => i.id !== id);
    garantirItem();
    renderItens();
  }

  function atualizarItem(id, campo, valor) {
    const it = itens.find((i) => i.id === id);
    if (it) it[campo] = valor;
  }

  // ============================================================
  // Sugestões / teclado
  // ============================================================

  function closeSugestoes_() {
    qsa("#receitaItensContainer .receita-item-sugestoes").forEach((c) => (c.innerHTML = ""));
    activeListEl = null;
    activeInputEl = null;
    activeIndex = -1;
  }

  function highlight_(text, term) {
    const s = String(text || "");
    const t = String(term || "").trim();
    if (!t) return escapeHtml(s);

    const idx = s.toLowerCase().indexOf(t.toLowerCase());
    if (idx < 0) return escapeHtml(s);

    const before = s.slice(0, idx);
    const mid = s.slice(idx, idx + t.length);
    const after = s.slice(idx + t.length);

    return `${escapeHtml(before)}<span class="rx-hl">${escapeHtml(mid)}</span>${escapeHtml(after)}`;
  }

  async function mostrarSugestoes_(termo, container, item, inputEl) {
    container.innerHTML = "";

    const t = (termo || "").toLowerCase().trim();
    if (!t) return;

    const lista = await carregarCatalogo_();
    if (!lista.length) return;

    const matches = lista
      .filter((r) => getNome_(r).toLowerCase().includes(t))
      .slice(0, 12);

    if (!matches.length) return;

    const ul = document.createElement("ul");
    ul.className = "receita-sugestoes-lista";

    matches.forEach((r) => {
      const nome = getNome_(r);
      const sub = buildSub_(r);
      const id = getId_(r);

      const li = document.createElement("li");
      li.innerHTML = `
        <button type="button">
          <div class="rx-sug-title">${highlight_(nome, termo)}</div>
          ${sub ? `<div class="rx-sug-sub">${escapeHtml(sub)}</div>` : ""}
        </button>
      `;

      li.querySelector("button").addEventListener("click", () => {
        atualizarItem(item.id, "idRemedio", id);
        atualizarItem(item.id, "remedio", nome);

        atualizarItem(item.id, "via", getVia_(r));
        atualizarItem(item.id, "quantidade", getQtd_(r));

        container.innerHTML = "";
        renderItens();
      });

      ul.appendChild(li);
    });

    container.appendChild(ul);

    activeListEl = ul;
    activeInputEl = inputEl;
    activeIndex = -1;
  }

  // ============================================================
  // Render
  // ============================================================

  function renderItens() {
    const container = qs("#receitaItensContainer");
    if (!container) return;

    garantirItem();
    container.innerHTML = "";

    itens.forEach((item) => {
      const el = document.createElement("div");
      el.className = "receita-item-bloco";

      el.innerHTML = `
        <div class="receita-item-header">
          <span class="texto-menor texto-suave">Remédio</span>
          <button type="button" class="btn btn-xs btn-link js-remover">Remover</button>
        </div>

        <div class="receita-item-grid">
          <input class="js-rem" placeholder="Remédio" value="${escapeHtml(item.remedio)}">
          <input class="js-pos" placeholder="Posologia" value="${escapeHtml(item.posologia)}">
          <input class="js-via" placeholder="Via" value="${escapeHtml(item.via)}">
          <input class="js-qtd" placeholder="Quantidade" value="${escapeHtml(item.quantidade)}">
          <input class="js-obs" placeholder="Observação" value="${escapeHtml(item.observacao)}">
        </div>

        <div class="receita-item-sugestoes texto-menor"></div>
      `;

      const sug = el.querySelector(".receita-item-sugestoes");
      const inp = el.querySelector(".js-rem");

      inp.addEventListener("input", (e) => {
        atualizarItem(item.id, "remedio", e.target.value);
        atualizarItem(item.id, "idRemedio", "");

        // ✅ P0: Usa timer específico por item para evitar race condition
        const existingTimer = debounceTimers.get(item.id);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(() => {
          debounceTimers.delete(item.id);
          mostrarSugestoes_(e.target.value, sug, item, inp);
        }, 120);

        debounceTimers.set(item.id, timer);
      });

      inp.addEventListener("keydown", (e) => {
        if (!activeListEl) return;

        const buttons = Array.from(activeListEl.querySelectorAll("button"));
        if (!buttons.length) return;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          activeIndex = Math.min(activeIndex + 1, buttons.length - 1);
          buttons[activeIndex].focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          activeIndex = Math.max(activeIndex - 1, 0);
          buttons[activeIndex].focus();
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeSugestoes_();
          inp.blur();
        }
      });

      el.querySelector(".js-pos").addEventListener("input", (e) => atualizarItem(item.id, "posologia", e.target.value));
      el.querySelector(".js-via").addEventListener("input", (e) => atualizarItem(item.id, "via", e.target.value));
      el.querySelector(".js-qtd").addEventListener("input", (e) => atualizarItem(item.id, "quantidade", e.target.value));
      el.querySelector(".js-obs").addEventListener("input", (e) => atualizarItem(item.id, "observacao", e.target.value));

      el.querySelector(".js-remover").addEventListener("click", () => removerItem(item.id));

      container.appendChild(el);
    });
  }

  // ============================================================
  // Submit
  // ============================================================

  function itensParaPayload_() {
    return itens
      .filter((i) => (i.remedio && i.remedio.trim()) || (i.posologia && i.posologia.trim()))
      .map((i) => ({
        idRemedio: String(i.idRemedio || "").trim(),
        remedio: String(i.remedio || "").trim(),
        posologia: String(i.posologia || "").trim(),
        via: String(i.via || "").trim(),
        quantidade: String(i.quantidade || "").trim(),
        observacao: String(i.observacao || "").trim()
      }));
  }

  // ✅ P0: try-catch completo + P1: feedback visual
  async function onSubmit_(ev) {
    ev.preventDefault();

    const ctxPaciente = getContextoPaciente_();
    const idPaciente = ctxPaciente.idPaciente;
    if (!idPaciente) {
      setMensagem_({ tipo: "erro", texto: "Paciente não identificado." });
      return;
    }

    const payload = {
      idPaciente,
      idAgenda: ctxPaciente.idAgenda,
      dataReceita: qs("#receitaData")?.value || "",
      observacoes: qs("#receitaObservacoes")?.value || "",
      itens: itensParaPayload_()
    };

    if (!payload.itens.length) {
      setMensagem_({ tipo: "erro", texto: "Informe ao menos um medicamento." });
      return;
    }

    const acao =
      ev.submitter?.dataset?.acaoReceita === "rascunho"
        ? "Receita.SalvarRascunho"
        : "Receita.SalvarFinal";

    setMensagem_({ tipo: "loading", texto: "Salvando receita..." });

    let resp;
    try {
      resp = await callApiData({ action: acao, payload });
    } catch (e) {
      const detalhe = e && e.message ? ` (${e.message})` : "";
      console.error("[PRONTIO] Erro ao salvar receita:", e);
      setMensagem_({ tipo: "erro", texto: `Erro ao salvar receita.${detalhe}` });
      return;
    }

    const idReceita =
      resp?.idReceita ||
      resp?.ID_Receita ||
      resp?.receita?.idReceita ||
      resp?.receita?.ID_Receita ||
      "";

    if (acao === "Receita.SalvarFinal" && idReceita) {
      try {
        const pdf = await callApiData({ action: "Receita.GerarPdf", payload: { idReceita } });
        const win = global.open("", "_blank");
        if (!win) {
          setMensagem_({ tipo: "erro", texto: "Pop-up bloqueado. Libere para imprimir a receita." });
          return;
        }
        win.document.open();
        win.document.write(pdf?.html || "");
        win.document.close();
      } catch (pdfErr) {
        console.warn("[PRONTIO] Erro ao gerar PDF:", pdfErr);
        setMensagem_({ tipo: "erro", texto: "Receita salva, mas ocorreu um erro ao gerar o PDF." });
        // Continua para limpar o formulário mesmo assim
      }
    }

    setMensagem_({
      tipo: "sucesso",
      texto: acao === "Receita.SalvarRascunho" ? "Rascunho salvo." : "Receita salva com sucesso."
    });

    itens = [novoItem()];
    renderItens();
    closeSugestoes_();
  }

  // ============================================================
  // Init
  // ============================================================

  function init() {
    // ✅ trava anti-duplo-init
    if (PRONTIO._pageInited.receita === true) return;
    PRONTIO._pageInited.receita = true;

    const form = qs("#formReceita") || qs("#formReceitaProntuario");
    const container = qs("#receitaItensContainer");
    if (!form || !container) return;

    // fecha sugestões ao clicar fora
    document.addEventListener("click", (e) => {
      if (!activeListEl) return;
      const clickedInside = activeListEl.contains(e.target) || (activeInputEl && activeInputEl.contains(e.target));
      if (!clickedInside) closeSugestoes_();
    });

    qs("#btnAdicionarMedicamento")?.addEventListener("click", adicionarItem);
    form.addEventListener("submit", onSubmit_);

    // data default
    const data = qs("#receitaData");
    if (data && !data.value) data.value = new Date().toISOString().slice(0, 10);

    // carrega catálogo e renderiza 1 item
    carregarCatalogo_().catch(() => {});
    itens = [novoItem()];
    renderItens();
  }

  // ✅ main.js chama PRONTIO.pages[pageId].init()
  PRONTIO.pages.receita.init = init;

  // ✅ compat com router antigo (se existir)
  try {
    if (PRONTIO.core && PRONTIO.core.router && typeof PRONTIO.core.router.register === "function") {
      PRONTIO.core.router.register("receita", init);
    }
  } catch (_) {}

  // ✅ fallback: se main.js não rodar, inicializa sozinho
  if (!PRONTIO._mainBootstrapped) {
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", init)
      : init();
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})(window, document);
