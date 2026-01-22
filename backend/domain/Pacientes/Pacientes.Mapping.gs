// ---------------------------------------------------------------------------
// Repo row (obj) -> DTO compat para o front
// ---------------------------------------------------------------------------

function pacienteRepoRowToObject_(rowObj) {
  rowObj = rowObj || {};

  var idRaw = String(_pacPick_(rowObj, ["idPaciente", "ID_Paciente"]) || "").trim();
  var status = String(_pacPick_(rowObj, ["status"]) || "ATIVO").trim().toUpperCase();
  if (!status) status = "ATIVO";

  var ativoBool = _statusToAtivo_(status);

  var nomeCompleto = _toText_(_pacPick_(rowObj, ["nomeCompleto", "NomeCompleto"]));
  var nomeSocial = _toText_(_pacPick_(rowObj, ["nomeSocial"]));
  var nomeExibicao = nomeCompleto || nomeSocial || "";

  var tel1 = _toText_(_pacPick_(rowObj, ["telefonePrincipal", "telefone1", "telefone", "Telefone"]));
  var tel2 = _toText_(_pacPick_(rowObj, ["telefoneSecundario", "telefone2", "Telefone2"]));

  var cidade = _toText_(_pacPick_(rowObj, ["cidade", "enderecoCidade"]));
  var bairro = _toText_(_pacPick_(rowObj, ["bairro", "enderecoBairro", "Bairro"]));
  var estado = _toText_(_pacPick_(rowObj, ["estado", "enderecoUf", "EnderecoUf"]));

  var criadoEm = _toText_(_pacPick_(rowObj, ["criadoEm", "DataCadastro"]));
  var atualizadoEm = _toText_(_pacPick_(rowObj, ["atualizadoEm"]));

  // datas podem ter vindo em Date/ISO: normaliza best-effort
  var dataNascimento = _toText_(_pacPick_(rowObj, ["dataNascimento", "DataNascimento"]));
  if (rowObj.dataNascimento instanceof Date) dataNascimento = _formatDateYMD_(rowObj.dataNascimento);

  return {
    idPaciente: idRaw,
    status: status,

    nomeCompleto: nomeCompleto,
    nomeSocial: nomeSocial,
    nomeExibicao: nomeExibicao,

    sexo: _toText_(_pacPick_(rowObj, ["sexo", "Sexo"])),
    dataNascimento: dataNascimento,
    estadoCivil: _toText_(_pacPick_(rowObj, ["estadoCivil"])),

    cpf: _toText_(_pacPick_(rowObj, ["cpf", "CPF"])),
    rg: _toText_(_pacPick_(rowObj, ["rg", "RG"])),
    rgOrgaoEmissor: _toText_(_pacPick_(rowObj, ["rgOrgaoEmissor"])),

    telefonePrincipal: tel1,
    telefoneSecundario: tel2,
    email: _toText_(_pacPick_(rowObj, ["email", "Email", "E-mail"])),

    planoSaude: _toText_(_pacPick_(rowObj, ["planoSaude", "PlanoSaude"])),
    numeroCarteirinha: _toText_(_pacPick_(rowObj, ["numeroCarteirinha", "NumeroCarteirinha"])),

    profissao: _toText_(_pacPick_(rowObj, ["profissao", "Profissao", "Profissão"])),

    cep: _toText_(_pacPick_(rowObj, ["cep"])),
    logradouro: _toText_(_pacPick_(rowObj, ["logradouro"])),
    numero: _toText_(_pacPick_(rowObj, ["numero"])),
    complemento: _toText_(_pacPick_(rowObj, ["complemento"])),
    bairro: bairro,
    cidade: cidade,
    estado: estado,

    tipoSanguineo: _toText_(_pacPick_(rowObj, ["tipoSanguineo"])),
    alergias: _toText_(_pacPick_(rowObj, ["alergias"])),
    observacoesClinicas: _toText_(_pacPick_(rowObj, ["observacoesClinicas"])),
    observacoesAdministrativas: _toText_(_pacPick_(rowObj, ["observacoesAdministrativas", "ObsImportantes", "observacoes"])),

    criadoEm: criadoEm,
    atualizadoEm: atualizadoEm,

    // aliases (compat)
    ID_Paciente: idRaw,
    telefone1: tel1,
    telefone2: tel2,
    telefone: tel1,
    enderecoCidade: cidade,
    enderecoBairro: bairro,
    enderecoUf: estado,
    dataCadastro: criadoEm,
    ativo: ativoBool,

    obsImportantes: _toText_(_pacPick_(rowObj, ["observacoesAdministrativas", "ObsImportantes", "observacoes"]))
  };
}
