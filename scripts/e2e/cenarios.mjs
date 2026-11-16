// Cenários de ponta a ponta: percorrem a app como um utilizador, na versão web, num Chrome sem janela.
// Cobrem os critérios de aceitação da especificação v1 que se conseguem verificar sem telemóvel.
//
// Uso:  npx expo start --web        (noutro terminal; a app tem de estar a ser servida)
//       npm run e2e                  (todos os cenários)
//       npm run e2e -- calendario    (só um: semana, calendario, revisao, arranque, ordem)
//       No Linux, em contentores: CHROME_PATH=/caminho/do/chrome CHROME_ARGS=--no-sandbox npm run e2e
//
// Cada cenário começa com a app "acabada de instalar" (perfil de navegador vazio), por isso não toca
// nos dados de ninguém. As capturas dos passos que falham ficam na pasta temporária do sistema.
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import { descreverSemanaComAno, descreverSemanaPorExtenso, inicioDaSemana, somarSemanas } from '../../src/domain/semana.ts';
import { APP, PASTA, abrirNavegador } from './navegador.mjs';

const ESTA = inicioDaSemana(new Date());
const SEGUINTE = somarSemanas(ESTA, 1);
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
/** O dia de hoje pelo nome que as definições usam; a revisão abre no dia escolhido. */
const HOJE = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][new Date().getDay()];

/** Passa pelo primeiro arranque, escolhendo as áreas indicadas, e acaba no ecrã das áreas. */
async function comecar(b, areas = []) {
  await b.ir('/', 'Uma semana alinhada');
  await b.clicar('Continuar');
  await b.verTexto('Quais são as suas áreas?');
  for (const area of areas) await b.clicar(area);
  await b.clicar('Continuar');
  await b.verTexto('Quando faz a revisão da semana?');
  await b.clicar('Começar');
  await b.verTexto('As minhas áreas');
}

/** No separador Semana: cria uma tarefa na área. `mais` e `menos` ajustam a duração (começa em 1 h). */
async function criarTarefa(b, area, nome, { mais = 0, menos = 0, semDuracao = false, repeticao } = {}) {
  await b.clicar(`Adicionar tarefa em ${area}`);
  await b.verTexto('REPETIÇÃO');
  await b.clicar('Nome da tarefa');
  await b.escrever(nome);
  for (let i = 0; i < mais; i++) await b.clicar('Mais duração');
  for (let i = 0; i < menos; i++) await b.clicar('Menos duração');
  if (semDuracao) await b.clicar('Sem duração');
  if (repeticao) await b.clicar(repeticao);
  await b.clicar('Criar tarefa');
  await b.verTexto('Planear a semana');
  await b.verTexto(nome);
}

/** No detalhe de uma área: cria uma meta com prazo daqui a 3 meses. Com `de` e `para` é de número; sem eles, um marco. */
async function criarMeta(b, descricao, { de, para, unidade } = {}) {
  await b.clicar('Adicionar meta');
  await b.verTexto('ONDE QUER CHEGAR?');
  await b.clicar('Descrição da meta');
  await b.escrever(descricao);
  if (de === undefined) {
    await b.clicar('Marco');
  } else {
    await b.clicar('Valor de partida');
    await b.escrever(String(de));
    await b.clicar('Valor alvo');
    await b.escrever(String(para));
    if (unidade) {
      await b.clicar('Unidade (opcional)');
      await b.escrever(unidade);
    }
  }
  await b.clicar('Prazo daqui a 3 meses');
  await b.clicar('Criar meta');
  await b.verTexto('TAREFAS DESTA SEMANA');
  await b.verTexto(descricao);
}

/** Centro de uma célula da grelha do calendário: dia 0–6 (segunda–domingo) e hora (ex.: 9.5). */
async function celula(b, dia, horas) {
  const coluna = await b.procurar(DIAS[dia]);
  const hora = Math.floor(horas);
  const etiqueta = await b.procurar(`${hora}h`);
  const seguinte = await b.procurar(`${hora + 1}h`);
  return { x: coluna.x, y: etiqueta.y + (horas - hora) * (seguinte.y - etiqueta.y) + 3 };
}

