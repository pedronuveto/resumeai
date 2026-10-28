const MODELO = "gemini-3.5-flash";
const URL_API = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
const MIN_PALAVRAS = 30;
const MAX_CARACTERES = 10000;
const TEMPO_LIMITE_MS = 30000; // 30 s

// vai como systemInstruction, vale pra todos os tipos
const INSTRUCAO_GERAL =
  "Você resume textos para estudantes. Responda sempre em português do Brasil, " +
  "em texto simples, sem Markdown (sem asteriscos, cerquilhas ou negrito). " +
  "Use apenas informações presentes no texto, sem inventar fatos. " +
  "Responda somente com o resumo, sem introdução nem comentários.";

const INSTRUCOES_TIPO = {
  paragrafo: "Escreva o resumo como um único parágrafo corrido.",
  topicos:
    "Escreva o resumo como uma lista dos pontos principais. " +
    "Coloque cada item em uma nova linha, começando com '- '.",
  estudo:
    "Liste os conceitos-chave do texto. Coloque cada um em uma nova linha, " +
    "no formato 'Conceito: explicação curta'.",
  simples:
    "Explique o conteúdo em linguagem simples, para alguém que nunca estudou o assunto. " +
    "Se precisar usar um termo técnico, explique-o.",
};

const INSTRUCOES_TAMANHO = {
  curto: "Seja muito breve: no máximo 40 palavras.",
  medio: "Use cerca de 80 a 100 palavras.",
  longo: "Use cerca de 150 a 200 palavras.",
};

const formulario = document.getElementById("form-resumo");
const campoTexto = document.getElementById("texto");
const campoTipo = document.getElementById("tipo");
const campoTamanho = document.getElementById("tamanho");
const botaoResumir = document.getElementById("btn-resumir");
const contador = document.getElementById("contador");
const areaMensagem = document.getElementById("mensagem");
const areaResumo = document.getElementById("resumo");
const areaEstatisticas = document.getElementById("estatisticas");
const botaoCopiar = document.getElementById("btn-copiar");

function contarPalavras(texto) {
  const textoLimpo = texto.trim();
  return textoLimpo === "" ? 0 : textoLimpo.split(/\s+/).length;
}

function atualizarContador() {
  const texto = campoTexto.value;
  const caracteres = texto.length.toLocaleString("pt-BR");
  const limite = MAX_CARACTERES.toLocaleString("pt-BR");
  contador.textContent = `${caracteres} / ${limite} caracteres · ${contarPalavras(texto)} palavras`;
}

function validarTexto(texto) {
  if (texto.trim() === "") {
    return "Cole um texto antes de clicar em Resumir.";
  }
  if (contarPalavras(texto) < MIN_PALAVRAS) {
    return `O texto é curto demais para resumir. Use pelo menos ${MIN_PALAVRAS} palavras.`;
  }
  if (texto.length > MAX_CARACTERES) {
    return `O texto passou do limite de ${MAX_CARACTERES.toLocaleString("pt-BR")} caracteres.`;
  }
  return null;
}

// sem config.js (ou com USAR_PLANO_B) usa o resumo de exemplo
function deveUsarPlanoB() {
  return typeof CONFIG === "undefined" || !CONFIG.GEMINI_API_KEY || CONFIG.USAR_PLANO_B === true;
}

function montarCorpoRequisicao(texto, tipo, tamanho) {
  const pedido = `${INSTRUCOES_TIPO[tipo]} ${INSTRUCOES_TAMANHO[tamanho]}\n\nTexto:\n${texto}`;
  return {
    systemInstruction: { parts: [{ text: INSTRUCAO_GERAL }] },
    contents: [{ role: "user", parts: [{ text: pedido }] }],
  };
}

function mensagemDeErroDaApi(status, detalhe) {
  if ((status === 400 && /api key/i.test(detalhe)) || status === 401 || status === 403) {
    return "Chave de API inválida ou sem permissão. Confira o arquivo config.js.";
  }
  if (status === 400) return "A API recusou o pedido. Tente com outro texto.";
  if (status === 429) return "Limite de uso da API atingido. Aguarde um minuto e tente de novo.";
  if (status >= 500) return "O serviço do Gemini está instável. Tente novamente em instantes.";
  return `Erro inesperado da API (código ${status}).`;
}

