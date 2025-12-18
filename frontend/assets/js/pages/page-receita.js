/**
 * PRONTIO - Receita (painel lateral no prontuário)
 *
 * Melhorias (sem quebrar o que já funciona):
 * - Sugestões mais legíveis (nome + detalhes)
 * - Navegação por teclado (↑ ↓ Enter Esc)
 * - Debounce leve
 * - Fecha sugestões ao clicar fora
 */

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      return Promise.reject(new Error("callApiData não disponível (API não carregada)."));
    };

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

  let itens = [];
  let nextItemId = 1;

  let catalogo = [];
  let catalogoCarregado = false;

  // debounce por input
  let debounceTimer = null;

  // estado para teclado
  let activeListEl = null;
  let activeInputEl = null;
  let activeIndex = -1;

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

  async function carregarCatalogo_() {
    if (catalogoCarregado) return catalogo;

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
  }

  function novoItem() {
    return {
      id: "MED_" + nextItemId++,
      idRemedio: "",
      remedio: "",
      posologia: "",
      via: "",
      quantidade: "",
      observacao: "",
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
    itens = itens.filter((i) => i.id !== id);
    garantirItem();
    renderItens();
  }

  function atualizarItem(id, campo, valor) {
    const it = itens.find((i) => i.id === id);
    if (it) it[campo] = valor;
  }

  function closeSugestoes_() {
    qsa("#receitaItensContainer .receita-item-sugestoes").forEach((c) => (c.innerHTML = ""));
    activeListEl = null;
    activeInputEl = null;
    activeIndex = -1;
  }

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

        // debounce leve
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          mostrarSugestoes_(e.target.value, sug, item, inp);
        }, 120);
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

        // autopreencher se existir
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

  function itensParaPayload_() {
    return itens
      .filter((i) => (i.remedio && i.remedio.trim()) || (i.posologia && i.posologia.trim()))
      .map((i) => ({
        idRemedio: String(i.idRemedio || "").trim(),
        remedio: String(i.remedio || "").trim(),
        posologia: String(i.posologia || "").trim(),
        via: String(i.via || "").trim(),
        quantidade: String(i.quantidade || "").trim(),
        observacao: String(i.observacao || "").trim(),
      }));
  }

  async function onSubmit_(ev) {
    ev.preventDefault();

    const ctx = PRONTIO.prontuarioContexto || {};
    const idPaciente = String(ctx.ID_Paciente || ctx.idPaciente || "").trim();
    if (!idPaciente) return alert("Paciente não identificado.");

    const payload = {
      idPaciente,
      idAgenda: String(ctx.ID_Agenda || ctx.idAgenda || "").trim(),
      dataReceita: qs("#receitaData")?.value || "",
      observacoes: qs("#receitaObservacoes")?.value || "",
      itens: itensParaPayload_(),
    };

    if (!payload.itens.length) return alert("Informe ao menos um medicamento.");

    const acao =
      ev.submitter?.dataset?.acaoReceita === "rascunho"
        ? "Receita.SalvarRascunho"
        : "Receita.SalvarFinal";

    const resp = await callApiData({ action: acao, payload });

    const idReceita =
      resp?.idReceita ||
      resp?.ID_Receita ||
      resp?.receita?.idReceita ||
      resp?.receita?.ID_Receita ||
      "";

    if (acao === "Receita.SalvarFinal" && idReceita) {
      const pdf = await callApiData({ action: "Receita.GerarPdf", payload: { idReceita } });
      const win = window.open("", "_blank");
      if (!win) return alert("Pop-up bloqueado. Libere para imprimir a receita.");
      win.document.open();
      win.document.write(pdf?.html || "");
      win.document.close();
    }

    itens = [novoItem()];
    renderItens();
    closeSugestoes_();

    if (typeof PRONTIO.recarregarReceitasPaciente === "function") {
      PRONTIO.recarregarReceitasPaciente({ apenasUltima: true });
    }

    if (typeof PRONTIO.fecharReceitaPanel === "function") {
      PRONTIO.fecharReceitaPanel();
    }
  }

  function abrirPainel_() {
    const panel = qs("#receitaPanel");
    if (!panel) return;

    panel.style.display = "flex";
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");

    const data = qs("#receitaData");
    if (data && !data.value) data.value = new Date().toISOString().slice(0, 10);

    carregarCatalogo_().catch(() => {});
  }

  function fecharPainel_() {
    const panel = qs("#receitaPanel");
    if (!panel) return;

    closeSugestoes_();
    panel.classList.remove("is-open");
    panel.style.display = "none";
    panel.setAttribute("aria-hidden", "true");
  }

  function init() {
    const form = qs("#formReceitaProntuario");
    const panel = qs("#receitaPanel");
    const btnAbrir = qs("#btnAcaoReceita");
    if (!form || !panel || !btnAbrir) return;

    // fecha sugestões ao clicar fora
    document.addEventListener("click", (e) => {
      if (!activeListEl) return;
      const clickedInside = activeListEl.contains(e.target) || (activeInputEl && activeInputEl.contains(e.target));
      if (!clickedInside) closeSugestoes_();
    });

    btnAbrir.addEventListener("click", abrirPainel_);

    qsa("#receitaPanel [data-close-receita]").forEach((b) => {
      b.addEventListener("click", (ev) => { ev.preventDefault(); fecharPainel_(); });
    });

    panel.addEventListener("click", (ev) => {
      if (ev.target === panel) fecharPainel_();
    });

    qs("#btnAdicionarMedicamento")?.addEventListener("click", adicionarItem);
    form.addEventListener("submit", onSubmit_);

    PRONTIO.abrirReceitaPanel = abrirPainel_;
    PRONTIO.fecharReceitaPanel = fecharPainel_;

    itens = [novoItem()];
    renderItens();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})(window, document);