/** Quantos elementos visíveis têm um rótulo começado por este texto (os separadores inativos, marcados "inert", não contam). */
const contar = (rotulo) => `[...document.querySelectorAll('[aria-label^=${JSON.stringify(rotulo)}]')].filter((e) => !e.closest('[inert]')).length`;
const haBloco = (b, rotulo) => b.ate(`${contar(rotulo)} > 0`, `o bloco "${rotulo}"`);
const naoHaBloco = (b, rotulo) => b.ate(`${contar(rotulo)} === 0`, `o bloco "${rotulo}" sair`);
/** Os blocos de uma tarefa no calendário têm o rótulo "Nome, dia da semana, horas" (o "–" separa as horas). */
const haBlocos = (b, nome, quantos) =>
  b.ate(
    `[...document.querySelectorAll('[aria-label^=${JSON.stringify(`${nome}, `)}]')].filter((e) => !e.closest('[inert]') && e.getAttribute('aria-label').includes('–')).length === ${quantos}`,
    `${quantos} blocos de ${nome}`,
  );

const cenarios = {
  /** Áreas, metas (resultados com prazo), tarefas, o plano da semana e a proposta da semana seguinte. */
  async semana(b, passo) {
    await passo('primeiro arranque e criar uma área pelo formulário', async () => {
      await comecar(b, ['Espiritual']);
      await b.verTexto('1 de 7 no máximo');
      await b.clicar('Nova área');
      await b.verTexto('NOME');
      await b.clicar('Nome da área');
      await b.escrever('Família');
      await b.clicar('Laranja');
      await b.clicar('casa');
      await b.clicar('Criar área');
      await b.ate(`document.querySelector('[aria-label="Nome da área"]')?.value === 'Família'`, 'o detalhe da área Família');
      await b.avaliar('history.back()');
      await b.verTexto('2 de 7 no máximo');
    });

    await passo('uma meta é um resultado com prazo: número com alvo, ou marco', async () => {
      await b.clicar('Espiritual');
      await b.verTexto('0 de 3 ativas');
      await criarMeta(b, 'Conseguir meditar 1 h seguida', { de: 20, para: 60, unidade: 'min seguidos' });
      await b.verTexto('20 de 60 min seguidos');
      await b.verTexto('faltam ');
      await b.verTexto('Ainda não há tarefas ligadas a esta meta.');
      await criarMeta(b, 'Fazer um retiro de silêncio');
      await b.verTexto('Por alcançar');
      await b.verTexto('2 de 3 ativas');
    });

    await passo('a tarefa "Meditar 2 h, todos os dias" fica ligada à meta e cria 7 instâncias por alocar', async () => {
      await b.clicar('Nova tarefa');
      await b.verTexto('REPETIÇÃO');
      await b.clicar('Nome da tarefa');
      await b.escrever('Meditar');
      await b.clicar('Mais duração');
      await b.clicar('Mais duração');
      await b.clicar('Todos os dias');
      await b.verTexto('Nesta semana: 7 × 2 h = 14 h.');
      await b.clicar('Conseguir meditar 1 h seguida'); // a meta, na secção "Meta (opcional)"
      await b.clicar('Criar tarefa');
      await b.verTexto('TAREFAS DESTA SEMANA');
      await b.verTexto('2 h · todos os dias · 0/7 esta semana');
      await b.verTexto('0/7 no calendário');
    });

    await passo('a meta regista o valor, guarda o histórico e pausa sem o perder', async () => {
      await b.clicar('Conseguir meditar 1 h seguida', { exato: false });
      await b.verTexto('PROGRESSO');
      await b.verTexto('TAREFAS LIGADAS');
      await b.clicar('Valor atual de Conseguir meditar 1 h seguida');
      await b.avaliar('document.activeElement.select()');
      await b.escrever('30');
      await b.clicar('Registar o valor de Conseguir meditar 1 h seguida');
      await b.verTexto('30 de 60 min seguidos');
      await b.verTexto('25% do caminho');
      await b.verTexto('HISTÓRICO');
      await b.verTexto('Registado hoje: 30.');
      await b.clicar('Pausar meta');
      await b.verTexto('Em pausa: o histórico e as tarefas ligadas ficam guardados.');
      await b.verTexto('HISTÓRICO');
      await b.avaliar('history.back()');
      await b.verTexto('1 de 3 ativas');
      await b.verTexto('Pausada');
      await b.clicar('Conseguir meditar 1 h seguida', { exato: false });
      await b.clicar('Retomar meta');
      await b.verTexto('Pausar meta');
      await b.avaliar('history.back()');
      await b.verTexto('2 de 3 ativas');
      await b.avaliar('history.back()');
      await b.verTexto('1 tarefa · 14 h esta semana');
    });

    await passo('o plano da semana soma tarefas únicas e conta as tarefas sem duração', async () => {
      await b.clicar('Semana');
      await b.verTexto(descreverSemanaComAno(ESTA));
      await criarTarefa(b, 'Família', 'Ligar aos avós', { menos: 1 });
      await b.verTexto('Por alocar');
      await b.verTexto('14,5 h');
      await criarTarefa(b, 'Espiritual', 'Lição ACIM', { semDuracao: true, repeticao: 'Todos os dias' });
      await b.clicar('Marcar mais uma vez de Lição ACIM');
      await b.clicar('Marcar mais uma vez de Lição ACIM');
      await b.verTexto('2/7');
      await b.clicar('Desfazer uma vez de Lição ACIM');
      await b.verTexto('1/7');
    });

    await passo('alterar a repetição acerta as instâncias', async () => {
      await b.clicar('Meditar');
      await b.verTexto('Guardar alterações');
      await b.clicar('Vezes por semana');
      await b.verTexto('Nesta semana: 3 × 2 h = 6 h.');
      await b.clicar('Guardar alterações');
      await b.verTexto('0/3');
      await b.verTexto('6,5 h');
    });

    await passo('a semana seguinte começa como uma proposta, que só fica definitiva ao aceitar', async () => {
      await b.clicar('Semana seguinte');
      await b.verTexto(descreverSemanaComAno(SEGUINTE));
      await b.verTexto('Como quer começar esta semana?');
      await b.verTexto('Igual à semana passada');
      await b.naoVerTexto('Igual à semana modelo');
      await b.naoVerTexto('Meditar');
      await b.clicar('Criar proposta');
      await b.verTexto('Proposta por aceitar');
      await b.verTexto('0/3');
      await b.verTexto('0/7');
      await b.verTexto('30 min · vem da semana passada'); // "Ligar aos avós" ficou por fazer
      await b.verTexto('2 áreas sem tempo no calendário');
      await b.clicar('Aceitar semana');
      await b.naoVerTexto('Proposta por aceitar');
      await b.clicar('Voltar a esta semana');
      await b.verTexto(descreverSemanaComAno(ESTA));
      await b.naoVerTexto('Proposta por aceitar');
    });

    await passo('qualquer semana se marca e desmarca como semana modelo', async () => {
      await b.clicar('Semana modelo');
      await b.verTexto('Esta é a semana modelo');
      await b.clicar('Semana seguinte');
      await b.verTexto(`Marcar como semana modelo (substitui a de ${descreverSemanaPorExtenso(ESTA)})`);
      await b.clicar('Voltar a esta semana');
      await b.clicar('Semana modelo');
      await b.verTexto('Marcar como semana modelo');
      await b.naoVerTexto('Esta é a semana modelo');
    });

    await passo('apagar pelo formulário e a deslizar, com confirmação', async () => {
      await b.clicar('Ligar aos avós');
      await b.clicar('Apagar tarefa');
      await b.naoVerTexto('Ligar aos avós');
      const linha = await b.procurar('Lição ACIM');
      await b.arrastar({ x: linha.x + 60, y: linha.y }, { x: linha.x - 140, y: linha.y }, { passos: 12 });
      await b.clicar('Apagar Lição ACIM');
      await b.naoVerTexto('Lição ACIM');
      if (b.dialogos.filter((d) => d.startsWith('confirm: Apagar')).length !== 2) throw new Error('faltou pedir confirmação');
      // Um toque simples continua a abrir a tarefa.
      await b.clicar('Meditar');
      await b.verTexto('Guardar alterações');
    });
  },

  /** Fase 3: calendário (critérios 4 a 6). */
  async calendario(b, passo) {
    await passo('prepara áreas e tarefas', async () => {
      await comecar(b, ['Espiritual', 'Trabalho']);
      await b.clicar('Semana');
      await b.verTexto('Planear a semana');
      await criarTarefa(b, 'Espiritual', 'Meditar', { mais: 2, repeticao: 'Todos os dias' });
      await criarTarefa(b, 'Trabalho', 'Curso online', { mais: 2 });
      await criarTarefa(b, 'Trabalho', 'Rever orçamento');
      await b.clicar('Alocar no calendário');
      await b.verTexto('Arraste para o calendário');
      await b.verTexto('×7');
    });

    await passo('aloca só com toques, sem arrastar (acessibilidade)', async () => {
      await b.clicar('Curso online · 2 h');
      await b.verTexto('Toque na hora de início de “Curso online”.');
      const p = await celula(b, 3, 9);
      await b.clicarEm(p.x, p.y);
      await haBloco(b, 'Curso online, quinta, 09:00–11:00');
      await b.naoVerTexto('Curso online · 2 h');
    });

    await passo('arrasta da bandeja e aloca as 7 instâncias', async () => {
      const ficha = await b.procurar('Meditar · 2 h');
      await b.arrastar(ficha, await celula(b, 0, 7), { segurar: 60 });
      await haBloco(b, 'Meditar, segunda, 06:30–08:30');
      await b.verTexto('Pôr as outras 6 à mesma hora?');
      await b.clicar('Alocar');
      await haBlocos(b, 'Meditar', 7);
    });

    await passo('move um bloco de dia e de hora, e muda-lhe a duração', async () => {
      await b.arrastar(await celula(b, 3, 9.5), await celula(b, 1, 14.5), { segurar: 500 });
      await haBloco(b, 'Curso online, terça, 14:00–16:00');
      await b.arrastar(await celula(b, 1, 15.95), await celula(b, 1, 17), { passos: 14, segurar: 500 });
      await haBloco(b, 'Curso online, terça, 14:00–17:00');
    });

    await passo('pela folha: marca como feito, muda a hora e devolve a "Por alocar"', async () => {
      const bloco = await celula(b, 1, 14.6);
      await b.clicarEm(bloco.x, bloco.y);
      await b.clicar('Marcar como feito');
      await b.verTexto('Desmarcar como feito');
      await haBloco(b, 'Curso online, terça, 14:00–17:00, feito');
      await b.clicar('Mais hora de início');
      await haBloco(b, 'Curso online, terça, 14:30–17:30');
      await b.clicar('Devolver a “Por alocar”');
      await b.verTexto('Curso online · 2 h');
      await naoHaBloco(b, 'Curso online, terça');
    });

    await passo('bloco "Ocupado" e avisos de sobreposição', async () => {
      await b.clicar('Novo bloco Ocupado');
      await b.verTexto('Toque na hora em que está ocupado.');
      const livre = await celula(b, 0, 10.2);
      await b.clicarEm(livre.x, livre.y);
      await b.verTexto('TÍTULO');
      await haBloco(b, 'Ocupado, segunda, 10:00–11:00');
      for (let i = 0; i < 4; i++) await b.clicar('Menos hora de início');
      await b.verTexto('Sobrepõe-se a “Meditar”.');
      await b.clicar('Título do bloco');
      await b.escrever('Reunião');
      await b.esperar(900);
      await b.clicar('Fechar', { indice: 1 });
      await haBloco(b, 'Reunião, segunda, 08:00–09:00');

      const ficha = await b.procurar('Rever orçamento · 1 h');
      await b.arrastar(ficha, await celula(b, 2, 7.6), { segurar: 60 });
      await b.verTexto('“Rever orçamento” sobrepõe-se a “Meditar”.');
    });

    await passo('largar um bloco na bandeja devolve-o, e a semana reflete o calendário', async () => {
      const de = await celula(b, 2, 7.5);
      const bandeja = await b.procurar('Por alocar', { exato: false });
      // O bloco ficou na metade direita da coluna de quarta, lado a lado com "Meditar".
      await b.arrastar({ x: de.x + 12, y: de.y }, { x: bandeja.x, y: bandeja.y + 30 }, { passos: 24, segurar: 500 });
      await b.verTexto('Rever orçamento · 1 h');
      await naoHaBloco(b, 'Rever orçamento, quarta');
      await b.clicar('Semana');
      await b.verTexto('7/7');
      await b.verTexto('14 h');
    });

    await passo('mexer num bloco de uma tarefa recorrente pergunta "só esta semana" ou "esta e as seguintes"', async () => {
      await b.clicar('Calendário');
      // Pela folha: terça passa das 6:30 para as 7:00, só esta semana.
      let p = await celula(b, 1, 7.6);
      await b.clicarEm(p.x, p.y);
      await b.clicar('Mais hora de início');
      await b.clicar('Guardar o novo horário');
      await b.verTexto('Mudar “Meditar” para terça, 07:00–09:00?');
      await b.clicar('Só esta semana');
      await haBloco(b, 'Meditar, terça, 07:00–09:00');
      await b.verTexto('Mudado só nesta semana');
      await b.clicar('Fechar', { indice: 1 });
      // A arrastar: quarta passa para o meio-dia, nesta semana e nas seguintes. Até responder, o bloco não sai do sítio.
      await b.arrastar(await celula(b, 2, 7), await celula(b, 2, 12.5), { segurar: 500 });
      await b.verTexto('Mudar “Meditar” para qua, 12:00–14:00?');
      await haBloco(b, 'Meditar, quarta, 06:30–08:30');
      await b.clicar('Esta e as seguintes');
      await haBloco(b, 'Meditar, quarta, 12:00–14:00');
    });

    await passo('a proposta da semana seguinte copia os blocos recorrentes e os "Ocupado", e destaca o que precisa de atenção', async () => {
      await b.clicar('Semana');
      await b.clicar('Semana seguinte');
      await b.verTexto('Como quer começar esta semana?');
      await b.clicar('Criar proposta');
      await b.verTexto('Proposta por aceitar');
      await b.verTexto('1 sobreposição');
      await b.verTexto('Seg 08:00–08:30 · Meditar e Reunião');
      await b.verTexto('1 área sem tempo no calendário');
      await b.verTexto('2 h · vem da semana passada'); // "Curso online" voltou a "Por alocar"
      await b.clicar('Rever no calendário');
      await b.verTexto('Proposta por aceitar · 1 sobreposição');
      await haBlocos(b, 'Meditar', 7);
      await haBloco(b, 'Meditar, segunda, 06:30–08:30, sobreposto a outro bloco');
      await haBloco(b, 'Meditar, terça, 06:30–08:30'); // a exceção de terça não passou
      await haBloco(b, 'Meditar, quarta, 12:00–14:00'); // o hábito novo de quarta passou
      await haBloco(b, 'Reunião, segunda, 08:00–09:00');
      await b.verTexto('vem da semana passada');
      if (await b.avaliar(`${contar('Meditar, ')} > 0 && [...document.querySelectorAll('[aria-label*=", feito"]')].filter((e) => !e.closest('[inert]')).length`)) throw new Error('o estado "feito" foi copiado');
    });

    await passo('rever a proposta: apagar o que não se repete e aceitar', async () => {
      const p = await celula(b, 0, 8.75);
      await b.clicarEm(p.x + 12, p.y);
      await b.clicar('Apagar bloco');
      await naoHaBloco(b, 'Reunião, segunda');
      await b.verTexto('Proposta por aceitar');
      await b.naoVerTexto('sobreposição');
      await b.clicar('Aceitar semana');
      await b.naoVerTexto('Proposta por aceitar');
      await b.clicar('Semana');
      await b.naoVerTexto('Proposta por aceitar');
      await b.verTexto('7/7');
    });
  },

  /** Fase 4: revisão semanal (critérios 7 e 8). */
  async revisao(b, passo) {
    await passo('prepara uma semana com blocos feitos e por marcar', async () => {
      await comecar(b, ['Espiritual', 'Trabalho']);
      await b.clicar('Semana');
      await b.verTexto('Planear a semana');
      await criarTarefa(b, 'Espiritual', 'Meditar', { mais: 2, repeticao: 'Todos os dias' });
      await criarTarefa(b, 'Trabalho', 'Curso online', { mais: 2 });
      await criarTarefa(b, 'Trabalho', 'Rever orçamento');
      await b.clicar('Áreas');
      await b.clicar('Espiritual');
      await criarMeta(b, 'Conseguir meditar 1 h seguida', { de: 20, para: 60, unidade: 'min seguidos' });
      await criarMeta(b, 'Fazer um retiro de silêncio');
      await b.avaliar('history.back()');
      await b.clicar('Calendário');
      await b.clicar('Meditar · 2 h');
      let p = await celula(b, 0, 6.6);
      await b.clicarEm(p.x, p.y);
      await b.clicar('Alocar');
      await haBlocos(b, 'Meditar', 7);
      await b.clicar('Curso online · 2 h');
      p = await celula(b, 3, 9.1);
      await b.clicarEm(p.x, p.y);
      await haBloco(b, 'Curso online, quinta, 09:00–11:00');
      for (const dia of [0, 1]) {
        p = await celula(b, dia, 7);
        await b.clicarEm(p.x, p.y);
        await b.clicar('Marcar como feito');
        await b.verTexto('Desmarcar como feito');
        await b.clicar('Fechar', { indice: 1 });
        await b.naoVerTexto('Desmarcar como feito');
      }
    });

    await passo('antes do dia da revisão, o ecrã mostra só como a semana vai', async () => {
      if (HOJE === 'domingo') return; // ao domingo a revisão já está aberta
      await b.clicar('Revisão');
      await b.verTexto('A revisão desta semana abre domingo');
      await b.verTexto('de 17 h planeadas');
      await b.verTexto('Vai em 24% do plano.');
      await b.naoVerTexto('REFLEXÃO');
    });

    await passo('nas definições, a revisão passa para hoje e aparece o atalho', async () => {
      await b.clicar('Áreas');
      await b.clicar('Definições');
      await b.clicar(HOJE);
      await b.verTexto(`A revisão da semana fica disponível a partir de ${HOJE}.`);
      await b.avaliar('history.back()');
      await b.verTexto(`Revisão de ${HOJE}`);
      await b.verTexto(`Como correu a semana de ${descreverSemanaPorExtenso(ESTA)}?`);
    });

    await passo('horas feitas por área, "Feito?" e o que ficou por fazer', async () => {
      await b.clicar(`Revisão de ${HOJE}`);
      await b.verTexto('Cumpriu 24% do plano.');
      await b.verTexto('4 de 14 h');
      await b.verTexto('0 de 3 h');
      await b.verTexto(`As tarefas marcadas passam para a semana de ${descreverSemanaPorExtenso(SEGUINTE)}.`);
      await b.clicar('Meditar: feito');
      await b.verTexto('Cumpriu 35% do plano.');
      await b.clicar('Meditar: não foi feito');
    });

    await passo('como estão as suas metas: atualizar o valor e marcar o marco como alcançado', async () => {
      await b.verTexto('COMO ESTÃO AS SUAS METAS?');
      await b.clicar('Valor atual de Conseguir meditar 1 h seguida');
      await b.avaliar('document.activeElement.select()');
      await b.escrever('25');
      await b.clicar('Registar o valor de Conseguir meditar 1 h seguida');
      await b.verTexto('25 de 60 min seguidos');
      await b.verTexto('Registado hoje: 25.');
      await b.clicar('Fazer um retiro de silêncio: alcançada');
      await b.verTexto('Fazer um retiro de silêncio — concluída');
    });

    await passo('fechar abre a proposta da semana seguinte, com a tarefa escolhida a passar', async () => {
      await b.clicar('Rever orçamento, Trabalho · 1 h'); // desmarca: esta não passa
      await b.clicar('O que correu bem?');
      await b.escrever('Meditei quase todos os dias.');
      await b.esperar(900);
      await b.clicar(`Planear a semana de ${descreverSemanaPorExtenso(SEGUINTE)}`);
      await b.verTexto(descreverSemanaComAno(SEGUINTE));
      await b.verTexto('Proposta por aceitar');
      await b.verTexto('Igual à semana passada');
      await b.verTexto('2 h · vem da semana passada');
      await b.verTexto('7/7'); // os blocos de "Meditar" vieram copiados
      await b.naoVerTexto('7/7 feitas');
      await b.naoVerTexto('Rever orçamento');
      if (!b.dialogos.some((d) => d.includes('blocos por marcar'))) throw new Error('não avisou dos blocos por marcar');
    });

    await passo('a revisão fica fechada, com as notas, e o atalho desaparece', async () => {
      await b.clicar('Revisão');
      await b.verTexto('Revisão fechada.');
      await b.verTexto('passou para a semana seguinte');
      await b.ate(`document.querySelector('[aria-label="O que correu bem?"]')?.value === 'Meditei quase todos os dias.'`, 'a nota guardada');
      await b.clicar('Áreas');
      await b.naoVerTexto('Como correu a semana');
    });
  },

  /** Primeiro arranque, definições e cópia de segurança (critério 11). */
  async arranque(b, passo) {
    const descargas = path.join(PASTA, 'descargas');
    rmSync(descargas, { recursive: true, force: true });
    mkdirSync(descargas, { recursive: true });
    await b.enviar('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: descargas });
    let ficheiro;

    await passo('primeiro arranque em três passos', async () => {
      await b.ir('/', 'Uma semana alinhada');
      await b.clicar('Continuar');
      for (const area of ['Espiritual', 'Trabalho', 'Família', 'Família']) await b.clicar(area);
      await b.clicar('Continuar');
      await b.clicar('sexta');
      await b.clicar('Mais hora da revisão');
      await b.verTexto('18:30');
      await b.clicar('Começar');
      await b.verTexto('2 de 7 no máximo');
      await b.naoVerTexto('Família');
    });

    await passo('as definições guardam o dia e a hora da revisão', async () => {
      await b.clicar('Definições');
      await b.verTexto('A revisão da semana fica disponível a partir de sexta.');
      await b.verTexto('18:30');
      await b.clicar('Mais última hora do calendário');
      await b.verTexto('24:00');
    });

    await passo('exporta os dados para um ficheiro', async () => {
      await b.clicar('Exportar dados');
      for (let i = 0; i < 50 && !(ficheiro = readdirSync(descargas).find((f) => f.endsWith('.json'))); i++) await b.esperar(200);
      if (!ficheiro) throw new Error('o ficheiro não foi descarregado');
      const copia = JSON.parse(readFileSync(path.join(descargas, ficheiro), 'utf8'));
      if (copia.app !== 'align' || copia.dados.areas.length !== 2 || copia.dados.definicoes[0].diaRevisao !== 5) throw new Error('a cópia não tem o que devia');
    });

    await passo('depois de mudar os dados, importar repõe a cópia', async () => {
      await b.avaliar('history.back()');
      await b.clicar('Nova área');
      await b.clicar('Nome da área');
      await b.escrever('Saúde');
      await b.clicar('Criar área');
      await b.ate(`document.querySelector('[aria-label="Nome da área"]')?.value === 'Saúde'`, 'o detalhe da área Saúde');
      await b.avaliar('history.back()');
      await b.verTexto('3 de 7 no máximo');

      await b.clicar('Definições');
      await b.enviar('Page.setInterceptFileChooserDialog', { enabled: true });
      const escolha = new Promise((resolver) => b.aoEvento('Page.fileChooserOpened', resolver));
      await b.clicar('Importar dados');
      const { backendNodeId } = await escolha;
      await b.enviar('DOM.setFileInputFiles', { files: [path.join(descargas, ficheiro)], backendNodeId });
      for (let i = 0; i < 50 && !b.dialogos.some((d) => d.includes('Dados importados')); i++) await b.esperar(200);
      if (!b.dialogos.some((d) => d.includes('Importar esta cópia?'))) throw new Error('não pediu confirmação');
      if (!b.dialogos.some((d) => d.includes('Dados importados'))) throw new Error('a importação não terminou');
      await b.avaliar('history.back()');
      await b.verTexto('2 de 7 no máximo');
      await b.naoVerTexto('Saúde');
    });

    await passo('uma app já usada não volta ao primeiro arranque', async () => {
      await b.ir('/', 'As minhas áreas');
      await b.verTexto('2 de 7 no máximo');
    });
  },

  /** Manter premido e arrastar para reordenar as áreas. */
  async ordem(b, passo) {
    const ordem = () =>
      b.avaliar(
        `['Espiritual', 'Família', 'Trabalho'].map((n) => { const e = [...document.querySelectorAll('*')].find((x) => x.children.length === 0 && x.textContent.trim() === n && !x.closest('[inert]')); return [n, e ? e.getBoundingClientRect().top : -1]; }).sort((a, c) => a[1] - c[1]).map((p) => p[0]).join()`,
      );

    await passo('arrastar uma área muda a ordem e fica guardado', async () => {
      await comecar(b, ['Espiritual', 'Família', 'Trabalho']);
      await b.verTexto('Mantenha uma área premida e arraste para mudar a ordem.');
      const trabalho = await b.procurar('Trabalho');
      const espiritual = await b.procurar('Espiritual');
      await b.arrastar(trabalho, { x: trabalho.x, y: espiritual.y - 20 }, { segurar: 600 });
      await b.esperar(500);
      if ((await ordem()) !== 'Trabalho,Espiritual,Família') throw new Error(`ordem inesperada: ${await ordem()}`);
      await b.ir('/', 'As minhas áreas');
      if ((await ordem()) !== 'Trabalho,Espiritual,Família') throw new Error('a ordem não ficou guardada');
    });

    await passo('um toque simples continua a abrir a área', async () => {
      await b.clicar('Família');
      await b.ate(`document.querySelector('[aria-label="Nome da área"]')?.value === 'Família'`, 'o detalhe da área Família');
    });
  },
};

const pedidos = process.argv.slice(2);
const nomes = pedidos.length ? pedidos : Object.keys(cenarios);
const desconhecido = nomes.find((nome) => !(nome in cenarios));
if (desconhecido) {
  console.error(`Não conheço o cenário "${desconhecido}". Há: ${Object.keys(cenarios).join(', ')}.`);
  process.exit(2);
}
if (!(await fetch(APP).then((r) => r.ok, () => false))) {
  console.error(`A app não está a ser servida em ${APP}. Arranque-a com "npx expo start --web" e tente outra vez.`);
  process.exit(2);
}

let falhas = 0;
for (const [indice, nome] of nomes.entries()) {
  console.log(`\n${nome}`);
  const b = await abrirNavegador(nome, { porta: 9400 + indice });
  const passo = async (descricao, acao) => {
    try {
      await acao();
      console.log(`  ok    ${descricao}`);
    } catch (erro) {
      console.log(`  FALHA ${descricao}\n        ${erro.message}\n        captura: ${await b.capturar('falha').catch(() => 'indisponível')}`);
      throw erro;
    }
  };
  try {
    await cenarios[nome](b, passo);
  } catch {
    falhas += 1;
  } finally {
    // Erros que o utilizador veria: exceções na consola e avisos de falha da própria app.
    const problemas = [...b.consola.filter((linha) => /^\[(error|exception)\]/.test(linha)), ...b.dialogos.filter((d) => d.includes('Não foi possível'))];
    for (const problema of problemas.slice(0, 10)) console.log(`  aviso ${problema.slice(0, 300)}`);
    if (problemas.length) falhas += 1;
    await b.fechar();
  }
}
console.log(falhas ? `\n${falhas} problema(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
