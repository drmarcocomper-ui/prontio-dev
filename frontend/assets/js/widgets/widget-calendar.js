// assets/js/widgets/widget-calendar.js
// Widget simples de calendário (visão mensal) para uso na agenda.
// Focado em DOM puro, sem dependências externas.
//
// Uso típico:
// const calendar = PRONTIO.widgets.calendar.create({
//   container: document.getElementById("agenda-calendar"),
//   selectedDate: "2025-01-01",
//   onDayClick: (isoDate) => { ... }
// });

(function (global) {
  "use strict";

  const PRONTIO = global.PRONTIO = global.PRONTIO || {};
  PRONTIO.widgets = PRONTIO.widgets || {};

  const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril",
    "Maio", "Junho", "Julho", "Agosto",
    "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const WEEKDAY_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

  function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function parseIsoDate(iso) {
    if (!iso) return new Date();
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d);
  }

  function createCalendar(options) {
    const container = options && options.container;
    if (!container) {
      throw new Error("[CalendarWidget] container é obrigatório");
    }

    let currentDate = parseIsoDate(options.selectedDate || options.initialDate);
    let selectedDateIso = toIsoDate(currentDate);

    const onDayClick = typeof options.onDayClick === "function"
      ? options.onDayClick
      : function () {};

    container.classList.add("prontio-calendar");

    const headerEl = document.createElement("div");
    headerEl.className = "prontio-calendar-header";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "prontio-calendar-nav prontio-calendar-nav-prev";
    prevBtn.textContent = "<";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "prontio-calendar-nav prontio-calendar-nav-next";
    nextBtn.textContent = ">";

    const titleEl = document.createElement("div");
    titleEl.className = "prontio-calendar-title";

    headerEl.appendChild(prevBtn);
    headerEl.appendChild(titleEl);
    headerEl.appendChild(nextBtn);

    const gridEl = document.createElement("div");
    gridEl.className = "prontio-calendar-grid";

    container.appendChild(headerEl);
    container.appendChild(gridEl);

    function render() {
      gridEl.innerHTML = "";

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      titleEl.textContent = `${MONTH_NAMES[month]} de ${year}`;

      // cabeçalho de dias da semana
      WEEKDAY_SHORT.forEach(label => {
        const cell = document.createElement("div");
        cell.className = "prontio-calendar-weekday";
        cell.textContent = label;
        gridEl.appendChild(cell);
      });

      const firstDayOfMonth = new Date(year, month, 1);
      const startingWeekday = firstDayOfMonth.getDay(); // 0 = domingo

      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // dias em branco antes do primeiro dia
      for (let i = 0; i < startingWeekday; i++) {
        const empty = document.createElement("div");
        empty.className = "prontio-calendar-day empty";
        gridEl.appendChild(empty);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const iso = toIsoDate(dateObj);

        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "prontio-calendar-day";
        cell.textContent = String(day);

        if (iso === selectedDateIso) {
          cell.classList.add("selected");
        }

        const todayIso = toIsoDate(new Date());
        if (iso === todayIso) {
          cell.classList.add("today");
        }

        cell.dataset.date = iso;

        cell.addEventListener("click", () => {
          selectedDateIso = iso;
          onDayClick(iso);
          render();
        });

        gridEl.appendChild(cell);
      }
    }

    prevBtn.addEventListener("click", () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      render();
    });

    nextBtn.addEventListener("click", () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      render();
    });

    // primeira renderização
    render();

    return {
      /**
       * Define a data selecionada (ISO YYYY-MM-DD) e rerenderiza.
       */
      setSelectedDate(isoDate) {
        selectedDateIso = isoDate;
        currentDate = parseIsoDate(isoDate);
        render();
      },

      /**
       * Retorna a data selecionada (ISO).
       */
      getSelectedDate() {
        return selectedDateIso;
      },

      /**
       * Navega para o mês da data informada, sem alterar seleção.
       */
      goToMonth(isoDate) {
        currentDate = parseIsoDate(isoDate);
        render();
      }
    };
  }

  PRONTIO.widgets.calendar = {
    create: createCalendar
  };

})(window);
