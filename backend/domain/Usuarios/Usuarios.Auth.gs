/**
 * ✅ Hash definitivo de senha (compatível com Auth.gs atual)
 * Base64(SHA-256( senhaTexto ))
 */
function hashSenha_(senha) {
  if (!senha) return "";
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(senha)
  );
  return Utilities.base64Encode(bytes);
}

function Usuarios_verifyPassword_(senha, senhaHash) {
  senha = (senha || "").toString();
  senhaHash = (senhaHash || "").toString();
  if (!senha || !senhaHash) return false;
  return hashSenha_(senha) === senhaHash;
}
