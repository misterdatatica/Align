/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { asc, eq } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas, blocos, metas, tarefas, tarefasSemana } from '../db/schema.ts';
import { apagarTarefa, carregarPlano, criarTarefa, editarTarefa, garantirSemana, marcarVez } from './tarefas.ts';

const S1 = '2026-11-16';
const S2 = '2026-11-23';
const S3 = '2026-11-30';
/** Quarta-feira da semana S1. */
const HOJE = new Date(2026, 10, 18);

function novaArea(nome = 'Espiritual', arquivada = false): number {
  return db.insert(areas).values({ nome, cor: 'violeta', icone: 'folha', arquivada }).returning({ id: areas.id }).get().id;
}

function instancias(tarefaId: number, semana?: string) {
  return db
    .select()
    .from(tarefasSemana)
    .where(eq(tarefasSemana.tarefaId, tarefaId))
    .orderBy(asc(tarefasSemana.id))
    .all()
    .filter((i) => !semana || i.semana === semana);
}

/** Põe uma instância no calendário, como o ecrã Calendário fará. */
function alocar(instanciaId: number, inicio: string, fim: string, feito = false): number {
  db.update(tarefasSemana)
    .set({ estado: feito ? 'feita' : 'alocada' })
    .where(eq(tarefasSemana.id, instanciaId))
    .run();
  return db.insert(blocos).values({ tarefaSemanaId: instanciaId, inicio, fim, feito }).returning({ id: blocos.id }).get().id;
}

const meditar = (areaId: number) => ({ areaId, nome: 'Meditar', duracaoMin: 120, recorrencia: { tipo: 'diaria' } as const });

beforeEach(() => prepararBd());

describe('criar tarefa', () => {
  it('cria uma instância por alocar para uma tarefa única', () => {
    const area = novaArea();
    const id = criarTarefa({ areaId: area, nome: '  Ligar aos avós ', duracaoMin: 30, recorrencia: null }, S1);
    const tarefa = db.select().from(tarefas).where(eq(tarefas.id, id)).get();
    assert.equal(tarefa?.nome, 'Ligar aos avós');
    assert.equal(tarefa?.semanaInicio, S1);
    assert.deepEqual(
      instancias(id).map((i) => [i.semana, i.estado]),
      [[S1, 'por_alocar']],
    );
  });

  it('cria 7 instâncias para uma tarefa diária (critério de aceitação 3)', () => {
    const id = criarTarefa(meditar(novaArea()), S1);
    assert.equal(instancias(id, S1).length, 7);
    assert.ok(instancias(id).every((i) => i.estado === 'por_alocar'));
  });

  it('cria N instâncias para "N vezes por semana" e para dias específicos', () => {
    const area = novaArea();
    const jantar = criarTarefa({ areaId: area, nome: 'Jantar', duracaoMin: 60, recorrencia: { tipo: 'vezes_por_semana', vezes: 4 } }, S1);
    const treino = criarTarefa({ areaId: area, nome: 'Treino', duracaoMin: 90, recorrencia: { tipo: 'dias', dias: [4, 2, 2] } }, S1);
    assert.equal(instancias(jantar).length, 4);
    assert.equal(instancias(treino).length, 2);
    assert.deepEqual(db.select().from(tarefas).where(eq(tarefas.id, treino)).get()?.recorrencia, { tipo: 'dias', dias: [2, 4] });
  });

  it('recusa dados inválidos', () => {
    const area = novaArea();
    const outra = novaArea('Trabalho');
    const metaDeOutra = db.insert(metas).values({ areaId: outra, descricao: 'Estudar', tipo: 'horas', alvoSemanal: 5 }).returning({ id: metas.id }).get().id;
    assert.throws(() => criarTarefa({ areaId: area, nome: '  ', duracaoMin: 30, recorrencia: null }, S1), /nome/);
    assert.throws(() => criarTarefa({ areaId: area, nome: 'X', duracaoMin: 0, recorrencia: null }, S1), /duração/);
    assert.throws(() => criarTarefa({ areaId: area, nome: 'X', duracaoMin: 30, recorrencia: { tipo: 'dias', dias: [] } }, S1), /dia/);
    assert.throws(() => criarTarefa({ areaId: area, nome: 'X', duracaoMin: 30, recorrencia: null, metaId: metaDeOutra }, S1), /meta/);
    assert.throws(() => criarTarefa({ areaId: novaArea('Antiga', true), nome: 'X', duracaoMin: 30, recorrencia: null }, S1), /área/);
    assert.equal(db.select().from(tarefas).all().length, 0);
  });
});

