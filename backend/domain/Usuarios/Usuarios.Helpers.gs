// backend/domain/Usuarios/Usuarios.Helpers.gs
/**
 * ============================================================
 * PRONTIO - Usuarios.Helpers.gs
 * ============================================================
 * Helpers utilitários usados pelo domínio de Usuários.
 *
 * IMPORTANTÍSSIMO:
 * - Funções puras
 * - Sem acesso a DB / Repository / Sheets
 * - Apenas normalização e leitura defensiva
 */

/**
 * Retorna o primeiro campo existente e não-vazio do objeto.
 * Exemplo:
 *   _usrPick_(row, ["ID_Usuario", "idUsuario", "id"])
 */
function _usrPick_(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  if (!Array.isArray(keys)) return null;

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k in obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
      return obj[k];
    }
  }
  return null;
}

/**
 * Converte valor vindo do Sheet para boolean.
 * Aceita: true, "true", 1, "1", "sim", "yes"
 */
function _usrBool_(v) {
  if (v === true) return true;
  if (v === false) return false;

  var s = String(v || "").trim().toLowerCase();
  if (s === "true" || s === "1" || s === "sim" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "nao" || s === "não" || s === "no") return false;

  return false;
}
