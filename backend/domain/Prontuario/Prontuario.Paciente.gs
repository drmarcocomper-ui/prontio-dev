function _prontuarioPacienteObterResumo_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();

  var raw = null;
  try {
    raw = _prontuarioDelegarPacientes_("Pacientes.ObterPorId", { idPaciente: idPaciente });
  } catch (e) {
    try {
      raw = _prontuarioDelegarPacientes_("Pacientes_ObterPorId", { idPaciente: idPaciente });
    } catch (e2) {
      _prontuarioThrow_(
        "PRONTUARIO_PACIENTE_NOT_FOUND",
        "Não foi possível obter o paciente no módulo Pacientes.",
        { idPaciente: idPaciente, error: String((e2 && e2.message) ? e2.message : e2) }
      );
    }
  }

  var p = (raw && raw.paciente) ? raw.paciente : raw;

  var nome = _prontuarioPickFirst_(p, [
    "nomeCompleto",
    "nomeExibicao",
    "nomeSocial",
    "nome",
    "Nome",
    "NOME"
  ]);

  var dn = _prontuarioPickFirst_(p, [
    "dataNascimento",
    "DataNascimento",
    "data_nascimento",
    "nascimento",
    "Nascimento",
    "DATA_NASCIMENTO"
  ]);

  var profissao = _prontuarioPickFirst_(p, [
    "profissao",
    "Profissao",
    "PROFISSAO"
  ]);

  var planoSaude = _prontuarioPickFirst_(p, [
    "planoSaude",
    "PlanoSaude",
    "convenio",
    "Convenio",
    "plano",
    "Plano"
  ]);

  var carteirinha = _prontuarioPickFirst_(p, [
    "numeroCarteirinha",
    "NumeroCarteirinha",
    "carteirinha",
    "Carteirinha",
    "NUMERO_CARTEIRINHA"
  ]);

  var idade = _prontuarioPickFirst_(p, ["idade", "Idade"]);
  if (!idade) {
    var idadeCalc = _prontuarioCalcIdadeFromAny_(dn);
    if (idadeCalc !== "" && idadeCalc !== null && idadeCalc !== undefined) idade = String(idadeCalc);
  }

  return {
    idPaciente: idPaciente,
    paciente: {
      idPaciente: idPaciente,
      nomeCompleto: nome ? String(nome) : "",
      dataNascimento: dn ? String(dn) : "",
      idade: idade ? String(idade) : "",
      profissao: profissao ? String(profissao) : "",
      planoSaude: planoSaude ? String(planoSaude) : "",
      carteirinha: carteirinha ? String(carteirinha) : ""
    }
  };
}
