(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

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

  function qs(sel) {
    return document.querySelector(sel);
  }

  const LOCALSTORAGE_USER_INFO_KEY = "medpronto_user_info";

  let currentUserName = "Usuário";

  // Chat refs
  let elProntuarioUserLabel = null;
  let elChatMessages = null;
  let elChatStatus = null;
  let elChatInput = null;
  let elChatSend = null;
  let elChatOpenAgenda = null;
  let elChatOpenFull = null;

  // Evolução
  let historicoCompletoCarregado = false;
  let idEvolucaoEmEdicao = null;

  // Receitas
  let receitasCompletoCarregado = false;

  // Timeline unificada + paginação
  let tlEls = {
    vazio: null,
    ul: null,
    meta: null,
    btnRecarregar: null,
    btnCarregarMais: null,
    filtroEvo: null,
    filtroRec: null,
    filtroChat: null,
  };

  let tlCacheEvents = [];
  let tlCursor = null;
  let tlHasMore = false;
  let tlLoading = false;

  // Evoluções paginadas
  let evoPaging = {
    btnMais: null,
    cursor: null,
    hasMore: false,
    loading: false,
    lista: [],
  };

  // Receitas paginadas
  let recPaging = {
    btnMais: null,
    cursor: null,
    hasMore: false,
    loading: false,
    lista: [],
  };

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
  // Contexto do Prontuário
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
      data: params.data || (ctxStorage && ctxStorage.data) || (ctxState && ctxState.data) || "",
      hora:
        params.horario ||
        (ctxStorage && (ctxStorage.hora_inicio || ctxStorage.hora)) ||
        (ctxState && (ctxState.hora_inicio || ctxState.hora)) ||
        "",
      status: (ctxStorage && ctxStorage.status) || (ctxState && ctxState.status) || "",
      documento:
        (ctxStorage && (ctxStorage.documento_paciente || ctxStorage.documento)) ||
        (ctxState && (ctxState.documento_paciente || ctxState.documento)) ||
        "",
      telefone:
        (ctxStorage && (ctxStorage.telefone_paciente || ctxStorage.telefone)) ||
        (ctxState && (ctxState.telefone_paciente || ctxState.telefone)) ||
        "",
      tipo: (ctxStorage && ctxStorage.tipo) || (ctxState && ctxState.tipo) || "",
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

  function formatTimeFromISO(timestampIso) {
    if (!timestampIso) return "";
    const d = new Date(timestampIso);
    if (isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function formatDateTimeBR_(iso) {
    const d = parseDataHora(iso);
    if (!d) return String(iso || "");
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
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

  // ============================================================
  // User
  // ============================================================

  function loadUserFromLocalStorage() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(LOCALSTORAGE_USER_INFO_KEY);
      if (!raw) currentUserName = "Usuário";
      else {
        const info = JSON.parse(raw);
        currentUserName = (info && info.nome) || "Usuário";
      }
    } catch (e) {
      currentUserName = "Usuário";
    }

    if (elProntuarioUserLabel) elProntuarioUserLabel.textContent = "Você: " + currentUserName;
  }

  // ============================================================
  // ✅ Resumo do paciente (cadastro)
  // ============================================================

  function setTextOrDash_(selector, value) {
    const el = qs(selector);
    if (!el) return;
    const s = value === null || value === undefined ? "" : String(value).trim();
    el.textContent = s ? s : "—";
  }

  async function carregarResumoPaciente_(ctx) {
    // Nome imediato pelo contexto
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
        [
          "Prontuario.Paciente.ObterResumo",
          "Pacientes.ObterPorId",
          "Pacientes.GetById",
          "Paciente.ObterPorId",
        ],
        { idPaciente: ctx.idPaciente }
      );

      const pac = data && data.paciente ? data.paciente : data;

      const nome =
        (pac && (pac.nomeCompleto || pac.nome || pac.Nome || pac.nome_paciente)) ||
        ctx.nome ||
        "—";

      const idade = pac && (pac.idade || pac.Idade);
      const profissao = pac && (pac.profissao || pac.Profissao);
      const plano =
        pac && (pac.planoSaude || pac.plano || pac.convenio || pac.Convenio || pac.PlanoSaude);
      const carteirinha =
        pac && (pac.carteirinha || pac.numeroCarteirinha || pac.Carteirinha || pac.NumeroCarteirinha);

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
  // Ações clínicas
  // ============================================================

  function abrirNovaEvolucao_() {
    const card = qs("#cardNovaEvolucao");
    if (!card) return;
    card.style.display = "";
    const txt = qs("#textoEvolucao");
    if (txt) txt.focus();
  }

  function abrirPainelReceita_(ctx) {
    if (typeof PRONTIO.abrirReceitaPanel === "function") {
      PRONTIO.abrirReceitaPanel();
      return;
    }

    try {
      const base = new URL("receita.html", global.location.origin);
      if (ctx.idPaciente) base.searchParams.set("pacienteId", ctx.idPaciente);
      if (ctx.nome) base.searchParams.set("pacienteNome", ctx.nome);
      if (ctx.idAgenda) base.searchParams.set("agendaId", ctx.idAgenda);
      global.location.href = base.toString();
    } catch (e) {
      global.alert("Não foi possível abrir a receita.");
    }
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

  function abrirDocumentos_(ctx) {
    try {
      const base = new URL("laudo.html", global.location.origin);
      if (ctx.idPaciente) base.searchParams.set("pacienteId", ctx.idPaciente);
      if (ctx.nome) base.searchParams.set("pacienteNome", ctx.nome);
      if (ctx.idAgenda) base.searchParams.set("agendaId", ctx.idAgenda);
      base.searchParams.set("from", "prontuario");
      global.location.href = base.toString();
    } catch (e) {
      global.alert("Não foi possível abrir Documentos.");
    }
  }

  function _setBtnMais_(btn, hasMore, loading) {
    if (!btn) return;
    btn.style.display = hasMore ? "inline-flex" : "none";
    btn.disabled = !!loading;
  }

  // ============================================================
  // Timeline unificada (com paginação)
  // ============================================================

  function tlGetEnabledTypes_() {
    const types = [];
    if (tlEls.filtroEvo && tlEls.filtroEvo.checked) types.push("EVOLUCAO");
    if (tlEls.filtroRec && tlEls.filtroRec.checked) types.push("RECEITA");
    if (tlEls.filtroChat && tlEls.filtroChat.checked) types.push("CHAT");
    return types;
  }

  function tlApplyFilterAndRender_() {
    const enabled = tlGetEnabledTypes_();
    const list = (tlCacheEvents || []).filter((e) => enabled.indexOf(e.type) >= 0);
    tlRender_(list);
  }

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

  function tlRender_(events) {
    if (!tlEls.ul || !tlEls.vazio) return;

    tlEls.ul.innerHTML = "";

    if (!events || !events.length) {
      tlEls.vazio.classList.remove("is-hidden");
      tlEls.vazio.textContent = "Nenhum evento para exibir com os filtros selecionados.";
      if (tlEls.meta) tlEls.meta.textContent = "0 eventos";
      return;
    }

    tlEls.vazio.classList.add("is-hidden");
    if (tlEls.meta) tlEls.meta.textContent = `${events.length} evento(s)`;

    events.forEach((ev) => {
      const li = document.createElement("li");
      li.className = "evolucao-item";

      const when = formatDateTimeBR_(ev.ts || ev.dataHora || ev.criadoEm || "");
      const title = ev.title || "";
      const summary = ev.summary || "";

      const typeLabel =
        ev.type === "EVOLUCAO"
          ? "Evolução"
          : ev.type === "RECEITA"
          ? "Receita"
          : ev.type === "CHAT"
          ? "Chat"
          : "Evento";
      const badge = `<span class="badge">${typeLabel}</span>`;

      let actionsHtml = "";
      if (ev.type === "RECEITA" && ev.id) {
        actionsHtml = `
          <div class="evo-actions">
            <button type="button" class="btn-evo-usar-modelo js-tl-abrir-receita" data-id="${ev.id}">Abrir PDF</button>
          </div>
        `;
      }

      li.innerHTML = `
        <div class="evo-header">
          <span class="evo-data">${when || ""}</span>
          ${badge}
          ${title ? `<span class="evo-autor">${title}</span>` : ""}
        </div>
        <div class="evo-texto">${String(summary || "").replace(/\n/g, "<br>")}</div>
        ${actionsHtml}
      `;

      const btnAbrirPdf = li.querySelector(".js-tl-abrir-receita");
      if (btnAbrirPdf) {
        btnAbrirPdf.addEventListener("click", (e) => {
          e.stopPropagation();
          abrirPdfReceita(btnAbrirPdf.dataset.id || ev.id);
        });
      }

      tlEls.ul.appendChild(li);
    });
  }

  function _timelineKey_(ev) {
    const t = String(ev && ev.type ? ev.type : "");
    const id = String(ev && ev.id ? ev.id : "");
    const ts = String(ev && ev.ts ? ev.ts : "");
    return `${t}::${id || "-"}::${ts || "-"}`;
  }

  function _dedupeAppend_(baseList, toAppend) {
    const map = new Set();
    (baseList || []).forEach((e) => map.add(_timelineKey_(e)));
    const out = (baseList || []).slice();

    (toAppend || []).forEach((e) => {
      const k = _timelineKey_(e);
      if (!map.has(k)) {
        map.add(k);
        out.push(e);
      }
    });

    out.sort((a, b) => {
      const da = parseDataHora(a.ts) || new Date(0);
      const db = parseDataHora(b.ts) || new Date(0);
      return db - da;
    });

    return out;
  }

  function _setCarregarMaisVisibility_() {
    if (!tlEls.btnCarregarMais) return;
    tlEls.btnCarregarMais.style.display = tlHasMore ? "inline-flex" : "none";
    tlEls.btnCarregarMais.disabled = !!tlLoading;
  }

  async function tlCarregarPagina_(ctx, opts) {
    if (!tlEls.ul || !tlEls.vazio) return;

    if (tlLoading) return;
    tlLoading = true;
    _setCarregarMaisVisibility_();

    const append = !!(opts && opts.append);
    const cursor = opts && typeof opts.cursor === "string" ? opts.cursor : null;

    if (!append) {
      tlEls.vazio.classList.remove("is-hidden");
      tlEls.vazio.textContent = "Carregando timeline...";
      tlEls.ul.innerHTML = "";
      if (tlEls.meta) tlEls.meta.textContent = "—";
    }

    if (!ctx.idPaciente) {
      if (!append) tlEls.vazio.textContent = "Nenhum paciente selecionado.";
      tlCacheEvents = [];
      tlCursor = null;
      tlHasMore = false;
      tlLoading = false;
      _setCarregarMaisVisibility_();
      return;
    }

    try {
      const payload = { idPaciente: ctx.idPaciente, limit: 80 };
      if (cursor) payload.cursor = cursor;

      const data = await callApiDataTry_(["Prontuario.Timeline.ListarPorPaciente"], payload);

      const events = (data && (data.events || data.eventos)) || [];
      const nextCursor =
        data && (data.nextCursor || (data.page && data.page.nextCursor))
          ? data.nextCursor || data.page.nextCursor
          : null;
      const hasMore = !!(data && (data.hasMore || (data.page && data.page.hasMore)));

      if (!append) tlCacheEvents = Array.isArray(events) ? events : [];
      else tlCacheEvents = _dedupeAppend_(tlCacheEvents, Array.isArray(events) ? events : []);

      tlCursor = nextCursor || null;
      tlHasMore = hasMore && !!tlCursor;

      tlApplyFilterAndRender_();
    } catch (e) {
      if (!append) {
        tlCacheEvents = [];
        tlEls.vazio.classList.remove("is-hidden");
        tlEls.vazio.textContent = "Erro ao carregar timeline.";
        if (tlEls.meta) tlEls.meta.textContent = "—";
      }
    } finally {
      tlLoading = false;
      _setCarregarMaisVisibility_();
    }
  }

  function tlRecarregar_(ctx) {
    tlCursor = null;
    tlHasMore = false;
    return tlCarregarPagina_(ctx, { append: false, cursor: null });
  }

  function tlCarregarMais_(ctx) {
    if (!tlHasMore || !tlCursor) return;
    return tlCarregarPagina_(ctx, { append: true, cursor: tlCursor });
  }

  // ============================================================
  // Evoluções (paginadas)
  // ============================================================

  function ordenarEvolucoes(lista) {
    return (lista || [])
      .slice()
      .sort((a, b) => {
        const da = parseDataHora(a.dataHoraRegistro || a.dataHora || a.data || a.criadoEm) || new Date(0);
        const db = parseDataHora(b.dataHoraRegistro || b.dataHora || b.data || b.criadoEm) || new Date(0);
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
            <button type="button" class="btn-evo-usar-modelo" data-id="${idEvo}">Usar como modelo</button>
            <button type="button" class="btn-evo-editar" data-id="${idEvo}">Editar evolução</button>
          </div>
        `;
      }

      li.innerHTML = `
        <div class="evo-header">
          <span class="evo-data">${dataFmt || ""}</span>
          ${autor ? `<span class="evo-autor">${autor}</span>` : ""}
          ${origem ? `<span class="evo-origem badge">${origem}</span>` : ""}
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
    const append = !!(opts && opts.append);
    const ul = qs("#listaEvolucoesPaciente");
    const vazio = qs("#listaEvolucoesPacienteVazia");
    if (!ul || !vazio) return;

    if (evoPaging.loading) return;
    evoPaging.loading = true;
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
      vazio.textContent = "Carregando evoluções...";
      ul.innerHTML = "";
      evoPaging.lista = [];
      evoPaging.cursor = null;
      evoPaging.hasMore = false;
    }

    try {
      const payload = { idPaciente: ctx.idPaciente, limit: 40 };
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
  // Receitas (paginadas) + PDF
  // ============================================================

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
      const itens = rec.itens || rec.Itens || [];
      const observacoes = rec.observacoes || rec.Observacoes || "";

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
        <div class="receita-meta texto-menor texto-suave">
          ID Receita: ${idRec || "—"} · Clique para reabrir o PDF
        </div>
        ${metaExtra ? `<div class="receita-meta texto-menor texto-suave">${metaExtra}</div>` : ""}
        <div class="receita-actions">
          <button type="button" class="btn btn-xs btn-link js-receita-usar-modelo">Usar como modelo</button>
        </div>
      `;

      li.addEventListener("click", () => abrirPdfReceita(li.dataset.idReceita || idRec));

      const btnModelo = li.querySelector(".js-receita-usar-modelo");
      if (btnModelo) {
        btnModelo.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (typeof PRONTIO.carregarItensReceitaNoForm === "function") {
            PRONTIO.carregarItensReceitaNoForm(itens, observacoes);
          } else if (typeof PRONTIO.abrirReceitaPanel === "function") {
            PRONTIO.abrirReceitaPanel();
          } else {
            global.alert("Painel de receita não disponível (page-receita.js não carregado?).");
          }
        });
      }

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
      const payload = { idPaciente: ctx.idPaciente, limit: 25 };
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

      receitasCompletoCarregado = true;
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
  // Chat (card rápido)
  // ============================================================

  function renderProntuarioChatMessages(messages) {
    if (!elChatMessages || !elChatStatus) return;

    elChatMessages.innerHTML = "";

    if (!messages || !messages.length) {
      const empty = document.createElement("p");
      empty.className = "msg-menor texto-suave";
      empty.style.margin = "0";
      empty.textContent = "Nenhuma anotação ainda para este paciente.";
      elChatMessages.appendChild(empty);
      elChatStatus.textContent = "0 mensagens";
      return;
    }

    messages.forEach((msg) => {
      const wrapper = document.createElement("div");
      wrapper.className = "prontuario-chat-message";
      wrapper.style.padding = "6px 8px";
      wrapper.style.borderRadius = "8px";
      wrapper.style.backgroundColor = "var(--bg-soft, #f3f4f6)";

      const meta = document.createElement("div");
      meta.style.display = "flex";
      meta.style.justifyContent = "space-between";
      meta.style.fontSize = "0.75rem";
      meta.style.color = "#4b5563";
      meta.style.marginBottom = "2px";

      const senderSpan = document.createElement("span");
      senderSpan.style.fontWeight = "500";
      senderSpan.textContent = msg.sender || "Anônimo";

      const timeSpan = document.createElement("span");
      timeSpan.style.fontVariantNumeric = "tabular-nums";
      timeSpan.textContent = formatTimeFromISO(msg.timestamp || msg.dataHora || msg.criadoEm || "");

      meta.appendChild(senderSpan);
      meta.appendChild(timeSpan);

      const textDiv = document.createElement("div");
      textDiv.style.whiteSpace = "pre-wrap";
      textDiv.style.wordWrap = "break-word";
      textDiv.style.color = "#111827";
      textDiv.textContent = msg.message || msg.texto || "";

      wrapper.appendChild(meta);
      wrapper.appendChild(textDiv);

      elChatMessages.appendChild(wrapper);
    });

    elChatStatus.textContent = messages.length === 1 ? "1 mensagem" : `${messages.length} mensagens`;
    elChatMessages.scrollTop = elChatMessages.scrollHeight;
  }

  async function carregarChatPaciente(ctx) {
    if (!elChatMessages || !elChatStatus) return;

    if (!ctx.idPaciente) {
      elChatMessages.innerHTML = "";
      const empty = document.createElement("p");
      empty.className = "msg-menor texto-suave";
      empty.style.margin = "0";
      empty.textContent = "Nenhum paciente selecionado para o chat.";
      elChatMessages.appendChild(empty);
      elChatStatus.textContent = "Chat indisponível (sem paciente).";
      return;
    }

    try {
      elChatStatus.textContent = "Carregando chat...";
      elChatMessages.innerHTML = "";
      const loading = document.createElement("p");
      loading.className = "msg-menor texto-suave";
      loading.style.margin = "0";
      loading.textContent = "Carregando chat do paciente...";
      elChatMessages.appendChild(loading);

      const data = await callApiDataTry_(
        ["Prontuario.Chat.ListByPaciente", "chat.listByPaciente", "Chat.ListByPaciente"],
        { idPaciente: ctx.idPaciente }
      );

      const messages = (data && (data.messages || data.mensagens)) || (Array.isArray(data) ? data : []) || [];
      renderProntuarioChatMessages(messages);

      if (elChatOpenFull) {
        try {
          const base = new URL("chat.html", global.location.origin);
          base.searchParams.set("pacienteId", ctx.idPaciente);
          if (ctx.nome) base.searchParams.set("pacienteNome", ctx.nome);
          if (ctx.idAgenda) base.searchParams.set("agendaId", ctx.idAgenda);
          elChatOpenFull.href = base.toString();
        } catch (e) {}
      }

      if (elChatOpenAgenda) {
        if (ctx.idAgenda) {
          try {
            const baseA = new URL("agenda.html", global.location.origin);
            baseA.searchParams.set("agendaId", ctx.idAgenda);
            if (ctx.idPaciente) baseA.searchParams.set("pacienteId", ctx.idPaciente);
            if (ctx.nome) baseA.searchParams.set("pacienteNome", ctx.nome);
            if (ctx.data) baseA.searchParams.set("data", ctx.data);
            if (ctx.hora) baseA.searchParams.set("horario", ctx.hora);
            elChatOpenAgenda.href = baseA.toString();
            elChatOpenAgenda.style.display = "inline-flex";
          } catch (e) {
            elChatOpenAgenda.style.display = "none";
          }
        } else {
          elChatOpenAgenda.style.display = "none";
        }
      }
    } catch (error) {
      elChatMessages.innerHTML = "";
      const errorDiv = document.createElement("p");
      errorDiv.className = "msg-menor texto-suave";
      errorDiv.style.margin = "0";
      errorDiv.textContent = "Erro ao carregar mensagens do chat.";
      elChatMessages.appendChild(errorDiv);
      elChatStatus.textContent = "Erro ao carregar chat. Tente novamente mais tarde.";
    }
  }

  async function enviarMensagemRapida(ctx) {
    if (!ctx.idPaciente || !elChatInput || !elChatSend || !elChatStatus) return;

    const text = elChatInput.value ? elChatInput.value.trim() : "";
    if (!text) return;

    try {
      elChatSend.disabled = true;
      elChatStatus.textContent = "Enviando...";

      const data = await callApiDataTry_(
        ["Prontuario.Chat.SendByPaciente", "chat.sendByPaciente", "Chat.SendByPaciente"],
        { idPaciente: ctx.idPaciente, sender: currentUserName, message: text }
      );

      const messages = (data && (data.messages || data.mensagens)) || (Array.isArray(data) ? data : []) || [];
      renderProntuarioChatMessages(messages);
      elChatInput.value = "";
      elChatStatus.textContent = "Mensagem enviada.";

      // Atualiza também a timeline (sem duplicar regra de negócio)
      if (PRONTIO && typeof PRONTIO.prontuarioRecarregarTimeline === "function") {
        PRONTIO.prontuarioRecarregarTimeline();
      }
    } catch (error) {
      global.alert("Erro ao enviar mensagem. Tente novamente.");
      elChatStatus.textContent = "Erro ao enviar mensagem.";
    } finally {
      elChatSend.disabled = false;
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

      // Atualiza topo (caso cadastro tenha sido alterado fora)
      carregarResumoPaciente_(ctx);

      // Se histórico completo está aberto, recarrega a primeira página
      if (historicoCompletoCarregado) {
        carregarEvolucoesPaginadas_(ctx, { append: false });
      }

      // Atualiza timeline
      if (PRONTIO && typeof PRONTIO.prontuarioRecarregarTimeline === "function") {
        PRONTIO.prontuarioRecarregarTimeline();
      }
    } catch (e) {
      setMensagemEvolucao({ tipo: "erro", texto: "Erro ao salvar evolução." });
    }
  }

  // ============================================================
  // Init
  // ============================================================

  function initProntuario() {
    const ctx = carregarContextoProntuario();
    PRONTIO.prontuarioContexto = ctx;

    // ✅ Preenche topo com dados do cadastro do paciente
    carregarResumoPaciente_(ctx);

    // Timeline
    tlEls.vazio = qs("#tlVazio");
    tlEls.ul = qs("#tlLista");
    tlEls.meta = qs("#tlMeta");
    tlEls.btnRecarregar = qs("#btnTimelineRecarregar");
    tlEls.btnCarregarMais = qs("#btnTimelineCarregarMais");
    tlEls.filtroEvo = qs("#tlFiltroEvolucao");
    tlEls.filtroRec = qs("#tlFiltroReceita");
    tlEls.filtroChat = qs("#tlFiltroChat");

    if (tlEls.btnRecarregar) tlEls.btnRecarregar.addEventListener("click", () => tlRecarregar_(ctx));
    if (tlEls.btnCarregarMais) tlEls.btnCarregarMais.addEventListener("click", () => tlCarregarMais_(ctx));
    if (tlEls.filtroEvo) tlEls.filtroEvo.addEventListener("change", tlApplyFilterAndRender_);
    if (tlEls.filtroRec) tlEls.filtroRec.addEventListener("change", tlApplyFilterAndRender_);
    if (tlEls.filtroChat) tlEls.filtroChat.addEventListener("change", tlApplyFilterAndRender_);

    PRONTIO.prontuarioRecarregarTimeline = function () {
      const contexto = PRONTIO.prontuarioContexto || ctx;
      return tlRecarregar_(contexto);
    };

    // Botões de ações clínicas
    const btnNovaEvo = qs("#btnAcaoNovaEvolucao");
    if (btnNovaEvo) btnNovaEvo.addEventListener("click", abrirNovaEvolucao_);

    const btnReceita = qs("#btnAcaoReceita");
    if (btnReceita) btnReceita.addEventListener("click", () => abrirPainelReceita_(ctx));

    const btnExames = qs("#btnAcaoExames");
    if (btnExames) btnExames.addEventListener("click", () => abrirExames_(ctx));

    const btnDocs = qs("#btnAcaoDocumentos");
    if (btnDocs) btnDocs.addEventListener("click", () => abrirDocumentos_(ctx));

    // Evolução salvar
    const formEvo = qs("#formEvolucao");
    if (formEvo) formEvo.addEventListener("submit", (ev) => salvarEvolucao(ctx, ev));

    // Evoluções paginadas (histórico completo)
    evoPaging.btnMais = qs("#btnCarregarMaisEvolucoes");
    _setBtnMais_(evoPaging.btnMais, false, false);

    const btnHist = qs("#btnCarregarHistoricoPaciente");
    if (btnHist) {
      btnHist.addEventListener("click", () => {
        historicoCompletoCarregado = true;
        carregarEvolucoesPaginadas_(ctx, { append: false });
      });
    }
    if (evoPaging.btnMais) {
      evoPaging.btnMais.addEventListener("click", () => carregarEvolucoesPaginadas_(ctx, { append: true }));
    }

    // Receitas paginadas
    recPaging.btnMais = qs("#btnCarregarMaisReceitas");
    _setBtnMais_(recPaging.btnMais, false, false);

    const btnReceitas = qs("#btnCarregarReceitasPaciente");
    if (btnReceitas) {
      btnReceitas.addEventListener("click", () => {
        receitasCompletoCarregado = true;
        carregarReceitasPaginadas_(ctx, { append: false });
      });
    }
    if (recPaging.btnMais) {
      recPaging.btnMais.addEventListener("click", () => carregarReceitasPaginadas_(ctx, { append: true }));
    }

    // Chat refs
    elProntuarioUserLabel = document.getElementById("prontuario-current-user-label");
    elChatMessages = qs("#prontuario-chat-messages");
    elChatStatus = qs("#prontuario-chat-status");
    elChatInput = qs("#prontuario-chat-input");
    elChatSend = qs("#prontuario-chat-send");
    elChatOpenAgenda = qs("#prontuario-open-agenda");
    elChatOpenFull = qs("#prontuario-open-full-chat");

    loadUserFromLocalStorage();

    if (elChatSend) elChatSend.addEventListener("click", () => enviarMensagemRapida(ctx));
    if (elChatInput) {
      elChatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          enviarMensagemRapida(ctx);
        }
      });
    }

    // Carregamentos iniciais
    tlRecarregar_(ctx);
    carregarChatPaciente(ctx);
  }

  if (PRONTIO.registerPage) {
    PRONTIO.registerPage("prontuario", initProntuario);
  } else {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initProntuario);
    else initProntuario();
  }
})(window, document);