describe('abrir uma semana', () => {
  it('cria as instâncias das tarefas recorrentes e só uma vez', () => {
    const area = novaArea();
    const id = criarTarefa(meditar(area), S1);
    const unica = criarTarefa({ areaId: area, nome: 'Jogo', duracaoMin: 120, recorrencia: null }, S1);
    assert.equal(garantirSemana(S2, HOJE), 7);
    assert.equal(garantirSemana(S2, HOJE), 0);
    assert.equal(instancias(id, S2).length, 7);
    assert.equal(instancias(unica, S2).length, 0);
  });

  it('não preenche semanas que já passaram nem anteriores à tarefa', () => {
    const id = criarTarefa(meditar(novaArea()), S2);
    assert.equal(garantirSemana(S1, HOJE), 0, 'a tarefa só começa em S2');
    assert.equal(garantirSemana('2026-11-09', HOJE), 0, 'semana passada');
    assert.equal(instancias(id).length, 7);
  });

  it('ignora áreas arquivadas', () => {
    const area = novaArea();
    criarTarefa(meditar(area), S1);
    db.update(areas).set({ arquivada: true }).where(eq(areas.id, area)).run();
    assert.equal(garantirSemana(S2, HOJE), 0);
  });
});

describe('alterar tarefa', () => {
  it('na semana em que nasceu altera a própria tarefa e acerta as instâncias', () => {
    const area = novaArea();
    const id = criarTarefa(meditar(area), S1);
    const [a, b] = instancias(id);
    alocar(a.id, `${S1}T06:30`, `${S1}T08:30`);
    alocar(b.id, '2026-11-17T06:30', '2026-11-17T08:30', true);

    const emVigor = editarTarefa(id, S1, { areaId: area, nome: 'Meditar', duracaoMin: 120, recorrencia: { tipo: 'vezes_por_semana', vezes: 3 } });
    assert.equal(emVigor, id);
    const restantes = instancias(id, S1);
    assert.equal(restantes.length, 3);
    assert.ok(restantes.some((i) => i.id === a.id), 'mantém a que está no calendário');
    assert.ok(restantes.some((i) => i.id === b.id), 'mantém a que já foi feita');

    editarTarefa(id, S1, { areaId: area, nome: 'Meditar', duracaoMin: 120, recorrencia: { tipo: 'diaria' } });
    assert.equal(instancias(id, S1).length, 7);
  });

  it('com histórico, as semanas anteriores ficam como estavam', () => {
    const area = novaArea();
    const id = criarTarefa(meditar(area), S1);
    garantirSemana(S2, HOJE);

    const nova = editarTarefa(id, S2, { areaId: area, nome: 'Meditar de manhã', duracaoMin: 60, recorrencia: { tipo: 'diaria' } });
    assert.notEqual(nova, id);
    const antiga = db.select().from(tarefas).where(eq(tarefas.id, id)).get();
    assert.equal(antiga?.nome, 'Meditar');
    assert.equal(antiga?.semanaFim, S2);
    assert.equal(instancias(id, S1).length, 7);
    assert.equal(instancias(id, S2).length, 0);
    assert.equal(instancias(nova, S2).length, 7);

    assert.equal(carregarPlano(S1).areas[0].tarefas[0].minutosPlaneados, 14 * 60);
    assert.equal(carregarPlano(S2).areas[0].tarefas[0].minutosPlaneados, 7 * 60);

    // A versão antiga já não gera instâncias; a nova continua.
    assert.equal(garantirSemana(S3, HOJE), 7);
    assert.equal(instancias(id, S3).length, 0);
    assert.equal(instancias(nova, S3).length, 7);
  });

  it('uma tarefa que deixa de repetir fica só na semana alterada', () => {
    const area = novaArea();
    const id = criarTarefa(meditar(area), S1);
    garantirSemana(S2, HOJE);
    editarTarefa(id, S1, { areaId: area, nome: 'Meditar', duracaoMin: 120, recorrencia: null });
    assert.equal(instancias(id, S1).length, 1);
    assert.equal(instancias(id, S2).length, 0);
    assert.equal(garantirSemana(S3, HOJE), 0);
  });

  it('a nova duração passa para os blocos que ainda tinham a antiga', () => {
    const area = novaArea();
    const id = criarTarefa(meditar(area), S1);
    const [a, b, c] = instancias(id);
    const normal = alocar(a.id, `${S1}T06:30`, `${S1}T08:30`);
    const ajustado = alocar(b.id, '2026-11-17T06:30', '2026-11-17T07:30');
    const feito = alocar(c.id, '2026-11-18T06:30', '2026-11-18T08:30', true);

    editarTarefa(id, S1, { areaId: area, nome: 'Meditar', duracaoMin: 90, recorrencia: { tipo: 'diaria' } });
    const fim = (bloco: number) => db.select().from(blocos).where(eq(blocos.id, bloco)).get()?.fim;
    assert.equal(fim(normal), `${S1}T08:00`);
    assert.equal(fim(ajustado), '2026-11-17T07:30');
    assert.equal(fim(feito), '2026-11-18T08:30');
  });

  it('sem duração, a tarefa sai do calendário', () => {
    const area = novaArea();
    const id = criarTarefa(meditar(area), S1);
    const [a, b] = instancias(id);
    alocar(a.id, `${S1}T06:30`, `${S1}T08:30`);
    alocar(b.id, '2026-11-17T06:30', '2026-11-17T08:30', true);
    editarTarefa(id, S1, { areaId: area, nome: 'Meditar', duracaoMin: null, recorrencia: { tipo: 'diaria' } });
    assert.equal(db.select().from(blocos).all().length, 0);
    assert.deepEqual(
      instancias(id).map((i) => i.estado).slice(0, 2),
      ['por_alocar', 'feita'],
    );
  });
});

