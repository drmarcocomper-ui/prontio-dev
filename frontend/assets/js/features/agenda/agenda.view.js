// frontend/assets/js/features/agenda/agenda.view.js
/**
 * PRONTIO — Agenda View (Front)
 * ------------------------------------------------------------
 * Responsabilidades:
 * - DOM: encontrar elementos e manipular UI
 * - Renderização: dia (slots/cards) e semana (grid)
 * - Estado visual: loading/erro/vazio
 * - Modais: open/close + mensagens de formulário + foco
 *
 * Regras:
 * - NÃO chama API
 * - NÃO guarda regra de negócio
 * - Pode receber callbacks do controller/page para ações do usuário
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  const F =
    PRONTIO.features.agenda.formatters ||
    {
      normalizeHora: (v) => String(v || ""),
      getDiaSemanaLabel: () => "",
      formatDataBonita: (s) => s,
      getStatusClass: () => "status-agendado",
      normalizeStatusLabel: (s) => String(s || ""),
      STATUS_OPTIONS_UI: ["Agendado", "Confirmado", "Em atendimento", "Concluído", "Faltou", "Cancelado"]
    };

  function getEl(doc, id) {
    const el = doc.getElementById(id);
    if (!el) console.warn(`[AgendaView] elemento #${id} não encontrado.`);
    return el;
  }

  function safeDisable(el, disabled) {
    if (!el) return;
    el.disabled = !!disabled;
    el.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  function setFormMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "form-message" + (kind ? " " + kind : "");
  }

  function createAgendaView(opts) {
    const doc = opts && opts.document ? opts.document : document;

    // ====== Containers principais ======
    const inputData = getEl(doc, "input-data");

    const secDia = doc.querySelector(".agenda-dia");
    const secSemana = getEl(doc, "agenda-semana");
    const listaHorariosEl = getEl(doc, "agenda-lista-horarios");
    const semanaGridEl = getEl(doc, "agenda-semana-grid");

    // ====== Resumo ======
    const resumoTotalEl = getEl(doc, "resumo-total");
    const resumoConfirmadosEl = getEl(doc, "resumo-confirmados");
    const resumoFaltasEl = getEl(doc, "resumo-faltas");
    const resumoCanceladosEl = getEl(doc, "resumo-cancelados");
    const resumoConcluidosEl = getEl(doc, "resumo-concluidos");
    const resumoEmAtendimentoEl = getEl(doc, "resumo-em-atendimento");

    // ====== Modais ======
    const modalNovo = getEl(doc, "modal-novo-agendamento");
    const modalEdit = getEl(doc, "modal-editar-agendamento");
    const modalBloqueio = getEl(doc, "modal-bloqueio");
    const modalPacientes = getEl(doc, "modal-pacientes");

    let ultimoFocusAntesModal = null;

    function isModalVisible(modalEl) {
      return !!modalEl && !modalEl.classList.contains("hidden");
    }

    function openModal(modalEl, focusEl) {
      if (!modalEl) return;
      ultimoFocusAntesModal = doc.activeElement;

      modalEl.classList.remove("hidden");
      modalEl.classList.add("visible");
      modalEl.setAttribute("aria-hidden", "false");

      setTimeout(() => {
        if (focusEl && typeof focusEl.focus === "function") focusEl.focus();
      }, 0);
    }

    function closeModal(modalEl) {
      if (!modalEl) return;

      modalEl.classList.remove("visible");
      modalEl.classList.add("hidden");
      modalEl.setAttribute("aria-hidden", "true");

      setTimeout(() => {
        if (ultimoFocusAntesModal && typeof ultimoFocusAntesModal.focus === "function") {
          ultimoFocusAntesModal.focus();
        }
        ultimoFocusAntesModal = null;
      }, 0);
    }

    // ====== Dia: estados ======
    function clearDay() {
      if (listaHorariosEl) listaHorariosEl.innerHTML = "";
    }

    function showDayLoading() {
      if (!listaHorariosEl) return;
      listaHorariosEl.classList.add("loading");
      listaHorariosEl.innerHTML = '<div class="agenda-loading">Carregando agenda...</div>';
    }

    function hideDayLoading() {
      if (!listaHorariosEl) return;
      listaHorariosEl.classList.remove("loading");
    }

    function showDayError(msg) {
      if (!listaHorariosEl) return;
      const wrap = doc.createElement("div");
      wrap.className = "agenda-erro";
      wrap.textContent = String(msg || "Erro.");
      listaHorariosEl.innerHTML = "";
      listaHorariosEl.appendChild(wrap);
    }

    function setResumo(resumo) {
      const r = resumo || {};
      if (resumoTotalEl) resumoTotalEl.textContent = String(r.total ?? 0);
      if (resumoConfirmadosEl) resumoConfirmadosEl.textContent = String(r.confirmados ?? 0);
      if (resumoFaltasEl) resumoFaltasEl.textContent = String(r.faltas ?? 0);
      if (resumoCanceladosEl) resumoCanceladosEl.textContent = String(r.cancelados ?? 0);
      if (resumoConcluidosEl) resumoConcluidosEl.textContent = String(r.concluidos ?? 0);
      if (resumoEmAtendimentoEl) resumoEmAtendimentoEl.textContent = String(r.em_atendimento ?? 0);
    }

    // ====== Render: cards ======
    function createCardAgendamento(ag, callbacks) {
      const cb = callbacks || {};
      const card = doc.createElement("div");
      card.className = "agendamento-card";
      card.classList.add(F.getStatusClass(ag.status));

      const linhaPrincipal = doc.createElement("div");
      linhaPrincipal.className = "agendamento-linha-principal";

      const nomeWrap = doc.createElement("div");
      nomeWrap.className = "agendamento-nome-wrap";

      const nome = doc.createElement("span");
      nome.className = "agendamento-nome";
      nome.textContent = ag.nome_paciente || "(sem nome)";
      nomeWrap.appendChild(nome);

      const tipo = doc.createElement("span");
      tipo.className = "agendamento-tipo";
      tipo.textContent = ag.tipo || "";

      linhaPrincipal.appendChild(nomeWrap);
      if (tipo.textContent) linhaPrincipal.appendChild(tipo);

      const linhaSec = doc.createElement("div");
      linhaSec.className = "agendamento-linha-secundaria";

      const statusSelect = doc.createElement("select");
      statusSelect.className = "agendamento-status-select";
      statusSelect.setAttribute("aria-label", "Alterar status do agendamento");

      (F.STATUS_OPTIONS_UI || []).forEach((opt) => {
        const o = doc.createElement("option");
        o.value = opt;
        o.textContent = opt;
        statusSelect.appendChild(o);
      });

      statusSelect.value = F.normalizeStatusLabel(ag.status);

      statusSelect.addEventListener("change", () => {
        if (typeof cb.onChangeStatus === "function") {
          cb.onChangeStatus(ag.ID_Agenda, statusSelect.value, card);
        }
      });

      const canal = doc.createElement("span");
      canal.className = "agendamento-canal";
      canal.textContent = ag.canal || "";

      linhaSec.appendChild(statusSelect);
      if (canal.textContent) linhaSec.appendChild(canal);

      const motivo = doc.createElement("div");
      motivo.className = "agendamento-motivo";
      motivo.textContent = ag.motivo || "";

      const acoes = doc.createElement("div");
      acoes.className = "agendamento-acoes";

      const btnAtender = doc.createElement("button");
      btnAtender.type = "button";
      btnAtender.className = "btn-status btn-status-atender";
      btnAtender.textContent = "Atender";
      btnAtender.addEventListener("click", () => {
        if (typeof cb.onAtender === "function") cb.onAtender(ag);
      });

      const btnEditar = doc.createElement("button");
      btnEditar.type = "button";
      btnEditar.className = "btn-status btn-status-editar";
      btnEditar.textContent = "Editar";
      btnEditar.addEventListener("click", () => {
        if (typeof cb.onEditar === "function") cb.onEditar(ag);
      });

      acoes.appendChild(btnAtender);
      acoes.appendChild(btnEditar);

      card.appendChild(linhaPrincipal);
      card.appendChild(linhaSec);
      if (motivo.textContent) card.appendChild(motivo);
      card.appendChild(acoes);

      return card;
    }

    function createCardBloqueio(ag, callbacks) {
      const cb = callbacks || {};
      const card = doc.createElement("div");
      card.className = "agendamento-card bloqueio-card";

      const linha = doc.createElement("div");
      linha.className = "agendamento-linha-principal";

      const label = doc.createElement("span");
      label.className = "bloqueio-label";
      label.textContent = "Horário bloqueado";

      linha.appendChild(label);
      card.appendChild(linha);

      const info = doc.createElement("div");
      info.className = "agendamento-motivo";
      info.textContent = `Das ${ag.hora_inicio} às ${ag.hora_fim}`;
      card.appendChild(info);

      const acoes = doc.createElement("div");
      acoes.className = "agendamento-acoes";

      const btnRemover = doc.createElement("button");
      btnRemover.type = "button";
      btnRemover.className = "btn-status btn-status-remover-bloqueio";
      btnRemover.textContent = "Remover bloqueio";
      btnRemover.addEventListener("click", () => {
        if (typeof cb.onDesbloquear === "function") cb.onDesbloquear(ag.ID_Agenda, card);
      });

      acoes.appendChild(btnRemover);
      card.appendChild(acoes);

      return card;
    }

    // ====== Render: Dia ======
    function renderDaySlots(params) {
      const p = params || {};
      const slots = Array.isArray(p.slots) ? p.slots : [];
      const map = p.map || new Map(); // Map<hhmm, ag[]>
      const now = p.now || null; // {dataStr, hhmm}
      const isHoje = !!p.isHoje;
      const horaFoco = p.horaFoco || null;

      const cb = p.callbacks || {};
      if (!listaHorariosEl) return;

      listaHorariosEl.innerHTML = "";

      if (!slots.length) {
        listaHorariosEl.innerHTML = '<div class="agenda-vazia">Nenhum horário para exibir.</div>';
        return;
      }

      let slotParaFoco = null;

      slots.forEach((hora) => {
        const ags = map.get(hora) || [];

        const slotEl = doc.createElement("div");
        slotEl.className = "agenda-slot";
        slotEl.dataset.hora = hora;

        if (isHoje && now && now.hhmm && hora === now.hhmm) slotEl.classList.add("slot-now");

        const horaEl = doc.createElement("div");
        horaEl.className = "agenda-slot-hora";
        horaEl.textContent = hora;

        const conteudoEl = doc.createElement("div");
        conteudoEl.className = "agenda-slot-conteudo";

        if (!ags.length) {
          const vazioEl = doc.createElement("div");
          vazioEl.className = "agenda-slot-vazio";
          vazioEl.textContent = "Horário livre";
          conteudoEl.appendChild(vazioEl);

          const actionsEl = doc.createElement("div");
          actionsEl.className = "agenda-slot-actions";

          const btnNovo = doc.createElement("button");
          btnNovo.type = "button";
          btnNovo.className = "btn-status btn-status-atender agenda-slot-action-btn";
          btnNovo.textContent = "Novo";
          btnNovo.addEventListener("click", () => {
            if (typeof cb.onNovo === "function") cb.onNovo(hora);
          });

          const btnBloq = doc.createElement("button");
          btnBloq.type = "button";
          btnBloq.className = "btn-status btn-status-cancelar agenda-slot-action-btn";
          btnBloq.textContent = "Bloquear";
          btnBloq.addEventListener("click", () => {
            if (typeof cb.onBloquear === "function") cb.onBloquear(hora);
          });

          actionsEl.appendChild(btnNovo);
          actionsEl.appendChild(btnBloq);
          conteudoEl.appendChild(actionsEl);

          slotEl.addEventListener("dblclick", () => {
            if (typeof cb.onNovo === "function") cb.onNovo(hora);
          });
        } else {
          ags.forEach((ag) => {
            const card = ag.bloqueio ? createCardBloqueio(ag, cb) : createCardAgendamento(ag, cb);
            conteudoEl.appendChild(card);
          });
        }

        slotEl.appendChild(horaEl);
        slotEl.appendChild(conteudoEl);
        listaHorariosEl.appendChild(slotEl);

        if (horaFoco && hora === horaFoco && !slotParaFoco) slotParaFoco = slotEl;
      });

      if (slotParaFoco) {
        slotParaFoco.scrollIntoView({ block: "start", behavior: "smooth" });
      } else if (isHoje && now && now.hhmm) {
        const elNow = listaHorariosEl.querySelector(`.agenda-slot[data-hora="${now.hhmm}"]`);
        if (elNow) elNow.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }

    // ====== Render: Semana ======
    function renderWeekGrid(params) {
      const p = params || {};
      const dias = Array.isArray(p.dias) ? p.dias : [];
      const slots = Array.isArray(p.slots) ? p.slots : [];
      const byDayHour = p.byDayHour || {}; // { [ymd]: { [hhmm]: ag[] } }
      const now = p.now || { dataStr: "", hhmm: "" };
      const cb = p.callbacks || {};

      if (!semanaGridEl) return;
      semanaGridEl.innerHTML = "";

      if (!dias.length || !slots.length) {
        semanaGridEl.innerHTML = '<div class="agenda-vazia">Nenhum horário configurado para exibir.</div>';
        return;
      }

      const headerRow = doc.createElement("div");
      headerRow.className = "semana-row semana-header-row semana-sticky";
      headerRow.dataset.hora = "__header__";

      const corner = doc.createElement("div");
      corner.className = "semana-cell semana-corner-cell semana-sticky-cell";
      corner.textContent = "";
      headerRow.appendChild(corner);

      // Mantém 6 colunas (seg..sab) como seu CSS atual
      dias.slice(0, 6).forEach((ds) => {
        const cell = doc.createElement("div");
        cell.className = "semana-cell semana-header-cell semana-sticky-cell";
        cell.innerHTML = `
          <div class="semana-header-dia">${F.getDiaSemanaLabel(ds)}</div>
          <div class="semana-header-data">${F.formatDataBonita(ds)}</div>
        `;
        if (ds === now.dataStr) cell.classList.add("semana-header-today");
        headerRow.appendChild(cell);
      });

      semanaGridEl.appendChild(headerRow);

      slots.forEach((hora) => {
        const row = doc.createElement("div");
        row.className = "semana-row";
        row.dataset.hora = hora;
        if (now.hhmm && hora === now.hhmm) row.classList.add("semana-row-now");

        const horaCell = doc.createElement("div");
        horaCell.className = "semana-cell semana-hora-cell semana-sticky-col";
        horaCell.textContent = hora;
        row.appendChild(horaCell);

        dias.slice(0, 6).forEach((ds) => {
          const cell = doc.createElement("div");
          cell.className = "semana-cell semana-slot-cell";
          if (ds === now.dataStr && now.hhmm && hora === now.hhmm) cell.classList.add("semana-slot-now");

          const ags = (byDayHour[ds] && byDayHour[ds][hora]) ? byDayHour[ds][hora] : [];

          if (ags.length) {
            ags.forEach((ag) => {
              const item = doc.createElement("div");
              item.classList.add("semana-agenda-item");

              if (ag.bloqueio) {
                item.classList.add("semana-bloqueio-item");
                item.textContent = "Bloqueado";
              } else {
                const partes = [ag.nome_paciente || "(sem nome)"];
                if (ag.tipo) partes.push(ag.tipo);
                if (ag.status) partes.push(ag.status);
                item.textContent = partes.join(" • ");

                item.addEventListener("click", () => {
                  if (typeof cb.onIrParaDia === "function") cb.onIrParaDia(ds, hora);
                });
              }

              cell.appendChild(item);
            });
          } else {
            cell.classList.add("semana-slot-empty");
            cell.addEventListener("dblclick", () => {
              if (typeof cb.onDblClickNovo === "function") cb.onDblClickNovo(ds, hora);
            });
          }

          row.appendChild(cell);
        });

        semanaGridEl.appendChild(row);
      });
    }

    // ====== View toggles ======
    function setVisao(modo, btnDia, btnSemana) {
      if (modo !== "dia" && modo !== "semana") return;

      if (modo === "dia") {
        secDia && secDia.classList.remove("hidden");
        secSemana && secSemana.classList.add("hidden");
        btnDia && btnDia.classList.add("view-active");
        btnSemana && btnSemana.classList.remove("view-active");
      } else {
        secDia && secDia.classList.add("hidden");
        secSemana && secSemana.classList.remove("hidden");
        btnDia && btnDia.classList.remove("view-active");
        btnSemana && btnSemana.classList.add("view-active");
      }
    }

    return {
      // refs úteis
      refs: {
        inputData,
        listaHorariosEl,
        semanaGridEl,
        secDia,
        secSemana,
        modalNovo,
        modalEdit,
        modalBloqueio,
        modalPacientes
      },

      // form helpers
      safeDisable,
      setFormMsg,

      // day status
      clearDay,
      showDayLoading,
      hideDayLoading,
      showDayError,

      // resumo
      setResumo,

      // renders
      renderDaySlots,
      renderWeekGrid,

      // view toggle
      setVisao,

      // modals
      isModalVisible,
      openModal,
      closeModal
    };
  }

  PRONTIO.features.agenda.view = { createAgendaView };
})(window);
