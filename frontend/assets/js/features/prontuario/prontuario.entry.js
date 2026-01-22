(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO._pageInited = PRONTIO._pageInited || {};

  // ✅ Guard: não inicializa fora da página Prontuário
  try {
    const body = document && document.body;
    const pageId = body && body.dataset ? String(body.dataset.pageId || body.getAttribute("data-page-id") || "") : "";
    if (pageId && pageId !== "prontuario") return;
  } catch (_) {}

  const { qs, trapFocusInPanel_ } = PRONTIO.features.prontuario.utils;
  const { carregarContextoProntuario } = PRONTIO.features.prontuario.context;
  const { carregarResumoPaciente_ } = PRONTIO.features.prontuario.paciente;

  const docs = PRONTIO.features.prontuario.documentos;
  const evo = PRONTIO.features.prontuario.evolucoes;
  const rx = PRONTIO.features.prontuario.receitas;

  function abrirExames_(ctx) {
    try {
      const base = new URL("exames.html", global.location.origin);
      if (ctx.idPaciente) base.searchParams.set("pacienteId", ctx.idPaciente);
      if (ctx.nomeCompleto) base.searchParams.set("pacienteNomeCompleto", ctx.nomeCompleto);
      if (ctx.idAgenda) base.searchParams.set("agendaId", ctx.idAgenda);
      global.location.href = base.toString();
    } catch (e) {
      global.alert("Não foi possível abrir Exames.");
    }
  }

  function initProntuario() {
    if (PRONTIO._pageInited.prontuario === true) return;
    PRONTIO._pageInited.prontuario = true;

    const ctx = carregarContextoProntuario();
    PRONTIO.prontuarioContexto = ctx;

    carregarResumoPaciente_(ctx);

    // Painéis
    rx.setupReceitaPanelEvents_();
    docs.setupDocumentosPanelEvents_(ctx);

    // Ações clínicas
    qs("#btnAcaoNovaEvolucao")?.addEventListener("click", evo.abrirNovaEvolucao_);
    qs("#btnAcaoReceita")?.addEventListener("click", () => rx.abrirReceitaNoPainel_(ctx));
    qs("#btnAcaoExames")?.addEventListener("click", () => abrirExames_(ctx));
    qs("#btnAcaoDocumentos")?.addEventListener("click", () => docs.abrirDocumentosPanel_());

    // Evolução salvar
    qs("#formEvolucao")?.addEventListener("submit", (evv) => evo.salvarEvolucao(ctx, evv));

    // Receita (painel)
    qs("#btnAdicionarMedicamento")?.addEventListener("click", () => rx.criarMedicamentoCard_());
    qs("#formReceitaProntuario")?.addEventListener("submit", (evv) => rx.onSubmitReceita_(evv, ctx));
    rx.ensurePrimeiroMedicamento_();

    // Evoluções (paginadas)
    evo.setBtnMaisRef(qs("#btnCarregarMaisEvolucoes"));
    const evoPaging = evo.getEvoPaging();
    if (evoPaging.btnMais) evoPaging.btnMais.style.display = "none";

    const btnHistorico = qs("#btnCarregarHistoricoPaciente");
    if (btnHistorico) btnHistorico.textContent = "Carregar 10 últimas";
    btnHistorico?.addEventListener("click", () => {
      evo.setHistoricoCarregado(true);
      evo.carregarEvolucoesPaginadas_(ctx, { append: false, limit: 10 });
    });
    evoPaging.btnMais?.addEventListener("click", () => evo.carregarEvolucoesPaginadas_(ctx, { append: true, limit: 10 }));
    evo.carregarEvolucoesPaginadas_(ctx, { append: false, limit: 1 });

    // Receitas (lista)
    rx.setBtnMaisRef(qs("#btnCarregarMaisReceitas"));
    const recPaging = rx.getRecPaging();
    if (recPaging.btnMais) recPaging.btnMais.style.display = "none";

    rx.carregarReceitasPaginadas_(ctx, { append: false, limit: 1 });

    const btn10 = qs("#btnCarregarReceitasPaciente");
    if (btn10) btn10.textContent = "Carregar 10 últimas";
    btn10?.addEventListener("click", () => rx.carregarReceitasPaginadas_(ctx, { append: false, limit: 10 }));
    recPaging.btnMais?.addEventListener("click", () => rx.carregarReceitasPaginadas_(ctx, { append: true }));

    // ✅ ESC + TrapFocus para painel aberto (Receita / Documentos)
    document.addEventListener("keydown", (ev) => {
      const r = rx.getPanelRefs();
      const d = docs.getPanelRefs();

      const receitaOpen = r.panel && r.panel.style.display !== "none";
      const docsOpen = d.panel && d.panel.style.display !== "none";
      if (!receitaOpen && !docsOpen) return;

      if (ev.key === "Escape") {
        ev.preventDefault();
        if (docsOpen) docs.fecharDocumentosPanel_();
        else if (receitaOpen) rx.fecharReceitaPanel_();
        return;
      }

      if (docsOpen) trapFocusInPanel_(d.aside, ev);
      if (receitaOpen) trapFocusInPanel_(r.aside, ev);
    });
  }

  // ✅ main.js chama PRONTIO.pages[pageId].init()
  PRONTIO.pages.prontuario = PRONTIO.pages.prontuario || {};
  PRONTIO.pages.prontuario.init = initProntuario;

  // ✅ compat com router antigo (se existir)
  try {
    if (PRONTIO.core && PRONTIO.core.router && typeof PRONTIO.core.router.register === "function") {
      PRONTIO.core.router.register("prontuario", initProntuario);
    }
  } catch (_) {}
})(window, document);
