// Conduz a versão web da app num Chrome sem janela, pelo protocolo DevTools (CDP), sem dependências.
// Serve para os cenários de ponta a ponta em cenarios.mjs: clicar, escrever, arrastar e ler o ecrã.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Onde ficam o perfil do navegador e as capturas: fora do projeto, na pasta temporária do sistema. */
export const PASTA = path.join(os.tmpdir(), 'align-e2e');
export const APP = process.env.APP_URL ?? 'http://localhost:8081';

const CANDIDATOS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/** Texto que o utilizador vê: os separadores inativos ficam no DOM (marcados "inert") e não contam. */
const TEXTO = `(() => { let t = document.body.innerText; for (const el of document.querySelectorAll('[inert]')) { const it = el.innerText; if (it) t = t.split(it).join(''); } return t; })()`;

/**
 * Procura um elemento pelo rótulo de acessibilidade, pelo texto ou pelo texto de exemplo de um campo,
 * por esta ordem, e devolve o seu centro. Só conta o que está mesmo visível por cima no ecrã.
 */
const PROCURAR = `
  window.__procurar = (alvo, opcoes = {}) => {
    const todos = [...document.querySelectorAll('*')];
    const visivel = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert]'); };
    const exato = opcoes.exato !== false;
    const serve = (s) => s != null && (exato ? s.trim() === alvo : s.includes(alvo));
    const porCima = (el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true;
      const topo = document.elementFromPoint(x, y);
      return !!topo && (el === topo || el.contains(topo) || topo.contains(el));
    };
    const estrategias = [
      (el) => serve(el.getAttribute('aria-label')),
      (el) => el.children.length === 0 && serve(el.textContent),
      (el) => [...el.childNodes].some((n) => n.nodeType === 3 && serve(n.textContent)),
      (el) => serve(el.getAttribute('placeholder')),
    ];
    let achados = [];
    let reserva = [];
    for (const estrategia of estrategias) {
      const candidatos = todos.filter((el) => visivel(el) && estrategia(el));
      if (!reserva.length) reserva = candidatos;
      achados = candidatos.filter(porCima);
      if (achados.length) break;
    }
    if (!achados.length) achados = reserva;
    // indice negativo conta a partir do fim (ex.: -1 = o último, como o separador por baixo de tudo).
    const el = achados.at(opcoes.indice ?? 0);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, largura: r.width, altura: r.height };
  };`;

/**
 * Abre um Chrome sem janela com um perfil vazio (uma "app acabada de instalar") e devolve as ações.
 * @param nome distingue o perfil e as capturas de cada cenário.
 */
