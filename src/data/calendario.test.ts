/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { asc, eq } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas, blocos, tarefasSemana } from '../db/schema.ts';
import { disporDia, encaixar, fimEncaixado, inicioEncaixado, limitesDaGrelha, sobrepostos } from '../domain/calendario.ts';
import { alocarRestantes, alocarTarefa, carregarCalendario, criarOcupado, marcarBlocoFeito, moverBloco, renomearOcupado, retirarBloco } from './calendario.ts';
import { guardarDefinicoes } from './definicoes.ts';
import { carregarPlano, criarTarefa } from './tarefas.ts';

const S1 = '2026-11-16';
const SEG = '2026-11-16';
const TER = '2026-11-17';
const QUI = '2026-11-19';

function novaArea(nome = 'Espiritual', cor = 'violeta'): number {
  return db.insert(areas).values({ nome, cor, icone: 'folha' }).returning({ id: areas.id }).get().id;
}

const estados = (tarefaId: number) =>
  db
    .select({ estado: tarefasSemana.estado })
    .from(tarefasSemana)
    .where(eq(tarefasSemana.tarefaId, tarefaId))
    .orderBy(asc(tarefasSemana.id))
    .all()
    .map((i) => i.estado);

beforeEach(() => prepararBd());

describe('geometria do calendário', () => {
  it('encaixa em meias horas sem sair da grelha', () => {
    assert.equal(encaixar(9 * 60 + 14), 9 * 60);
    assert.equal(encaixar(9 * 60 + 16), 9 * 60 + 30);
    assert.equal(inicioEncaixado(5 * 60, 120, 6 * 60, 23 * 60), 6 * 60, 'não começa antes da grelha');
    assert.equal(inicioEncaixado(22 * 60 + 20, 120, 6 * 60, 23 * 60), 21 * 60, 'não acaba depois da grelha');
    assert.equal(fimEncaixado(9 * 60 + 5, 9 * 60, 23 * 60), 9 * 60 + 30, 'um bloco tem pelo menos meia hora');
    assert.equal(fimEncaixado(23 * 60 + 50, 9 * 60, 23 * 60), 23 * 60);
  });

  it('põe lado a lado os blocos que se sobrepõem', () => {
    const d = disporDia([
      { id: 1, inicioMin: 540, fimMin: 660 },
      { id: 2, inicioMin: 600, fimMin: 720 },
      { id: 3, inicioMin: 690, fimMin: 780 },
      { id: 4, inicioMin: 780, fimMin: 840 },
    ]);
    assert.deepEqual(d.get(1), { coluna: 0, colunas: 2 });
    assert.deepEqual(d.get(2), { coluna: 1, colunas: 2 });
    assert.deepEqual(d.get(3), { coluna: 0, colunas: 2 }, 'sobrepõe-se ao bloco 2 e reutiliza a coluna que o bloco 1 deixou livre');
    assert.deepEqual(d.get(4), { coluna: 0, colunas: 1 }, 'começa quando o anterior acaba: não se sobrepõe, largura inteira');
  });

  it('encontra sobreposições e alarga a grelha para blocos fora de horas', () => {
    const blocosDoDia = [
      { id: 1, inicioMin: 540, fimMin: 660 },
      { id: 2, inicioMin: 660, fimMin: 720 },
    ];
    assert.deepEqual(
      sobrepostos(blocosDoDia, { id: 9, inicioMin: 600, fimMin: 690 }).map((b) => b.id),
      [1, 2],
    );
    assert.deepEqual(sobrepostos(blocosDoDia, { id: 1, inicioMin: 540, fimMin: 660 }), [], 'blocos seguidos não se sobrepõem');
    assert.deepEqual(limitesDaGrelha(6, 23, []), { inicioMin: 360, fimMin: 1380 });
    assert.deepEqual(limitesDaGrelha(6, 23, [{ inicioMin: 330, fimMin: 1400 }]), { inicioMin: 300, fimMin: 1440 });
  });
});

