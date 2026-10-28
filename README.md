# ResumeAí

Resumidor de textos em português com inteligência artificial. O usuário cola um texto, escolhe o **tipo** de resumo (parágrafo, tópicos, para estudo ou explicação simples) e o **tamanho** (curto, médio ou longo), e o app devolve um resumo gerado pela API do Google Gemini.

Projeto da disciplina Desenvolvimento de Sistemas Web (EECP0036), UFMA, 2026.2. Trilha A (API de IA).

## O que o app faz

- Gera resumos com IA em 4 tipos e 3 tamanhos.
- Mostra a contagem de palavras antes e depois do resumo.
- Copia o resumo com um botão.
- Mostra mensagens claras para campo vazio, texto curto demais (menos de 30 palavras), texto acima de 10.000 caracteres, falta de internet e erros da API (chave inválida, limite de uso, serviço instável).

Não faz: ler arquivos, PDFs ou links; guardar histórico; garantir que o resumo esteja 100% correto (a IA pode errar).

## Como rodar

1. Clone o repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/resumeai.git
   cd resumeai
   ```
2. Crie uma chave gratuita no [Google AI Studio](https://aistudio.google.com/apikey).
3. Copie `config.example.js` para `config.js` e cole a chave no campo `GEMINI_API_KEY`. O `config.js` está no `.gitignore` e não vai para o GitHub.
4. Rode um servidor local na pasta do projeto:
   ```bash
   python -m http.server 8000
   ```
   ou use a extensão Live Server do VS Code.
5. Abra `http://localhost:8000`.

### Texto para testar

> O protocolo HTTP é a base da comunicação na web. Ele define como o navegador pede recursos e como o servidor responde. Cada resposta traz um código de status, como 200 ou 404, que indica se o pedido deu certo. O HTTPS é a versão segura do HTTP, com criptografia para proteger os dados no caminho. Muitas pessoas usam a web todos os dias sem perceber que tudo isso acontece por trás de cada página.

## Plano B (sem internet ou API fora do ar)

Se o `config.js` não existir, não tiver chave, ou tiver `USAR_PLANO_B: true`, o app não chama a API: ele exibe um resumo pronto, guardado em `respostaExemplo.js` (feito para o texto de teste acima), e avisa na tela que está em modo demonstração.

## Como funciona

1. O clique em **Resumir** chama `resfumir()`, que valida o texto e lê o tipo e o tamanho escolhidos.
2. `montarCorpoRequisicao()` junta a instrução do tipo, a do tamanho e o texto, e `chamarGemini()` envia um `fetch` (POST) para a API do Gemini (modelo `gemini-3.5-flash`), com a chave do `config.js` no cabeçalho `x-goog-api-key`.
3. A API devolve um JSON. O app extrai o texto do resumo ou, em caso de erro, converte o código de status em uma mensagem amigável.
4. O resultado aparece na página com `textContent` (nunca `innerHTML`), e o CSS `white-space: pre-line` mantém as quebras de linha dos tópicos.

## Estrutura

```
index.html           página (HTML semântico)
style.css            estilos responsivos, com tema claro e escuro
app.js               lógica do app e chamada à API
respostaExemplo.js   resumos prontos do Plano B
config.example.js    modelo do arquivo de configuração (sem chave)
.gitignore           impede o commit do config.js
```

## Segurança

- A chave da API fica só no `config.js`, ignorado pelo Git. O repositório contém apenas o `config.example.js`.
- O app não é publicado no GitHub Pages, porque a página carregaria a chave.
- Todo texto digitado ou vindo da API entra na página com `textContent`.
- A página avisa para não colar dados pessoais: no plano gratuito, o Google pode usar os textos enviados para melhorar os modelos.

## Uso de IA

- **Google Gemini:** faz parte do app e gera os resumos.
- **Claude (Anthropic):** usado para descrever o projeto, por exemplo no README.
