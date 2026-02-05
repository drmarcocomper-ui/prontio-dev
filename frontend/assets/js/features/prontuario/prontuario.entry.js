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

  const { qs, trapFocusInPanel_, showToast_ } = PRONTIO.features.prontuario.utils;
  const { carregarContextoProntuario } = PRONTIO.features.prontuario.context;
  const { carregarResumoPaciente_ } = PRONTIO.features.prontuario.paciente;

  const docs = PRONTIO.features.prontuario.documentos;
  const evo = PRONTIO.features.prontuario.evolucoes;
  const rx = PRONTIO.features.prontuario.receitas;
  const anamnese = PRONTIO.features.prontuario.anamnese;

  function abrirExames_(ctx) {
    try {
      const base = new URL("exames.html", global.location.origin);
      if (ctx.idPaciente) base.searchParams.set("pacienteId", ctx.idPaciente);
      if (ctx.nomeCompleto) base.searchParams.set("pacienteNomeCompleto", ctx.nomeCompleto);
      if (ctx.idAgenda) base.searchParams.set("agendaId", ctx.idAgenda);
      global.location.href = base.toString();
    } catch (e) {
      // ✅ P1: Usa toast em vez de alert()
      showToast_("Não foi possível abrir Exames.");
    }
  }

  /**
   * Abre WhatsApp Web/App com mensagem para o paciente
   */
  function abrirWhatsApp_(ctx) {
    if (!ctx.telefone) {
      showToast_("Paciente não possui telefone cadastrado.", "erro");
      return;
    }

    // Limpa telefone: remove tudo que não é número
    let tel = String(ctx.telefone).replace(/\D/g, "");

    // Se não começar com 55 (Brasil), adiciona
    if (tel.length <= 11 && !tel.startsWith("55")) {
      tel = "55" + tel;
    }

    const nome = ctx.nomeCompleto || ctx.nome || "paciente";
    const mensagem = encodeURIComponent(`Olá, ${nome}!`);
    const url = `https://wa.me/${tel}?text=${mensagem}`;

    // Abre em nova aba
    const win = global.open(url, "_blank");
    if (!win) {
      // Popup bloqueado - tenta com window.location
      showToast_("Popup bloqueado. Redirecionando...", "info");
      global.location.href = url;
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
    if (anamnese && anamnese.setupAnamnesePanelEvents_) {
      anamnese.setupAnamnesePanelEvents_(ctx);
    }

    // Ações clínicas
    qs("#btnAcaoNovaEvolucao")?.addEventListener("click", evo.abrirNovaEvolucao_);
    qs("#btnAcaoReceita")?.addEventListener("click", () => rx.abrirReceitaNoPainel_(ctx));
    qs("#btnAcaoExames")?.addEventListener("click", () => abrirExames_(ctx));
    qs("#btnAcaoDocumentos")?.addEventListener("click", () => docs.abrirDocumentosPanel_());
    qs("#btnAcaoAnamnese")?.addEventListener("click", () => {
      if (anamnese && anamnese.abrirAnamnesePanel_) {
        anamnese.abrirAnamnesePanel_(ctx);
      }
    });

    // WhatsApp do paciente
    qs("#btnWhatsAppPaciente")?.addEventListener("click", () => abrirWhatsApp_(ctx));

    // Evolução salvar
    qs("#formEvolucao")?.addEventListener("submit", (evv) => evo.salvarEvolucao(ctx, evv));

    // Botão inserir anamnese na evolução
    if (evo.setupInserirAnamneseBtn_) {
      evo.setupInserirAnamneseBtn_(ctx);
    }

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

    // ✅ ESC + TrapFocus para painel aberto (Receita / Documentos / Anamnese)
    document.addEventListener("keydown", (ev) => {
      const r = rx.getPanelRefs();
      const d = docs.getPanelRefs();
      const a = anamnese && anamnese.getPanelRefs ? anamnese.getPanelRefs() : {};

      const receitaOpen = r.panel && r.panel.style.display !== "none";
      const docsOpen = d.panel && d.panel.style.display !== "none";
      const anamneseOpen = a.panel && a.panel.style.display !== "none";
      if (!receitaOpen && !docsOpen && !anamneseOpen) return;

      if (ev.key === "Escape") {
        ev.preventDefault();
        if (anamneseOpen && anamnese.fecharAnamnesePanel_) anamnese.fecharAnamnesePanel_();
        else if (docsOpen) docs.fecharDocumentosPanel_();
        else if (receitaOpen) rx.fecharReceitaPanel_();
        return;
      }

      if (anamneseOpen) trapFocusInPanel_(a.aside, ev);
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