async function chamarGemini(corpo) {
  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  let resposta;
  try {
    resposta = await fetch(URL_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": CONFIG.GEMINI_API_KEY,
      },
      body: JSON.stringify(corpo),
      signal: controle.signal,
    });
  } catch (erro) {
    if (erro.name === "AbortError") {
      throw new Error("A API demorou demais para responder. Tente novamente.");
    }
    throw new Error("Sem conexão com a internet ou a API está inacessível.");
  } finally {
    clearTimeout(temporizador);
  }

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(mensagemDeErroDaApi(resposta.status, dados.error?.message ?? ""));
  }

  if (dados.promptFeedback?.blockReason) {
    throw new Error("A IA se recusou a resumir este texto. Tente com outro conteúdo.");
  }

  // pula as partes de raciocínio (thought) que o modelo às vezes manda
  const partes = dados.candidates?.[0]?.content?.parts ?? [];
  const resumo = partes
    .filter((parte) => parte.text && !parte.thought)
    .map((parte) => parte.text)
    .join("")
    .trim();

  if (resumo === "") {
    throw new Error("A IA não retornou um resumo. Tente novamente.");
  }
  return resumo;
}

function obterResumoDeExemplo(tipo) {
  return new Promise((resolver) => {
    setTimeout(() => resolver(RESPOSTA_EXEMPLO[tipo]), 600);
  });
}

function definirCarregando(carregando) {
  botaoResumir.disabled = carregando;
  botaoResumir.textContent = carregando ? "Resumindo..." : "Resumir";
  formulario.setAttribute("aria-busy", String(carregando));
}

function limparResultado() {
  areaMensagem.className = "mensagem";
  areaMensagem.hidden = true;
  areaResumo.hidden = true;
  areaEstatisticas.hidden = true;
  botaoCopiar.hidden = true;
}

function mostrarMensagem(texto, tipo = "") {
  areaMensagem.textContent = texto;
  areaMensagem.className = tipo ? `mensagem ${tipo}` : "mensagem";
  areaMensagem.hidden = false;
}

function mostrarResumo(resumo, textoOriginal) {
  // textContent pra não interpretar HTML que venha da API
  areaResumo.textContent = resumo;
  areaResumo.hidden = false;

  const antes = contarPalavras(textoOriginal);
  const depois = contarPalavras(resumo);
  const reducao = Math.max(0, Math.round((1 - depois / antes) * 100));
  areaEstatisticas.textContent = `${antes} palavras → ${depois} palavras (${reducao}% menor)`;
  areaEstatisticas.hidden = false;

  botaoCopiar.textContent = "Copiar resumo";
  botaoCopiar.hidden = false;
}

async function resumir(evento) {
  evento.preventDefault();
  limparResultado();

  const texto = campoTexto.value;
  const erroValidacao = validarTexto(texto);
  if (erroValidacao) {
    mostrarMensagem(erroValidacao, "erro");
    campoTexto.focus();
    return;
  }

  const tipo = campoTipo.value;
  const tamanho = campoTamanho.value;
  definirCarregando(true);

  try {
    if (deveUsarPlanoB()) {
      mostrarMensagem("Modo demonstração (Plano B): exibindo um resumo de exemplo, sem chamar a API.", "info");
      mostrarResumo(await obterResumoDeExemplo(tipo), texto);
    } else {
      const resumo = await chamarGemini(montarCorpoRequisicao(texto, tipo, tamanho));
      mostrarResumo(resumo, texto);
    }
  } catch (erro) {
    mostrarMensagem(erro.message, "erro");
  } finally {
    definirCarregando(false);
  }
}

async function copiarResumo() {
  try {
    await navigator.clipboard.writeText(areaResumo.textContent);
    botaoCopiar.textContent = "Copiado!";
  } catch {
    botaoCopiar.textContent = "Não foi possível copiar";
  }
}

formulario.addEventListener("submit", resumir);
campoTexto.addEventListener("input", atualizarContador);
botaoCopiar.addEventListener("click", copiarResumo);
atualizarContador();