describe('apagar tarefa', () => {
  it('sem histórico apaga tudo, blocos incluídos', () => {
    const id = criarTarefa(meditar(novaArea()), S1);
    alocar(instancias(id)[0].id, `${S1}T06:30`, `${S1}T08:30`);
    apagarTarefa(id, S1);
    assert.equal(db.select().from(tarefas).all().length, 0);
    assert.equal(db.select().from(tarefasSemana).all().length, 0);
    assert.equal(db.select().from(blocos).all().length, 0);
  });

  it('com histórico sai desta semana e das seguintes, e deixa de repetir', () => {
    const id = criarTarefa(meditar(novaArea()), S1);
    garantirSemana(S2, HOJE);
    apagarTarefa(id, S2);
    assert.equal(instancias(id, S1).length, 7);
    assert.equal(instancias(id, S2).length, 0);
    assert.equal(db.select().from(tarefas).where(eq(tarefas.id, id)).get()?.semanaFim, S2);
    assert.equal(garantirSemana(S2, HOJE), 0);
    assert.equal(garantirSemana(S3, HOJE), 0);
  });
});

describe('tarefas sem duração', () => {
  it('contam-se uma vez de cada vez', () => {
    const area = novaArea();
    const id = criarTarefa({ areaId: area, nome: 'Lição ACIM', duracaoMin: null, recorrencia: { tipo: 'diaria' } }, S1);
    marcarVez(id, S1, true);
    marcarVez(id, S1, true);
    assert.equal(instancias(id).filter((i) => i.estado === 'feita').length, 2);
    marcarVez(id, S1, false);
    assert.equal(instancias(id).filter((i) => i.estado === 'feita').length, 1);
    for (let i = 0; i < 10; i++) marcarVez(id, S1, true);
    assert.equal(instancias(id).filter((i) => i.estado === 'feita').length, 7);

    const plano = carregarPlano(S1);
    assert.equal(plano.minutosPlaneados, 0);
    assert.equal(plano.porAlocar, 0, 'não ocupa tempo, por isso não fica por alocar');
  });

  it('recusa tarefas com duração', () => {
    const id = criarTarefa(meditar(novaArea()), S1);
    assert.throws(() => marcarVez(id, S1, true), /calendário/);
  });
});

describe('plano da semana', () => {
  it('soma horas planeadas, no calendário e por alocar (critério de aceitação 4)', () => {
    const espiritual = novaArea('Espiritual');
    const familia = novaArea('Família');
    const id = criarTarefa(meditar(espiritual), S1);
    criarTarefa({ areaId: familia, nome: 'Ligar aos avós', duracaoMin: 30, recorrencia: null }, S1);

    let plano = carregarPlano(S1);
    assert.equal(plano.minutosPlaneados, 14 * 60 + 30);
    assert.equal(plano.minutosCalendario, 0);
    assert.equal(plano.porAlocar, 8);
    assert.equal(plano.minutosPorAlocar, 14 * 60 + 30);
    assert.deepEqual(
      plano.areas.map((a) => [a.area.nome, a.minutosPlaneados, a.tarefas.length]),
      [
        ['Espiritual', 14 * 60, 1],
        ['Família', 30, 1],
      ],
    );

    instancias(id).forEach((i, dia) => alocar(i.id, `2026-11-${16 + dia}T06:30`, `2026-11-${16 + dia}T08:30`, dia < 2));
    plano = carregarPlano(S1);
    const linha = plano.areas[0].tarefas[0];
    assert.equal(linha.noCalendario, 7);
    assert.equal(linha.feitas, 2);
    assert.equal(linha.minutosCalendario, 14 * 60);
    assert.equal(plano.minutosFeitos, 4 * 60);
    assert.equal(plano.porAlocar, 1);
  });

  it('esconde as áreas arquivadas e mostra as áreas sem tarefas', () => {
    const arquivada = novaArea('Antiga');
    novaArea('Trabalho');
    criarTarefa(meditar(arquivada), S1);
    db.update(areas).set({ arquivada: true }).where(eq(areas.id, arquivada)).run();
    const plano = carregarPlano(S1);
    assert.deepEqual(
      plano.areas.map((a) => [a.area.nome, a.tarefas.length]),
      [['Trabalho', 0]],
    );
    assert.equal(plano.minutosPlaneados, 0);
  });
});
