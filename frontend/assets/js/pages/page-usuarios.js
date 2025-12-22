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
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function assertApi_() {
    if (!api || typeof api.callApiData !== "function") {
      throw new Error("PRONTIO.api.callApiData não está disponível.");
    }
  }

  function isAdmin_() {
    try {
      const u = auth && typeof auth.getUser === "function" ? auth.getUser() : null;
      const perfil = (u && u.perfil ? String(u.perfil) : "").toLowerCase();
      return perfil === "admin";
    } catch (_) {
      return false;
    }
  }

  function openModal_(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("is-hidden");
  }

  function closeModal_(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add("is-hidden");
  }

  function bindModalClosers_() {
    document.querySelectorAll("[data-modal-close]").forEach((el) => {
      if (el.dataset._boundClose === "1") return;
      el.dataset._boundClose = "1";
      el.addEventListener("click", () => {
        const target = el.getAttribute("data-modal-close");
        if (target) closeModal_(target);
      });
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        closeModal_("modalUsuario");
        closeModal_("modalResetSenha");
      }
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
    assertApi_();
    return await api.callApiData({ action: "Usuarios_Listar", payload: {} });
  }

  async function apiCreate_(payload) {
    assertApi_();
    return await api.callApiData({ action: "Usuarios_Criar", payload });
  }

  async function apiUpdate_(payload) {
    assertApi_();
    return await api.callApiData({ action: "Usuarios_Atualizar", payload });
  }

  async function apiResetSenha_(payload) {
    assertApi_();
    return await api.callApiData({ action: "Usuarios_ResetSenhaAdmin", payload });
  }

  // ---------- filtering ----------
  function matches_(u) {
    if (!u) return false;

    if (FILTER_ATIVO === "ativos" && !u.ativo) return false;
    if (FILTER_ATIVO === "inativos" && u.ativo) return false;

    const t = (FILTER_TEXT || "").trim().toLowerCase();
    if (!t) return true;

    const hay = [
      u.id, u.nome, u.login, u.email, u.perfil,
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
          <div class="cell-title">${escHtml_(u.nome || "")}</div>
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
          <button class="btn btn-secondary btn-sm" data-act="edit">Editar</button>
          <button class="btn btn-secondary btn-sm" data-act="reset">Reset senha</button>
          <button class="btn btn-secondary btn-sm" data-act="toggle">${u.ativo ? "Desativar" : "Ativar"}</button>
        </td>
      `;

      tr.querySelector('[data-act="edit"]')?.addEventListener("click", () => openEdit_(u));
      tr.querySelector('[data-act="reset"]')?.addEventListener("click", () => openReset_(u));
      tr.querySelector('[data-act="toggle"]')?.addEventListener("click", () => toggleAtivo_(u));

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
      showMsg_("usuariosMsg", e?.message || "Falha ao carregar usuários.", "error");
    }
  }

  // ---------- modal: create/edit ----------
  function openCreate_() {
    showMsg_("modalUsuarioMsg", "", "info");
    $("modalUsuarioTitle").textContent = "Novo usuário";

    $("usuarioId").value = "";
    $("usuarioNome").value = "";
    $("usuarioLogin").value = "";
    $("usuarioEmail").value = "";
    $("usuarioPerfil").value = "secretaria";
    $("usuarioAtivo").value = "true";
    $("usuarioSenha").value = "";

    openModal_("modalUsuario");
  }

  function openEdit_(u) {
    showMsg_("modalUsuarioMsg", "", "info");
    $("modalUsuarioTitle").textContent = "Editar usuário";

    $("usuarioId").value = u.id || "";
    $("usuarioNome").value = u.nome || "";
    $("usuarioLogin").value = u.login || "";
    $("usuarioEmail").value = u.email || "";
    $("usuarioPerfil").value = u.perfil || "secretaria";
    $("usuarioAtivo").value = u.ativo ? "true" : "false";
    $("usuarioSenha").value = ""; // não edita senha aqui

    openModal_("modalUsuario");
  }

  async function saveUser_() {
    showMsg_("modalUsuarioMsg", "", "info");
    setButtonBusy_("btnSalvarUsuario", true);

    try {
      const id = String($("usuarioId").value || "").trim();
      const nome = String($("usuarioNome").value || "").trim();
      const login = String($("usuarioLogin").value || "").trim();
      const email = String($("usuarioEmail").value || "").trim();
      const perfil = String($("usuarioPerfil").value || "").trim() || "secretaria";
      const ativo = String($("usuarioAtivo").value || "true") === "true";
      const senha = String($("usuarioSenha").value || "");

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

      closeModal_("modalUsuario");
      await refresh_();
    } catch (e) {
      showMsg_("modalUsuarioMsg", e?.message || "Falha ao salvar usuário.", "error");
    } finally {
      setButtonBusy_("btnSalvarUsuario", false);
    }
  }

  // ---------- modal: reset senha ----------
  function openReset_(u) {
    showMsg_("modalResetMsg", "", "info");

    $("resetUserId").value = u.id || "";
    $("resetUserLabel").textContent = `${u.nome || "Usuário"} (${u.login || u.email || u.id})`;
    $("resetNovaSenha").value = "";
    $("resetAtivar").checked = true;

    openModal_("modalResetSenha");
  }

  async function confirmReset_() {
    showMsg_("modalResetMsg", "", "info");
    setButtonBusy_("btnConfirmarReset", true);

    try {
      const id = String($("resetUserId").value || "").trim();
      const senha = String($("resetNovaSenha").value || "");
      const ativar = !!$("resetAtivar").checked;

      if (!id) return showMsg_("modalResetMsg", "Usuário inválido para reset.", "error");
      if (!senha) return showMsg_("modalResetMsg", "Informe a nova senha.", "error");

      await apiResetSenha_({ id, senha, ativar });
      showMsg_("usuariosMsg", "Senha resetada com sucesso.", "success");

      closeModal_("modalResetSenha");
      await refresh_();
    } catch (e) {
      showMsg_("modalResetMsg", e?.message || "Falha ao resetar senha.", "error");
    } finally {
      setButtonBusy_("btnConfirmarReset", false);
    }
  }

  // ---------- actions ----------
  async function toggleAtivo_(u) {
    showMsg_("usuariosMsg", "", "info");

    const novoAtivo = !u.ativo;
    const ok = global.confirm(`Confirma ${novoAtivo ? "ATIVAR" : "DESATIVAR"} o usuário "${u.nome || u.id}"?`);
    if (!ok) return;

    try {
      await apiUpdate_({
        id: u.id,
        nome: u.nome,
        login: u.login,
        email: u.email,
        perfil: u.perfil,
        ativo: novoAtivo
      });

      showMsg_("usuariosMsg", `Usuário ${novoAtivo ? "ativado" : "desativado"} com sucesso.`, "success");
      await refresh_();
    } catch (e) {
      showMsg_("usuariosMsg", e?.message || "Falha ao atualizar status.", "error");
    }
  }

  // ---------- boot ----------
  async function boot_() {
    bindModalClosers_();

    // sessão
    try {
      if (auth && typeof auth.ensureSession === "function") {
        await auth.ensureSession({ redirect: true });
      } else if (auth && typeof auth.requireAuth === "function") {
        auth.requireAuth({ redirect: true });
      }
    } catch (_) {}

    // label + logout
    try { auth?.renderUserLabel?.(); } catch (_) {}
    try { auth?.bindLogoutButtons?.(); } catch (_) {}

    // binds
    $("btnRecarregar")?.addEventListener("click", refresh_);
    $("btnNovoUsuario")?.addEventListener("click", openCreate_);
    $("btnSalvarUsuario")?.addEventListener("click", saveUser_);
    $("btnConfirmarReset")?.addEventListener("click", confirmReset_);

    $("usuariosBusca")?.addEventListener("input", (ev) => {
      FILTER_TEXT = String(ev.target.value || "");
      render_();
    });

    $("usuariosFiltroAtivo")?.addEventListener("change", (ev) => {
      FILTER_ATIVO = String(ev.target.value || "todos");
      render_();
    });

    await refresh_();
  }

  document.addEventListener("DOMContentLoaded", boot_);
})(window, document);
