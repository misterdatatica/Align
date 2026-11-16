/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas, semanas, tarefasSemana } from '../db/schema.ts';
import { alocarTarefa, carregarCalendario, criarOcupado, marcarBlocoFeito, moverBloco, retirarBloco } from './calendario.ts';
import { fecharRevisao } from './revisao.ts';
import { abrirProposta, aceitarSemana, carregarPlanoDaSemana, criarProposta, marcarSemanaModelo } from './semanas.ts';
import { carregarPlano, criarTarefa, editarTarefa, garantirSemana } from './tarefas.ts';

// Quatro semanas seguidas; "hoje" é o domingo da primeira (o dia da revisão).
const S1 = '2026-11-09';
const S2 = '2026-11-16';
const S3 = '2026-11-23';
const S4 = '2026-11-30';
const HOJE = new Date(2026, 10, 15);
const DOMINGO = '2026-11-15';
const dia = (semana: string, n: number) => {
  const d = new Date(Number(semana.slice(0, 4)), Number(semana.slice(5, 7)) - 1, Number(semana.slice(8)) + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function novaArea(nome: string, cor = 'violeta'): number {
  return db.insert(areas).values({ nome, cor, icone: 'folha' }).returning({ id: areas.id }).get().id;
}

/**
 * A primeira semana, já vivida: Meditar de segunda a sexta às 6:30 (2 feitos), Treino terça e quinta
 * às 18:00, uma lição sem duração, três tarefas únicas (uma feita, uma no calendário por fazer, uma
 * por alocar) e um compromisso "Médico" à quarta. A área Família não tem nada.
 */
function primeiraSemana() {
  garantirSemana(S1, HOJE);
  const espiritual = novaArea('Espiritual');
  const trabalho = novaArea('Trabalho', 'azul');
  novaArea('Família', 'laranja');
  const meditar = criarTarefa({ areaId: espiritual, nome: 'Meditar', duracaoMin: 120, recorrencia: { tipo: 'diaria' } }, S1);
  const treino = criarTarefa({ areaId: espiritual, nome: 'Treino', duracaoMin: 60, recorrencia: { tipo: 'vezes_por_semana', vezes: 2 } }, S1);
  criarTarefa({ areaId: espiritual, nome: 'Lição', duracaoMin: null, recorrencia: { tipo: 'diaria' } }, S1);
  const curso = criarTarefa({ areaId: trabalho, nome: 'Curso online', duracaoMin: 120, recorrencia: null }, S1);
  const orcamento = criarTarefa({ areaId: trabalho, nome: 'Rever orçamento', duracaoMin: 60, recorrencia: null }, S1);
  const avos = criarTarefa({ areaId: trabalho, nome: 'Ligar aos avós', duracaoMin: 30, recorrencia: null }, S1);

  const blocosMeditar = [0, 1, 2, 3, 4].map((n) => alocarTarefa(meditar, S1, dia(S1, n), 390));
  marcarBlocoFeito(blocosMeditar[0], true);
  marcarBlocoFeito(blocosMeditar[1], true);
  alocarTarefa(treino, S1, dia(S1, 1), 18 * 60);
  alocarTarefa(treino, S1, dia(S1, 3), 18 * 60);
  alocarTarefa(curso, S1, dia(S1, 3), 9 * 60);
  marcarBlocoFeito(alocarTarefa(orcamento, S1, dia(S1, 1), 9 * 60), true);
  criarOcupado(dia(S1, 2), 14 * 60, 15 * 60, 'Médico');
  return { meditar, treino, curso, orcamento, avos };
}

/** Os blocos de uma semana como "Nome dia hora-de-início", pela ordem do calendário. */
const blocosDe = (semana: string, nome?: string) =>
  carregarCalendario(semana)
    .blocos.filter((b) => !nome || b.nome === nome)
    .map((b) => `${b.nome} ${b.dia} ${b.inicioMin}-${b.fimMin}${b.feito ? ' feito' : ''}`);
const porAlocar = (semana: string) => carregarCalendario(semana).porAlocar.map((t) => `${t.nome} ×${t.quantas}${t.veioDaSemanaPassada ? ' (vem da semana passada)' : ''}`);
const blocoEm = (semana: string, nome: string, n: number) => {
  const bloco = carregarCalendario(semana).blocos.find((b) => b.nome === nome && b.dia === n);
  assert.ok(bloco, `${nome} no dia ${n} de ${semana}`);
  return bloco;
};

beforeEach(() => prepararBd());

describe('planear uma semana nova', () => {
  it('a primeira semana de todas começa aceite; as seguintes esperam que se escolha a origem', () => {
    assert.equal(carregarPlanoDaSemana(S1, DOMINGO).estado, 'por_planear');
    primeiraSemana();
    assert.equal(carregarPlanoDaSemana(S1, DOMINGO).estado, 'aceite');

    assert.equal(garantirSemana(S2, HOJE), 0, 'abrir a semana seguinte já não cria nada sozinho');
    const plano = carregarPlanoDaSemana(S2, DOMINGO);
    assert.deepEqual(
      { estado: plano.estado, origens: plano.origens, porOmissao: plano.origemPorOmissao, ultima: plano.ultimaPlaneada, pode: plano.podePlanear, atencao: plano.atencao },
      { estado: 'por_planear', origens: ['passada', 'vazia'], porOmissao: 'passada', ultima: S1, pode: true, atencao: null },
    );
    assert.equal(carregarPlano(S2).areas.flatMap((a) => a.tarefas).length, 0);
    assert.equal(carregarPlanoDaSemana('2026-11-02', DOMINGO).podePlanear, false, 'as semanas que já passaram não se planeiam');
    assert.throws(() => criarProposta('2026-11-02', 'vazia', HOJE), /atual e as seguintes/);
  });

  it('igual à semana passada: copia os blocos recorrentes e os "Ocupado" para o mesmo dia e hora', () => {
    primeiraSemana();
    criarProposta(S2, 'passada', HOJE);

    assert.deepEqual(blocosDe(S2), [
      'Meditar 0 390-510',
      'Meditar 1 390-510',
      'Treino 1 1080-1140',
      'Meditar 2 390-510',
      'Médico 2 840-900',
      'Meditar 3 390-510',
      'Treino 3 1080-1140',
      'Meditar 4 390-510',
    ]);
    const plano = carregarPlanoDaSemana(S2, DOMINGO);
    assert.deepEqual([plano.estado, plano.origem, plano.origemSemana], ['rascunho', 'passada', S1], 'é uma proposta, ainda por aceitar');
  });

  it('o estado "feito" nunca é copiado, e as tarefas únicas feitas ficam para trás', () => {
    const { orcamento } = primeiraSemana();
    criarProposta(S2, 'passada', HOJE);
    assert.ok(carregarCalendario(S2).blocos.every((b) => !b.feito));
    assert.ok(db.select().from(tarefasSemana).where(eq(tarefasSemana.semana, S2)).all().every((i) => i.estado === 'alocada' || i.estado === 'por_alocar'));
    const plano = carregarPlano(S2);
    assert.equal(plano.minutosFeitos, 0);
    assert.equal(db.select().from(tarefasSemana).where(eq(tarefasSemana.tarefaId, orcamento)).all().filter((i) => i.semana === S2).length, 0, '"Rever orçamento" foi feita: não passa');
    const licao = plano.areas.flatMap((a) => a.tarefas).find((t) => t.nome === 'Lição');
    assert.deepEqual([licao?.total, licao?.feitas], [7, 0], 'as tarefas sem duração recomeçam a contagem');
  });

  it('as tarefas únicas por fazer vão para "Por alocar" com a marca "vem da semana passada"', () => {
    primeiraSemana();
    criarProposta(S2, 'passada', HOJE);
    assert.deepEqual(porAlocar(S2), ['Meditar ×2', 'Curso online ×1 (vem da semana passada)', 'Ligar aos avós ×1 (vem da semana passada)']);
    assert.deepEqual(blocosDe(S2, 'Curso online'), [], 'o bloco do curso não é copiado: a tarefa volta a "Por alocar"');
  });

  it('respeita o que foi marcado na revisão, feita antes ou depois da proposta', () => {
    const { curso, avos } = primeiraSemana();
    // Revisão primeiro: só o curso passa.
    fecharRevisao(S1, [curso], HOJE);
    assert.equal(abrirProposta(S2, HOJE), 'rascunho');
    assert.deepEqual(porAlocar(S2), ['Meditar ×2', 'Curso online ×1 (vem da semana passada)']);

    // Proposta primeiro (leva as duas), revisão depois: a que foi desmarcada sai, se ninguém lhe mexeu.
    prepararBd();
    const outra = primeiraSemana();
    criarProposta(S2, 'passada', HOJE);
    alocarTarefa(outra.avos, S2, dia(S2, 0), 20 * 60);
    fecharRevisao(S1, [], HOJE);
    assert.deepEqual(porAlocar(S2), ['Meditar ×2'], 'o curso, desmarcado e ainda por alocar, saiu');
    assert.deepEqual(blocosDe(S2, 'Ligar aos avós'), ['Ligar aos avós 0 1200-1230'], 'a que já tinha lugar no calendário fica');
    assert.ok(avos > 0);
  });

  it('destaca as sobreposições e as áreas sem nenhum tempo', () => {
    primeiraSemana();
    criarOcupado(dia(S1, 0), 6 * 60, 7 * 60, 'Levar o carro');
    criarProposta(S2, 'passada', HOJE);
    const { atencao } = carregarPlanoDaSemana(S2, DOMINGO);
    assert.deepEqual(
      atencao?.sobreposicoes.map((s) => [s.dia, s.inicioMin, s.fimMin, s.a.nome, s.b.nome]),
      [[0, 390, 420, 'Levar o carro', 'Meditar']],
    );
    assert.deepEqual(atencao?.areasSemTempo.map((a) => a.nome), ['Trabalho', 'Família'], 'o curso passou, mas ainda não tem bloco');
  });

  it('a proposta só fica definitiva com "Aceitar semana"', () => {
    primeiraSemana();
    assert.throws(() => aceitarSemana(S2), /proposta/);
    criarProposta(S2, 'passada', HOJE);
    retirarBloco(blocoEm(S2, 'Médico', 2).id); // rever: o médico foi só na semana passada
    aceitarSemana(S2);
    const plano = carregarPlanoDaSemana(S2, DOMINGO);
    assert.deepEqual([plano.estado, plano.atencao], ['aceite', null]);
    assert.throws(() => criarProposta(S2, 'vazia', HOJE), /já foi aceite/);
    assert.equal(abrirProposta(S2, HOJE), 'aceite', 'abrir a proposta de uma semana aceite não a refaz');
    assert.equal(blocosDe(S2).length, 7);
  });

  it('começar vazia: as tarefas recorrentes ficam por alocar e o calendário sem blocos', () => {
    primeiraSemana();
    criarProposta(S2, 'vazia', HOJE);
    assert.deepEqual(blocosDe(S2), []);
    assert.deepEqual(porAlocar(S2), ['Meditar ×7', 'Treino ×2', 'Curso online ×1 (vem da semana passada)', 'Ligar aos avós ×1 (vem da semana passada)']);
    assert.deepEqual([carregarPlanoDaSemana(S2, DOMINGO).origem, carregarPlanoDaSemana(S2, DOMINGO).origemSemana], ['vazia', null]);
  });

  it('mudar a origem de uma proposta refaz a proposta sem duplicar tarefas', () => {
    primeiraSemana();
    criarProposta(S2, 'passada', HOJE);
    criarOcupado(dia(S2, 5), 10 * 60, 11 * 60, 'Mercado');
    criarProposta(S2, 'vazia', HOJE);
    assert.deepEqual(blocosDe(S2), []);
    criarProposta(S2, 'passada', HOJE);
    assert.equal(blocosDe(S2).length, 8);
    assert.deepEqual(porAlocar(S2), ['Meditar ×2', 'Curso online ×1 (vem da semana passada)', 'Ligar aos avós ×1 (vem da semana passada)']);
    assert.equal(db.select().from(tarefasSemana).where(eq(tarefasSemana.semana, S2)).all().length, 7 + 2 + 7 + 2);
  });

  it('salta as semanas sem plano: "semana passada" é a última que foi planeada', () => {
    primeiraSemana();
    const plano = carregarPlanoDaSemana(S3, DOMINGO);
    assert.equal(plano.ultimaPlaneada, S1);
    criarProposta(S3, 'passada', HOJE);
    assert.equal(blocosDe(S3, 'Meditar').length, 5);
    assert.equal(carregarPlanoDaSemana(S3, DOMINGO).origemSemana, S1);
  });
});

describe('semana modelo', () => {
  it('marca-se e desmarca-se qualquer semana planeada, e só há uma de cada vez', () => {
    primeiraSemana();
    assert.throws(() => marcarSemanaModelo(S2, true), /Planeie/);
    criarProposta(S2, 'passada', HOJE);
    marcarSemanaModelo(S1, true);
    assert.deepEqual([carregarPlanoDaSemana(S1, DOMINGO).modelo, carregarPlanoDaSemana(S2, DOMINGO).semanaModelo], [true, S1]);
    marcarSemanaModelo(S2, true);
    assert.deepEqual(
      db.select({ semana: semanas.semana, modelo: semanas.modelo }).from(semanas).orderBy(semanas.semana).all(),
      [
        { semana: S1, modelo: false },
        { semana: S2, modelo: true },
      ],
    );
    marcarSemanaModelo(S2, false);
    assert.equal(carregarPlanoDaSemana(S3, DOMINGO).semanaModelo, null);
    assert.deepEqual(carregarPlanoDaSemana(S3, DOMINGO).origens, ['passada', 'vazia']);
  });

  it('igual à semana modelo: copia a semana típica, mesmo que a passada tenha sido diferente', () => {
    const { meditar, treino } = primeiraSemana();
    marcarSemanaModelo(S1, true);
    // A segunda semana foi atípica: sem treinos e com a meditação de segunda noutra hora.
    criarProposta(S2, 'passada', HOJE);
    aceitarSemana(S2);
    retirarBloco(blocoEm(S2, 'Treino', 1).id);
    retirarBloco(blocoEm(S2, 'Treino', 3).id);
    const segunda = blocoEm(S2, 'Meditar', 0);
    moverBloco(segunda.id, dia(S2, 0), 21 * 60, 23 * 60);
    criarOcupado(dia(S2, 4), 10 * 60, 12 * 60, 'Feriado');

    assert.deepEqual(carregarPlanoDaSemana(S3, DOMINGO).origens, ['passada', 'modelo', 'vazia']);
    criarProposta(S3, 'modelo', HOJE);
    assert.deepEqual(blocosDe(S3, 'Treino'), ['Treino 1 1080-1140', 'Treino 3 1080-1140']);
    assert.deepEqual(blocosDe(S3, 'Meditar')[0], 'Meditar 0 390-510');
    assert.deepEqual(blocosDe(S3, 'Médico'), ['Médico 2 840-900'], 'os "Ocupado" vêm da semana modelo…');
    assert.deepEqual(blocosDe(S3, 'Feriado'), [], '…e não da semana passada');
    assert.deepEqual([carregarPlanoDaSemana(S3, DOMINGO).origem, carregarPlanoDaSemana(S3, DOMINGO).origemSemana], ['modelo', S1]);
    assert.ok(meditar > 0 && treino > 0);
  });

  it('reconhece a tarefa mesmo depois de alterada, e usa a duração de agora', () => {
    const { meditar } = primeiraSemana();
    marcarSemanaModelo(S1, true);
    criarProposta(S2, 'passada', HOJE);
    aceitarSemana(S2);
    // Alterar em S2 cria uma versão nova da tarefa (a S1 fica com a antiga).
    const nova = editarTarefa(meditar, S2, { areaId: 1, nome: 'Meditar', duracaoMin: 60, recorrencia: { tipo: 'diaria' } });
    assert.notEqual(nova, meditar);

    criarProposta(S3, 'modelo', HOJE);
    assert.deepEqual(blocosDe(S3, 'Meditar'), ['Meditar 0 390-450', 'Meditar 1 390-450', 'Meditar 2 390-450', 'Meditar 3 390-450', 'Meditar 4 390-450']);
  });
});

describe('só esta semana ou esta e as seguintes', () => {
  /** Três semanas: a primeira vivida, a segunda aceite e a terceira já proposta. */
  function tresSemanas() {
    const ids = primeiraSemana();
    criarProposta(S2, 'passada', HOJE);
    aceitarSemana(S2);
    criarProposta(S3, 'passada', HOJE);
    return ids;
  }

  it('mover só esta semana: a semana seguinte volta ao horário habitual', () => {
    primeiraSemana();
    criarProposta(S2, 'passada', HOJE);
    const bloco = blocoEm(S2, 'Meditar', 0);
    assert.deepEqual([bloco.recorrente, bloco.soEstaSemana], [true, false]);
    moverBloco(bloco.id, dia(S2, 0), 20 * 60, 22 * 60, 'semana');
    assert.deepEqual(blocosDe(S2, 'Meditar')[0], 'Meditar 0 1200-1320');
    assert.equal(blocoEm(S2, 'Meditar', 0).soEstaSemana, true);

    criarProposta(S3, 'passada', HOJE);
    assert.deepEqual(blocosDe(S3, 'Meditar')[0], 'Meditar 0 390-510');

    // Voltar a pôr o bloco no sítio desfaz a exceção.
    moverBloco(bloco.id, dia(S2, 0), 390, 510, 'semana');
    assert.equal(blocoEm(S2, 'Meditar', 0).soEstaSemana, false);
  });

  it('mover esta e as seguintes: muda as semanas que já existem e as que vierem', () => {
    tresSemanas();
    moverBloco(blocoEm(S2, 'Meditar', 0).id, dia(S2, 0), 7 * 60, 9 * 60, 'seguintes');
    assert.deepEqual(blocosDe(S2, 'Meditar')[0], 'Meditar 0 420-540');
    assert.deepEqual(blocosDe(S3, 'Meditar')[0], 'Meditar 0 420-540', 'a semana seguinte, já proposta, acompanha');
    assert.deepEqual(blocosDe(S3, 'Meditar')[1], 'Meditar 1 390-510', 'os outros dias ficam como estavam');
    assert.deepEqual(blocosDe(S1, 'Meditar')[0], 'Meditar 0 390-510 feito', 'as semanas anteriores não mudam');
    assert.equal(blocoEm(S2, 'Meditar', 0).soEstaSemana, false);

    aceitarSemana(S3);
    criarProposta(S4, 'passada', HOJE);
    assert.deepEqual(blocosDe(S4, 'Meditar')[0], 'Meditar 0 420-540');
  });

  it('mudar de dia esta e as seguintes leva o bloco para o mesmo dia nas outras semanas', () => {
    tresSemanas();
    moverBloco(blocoEm(S2, 'Treino', 1).id, dia(S2, 5), 10 * 60, 11 * 60, 'seguintes');
    assert.deepEqual(blocosDe(S3, 'Treino'), ['Treino 3 1080-1140', 'Treino 5 600-660']);
  });

  it('retirar só esta semana: fica por alocar aqui e volta na semana seguinte', () => {
    primeiraSemana();
    criarProposta(S2, 'passada', HOJE);
    retirarBloco(blocoEm(S2, 'Treino', 1).id, 'semana');
    assert.deepEqual(blocosDe(S2, 'Treino'), ['Treino 3 1080-1140']);
    assert.ok(porAlocar(S2).includes('Treino ×1'));

    criarProposta(S3, 'passada', HOJE);
    assert.deepEqual(blocosDe(S3, 'Treino'), ['Treino 1 1080-1140', 'Treino 3 1080-1140']);
  });

  it('retirar esta e as seguintes: sai também das semanas que já existem e não volta', () => {
    tresSemanas();
    retirarBloco(blocoEm(S2, 'Treino', 1).id, 'seguintes');
    assert.deepEqual(blocosDe(S2, 'Treino'), ['Treino 3 1080-1140']);
    assert.deepEqual(blocosDe(S3, 'Treino'), ['Treino 3 1080-1140']);
    assert.ok(porAlocar(S3).includes('Treino ×1'), 'a tarefa continua a repetir: fica por alocar');

    aceitarSemana(S3);
    criarProposta(S4, 'passada', HOJE);
    assert.deepEqual(blocosDe(S4, 'Treino'), ['Treino 3 1080-1140']);
  });

  it('uma exceção numa semana seguinte mantém-se, mas passa a voltar ao horário novo', () => {
    tresSemanas();
    // Em S3 a meditação de segunda foi mudada só nessa semana…
    moverBloco(blocoEm(S3, 'Meditar', 0).id, dia(S3, 0), 21 * 60, 23 * 60, 'semana');
    // …e depois, em S2, o hábito de segunda muda para as 7:00.
    moverBloco(blocoEm(S2, 'Meditar', 0).id, dia(S2, 0), 7 * 60, 9 * 60, 'seguintes');
    assert.deepEqual(blocosDe(S3, 'Meditar')[0], 'Meditar 0 1260-1380', 'a exceção de S3 fica onde está');

    aceitarSemana(S3);
    criarProposta(S4, 'passada', HOJE);
    assert.deepEqual(blocosDe(S4, 'Meditar')[0], 'Meditar 0 420-540', 'a semana seguinte copia o hábito novo');
  });

  it('os blocos de tarefas únicas e os "Ocupado" não têm âmbito', () => {
    const { curso } = primeiraSemana();
    criarProposta(S2, 'passada', HOJE);
    const idCurso = alocarTarefa(curso, S2, dia(S2, 0), 10 * 60);
    assert.equal(carregarCalendario(S2).blocos.find((b) => b.id === idCurso)?.recorrente, false);
    moverBloco(idCurso, dia(S2, 1), 10 * 60, 12 * 60, 'semana');
    assert.equal(carregarCalendario(S2).blocos.find((b) => b.id === idCurso)?.soEstaSemana, false);
    const medico = blocoEm(S2, 'Médico', 2);
    assert.equal(medico.recorrente, false);
    retirarBloco(medico.id, 'semana');
    assert.deepEqual(blocosDe(S2, 'Médico'), []);
  });
});
