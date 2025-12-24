// frontend/assets/js/pages/page-atendimento.js
// Módulo: Atendimento
// ✅ Agora chama Atendimento.SyncHoje (para montar a fila) e depois Atendimento.ListarFilaHoje.
// ✅ Mantém fallback para Agenda.ListarAFuturo (compatibilidade).
// OBS: enquanto o backend de Atendimento não retornar nome/hora/tipo, a tabela exibe placeholders.

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
      const s = String(iso);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [ano, mes, dia] = s.split("-");
        return `${dia}/${mes}/${ano}`;
      }
      try {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = String(d.getFullYear());
          return `${dd}/${mm}/${yyyy}`;
        }
      } catch (_) {}
      return s;
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

  let selected = null;

  function setSelected_(row) {
    selected = row || null;
    if (btnAbrirProntuario) {
      const ok = !!(selected && selected.idPaciente && selected.idAgenda);
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

  function normalizeRow_(raw, fonte) {
    if (fonte === "atendimento") {
      const idAgenda = raw.idAgenda || raw.ID_Agenda || "";
      const idPaciente = raw.idPaciente || raw.ID_Paciente || "";
      const data = raw.dataRef || "";
      const hora = raw.hora || raw.horaConsulta || "";
      const pacienteNome = raw.nomePaciente || raw.paciente || raw.pacienteNome || idPaciente || "";
      const tipo = raw.tipo || "";
      const status = raw.status || "";
      return { fonte, idAgenda, idPaciente, data, hora, pacienteNome, tipo, status, _raw: raw };
    }

    const idAgenda2 = raw.idAgenda || raw.ID_Agenda || "";
    const idPaciente2 = raw.idPaciente || raw.ID_Paciente || "";
    const data2 = raw.dataConsulta || raw.data || "";
    const hora2 = raw.horaConsulta || raw.hora || "";
    const pacienteNome2 = raw.nomePaciente || raw.paciente || "";
    const tipo2 = raw.tipo || "";
    const status2 = raw.status || "";
    return { fonte: "agenda", idAgenda: idAgenda2, idPaciente: idPaciente2, data: data2, hora: hora2, pacienteNome: pacienteNome2, tipo: tipo2, status: status2, _raw: raw };
  }

  function criarBadgeStatus(status, fonte) {
    const span = document.createElement("span");
    span.classList.add("badge-status");

    if (!status) {
      span.textContent = "N/A";
      span.classList.add("badge-outro");
      return span;
    }

    const s = String(status).toUpperCase();
    span.textContent = status;

    if (fonte === "atendimento") {
      if (s === "AGUARDANDO") span.classList.add("badge-outro");
      else if (s === "CHEGOU") span.classList.add("badge-confirmado");
      else if (s === "CHAMADO") span.classList.add("badge-agendado");
      else if (s === "EM_ATENDIMENTO") span.classList.add("badge-agendado");
      else if (s === "CONCLUIDO") span.classList.add("badge-confirmado");
      else if (s === "CANCELADO") span.classList.add("badge-cancelado");
      else span.classList.add("badge-outro");
      return span;
    }

    if (s === "AGENDADO") span.classList.add("badge-agendado");
    else if (s === "CONFIRMADO") span.classList.add("badge-confirmado");
    else if (s === "CANCELADO") span.classList.add("badge-cancelado");
    else if (s === "FALTOU") span.classList.add("badge-faltou");
    else span.classList.add("badge-outro");

    return span;
  }

  function renderizarLinhas(rows) {
    limparTabela();
    setSelected_(null);

    if (!tbody) return;

    if (!rows || rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.classList.add("linha-vazia");
      td.textContent = "Nenhum atendimento encontrado.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement("tr");

      const tdData = document.createElement("td");
      tdData.classList.add("col-data");
      tdData.textContent = formatarDataBR(row.data || "");
      tr.appendChild(tdData);

      const tdHora = document.createElement("td");
      tdHora.classList.add("col-hora");
      tdHora.textContent = row.hora || "—";
      tr.appendChild(tdHora);

      const tdPaciente = document.createElement("td");
      tdPaciente.classList.add("col-paciente");
      tdPaciente.textContent = row.pacienteNome || "—";
      tr.appendChild(tdPaciente);

      const tdTipo = document.createElement("td");
      tdTipo.classList.add("col-tipo");
      tdTipo.textContent = row.tipo || "—";
      tr.appendChild(tdTipo);

      const tdStatus = document.createElement("td");
      tdStatus.classList.add("col-status");
      tdStatus.appendChild(criarBadgeStatus(row.status, row.fonte));
      tr.appendChild(tdStatus);

      tr.addEventListener("click", function () {
        tbody.querySelectorAll("tr.is-selected").forEach((r) => r.classList.remove("is-selected"));
        tr.classList.add("is-selected");
        setSelected_(row);
      });

      tbody.appendChild(tr);
    });
  }

  function setUltimaAtualizacao_() {
    if (!infoUltimaAtualizacao) return;
    const agora = new Date();
    const dd = String(agora.getDate()).padStart(2, "0");
    const mm = String(agora.getMonth() + 1).padStart(2, "0");
    const yyyy = agora.getFullYear();
    const hh = String(agora.getHours()).padStart(2, "0");
    const min = String(agora.getMinutes()).padStart(2, "0");
    infoUltimaAtualizacao.textContent = `Atualizado em ${dd}/${mm}/${yyyy} às ${hh}:${min}`;
  }

  async function carregarListaAtendimento() {
    msgs.info("Carregando atendimentos...");
    renderizarEstadoCarregando();
    if (btnRecarregar) btnRecarregar.disabled = true;

    try {
      // ✅ 0) Sync: cria/atualiza a fila do dia a partir da Agenda (idempotente)
      try {
        await callApiData({ action: "Atendimento.SyncHoje", payload: {} });
      } catch (_) {
        // se sync falhar, seguimos (não bloqueia a tela)
      }

      // 1) NOVO: Atendimento.ListarFilaHoje
      let dataAtd = null;
      try {
        dataAtd = await callApiData({ action: "Atendimento.ListarFilaHoje", payload: {} });
      } catch (_) {
        dataAtd = null;
      }

      if (dataAtd && Array.isArray(dataAtd.items)) {
        const rows = dataAtd.items.map((it) => normalizeRow_(it, "atendimento"));
        renderizarLinhas(rows);

        msgs.sucesso(
          rows.length === 0
            ? "Fila vazia para hoje."
            : `Fila do dia: ${rows.length} atendimento(s).`
        );
        setUltimaAtualizacao_();
        return;
      }

      // 2) FALLBACK: Agenda.ListarAFuturo
      let dataAgenda;
      try {
        dataAgenda = await callApiData({ action: "Agenda.ListarAFuturo", payload: {} });
      } catch (_) {
        dataAgenda = await callApiData({ action: "Agenda_ListarAFuturo", payload: {} });
      }

      const agendamentos = (dataAgenda && dataAgenda.agendamentos) || [];
      const rowsLegacy = agendamentos.map((it) => normalizeRow_(it, "agenda"));
      renderizarLinhas(rowsLegacy);

      msgs.sucesso(
        rowsLegacy.length === 0
          ? "Nenhum atendimento a partir de hoje."
          : `Encontrado(s) ${rowsLegacy.length} atendimento(s) a partir de hoje.`
      );
      setUltimaAtualizacao_();

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

    const idPaciente = selected.idPaciente || "";
    const idAgenda = selected.idAgenda || "";

    if (!idPaciente || !idAgenda) return;

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
