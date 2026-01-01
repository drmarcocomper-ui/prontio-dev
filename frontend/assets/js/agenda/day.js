/**
 * PRONTIO - Agenda Day (Etapa 2A)
 * - Carrega e renderiza a agenda do dia via Agenda_ListarDia({data})
 * - Mantém simples (base sólida). Semana entra na etapa 2B.
 */
(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.agenda = PRONTIO.agenda || {};

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData;

  function setText_(el, text) {
    if (!el) return;
    el.textContent = text == null ? "" : String(text);
  }

  function clear_(el) {
    if (!el) return;
    el.innerHTML = "";
  }

  function renderEmpty_(container, msg) {
    clear_(container);
    const d = document.createElement("div");
    d.className = "agenda-vazia";
    d.textContent = msg || "Nenhum horário para exibir.";
    container.appendChild(d);
  }

  function renderError_(container, msg) {
    clear_(container);
    const d = document.createElement("div");
    d.className = "agenda-erro";
    d.textContent = msg || "Erro.";
    container.appendChild(d);
  }

  function normalizeHora_(hhmm) {
    const s = String(hhmm || "").trim();
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return s;
    const hh = String(parseInt(m[1], 10)).padStart(2, "0");
    return `${hh}:${m[2]}`;
  }

  function render_(container, data) {
    const horarios = (data && data.horarios) ? data.horarios : [];
    clear_(container);

    if (!horarios.length) {
      renderEmpty_(container, "Nenhum agendamento para o dia.");
      return;
    }

    horarios.forEach((h) => {
      const hora = normalizeHora_(h && h.hora ? h.hora : "");
      const ags = (h && h.agendamentos) ? h.agendamentos : [];

      const slot = document.createElement("div");
      slot.className = "agenda-slot";
      slot.dataset.hora = hora;

      const horaEl = document.createElement("div");
      horaEl.className = "agenda-slot-hora";
      horaEl.textContent = hora || "--:--";

      const conteudo = document.createElement("div");
      conteudo.className = "agenda-slot-conteudo";

      if (!ags.length) {
        const vazio = document.createElement("div");
        vazio.className = "agenda-slot-vazio";
        vazio.textContent = "Horário livre";
        conteudo.appendChild(vazio);
      } else {
        ags.forEach((ag) => {
          const card = document.createElement("div");
          card.className = "agendamento-card";

          const nome = document.createElement("div");
          nome.className = "agendamento-nome";
          nome.textContent = ag.nome_paciente || ag.titulo || "(sem nome)";

          const meta = document.createElement("div");
          meta.className = "agendamento-motivo";
          meta.textContent = ag.motivo || "";

          card.appendChild(nome);
          if (meta.textContent) card.appendChild(meta);
          conteudo.appendChild(card);
        });
      }

      slot.appendChild(horaEl);
      slot.appendChild(conteudo);
      container.appendChild(slot);
    });
  }

  async function loadDay(opts) {
    opts = opts || {};
    const dataStr = String(opts.data || "").trim();
    const container = opts.container;

    if (!dataStr) {
      renderEmpty_(container, "Selecione uma data.");
      return null;
    }

    clear_(container);
    const loading = document.createElement("div");
    loading.className = "agenda-loading";
    loading.textContent = "Carregando agenda...";
    container.appendChild(loading);

    try {
      const data = await callApiData({
        action: "Agenda_ListarDia",
        payload: { data: dataStr }
      });

      render_(container, data);
      return data;
    } catch (e) {
      renderError_(container, "Não foi possível carregar a agenda do dia: " + (e && e.message ? e.message : String(e)));
      return null;
    }
  }

  PRONTIO.agenda.day = {
    loadDay
  };
})(window);