export async function abrirNavegador(nome, { porta = 9400, largura = 390, altura = 844, idioma = 'pt-PT' } = {}) {
  const chrome = CANDIDATOS.find((caminho) => caminho && existsSync(caminho));
  if (!chrome) throw new Error('Não encontrei o Chrome. Indique o caminho na variável CHROME_PATH.');
  const perfil = path.join(PASTA, `perfil-${nome}`);
  const capturas = path.join(PASTA, 'capturas');
  rmSync(perfil, { recursive: true, force: true });
  mkdirSync(perfil, { recursive: true });
  mkdirSync(capturas, { recursive: true });

  const processo = spawn(
    chrome,
    // CHROME_ARGS acrescenta opções ao Chrome (ex.: "--no-sandbox" em contentores, onde corre como root).
    ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, `--window-size=${largura},${altura}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--lang=${idioma}`, `--accept-lang=${idioma}`, ...(process.env.CHROME_ARGS?.split(' ').filter(Boolean) ?? []), 'about:blank'],
    { stdio: 'ignore' },
  );
  let pagina;
  for (let i = 0; i < 60 && !pagina; i++) {
    try {
      pagina = (await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()).find((t) => t.type === 'page');
    } catch {
      // O Chrome ainda está a arrancar.
    }
    if (!pagina) await esperar(250);
  }
  if (!pagina) throw new Error('O Chrome não arrancou.');

  const ligacao = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((resolver, rejeitar) => {
    ligacao.addEventListener('open', resolver, { once: true });
    ligacao.addEventListener('error', rejeitar, { once: true });
  });
  let numero = 0;
  const pendentes = new Map();
  const ouvintes = new Map();
  /** Mensagens da consola da página e diálogos (alert / confirm) que apareceram; os diálogos são aceites. */
  const consola = [];
  const dialogos = [];
  ligacao.addEventListener('message', (evento) => {
    const mensagem = JSON.parse(evento.data);
    if (mensagem.id && pendentes.has(mensagem.id)) {
      const { resolver, rejeitar } = pendentes.get(mensagem.id);
      pendentes.delete(mensagem.id);
      if (mensagem.error) rejeitar(new Error(`${mensagem.error.message} ${mensagem.error.data ?? ''}`));
      else resolver(mensagem.result);
      return;
    }
    for (const ouvinte of ouvintes.get(mensagem.method) ?? []) ouvinte(mensagem.params);
    if (mensagem.method === 'Runtime.consoleAPICalled') {
      consola.push(`[${mensagem.params.type}] ${mensagem.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    } else if (mensagem.method === 'Runtime.exceptionThrown') {
      const detalhes = mensagem.params.exceptionDetails;
      consola.push(`[exception] ${detalhes.exception?.description ?? detalhes.text}`);
    } else if (mensagem.method === 'Page.javascriptDialogOpening') {
      dialogos.push(`${mensagem.params.type}: ${mensagem.params.message}`);
      enviar('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  });

  function enviar(metodo, parametros = {}) {
    const id = ++numero;
    ligacao.send(JSON.stringify({ id, method: metodo, params: parametros }));
    return new Promise((resolver, rejeitar) => pendentes.set(id, { resolver, rejeitar }));
  }
  const aoEvento = (metodo, ouvinte) => ouvintes.set(metodo, [...(ouvintes.get(metodo) ?? []), ouvinte]);

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 2, mobile: false });

  async function avaliar(expressao) {
    const r = await enviar('Runtime.evaluate', { expression: expressao, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }

  async function ate(expressao, descricao = expressao, limite = 10000) {
    const inicio = Date.now();
    for (;;) {
      const valor = await avaliar(expressao).catch(() => false);
      if (valor) return valor;
      if (Date.now() - inicio > limite) throw new Error(`Esperei em vão por: ${descricao}`);
      await esperar(100);
    }
  }

  async function procurar(alvo, opcoes) {
    await avaliar(PROCURAR);
    return avaliar(`window.__procurar(${JSON.stringify(alvo)}, ${JSON.stringify(opcoes ?? {})})`);
  }

  async function rato(tipo, x, y, extra = {}) {
    await enviar('Input.dispatchMouseEvent', { type: tipo, x, y, button: 'left', buttons: tipo === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse', ...extra });
  }

  async function clicarEm(x, y) {
    await rato('mouseMoved', x, y, { buttons: 0 });
    await rato('mousePressed', x, y);
    await rato('mouseReleased', x, y);
    await esperar(150);
  }

  /** Clica no elemento com este rótulo ou texto, depois de ele parar de se mexer (folhas a subir, listas a arrumar). */
  async function clicar(alvo, opcoes = {}) {
    const inicio = Date.now();
    let ponto;
    while (!(ponto = await procurar(alvo, opcoes))) {
      if (Date.now() - inicio > 8000) throw new Error(`Não encontrei: ${alvo}`);
      await esperar(150);
    }
    for (let i = 0; i < 25; i++) {
      await esperar(120);
      const agora = (await procurar(alvo, opcoes)) ?? ponto;
      const parado = Math.abs(agora.x - ponto.x) < 0.5 && Math.abs(agora.y - ponto.y) < 0.5;
      ponto = agora;
      if (parado) break;
    }
    await clicarEm(ponto.x, ponto.y);
    return ponto;
  }

  /** Arrasta de um ponto a outro. `segurar` é o tempo parado antes de mexer (manter premido). */
  async function arrastar(de, para, { passos = 20, segurar = 100 } = {}) {
    await rato('mouseMoved', de.x, de.y, { buttons: 0 });
    await rato('mousePressed', de.x, de.y);
    await esperar(segurar);
    for (let i = 1; i <= passos; i++) {
      await rato('mouseMoved', de.x + ((para.x - de.x) * i) / passos, de.y + ((para.y - de.y) * i) / passos);
      await esperar(16);
    }
    await esperar(100);
    await rato('mouseReleased', para.x, para.y);
    await esperar(300);
  }

  async function escrever(texto) {
    await enviar('Input.insertText', { text: texto });
    await esperar(80);
  }

  async function capturar(nomeDaCaptura) {
    const { data } = await enviar('Page.captureScreenshot', { format: 'png' });
    const ficheiro = path.join(capturas, `${nome}-${nomeDaCaptura}.png`);
    writeFileSync(ficheiro, Buffer.from(data, 'base64'));
    return ficheiro;
  }

  async function ir(caminho, textoEsperado) {
    await enviar('Page.navigate', { url: `${APP}${caminho}` });
    // O primeiro carregamento inclui a compilação do pacote pelo Metro: pode demorar.
    await ate(`document.body && ${TEXTO}.includes(${JSON.stringify(textoEsperado)})`, `a página ${caminho} com "${textoEsperado}"`, 180000);
    await esperar(500);
  }

  const texto = () => avaliar(TEXTO);
  const tem = async (s) => (await texto()).includes(s);
  const verTexto = (s) => ate(`${TEXTO}.includes(${JSON.stringify(s)})`, `o texto "${s}"`);
  const naoVerTexto = (s) => ate(`!${TEXTO}.includes(${JSON.stringify(s)})`, `o texto "${s}" desaparecer`);

  async function fechar() {
    await enviar('Browser.close').catch(() => {});
    await esperar(300);
    processo.kill();
  }

  return { enviar, aoEvento, avaliar, ate, procurar, rato, clicarEm, clicar, arrastar, escrever, capturar, ir, texto, tem, verTexto, naoVerTexto, esperar, fechar, consola, dialogos };
}
