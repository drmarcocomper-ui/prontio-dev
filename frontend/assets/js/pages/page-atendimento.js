// frontend/assets/js/pages/page-atendimento.js
// Módulo: Atendimento
// Lista atendimentos do dia de hoje para frente.
// Hoje usa Agenda.ListarAFuturo (sem precisar Atendimento.gs).

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      console.warn("[PRONTIO.atendimento] callApiData não definido.");
      return Promise.reject(new Error("API não disponível (callApiData indefinido)."));
    };

  const utils = (PRONTIO.core && PRONTIO.core.utils) || {};
  const formatarDataBR =
    global.formatarDataBR ||
    utils.formatarDataBR ||
    function (iso) {
      if (!iso) return "";
      const parts = String(iso).split("-");
      if (parts.length !== 3) return iso;
      const [ano, mes, dia] = parts;
      return `${dia}/${mes}/${ano}`;
    };

  const createPageMessages =
    global.createPageMessages ||
    (PRONTIO.ui && PRONTIO.ui.messages && PRONTIO.ui.messages.createPageMessages) ||
    function fallbackCreatePageMessages(selector) {
      const el = document.querySelector(selector);
      function setText(text, cls) {
        if (!el) return;
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

  let tbody = null;
  let infoUltimaAtualizacao = null;
  let btnRecarregar = null;
  let btnAbrirProntuario = null;

  // seleção atual
  let selected = null;

  function setSelected_(ag) {
    selected = ag || null;
    if (btnAbrirProntuario) {
      const ok = !!(selected && (selected.idPaciente || selected.ID_Paciente) && (selected.idAgenda || selected.ID_Agenda));
      btnAbrirProntuario.disabled = !ok;
    }
  }

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
    td.textContent = "Carregando atendimentos...";
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
    setSelected_(null);

    if (!tbody) return;

    if (!agendamentos || agendamentos.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.classList.add("linha-vazia");
      td.textContent = "Nenhum atendimento a partir de hoje.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    agendamentos.forEach((ag) => {
      const tr = document.createElement("tr");

      const tdData = document.createElement("td");
      tdData.classList.add("col-data");
      tdData.textContent = formatarDataBR(ag.dataConsulta || ag.data || "");
      tr.appendChild(tdData);

      const tdHora = document.createElement("td");
      tdHora.classList.add("col-hora");
      tdHora.textContent = ag.horaConsulta || ag.hora || "";
      tr.appendChild(tdHora);

      const tdPaciente = document.createElement("td");
      tdPaciente.classList.add("col-paciente");
      tdPaciente.textContent = ag.nomePaciente || ag.paciente || "";
      tr.appendChild(tdPaciente);

      const tdTipo = document.createElement("td");
      tdTipo.classList.add("col-tipo");
      tdTipo.textContent = ag.tipo || "";
      tr.appendChild(tdTipo);

      const tdStatus = document.createElement("td");
      tdStatus.classList.add("col-status");
      tdStatus.appendChild(criarBadgeStatus(ag.status));
      tr.appendChild(tdStatus);

      tr.addEventListener("click", function () {
        // marca seleção visual
        tbody.querySelectorAll("tr.is-selected").forEach((row) => row.classList.remove("is-selected"));
        tr.classList.add("is-selected");
        setSelected_(ag);
      });

      tbody.appendChild(tr);
    });
  }

  async function carregarListaAtendimento() {
    msgs.info("Carregando atendimentos...");
    renderizarEstadoCarregando();
    if (btnRecarregar) btnRecarregar.disabled = true;

    try {
      let data;
      try {
        data = await callApiData({ action: "Agenda.ListarAFuturo", payload: {} });
      } catch (_) {
        data = await callApiData({ action: "Agenda_ListarAFuturo", payload: {} });
      }

      const agendamentos = (data && data.agendamentos) || [];
      renderizarLinhas(agendamentos);

      msgs.sucesso(
        agendamentos.length === 0
          ? "Nenhum atendimento a partir de hoje."
          : `Encontrado(s) ${agendamentos.length} atendimento(s) a partir de hoje.`
      );

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
      console.error("[PRONTIO.atendimento] erro:", erro);
      msgs.erro((erro && erro.message) || "Falha ao carregar atendimentos.");
      limparTabela();
      setSelected_(null);
    } finally {
      if (btnRecarregar) btnRecarregar.disabled = false;
    }
  }

  function abrirProntuarioSelecionado_() {
    if (!selected) return;

    const idPaciente = selected.idPaciente || selected.ID_Paciente;
    const idAgenda = selected.idAgenda || selected.ID_Agenda;

    if (!idPaciente || !idAgenda) return;

    // navegação simples (página prontuário pode ler querystring)
    const url = `prontuario.html?idPaciente=${encodeURIComponent(idPaciente)}&idAgenda=${encodeURIComponent(idAgenda)}`;
    global.location.href = url;
  }

  function initAtendimentoPage() {
    tbody = document.getElementById("tabelaAtendimentoBody");
    infoUltimaAtualizacao = document.getElementById("infoUltimaAtualizacao");
    btnRecarregar = document.getElementById("btnRecarregarLista");
    btnAbrirProntuario = document.getElementById("btnAbrirProntuario");

    if (btnRecarregar) {
      btnRecarregar.addEventListener("click", function (ev) {
        ev.preventDefault();
        carregarListaAtendimento();
      });
    }

    if (btnAbrirProntuario) {
      btnAbrirProntuario.addEventListener("click", function (ev) {
        ev.preventDefault();
        abrirProntuarioSelecionado_();
      });
    }

    carregarListaAtendimento();
  }

  if (typeof PRONTIO.registerPage === "function") {
    PRONTIO.registerPage("atendimento", initAtendimentoPage);
  } else {
    PRONTIO.pages = PRONTIO.pages || {};
    PRONTIO.pages.atendimento = { init: initAtendimentoPage };
  }
})(window, document);