describe('alocar no calendário', () => {
  it('cria o bloco com a duração da tarefa e marca a instância como alocada', () => {
    const area = novaArea();
    const tarefa = criarTarefa({ areaId: area, nome: 'Preparar apresentação Q4', nomeCurto: 'Apres. Q4', duracaoMin: 180, recorrencia: null }, S1);
    const bloco = alocarTarefa(tarefa, S1, SEG, 9 * 60);
    assert.deepEqual(estados(tarefa), ['alocada']);

    const cal = carregarCalendario(S1);
    assert.equal(cal.blocos.length, 1);
    assert.deepEqual(
      { id: cal.blocos[0].id, dia: cal.blocos[0].dia, inicioMin: cal.blocos[0].inicioMin, fimMin: cal.blocos[0].fimMin, nomeCurto: cal.blocos[0].nomeCurto, cor: cal.blocos[0].cor },
      { id: bloco, dia: 0, inicioMin: 540, fimMin: 720, nomeCurto: 'Apres. Q4', cor: 'violeta' },
    );
    assert.equal(cal.porAlocar.length, 0);
    assert.throws(() => alocarTarefa(tarefa, S1, SEG, 10 * 60), /já está toda/);
    assert.throws(() => alocarTarefa(tarefa, S1, '2026-11-23', 10 * 60));
  });

  it('as 7 instâncias de uma tarefa diária enchem a meta (critério de aceitação 4)', () => {
    const area = novaArea();
    const tarefa = criarTarefa({ areaId: area, nome: 'Meditar', duracaoMin: 120, recorrencia: { tipo: 'diaria' } }, S1);
    let cal = carregarCalendario(S1);
    assert.deepEqual(
      cal.porAlocar.map((t) => [t.nome, t.quantas, t.duracaoMin]),
      [['Meditar', 7, 120]],
    );
    assert.equal(cal.minutosPorAlocar, 14 * 60);

    alocarTarefa(tarefa, S1, SEG, 6 * 60 + 30);
    assert.equal(alocarRestantes(tarefa, S1, 6 * 60 + 30), 6);
    cal = carregarCalendario(S1);
    assert.deepEqual(
      cal.blocos.map((b) => [b.dia, b.inicioMin]),
      [0, 1, 2, 3, 4, 5, 6].map((dia) => [dia, 390]),
    );
    assert.equal(cal.porAlocar.length, 0);
    const plano = carregarPlano(S1);
    assert.equal(plano.minutosCalendario, 14 * 60);
    assert.equal(plano.areas[0].tarefas[0].noCalendario, 7);
  });

  it('alocar o resto respeita os dias da recorrência e os blocos que já existem', () => {
    const tarefa = criarTarefa({ areaId: novaArea(), nome: 'Treino', duracaoMin: 90, recorrencia: { tipo: 'dias', dias: [2, 4] } }, S1);
    alocarTarefa(tarefa, S1, TER, 19 * 60);
    assert.equal(alocarRestantes(tarefa, S1, 19 * 60), 1);
    assert.deepEqual(
      carregarCalendario(S1).blocos.map((b) => b.dia),
      [1, 3],
    );
    assert.equal(alocarRestantes(tarefa, S1, 19 * 60), 0);
  });
});

