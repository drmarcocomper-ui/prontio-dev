// assets/js/pages/page-index.js
// Tela inicial (index) = Lista de Atendimento
// Mostra todos os agendamentos do dia de hoje para frente,
// ordenados por data e hora, usando a ação de API: Agenda.ListarAFuturo

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  // -----------------------------------------------------
  // Dependências (callApiData, formatarDataBR, createPageMessages)
  // -----------------------------------------------------

  // ✅ Padrão PRONTIO (assets/js/api.js):
  // - callApiData() retorna SOMENTE data e lança erro se success=false
  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      console.warn("[PRONTIO.index] callApiData não definido.");
      return Promise.reject(
        new Error("API não disponível nesta página (callApiData indefinido).")
      );
    };

  // formatarDataBR: tenta pegar de utils ou usa fallback simples
  const utils = (PRONTIO.core && PRONTIO.core.utils) || {};
  const formatarDataBR =
    global.formatarDataBR ||
    utils.formatarDataBR ||
    function fallbackFormatarDataBR(iso) {
      if (!iso) return "";
      const parts = String(iso).split("-");
      if (parts.length !== 3) return iso;
      const [ano, mes, dia] = parts;
      return `${dia}/${mes}/${ano}`;
    };

  // createPageMessages: vem de ui/messages.js ou fallback básico
  const createPageMessages =
    global.createPageMessages ||
    (PRONTIO.ui && PRONTIO.ui.messages && PRONTIO.ui.messages.createPageMessages) ||
    function fallbackCreatePageMessages(selector) {
      const el = document.querySelector(selector);
      function setText(text, cls) {
        if (!el) {
          console[cls === "erro" ? "error" : "log"]("[PRONTIO.index.msg] " + text);
          return;
        }
        el.style.display = text ? "" : "none";
        el.textContent = text || "";
        el.className = "mensagem " + (cls ? "mensagem-" + cls : "");
      }
      return {
        info: (t) => setText(t, "info"),
        erro: (t) => setText(t, "erro"),
        sucesso: (t) => setText(t, "sucesso"),
        clear: () => setText("", "")
      };
    };

  const msgs = createPageMessages("#mensagemListaAtendimento");

  // -----------------------------------------------------
  // Integração com o "usuário do chat" (localStorage)
  // -----------------------------------------------------

  const LOCALSTORAGE_USER_INFO_KEY = "medpronto_user_info";
  let elIndexUserLabel = null;

  function loadUserForIndex() {
    if (!elIndexUserLabel) return;

    let nome = "Usuário";

    try {
      const raw = global.localStorage && global.localStorage.getItem(LOCALSTORAGE_USER_INFO_KEY);
      if (raw) {
        const info = JSON.parse(raw);
        if (info && info.nome) nome = info.nome;
      }
    } catch (e) {
      nome = "Usuário";
    }

    elIndexUserLabel.textContent = "Você: " + nome;
  }

  // -----------------------------------------------------
  // Referências de DOM (inicializadas em initIndexPage)
  // -----------------------------------------------------
  let tbody = null;
  let infoUltimaAtualizacao = null;
  let btnRecarregar = null;

  // -----------------------------------------------------
  // Helpers de mensagem (wrapper para msgs)
  // -----------------------------------------------------
  function atualizarMensagem(texto, tipo) {
    if (!texto) {
      msgs.clear();
      return;
    }

    switch (tipo) {
      case "erro":
        msgs.erro(texto);
        break;
      case "sucesso":
        msgs.sucesso(texto);
        break;
      default:
        msgs.info(texto);
        break;
    }
  }

  // -----------------------------------------------------
  // Tabela de atendimentos
  // -----------------------------------------------------
  function limparTabela() {
    if (!tbody) return;
    tbody.innerHTML = "";
  }

  function renderizarEstadoCarregando() {
    if (!tbody) return;
    limparTabela();

    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.classList.add("linha-vazia");
    td.textContent = "Carregando lista de atendimento...";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function criarBadgeStatus(status) {
    const span = document.createElement("span");
    span.classList.add("badge-status");

    if (!status) {
      span.textContent = "N/A";
      span.classList.add("badge-outro");
      return span;
    }

    const s = String(status).toUpperCase();
    span.textContent = status;

    if (s === "AGENDADO") span.classList.add("badge-agendado");
    else if (s === "CONFIRMADO") span.classList.add("badge-confirmado");
    else if (s === "CANCELADO") span.classList.add("badge-cancelado");
    else if (s === "FALTOU") span.classList.add("badge-faltou");
    else span.classList.add("badge-outro");

    return span;
  }

  function renderizarLinhas(agendamentos) {
    limparTabela();
    if (!tbody) return;

    if (!agendamentos || agendamentos.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.classList.add("linha-vazia");
      td.textContent = "Nenhum atendimento agendado a partir de hoje.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    agendamentos.forEach((ag) => {
      const tr = document.createElement("tr");

      const tdData = document.createElement("td");
      tdData.classList.add("col-data");
      tdData.textContent = formatarDataBR(ag.dataConsulta || "");
      tr.appendChild(tdData);

      const tdHora = document.createElement("td");
      tdHora.classList.add("col-hora");
      tdHora.textContent = ag.horaConsulta || "";
      tr.appendChild(tdHora);

      const tdPaciente = document.createElement("td");
      tdPaciente.classList.add("col-paciente");
      tdPaciente.textContent = ag.nomePaciente || "";
      tr.appendChild(tdPaciente);

      const tdTipo = document.createElement("td");
      tdTipo.classList.add("col-tipo");
      tdTipo.textContent = ag.tipo || "";
      tr.appendChild(tdTipo);

      const tdStatus = document.createElement("td");
      tdStatus.classList.add("col-status");
      tdStatus.appendChild(criarBadgeStatus(ag.status));
      tr.appendChild(tdStatus);

      tbody.appendChild(tr);
    });
  }

  // -----------------------------------------------------
  // Carregamento da lista de atendimento (API)
  // -----------------------------------------------------
  async function carregarListaAtendimento() {
    atualizarMensagem("Carregando lista de atendimento...", "info");
    renderizarEstadoCarregando();
    if (btnRecarregar) btnRecarregar.disabled = true;

    try {
      // ✅ padrão novo: callApiData
      // compat: tenta "Agenda.ListarAFuturo" e cai para underscore se necessário
      let data;
      try {
        data = await callApiData({ action: "Agenda.ListarAFuturo", payload: {} });
      } catch (e1) {
        data = await callApiData({ action: "Agenda_ListarAFuturo", payload: {} });
      }

      const agendamentos = (data && data.agendamentos) || [];

      renderizarLinhas(agendamentos);

      const qtd = agendamentos.length;
      const msgInfo =
        qtd === 0
          ? "Nenhum atendimento agendado a partir de hoje."
          : `Encontrado(s) ${qtd} atendimento(s) do dia de hoje para frente.`;
      atualizarMensagem(msgInfo, "sucesso");

      if (infoUltimaAtualizacao) {
        const agora = new Date();
        const dd = String(agora.getDate()).padStart(2, "0");
        const mm = String(agora.getMonth() + 1).padStart(2, "0");
        const yyyy = agora.getFullYear();
        const hh = String(agora.getHours()).padStart(2, "0");
        const min = String(agora.getMinutes()).padStart(2, "0");
        infoUltimaAtualizacao.textContent = `Atualizado em ${dd}/${mm}/${yyyy} às ${hh}:${min}`;
      }
    } catch (erro) {
      console.error("Erro ao carregar Lista de Atendimento:", erro);
      const msg =
        (erro && erro.message) ||
        "Falha na comunicação com o servidor. Verifique sua conexão ou tente novamente.";
      atualizarMensagem(msg, "erro");
      limparTabela();
    } finally {
      if (btnRecarregar) btnRecarregar.disabled = false;
    }
  }

  // -----------------------------------------------------
  // Inicialização da página INDEX
  // -----------------------------------------------------
  function initIndexPage() {
    console.log("[PRONTIO.index] initIndexPage");

    tbody = document.getElementById("tabelaAtendimentoBody");
    infoUltimaAtualizacao = document.getElementById("infoUltimaAtualizacao");
    btnRecarregar = document.getElementById("btnRecarregarLista");

    elIndexUserLabel = document.getElementById("index-current-user-label");
    loadUserForIndex();

    if (btnRecarregar) {
      btnRecarregar.addEventListener("click", function (ev) {
        ev.preventDefault();
        carregarListaAtendimento();
      });
    }

    carregarListaAtendimento();
  }

  // -----------------------------------------------------
  // Registro no PRONTIO (para main.js e router)
  // -----------------------------------------------------
  if (typeof PRONTIO.registerPage === "function") {
    PRONTIO.registerPage("index", initIndexPage);
  } else {
    PRONTIO.pages = PRONTIO.pages || {};
    PRONTIO.pages.index = { init: initIndexPage };
  }
})(window, document);
