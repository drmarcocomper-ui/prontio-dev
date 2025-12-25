// frontend/assets/js/pages/page-atendimento.js
// Módulo: Atendimento (Fila)
// ✅ SyncHoje + ListarFilaHoje (Atendimento.gs)
// ✅ Ações por linha: Chegou / Chamar / Iniciar / Concluir / Cancelar
// ✅ Botão "Chamar próximo"
// ✅ Mantém fallback para Agenda.ListarAFuturo (compatibilidade)

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
  let btnChamarProximo = null;

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
    td.colSpan = 6;
    td.classList.add("linha-vazia");
    td.textContent = "Carregando atendimentos...";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function normalizeRow_(raw, fonte) {
    if (fonte === "atendimento") {
      const idAgenda = raw.idAgenda || raw.ID_Agenda || "";
      const idPaciente = raw.idPaciente || raw.ID_Paciente || "";
      const data = raw.dataRef || raw.data || "";
      const hora = raw.hora || raw.horaConsulta || "";
      const pacienteNome = raw.nomePaciente || raw.paciente || raw.pacienteNome || idPaciente || "";
      const tipo = raw.tipo || "";
      const status = raw.status || "";
      const idAtendimento = raw.idAtendimento || raw.ID_Atendimento || "";
      return { fonte, idAtendimento, idAgenda, idPaciente, data, hora, pacienteNome, tipo, status, _raw: raw };
    }

    const idAgenda2 = raw.idAgenda || raw.ID_Agenda || "";
    const idPaciente2 = raw.idPaciente || raw.ID_Paciente || "";
    const data2 = raw.dataConsulta || raw.data || "";
    const hora2 = raw.horaConsulta || raw.hora || "";
    const pacienteNome2 = raw.nomePaciente || raw.paciente || "";
    const tipo2 = raw.tipo || "";
    const status2 = raw.status || "";
    return { fonte: "agenda", idAtendimento: "", idAgenda: idAgenda2, idPaciente: idPaciente2, data: data2, hora: hora2, pacienteNome: pacienteNome2, tipo: tipo2, status: status2, _raw: raw };
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

  function canDo_(row, action) {
    if (!row || row.fonte !== "atendimento") return false;

    const s = String(row.status || "").toUpperCase();

    // ação "Chegou" faz sentido só se ainda não chegou (aguardando)
    if (action === "chegou") return (s === "AGUARDANDO");

    // "Chamar" pode para CHEGOU ou AGUARDANDO (backend prioriza CHEGOU no chamar próximo, mas aqui é manual)
    if (action === "chamar") return (s === "CHEGOU" || s === "AGUARDANDO");

    // "Iniciar" normalmente depois de chamado ou chegou
    if (action === "iniciar") return (s === "CHAMADO" || s === "CHEGOU");

    // "Concluir" só em atendimento
    if (action === "concluir") return (s === "EM_ATENDIMENTO");

    // "Cancelar" pode quase sempre, exceto concluído/cancelado
    if (action === "cancelar") return !(s === "CONCLUIDO" || s === "CANCELADO");

    return false;
  }

  function criarAcoesLinha_(row) {
    const wrap = document.createElement("div");
    wrap.className = "atendimento-row-actions";

    // Se é fallback "agenda" (sem idAtendimento), não habilita ações de fila
    if (row.fonte !== "atendimento") {
      const small = document.createElement("span");
      small.className = "muted";
      small.textContent = "—";
      wrap.appendChild(small);
      return wrap;
    }

    const btnChegou = _makeBtn_("Chegou", "btn btn-secondary", async () => {
      await acaoMarcarChegada_(row);
    });

    const btnChamar = _makeBtn_("Chamar", "btn btn-secondary", async () => {
      await acaoChamarManual_(row);
    });

    const btnIniciar = _makeBtn_("Iniciar", "btn btn-secondary", async () => {
      await acaoIniciar_(row);
    });

    const btnConcluir = _makeBtn_("Concluir", "btn btn-secondary", async () => {
      await acaoConcluir_(row);
    });

    const btnCancelar = _makeBtn_("Cancelar", "btn btn-secondary", async () => {
      await acaoCancelar_(row);
    });

    // Habilita/desabilita conforme status
    btnChegou.disabled = !canDo_(row, "chegou");
    btnChamar.disabled = !canDo_(row, "chamar");
    btnIniciar.disabled = !canDo_(row, "iniciar");
    btnConcluir.disabled = !canDo_(row, "concluir");
    btnCancelar.disabled = !canDo_(row, "cancelar");

    wrap.appendChild(btnChegou);
    wrap.appendChild(btnChamar);
    wrap.appendChild(btnIniciar);
    wrap.appendChild(btnConcluir);
    wrap.appendChild(btnCancelar);

    return wrap;
  }

  function _makeBtn_(label, cls, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.className = cls;
    b.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation(); // não seleciona a linha ao clicar no botão
      try {
        b.disabled = true;
        await onClick();
      } catch (e) {
        alert((e && e.message) || "Falha na ação.");
      } finally {
        b.disabled = false;
      }
    });
    return b;
  }

  function renderizarLinhas(rows) {
    limparTabela();
    setSelected_(null);

    if (!tbody) return;

    if (!rows || rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
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

      const tdAcoes = document.createElement("td");
      tdAcoes.classList.add("col-acoes");
      tdAcoes.appendChild(criarAcoesLinha_(row));
      tr.appendChild(tdAcoes);

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
      // 0) Sync (idempotente)
      try {
        await callApiData({ action: "Atendimento.SyncHoje", payload: {} });
      } catch (_) {}

      // 1) Atendimento.ListarFilaHoje (preferencial)
      let dataAtd = null;
      try {
        dataAtd = await callApiData({ action: "Atendimento.ListarFilaHoje", payload: {} });
      } catch (_) {
        dataAtd = null;
      }

      if (dataAtd && Array.isArray(dataAtd.items)) {
        const rows = dataAtd.items.map((it) => normalizeRow_(it, "atendimento"));
        renderizarLinhas(rows);

        msgs.sucesso(rows.length === 0 ? "Fila vazia para hoje." : `Fila do dia: ${rows.length} atendimento(s).`);
        setUltimaAtualizacao_();
        return;
      }

      // 2) Fallback: Agenda.ListarAFuturo
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

  async function acaoMarcarChegada_(row) {
    if (!row || !row.idAgenda) return;
    await callApiData({ action: "Atendimento.MarcarChegada", payload: { idAgenda: row.idAgenda, idPaciente: row.idPaciente || "" } });
    await carregarListaAtendimento();
  }

  // Chamar manualmente uma pessoa específica:
  // não existe action "Chamar(idAtendimento)" no backend, então fazemos:
  // 1) Marcar chegada (se ainda aguardando) e
  // 2) Chamar próximo (backend prioriza CHEGOU, e com ordem tende a puxar o correto)
  async function acaoChamarManual_(row) {
    if (!row || !row.idAgenda) return;
    const s = String(row.status || "").toUpperCase();
    if (s === "AGUARDANDO") {
      await callApiData({ action: "Atendimento.MarcarChegada", payload: { idAgenda: row.idAgenda, idPaciente: row.idPaciente || "" } });
    }
    // Chama próximo (pode chamar este se estiver no topo; funciona bem com ordem)
    await callApiData({ action: "Atendimento.ChamarProximo", payload: {} });
    await carregarListaAtendimento();
  }

  async function acaoIniciar_(row) {
    if (!row) return;
    if (row.idAtendimento) {
      await callApiData({ action: "Atendimento.Iniciar", payload: { idAtendimento: row.idAtendimento } });
    } else if (row.idAgenda) {
      await callApiData({ action: "Atendimento.Iniciar", payload: { idAgenda: row.idAgenda } });
    }
    await carregarListaAtendimento();
  }

  async function acaoConcluir_(row) {
    if (!row) return;
    if (row.idAtendimento) {
      await callApiData({ action: "Atendimento.Concluir", payload: { idAtendimento: row.idAtendimento } });
    } else if (row.idAgenda) {
      await callApiData({ action: "Atendimento.Concluir", payload: { idAgenda: row.idAgenda } });
    }
    await carregarListaAtendimento();
  }

  async function acaoCancelar_(row) {
    if (!row) return;
    const ok = confirm("Cancelar este atendimento? (Ação não pode ser desfeita facilmente)");
    if (!ok) return;

    if (row.idAtendimento) {
      await callApiData({ action: "Atendimento.Cancelar", payload: { idAtendimento: row.idAtendimento, motivo: "Cancelado pela fila" } });
    } else if (row.idAgenda) {
      await callApiData({ action: "Atendimento.Cancelar", payload: { idAgenda: row.idAgenda, motivo: "Cancelado pela fila" } });
    }
    await carregarListaAtendimento();
  }

  async function acaoChamarProximo_() {
    msgs.info("Chamando próximo...");
    try {
      const res = await callApiData({ action: "Atendimento.ChamarProximo", payload: {} });
      if (res && res.item) msgs.sucesso("Próximo paciente chamado.");
      else msgs.info((res && res.message) || "Fila vazia.");
      await carregarListaAtendimento();
    } catch (e) {
      msgs.erro((e && e.message) || "Falha ao chamar próximo.");
    }
  }

  function initAtendimentoPage() {
    tbody = document.getElementById("tabelaAtendimentoBody");
    infoUltimaAtualizacao = document.getElementById("infoUltimaAtualizacao");
    btnRecarregar = document.getElementById("btnRecarregarLista");
    btnAbrirProntuario = document.getElementById("btnAbrirProntuario");
    btnChamarProximo = document.getElementById("btnChamarProximo");

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

    if (btnChamarProximo) {
      btnChamarProximo.addEventListener("click", function (ev) {
        ev.preventDefault();
        acaoChamarProximo_();
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
