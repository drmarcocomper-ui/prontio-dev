(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      return Promise.reject(
        new Error(
          "API não disponível (callApiData indefinido). Verifique se assets/js/api.js foi carregado antes."
        )
      );
    };

  function qs(sel) {
    return document.querySelector(sel);
  }
  function qsa(sel) {
    return Array.from(document.querySelectorAll(sel));
  }

  const LOCALSTORAGE_USER_INFO_KEY = "medpronto_user_info";

  let currentUserName = "Usuário";

  let elProntuarioUserLabel = null;
  let elChatMessages = null;
  let elChatStatus = null;
  let elChatInput = null;
  let elChatSend = null;
  let elChatOpenAgenda = null;
  let elChatOpenFull = null;

  let historicoCompletoCarregado = false;
  let idEvolucaoEmEdicao = null;

  let receitasCompletoCarregado = false;

  // ============================================================
  // Helpers de API: tentativa + fallback
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
  // Contexto / UI
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
        "Paciente",
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

  function aplicarContextoNaUI(ctx) {
    const elNome = qs("#prontuario-paciente-nome");
    const elId = qs("#prontuario-paciente-id");
    const elData = qs("#info-agenda-data");
    const elHora = qs("#info-agenda-hora");
    const elStatus = qs("#info-agenda-status");
    const elAgendaId = qs("#info-agenda-id");
    const meta = qs("#topbar-meta-context");

    if (elNome) elNome.textContent = ctx.nome || "Paciente";
    if (elId) elId.textContent = ctx.idPaciente || "—";

    if (elData) elData.textContent = ctx.data ? String(ctx.data).split("-").reverse().join("/") : "—";
    if (elHora) elHora.textContent = ctx.hora || "—";
    if (elStatus) elStatus.textContent = ctx.status || "—";
    if (elAgendaId) elAgendaId.textContent = ctx.idAgenda || "—";

    if (meta) meta.textContent = ctx.idPaciente ? `Paciente #${ctx.idPaciente}` : "";
  }

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

  function formatIsoDateToBR_(iso) {
    if (!iso) return "";
    const partes = String(iso).split("-");
    if (partes.length !== 3) return "";
    const [ano, mes, dia] = partes;
    if (!ano || !mes || !dia) return "";
    return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
  }

  // ✅ converte ENUM (COMUM/ESPECIAL) e variantes legadas para rótulo humano
  function formatTipoReceitaLabel_(raw) {
    const s = String(raw || "").trim();
    if (!s) return "Comum";

    const up = s.toUpperCase();
    if (up === "COMUM") return "Comum";
    if (up === "ESPECIAL") return "Especial";

    if (s === "Comum" || s === "Especial") return s;

    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

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
  // Chat
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

      const data = await callApiData({ action: "chat.listByPaciente", payload: { idPaciente: ctx.idPaciente } });
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

      const data = await callApiData({
        action: "chat.sendByPaciente",
        payload: { idPaciente: ctx.idPaciente, sender: currentUserName, message: text },
      });

      const messages = (data && (data.messages || data.mensagens)) || (Array.isArray(data) ? data : []) || [];

      renderProntuarioChatMessages(messages);
      elChatInput.value = "";
      elChatStatus.textContent = "Mensagem enviada.";
    } catch (error) {
      global.alert("Erro ao enviar mensagem. Tente novamente.");
      elChatStatus.textContent = "Erro ao enviar mensagem.";
    } finally {
      elChatSend.disabled = false;
    }
  }

  // ============================================================
  // Evolução
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
        // ✅ CORRIGIDO: removido um ")" extra que quebrava o JS
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
            const card = qs("#cardNovaEvolucao");
            if (card) card.style.display = "";
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
            const card = qs("#cardNovaEvolucao");
            if (card) card.style.display = "";
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

  function setMensagemEvolucao(obj) {
    const el = qs("#mensagemEvolucao");
    if (!el) return;
    el.classList.remove("is-hidden", "msg-erro", "msg-sucesso");
    el.textContent = (obj && obj.texto) || "";
    if (obj && obj.tipo === "erro") el.classList.add("msg-erro");
    if (obj && obj.tipo === "sucesso") el.classList.add("msg-sucesso");
  }

  async function carregarHistoricoPaciente(ctx, opts) {
    const apenasUltima = !!(opts && opts.apenasUltima);
    const ul = qs("#listaEvolucoesPaciente");
    const vazio = qs("#listaEvolucoesPacienteVazia");
    if (!ul || !vazio) return;

    vazio.textContent = "Carregando...";
    vazio.classList.remove("is-hidden");
    ul.innerHTML = "";

    if (!ctx.idPaciente) {
      vazio.textContent = "Nenhum paciente selecionado.";
      return;
    }

    try {
      const data = await callApiDataTry_(
        ["Prontuario.Evolucao.ListarPorPaciente", "Evolucao.ListarPorPaciente"],
        { idPaciente: ctx.idPaciente }
      );

      let lista = (data && (data.evolucoes || data.lista)) || (Array.isArray(data) ? data : []) || [];
      lista = ordenarEvolucoes(lista);

      if (apenasUltima) {
        renderListaEvolucoes(lista.slice(0, 1), ul, vazio);
        historicoCompletoCarregado = false;
      } else {
        renderListaEvolucoes(lista, ul, vazio);
        historicoCompletoCarregado = true;
      }
    } catch (e) {
      vazio.textContent = "Erro ao carregar evoluções.";
    }
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

      await carregarHistoricoPaciente(ctx, { apenasUltima: !historicoCompletoCarregado });
    } catch (e) {
      setMensagemEvolucao({ tipo: "erro", texto: "Erro ao salvar evolução." });
    }
  }

  // ============================================================
  // Receita (FOCO): listar + abrir PDF (Prontuario.* com fallback)
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
      global.alert(
        "Erro ao abrir o PDF da receita:\n\n" + (err && err.message ? err.message : String(err || ""))
      );
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

  async function carregarReceitasPaciente(ctx, opts) {
    const apenasUltima = !!(opts && opts.apenasUltima);
    const ul = qs("#listaReceitasPaciente");
    const vazio = qs("#listaReceitasPacienteVazia");

    if (!ul || !vazio) return;

    vazio.textContent = apenasUltima ? "Carregando última receita..." : "Carregando receitas...";
    vazio.classList.remove("is-hidden");
    ul.innerHTML = "";

    if (!ctx.idPaciente) {
      vazio.textContent = "Nenhum paciente selecionado.";
      return;
    }

    try {
      const data = await callApiDataTry_(["Prontuario.Receita.ListarPorPaciente", "Receita.ListarPorPaciente"], {
        idPaciente: ctx.idPaciente,
      });

      let lista = (data && (data.receitas || data.lista)) || (Array.isArray(data) ? data : []) || [];

      lista = (lista || [])
        .slice()
        .sort((a, b) => {
          const da = parseDataHora(a.dataHoraCriacao || a.dataHora || a.data || a.criadoEm) || new Date(0);
          const db = parseDataHora(b.dataHoraCriacao || b.dataHora || b.data || b.criadoEm) || new Date(0);
          return db - da;
        });

      if (apenasUltima) {
        renderListaReceitas(lista.slice(0, 1), ul, vazio);
        receitasCompletoCarregado = false;
      } else {
        renderListaReceitas(lista, ul, vazio);
        receitasCompletoCarregado = true;
      }
    } catch (e) {
      vazio.textContent = "Erro ao carregar receitas.";
    }
  }

  // ============================================================
  // Init
  // ============================================================

  function initProntuario() {
    const ctx = carregarContextoProntuario();
    PRONTIO.prontuarioContexto = ctx;

    aplicarContextoNaUI(ctx);

    elProntuarioUserLabel = document.getElementById("prontuario-current-user-label");
    elChatMessages = qs("#prontuario-chat-messages");
    elChatStatus = qs("#prontuario-chat-status");
    elChatInput = qs("#prontuario-chat-input");
    elChatSend = qs("#prontuario-chat-send");
    elChatOpenAgenda = qs("#prontuario-open-agenda");
    elChatOpenFull = qs("#prontuario-open-full-chat");

    loadUserFromLocalStorage();

    const formEvo = qs("#formEvolucao");
    if (formEvo) formEvo.addEventListener("submit", (ev) => salvarEvolucao(ctx, ev));

    const btnHist = qs("#btnCarregarHistoricoPaciente");
    if (btnHist) btnHist.addEventListener("click", () => carregarHistoricoPaciente(ctx, { apenasUltima: false }));

    carregarHistoricoPaciente(ctx, { apenasUltima: true });
    carregarReceitasPaciente(ctx, { apenasUltima: true });

    const btnReceitas = qs("#btnCarregarReceitasPaciente");
    if (btnReceitas) btnReceitas.addEventListener("click", () => carregarReceitasPaciente(ctx, { apenasUltima: false }));

    PRONTIO.recarregarReceitasPaciente = function (opcoes) {
      const contexto = PRONTIO.prontuarioContexto || ctx;
      if (!contexto || !contexto.idPaciente) return;

      const apenasUltima =
        opcoes && typeof opcoes.apenasUltima === "boolean" ? opcoes.apenasUltima : !receitasCompletoCarregado;

      carregarReceitasPaciente(contexto, { apenasUltima });
    };

    if (elChatSend) elChatSend.addEventListener("click", () => enviarMensagemRapida(ctx));
    if (elChatInput) {
      elChatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          enviarMensagemRapida(ctx);
        }
      });
    }

    carregarChatPaciente(ctx);

    // painel receita é controlado por page-receita.js
  }

  if (PRONTIO.registerPage) {
    PRONTIO.registerPage("prontuario", initProntuario);
  } else {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initProntuario);
    else initProntuario();
  }
})(window, document);