describe('mexer nos blocos', () => {
  it('move, muda a duração e os totais acompanham (critério de aceitação 5)', () => {
    const tarefa = criarTarefa({ areaId: novaArea(), nome: 'Rever orçamento', duracaoMin: 120, recorrencia: null }, S1);
    const bloco = alocarTarefa(tarefa, S1, TER, 9 * 60);
    moverBloco(bloco, QUI, 14 * 60, 15 * 60);
    const cal = carregarCalendario(S1);
    assert.deepEqual([cal.blocos[0].dia, cal.blocos[0].inicioMin, cal.blocos[0].fimMin], [3, 840, 900]);
    assert.equal(carregarPlano(S1).minutosCalendario, 60);
    assert.throws(() => moverBloco(bloco, QUI, 600, 600), /horas/);
    assert.throws(() => moverBloco(bloco, '2026-11-25', 600, 660), /semana/);
  });

  it('marca como feito e desmarca', () => {
    const tarefa = criarTarefa({ areaId: novaArea(), nome: 'Jogo', duracaoMin: 120, recorrencia: null }, S1);
    const bloco = alocarTarefa(tarefa, S1, SEG, 10 * 60);
    marcarBlocoFeito(bloco, true);
    assert.deepEqual(estados(tarefa), ['feita']);
    assert.equal(carregarCalendario(S1).blocos[0].feito, true);
    assert.equal(carregarPlano(S1).minutosFeitos, 120);
    marcarBlocoFeito(bloco, false);
    assert.deepEqual(estados(tarefa), ['alocada']);
    assert.equal(carregarPlano(S1).minutosFeitos, 0);
  });

  it('devolve um bloco a "por alocar"', () => {
    const tarefa = criarTarefa({ areaId: novaArea(), nome: 'Jogo', duracaoMin: 120, recorrencia: null }, S1);
    const bloco = alocarTarefa(tarefa, S1, SEG, 10 * 60);
    marcarBlocoFeito(bloco, true);
    retirarBloco(bloco);
    assert.deepEqual(estados(tarefa), ['por_alocar']);
    const cal = carregarCalendario(S1);
    assert.equal(cal.blocos.length, 0);
    assert.equal(cal.porAlocar[0].quantas, 1);
  });
});

describe('blocos "Ocupado"', () => {
  it('aparecem na semana certa, sem área, e não contam como horas', () => {
    const id = criarOcupado(SEG, 14 * 60, 15 * 60, ' Reunião ');
    criarOcupado('2026-11-24', 14 * 60, 15 * 60);
    const cal = carregarCalendario(S1);
    assert.deepEqual(
      cal.blocos.map((b) => [b.tipo, b.nome, b.cor, b.dia]),
      [['ocupado', 'Reunião', null, 0]],
    );
    assert.equal(carregarPlano(S1).minutosCalendario, 0);

    renomearOcupado(id, '');
    assert.equal(carregarCalendario(S1).blocos[0].nome, 'Ocupado');
    assert.throws(() => marcarBlocoFeito(id, true), /Ocupado/);
    retirarBloco(id);
    assert.equal(db.select().from(blocos).all().length, 1);
  });

  it('sobrepostos a uma tarefa ficam lado a lado', () => {
    const tarefa = criarTarefa({ areaId: novaArea(), nome: 'E-mails', duracaoMin: 90, recorrencia: null }, S1);
    alocarTarefa(tarefa, S1, SEG, 14 * 60);
    criarOcupado(SEG, 14 * 60 + 30, 15 * 60 + 30);
    const cal = carregarCalendario(S1);
    assert.deepEqual(
      cal.blocos.map((b) => [b.tipo, b.coluna, b.colunas]),
      [
        ['tarefa', 0, 2],
        ['ocupado', 1, 2],
      ],
    );
  });
});

describe('grelha', () => {
  it('usa as horas das definições e alarga para blocos fora delas', () => {
    assert.deepEqual([carregarCalendario(S1).inicioMin, carregarCalendario(S1).fimMin], [360, 1380]);
    guardarDefinicoes({ inicioGrelha: 8, fimGrelha: 20 });
    assert.deepEqual([carregarCalendario(S1).inicioMin, carregarCalendario(S1).fimMin], [480, 1200]);
    criarOcupado(SEG, 7 * 60, 7 * 60 + 30);
    assert.equal(carregarCalendario(S1).inicioMin, 420);
    assert.throws(() => guardarDefinicoes({ inicioGrelha: 10, fimGrelha: 12 }), /4 horas/);
  });
});
