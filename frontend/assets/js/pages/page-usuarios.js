// frontend/assets/js/pages/page-usuarios.js
// =====================================
// PRONTIO - pages/page-usuarios.js
// Pilar F: Gestão de Usuários (Admin)
// Compatível com usuarios.html atual
//
// Ações usadas:
// - Usuarios_Listar
// - Usuarios_Criar
// - Usuarios_Atualizar
// - Usuarios_ResetSenhaAdmin
//
// IDs esperados no HTML:
// - usuariosMsg, usuariosBusca, usuariosFiltroAtivo
// - btnRecarregar, btnNovoUsuario
// - usuariosTbody, usuariosCount
// - modalUsuario + campos: usuarioId, usuarioNome, usuarioLogin, usuarioEmail, usuarioPerfil, usuarioAtivo, usuarioSenha
// - btnSalvarUsuario, modalUsuarioMsg, modalUsuarioTitle
// - modalResetSenha + campos: resetUserId, resetUserLabel, resetNovaSenha, resetAtivar
// - btnConfirmarReset, modalResetMsg
// =====================================

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const auth = PRONTIO.auth || {};
  const api = PRONTIO.api || {};

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  function showMsg_(id, msg, type) {
    const el = $(id);
    if (!el) return;

    if (!msg) {
      el.textContent = "";
      el.classList.add("is-hidden");
      el.classList.remove("mensagem-sucesso", "mensagem-erro", "mensagem-aviso", "mensagem-info");
      return;
    }

    el.textContent = String(msg);
    el.classList.remove("is-hidden");
    el.classList.remove("mensagem-sucesso", "mensagem-erro", "mensagem-aviso", "mensagem-info");

    if (type === "success") el.classList.add("mensagem-sucesso");
    else if (type === "warning") el.classList.add("mensagem-aviso");
    else if (type === "error") el.classList.add("mensagem-erro");
    else el.classList.add("mensagem-info");
  }

  function escHtml_(s) {
    // Compatível (evita depender de replaceAll em ambientes antigos)
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getCallApiData_() {
    // Preferência: PRONTIO.api.callApiData
    if (api && typeof api.callApiData === "function") return api.callApiData;
    // Compat global
    if (typeof global.callApiData === "function") return global.callApiData;
    throw new Error("PRONTIO.api.callApiData não está disponível.");
  }

  function getCurrentUser_() {
    // Preferência: auth.getUser()
    try {
      if (auth && typeof auth.getUser === "function") {
        const u = auth.getUser();
        if (u) return u;
      }
    } catch (_) {}

    // Fallback: tentar localStorage (best-effort)
    try {
      const ls = global.localStorage;
      if (!ls) return null;

      const raw =
        ls.getItem("prontio.auth.user") ||
        ls.getItem("prontio_auth_user") ||
        ls.getItem("prontio.user") ||
        "";
      if (!raw) return null;

      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : null;
    } catch (_) {}

    return null;
  }

  function isAdmin_() {
    try {
      const u = getCurrentUser_();
      const perfil = (u && (u.perfil || u.role) ? String(u.perfil || u.role) : "").toLowerCase();
      return perfil === "admin";
    } catch (_) {
      return false;
    }
  }

  function openModalById_(id) {
    const el = $(id);
    if (!el) return;

    // Suporta dois padrões sem quebrar:
    // 1) ".modal.is-hidden" (HTML atual)
    // 2) hidden + .is-open (main.js antigo)
    // 3) ".modal-overlay.hidden/.visible" (outros módulos)
    if (el.classList.contains("is-hidden")) {
      el.classList.remove("is-hidden");
      el.setAttribute("aria-hidden", "false");
      return;
    }

    if (el.hasAttribute("hidden") || el.hidden === true) {
      el.hidden = false;
      el.classList.add("is-open");
      el.setAttribute("aria-hidden", "false");
      return;
    }

    if (el.classList.contains("hidden")) {
      el.classList.remove("hidden");
      el.classList.add("visible");
      el.setAttribute("aria-hidden", "false");
      return;
    }

    // fallback
    el.classList.add("is-open");
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
  }

  function closeModalById_(id) {
    const el = $(id);
    if (!el) return;

    if (el.classList.contains("is-hidden")) {
      // já fechado
      el.setAttribute("aria-hidden", "true");
      return;
    }

    if (el.classList.contains("modal-overlay") || el.classList.contains("visible") || el.classList.contains("hidden")) {
      el.classList.remove("visible");
      el.classList.add("hidden");
      el.setAttribute("aria-hidden", "true");
      return;
    }

    // padrão ".modal"
    el.classList.add("is-hidden");
    el.classList.remove("is-open");
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
  }

  function bindModalClosers_() {
    document.querySelectorAll("[data-modal-close]").forEach((el) => {
      if (el.dataset._boundClose === "1") return;
      el.dataset._boundClose = "1";
      el.addEventListener("click", () => {
        const target = el.getAttribute("data-modal-close");
        if (target) closeModalById_(target);
      });
    });

    // Clique no backdrop (se existir)
    document.querySelectorAll(".modal-backdrop").forEach((bg) => {
      if (bg.dataset._boundBackdrop === "1") return;
      bg.dataset._boundBackdrop = "1";
      bg.addEventListener("click", () => {
        const target = bg.getAttribute("data-modal-close");
        if (target) closeModalById_(target);
      });
    });

    // ESC fecha modais do módulo
    if (document.body.getAttribute("data-usuarios-esc-bound") === "1") return;
    document.body.setAttribute("data-usuarios-esc-bound", "1");

    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      closeModalById_("modalUsuario");
      closeModalById_("modalResetSenha");
    });
  }

  function setButtonBusy_(btnId, busy) {
    const btn = $(btnId);
    if (!btn) return;
    btn.disabled = !!busy;
    btn.setAttribute("aria-busy", busy ? "true" : "false");
  }

  // ---------- state ----------
  let USERS = [];
  let FILTER_TEXT = "";
  let FILTER_ATIVO = "todos"; // todos | ativos | inativos

  // ---------- API wrappers ----------
  async function apiList_() {
    const callApiData = getCallApiData_();
    return await callApiData({ action: "Usuarios_Listar", payload: {} });
  }

  async function apiCreate_(payload) {
    const callApiData = getCallApiData_();
    return await callApiData({ action: "Usuarios_Criar", payload });
  }

  async function apiUpdate_(payload) {
    const callApiData = getCallApiData_();
    return await callApiData({ action: "Usuarios_Atualizar", payload });
  }

  async function apiResetSenha_(payload) {
    const callApiData = getCallApiData_();
    return await callApiData({ action: "Usuarios_ResetSenhaAdmin", payload });
  }

  // ---------- filtering ----------
  function matches_(u) {
    if (!u) return false;

    if (FILTER_ATIVO === "ativos" && !u.ativo) return false;
    if (FILTER_ATIVO === "inativos" && u.ativo) return false;

    const t = (FILTER_TEXT || "").trim().toLowerCase();
    if (!t) return true;

    const hay = [
      u.id, u.nome, u.nomeCompleto, u.login, u.email, u.perfil,
      u.ativo ? "ativo" : "inativo"
    ].map(v => String(v || "").toLowerCase()).join(" ");

    return hay.includes(t);
  }

  function getFiltered_() {
    return (USERS || []).filter(matches_);
  }

  // ---------- render ----------
  function render_() {
    const tbody = $("usuariosTbody");
    const countEl = $("usuariosCount");
    if (!tbody) return;

    const rows = getFiltered_();

    tbody.innerHTML = "";

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Nenhum usuário encontrado.</td></tr>`;
      if (countEl) countEl.textContent = "0 usuário(s)";
      return;
    }

    rows.forEach((u) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>
          <div class="cell-title">${escHtml_(u.nome || u.nomeCompleto || "")}</div>
          <div class="cell-sub text-muted text-small">${escHtml_(u.id || "")}</div>
        </td>
        <td>${escHtml_(u.login || "")}</td>
        <td>${escHtml_(u.email || "")}</td>
        <td><span class="badge">${escHtml_(u.perfil || "")}</span></td>
        <td>
          <span class="status ${u.ativo ? "status-ok" : "status-bad"}">
            ${u.ativo ? "Ativo" : "Inativo"}
          </span>
        </td>
        <td class="col-actions">
          <button class="btn btn-secondary btn-sm" type="button" data-act="edit">Editar</button>
          <button class="btn btn-secondary btn-sm" type="button" data-act="reset">Reset senha</button>
          <button class="btn btn-secondary btn-sm" type="button" data-act="toggle">${u.ativo ? "Desativar" : "Ativar"}</button>
        </td>
      `;

      const btnEdit = tr.querySelector('[data-act="edit"]');
      const btnReset = tr.querySelector('[data-act="reset"]');
      const btnToggle = tr.querySelector('[data-act="toggle"]');

      if (btnEdit) btnEdit.addEventListener("click", () => openEdit_(u));
      if (btnReset) btnReset.addEventListener("click", () => openReset_(u));
      if (btnToggle) btnToggle.addEventListener("click", () => toggleAtivo_(u));

      tbody.appendChild(tr);
    });

    if (countEl) countEl.textContent = `${rows.length} usuário(s)`;
  }

  // ---------- load ----------
  async function refresh_() {
    showMsg_("usuariosMsg", "", "info");

    const tbody = $("usuariosTbody");
    const countEl = $("usuariosCount");
    if (!tbody) return;

    // Garante que usuário está logado (best-effort); quem faz redirect normalmente é auth.js
    try {
      if (auth && typeof auth.ensureSession === "function") {
        await auth.ensureSession({ redirect: true });
      } else if (auth && typeof auth.requireAuth === "function") {
        auth.requireAuth({ redirect: true });
      }
    } catch (_) {}

    if (!isAdmin_()) {
      USERS = [];
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Apenas administradores podem gerenciar usuários.</td></tr>`;
      if (countEl) countEl.textContent = "";
      return;
    }

    try {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Carregando...</td></tr>`;
      const list = await apiList_();
      USERS = Array.isArray(list) ? list : [];
      render_();
      showMsg_("usuariosMsg", "Usuários carregados.", "success");
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Erro ao carregar.</td></tr>`;
      showMsg_("usuariosMsg", (e && e.message) ? e.message : "Falha ao carregar usuários.", "error");
    }
  }

  // ---------- modal: create/edit ----------
  function openCreate_() {
    showMsg_("modalUsuarioMsg", "", "info");

    const titleEl = $("modalUsuarioTitle");
    if (titleEl) titleEl.textContent = "Novo usuário";

    if ($("usuarioId")) $("usuarioId").value = "";
    if ($("usuarioNome")) $("usuarioNome").value = "";
    if ($("usuarioLogin")) $("usuarioLogin").value = "";
    if ($("usuarioEmail")) $("usuarioEmail").value = "";
    if ($("usuarioPerfil")) $("usuarioPerfil").value = "secretaria";
    if ($("usuarioAtivo")) $("usuarioAtivo").value = "true";
    if ($("usuarioSenha")) $("usuarioSenha").value = "";

    openModalById_("modalUsuario");
  }

  function openEdit_(u) {
    showMsg_("modalUsuarioMsg", "", "info");

    const titleEl = $("modalUsuarioTitle");
    if (titleEl) titleEl.textContent = "Editar usuário";

    if ($("usuarioId")) $("usuarioId").value = u.id || "";
    if ($("usuarioNome")) $("usuarioNome").value = u.nome || u.nomeCompleto || "";
    if ($("usuarioLogin")) $("usuarioLogin").value = u.login || "";
    if ($("usuarioEmail")) $("usuarioEmail").value = u.email || "";
    if ($("usuarioPerfil")) $("usuarioPerfil").value = u.perfil || "secretaria";
    if ($("usuarioAtivo")) $("usuarioAtivo").value = u.ativo ? "true" : "false";
    if ($("usuarioSenha")) $("usuarioSenha").value = ""; // não edita senha aqui

    openModalById_("modalUsuario");
  }

  async function saveUser_() {
    showMsg_("modalUsuarioMsg", "", "info");
    setButtonBusy_("btnSalvarUsuario", true);

    try {
      const id = String(($("usuarioId") && $("usuarioId").value) || "").trim();
      const nome = String(($("usuarioNome") && $("usuarioNome").value) || "").trim();
      const login = String(($("usuarioLogin") && $("usuarioLogin").value) || "").trim();
      const email = String(($("usuarioEmail") && $("usuarioEmail").value) || "").trim();
      const perfil = String(($("usuarioPerfil") && $("usuarioPerfil").value) || "").trim() || "secretaria";
      const ativo = String(($("usuarioAtivo") && $("usuarioAtivo").value) || "true") === "true";
      const senha = String(($("usuarioSenha") && $("usuarioSenha").value) || "");

      if (!nome || !login) {
        showMsg_("modalUsuarioMsg", "Informe nome e login.", "error");
        return;
      }

      if (!id) {
        // criar
        if (!senha) {
          showMsg_("modalUsuarioMsg", "Informe a senha inicial para criar o usuário.", "error");
          return;
        }
        await apiCreate_({ nome, login, email, perfil, senha });
        showMsg_("usuariosMsg", "Usuário criado com sucesso.", "success");
      } else {
        // atualizar
        await apiUpdate_({ id, nome, login, email, perfil, ativo });
        showMsg_("usuariosMsg", "Usuário atualizado com sucesso.", "success");
      }

      closeModalById_("modalUsuario");
      await refresh_();
    } catch (e) {
      showMsg_("modalUsuarioMsg", (e && e.message) ? e.message : "Falha ao salvar usuário.", "error");
    } finally {
      setButtonBusy_("btnSalvarUsuario", false);
    }
  }

  // ---------- modal: reset senha ----------
  function openReset_(u) {
    showMsg_("modalResetMsg", "", "info");

    if ($("resetUserId")) $("resetUserId").value = u.id || "";
    if ($("resetUserLabel")) $("resetUserLabel").textContent = `${u.nome || u.nomeCompleto || "Usuário"} (${u.login || u.email || u.id})`;
    if ($("resetNovaSenha")) $("resetNovaSenha").value = "";
    if ($("resetAtivar")) $("resetAtivar").checked = true;

    openModalById_("modalResetSenha");
  }

  async function confirmReset_() {
    showMsg_("modalResetMsg", "", "info");
    setButtonBusy_("btnConfirmarReset", true);

    try {
      const id = String(($("resetUserId") && $("resetUserId").value) || "").trim();
      const senha = String(($("resetNovaSenha") && $("resetNovaSenha").value) || "");
      const ativar = !!($("resetAtivar") && $("resetAtivar").checked);

      if (!id) return showMsg_("modalResetMsg", "Usuário inválido para reset.", "error");
      if (!senha) return showMsg_("modalResetMsg", "Informe a nova senha.", "error");

      await apiResetSenha_({ id, senha, ativar });
      showMsg_("usuariosMsg", "Senha resetada com sucesso.", "success");

      closeModalById_("modalResetSenha");
      await refresh_();
    } catch (e) {
      showMsg_("modalResetMsg", (e && e.message) ? e.message : "Falha ao resetar senha.", "error");
    } finally {
      setButtonBusy_("btnConfirmarReset", false);
    }
  }

  // ---------- actions ----------
  async function toggleAtivo_(u) {
    showMsg_("usuariosMsg", "", "info");

    const novoAtivo = !u.ativo;
    const ok = global.confirm(`Confirma ${novoAtivo ? "ATIVAR" : "DESATIVAR"} o usuário "${u.nome || u.nomeCompleto || u.id}"?`);
    if (!ok) return;

    try {
      await apiUpdate_({
        id: u.id,
        nome: u.nome || u.nomeCompleto || "",
        login: u.login,
        email: u.email,
        perfil: u.perfil,
        ativo: novoAtivo
      });

      showMsg_("usuariosMsg", `Usuário ${novoAtivo ? "ativado" : "desativado"} com sucesso.`, "success");
      await refresh_();
    } catch (e) {
      showMsg_("usuariosMsg", (e && e.message) ? e.message : "Falha ao atualizar status.", "error");
    }
  }

  // ---------- init ----------
  function bind_() {
    bindModalClosers_();

    // binds
    const btnRecarregar = $("btnRecarregar");
    const btnNovoUsuario = $("btnNovoUsuario");
    const btnSalvarUsuario = $("btnSalvarUsuario");
    const btnConfirmarReset = $("btnConfirmarReset");

    if (btnRecarregar) btnRecarregar.addEventListener("click", refresh_);
    if (btnNovoUsuario) btnNovoUsuario.addEventListener("click", openCreate_);
    if (btnSalvarUsuario) btnSalvarUsuario.addEventListener("click", saveUser_);
    if (btnConfirmarReset) btnConfirmarReset.addEventListener("click", confirmReset_);

    const busca = $("usuariosBusca");
    const filtroAtivo = $("usuariosFiltroAtivo");

    if (busca) {
      let t = null;
      busca.addEventListener("input", (ev) => {
        const v = String(ev.target.value || "");
        // debounce leve
        if (t) clearTimeout(t);
        t = setTimeout(() => {
          FILTER_TEXT = v;
          render_();
        }, 80);
      });
    }

    if (filtroAtivo) {
      filtroAtivo.addEventListener("change", (ev) => {
        FILTER_ATIVO = String(ev.target.value || "todos");
        render_();
      });
    }
  }

  function initUsuariosPage() {
    const body = document.body;
    const pageId = (body && body.dataset && (body.dataset.pageId || body.dataset.page)) || "";
    if (String(pageId).toLowerCase() !== "usuarios") return;

    // evita double-init
    if (body.getAttribute("data-usuarios-inited") === "1") return;
    body.setAttribute("data-usuarios-inited", "1");

    bind_();
    refresh_();
  }

  // ✅ Integra com o loader do main.js (evita bug de DOMContentLoaded já ter passado)
  if (typeof PRONTIO.registerPage === "function") {
    PRONTIO.registerPage("usuarios", initUsuariosPage);
  } else {
    PRONTIO.pages = PRONTIO.pages || {};
    PRONTIO.pages.usuarios = { init: initUsuariosPage };
  }
})(window, document);
