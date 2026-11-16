/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas, metas, metasRegistos, tarefas } from '../db/schema.ts';
import { alocarTarefa, marcarBlocoFeito } from './calendario.ts';
import {
  apagarMeta,
  apagarRegisto,
  atualizarMeta,
  carregarMeta,
  carregarMetasAtivas,
  carregarMetasDaArea,
  criarMeta,
  metasParaTarefas,
  mudarEstadoDaMeta,
  registarValor,
} from './metas.ts';
import { carregarRevisao } from './revisao.ts';
import { apagarTarefa, criarTarefa } from './tarefas.ts';

const S1 = '2026-11-16';
const HOJE = '2026-11-16';
const PRAZO = '2027-03-31';

function novaArea(nome = 'Espiritual', arquivada = false): number {
  return db.insert(areas).values({ nome, cor: 'violeta', icone: 'folha', arquivada }).returning({ id: areas.id }).get().id;
}

const meditar = (areaId: number) =>
  criarMeta({ areaId, descricao: 'Conseguir meditar 1 h seguida', prazo: PRAZO, medida: 'numero', valorInicial: 20, valorAlvo: 60, unidade: 'min seguidos' });
const viagem = (areaId: number) => criarMeta({ areaId, descricao: 'Fazer uma viagem com os pais', prazo: PRAZO, medida: 'marco' });
const ler = (id: number) => {
  const meta = carregarMeta(id, S1, HOJE);
  assert.ok(meta);
  return meta;
};

beforeEach(() => prepararBd());

describe('criar metas', () => {
  it('uma meta de número começa no valor inicial, com prazo e dias que faltam', () => {
    const meta = ler(meditar(novaArea()));
    assert.deepEqual(
      { medida: meta.medida, inicial: meta.valorInicial, atual: meta.valorAtual, alvo: meta.valorAlvo, unidade: meta.unidade, estado: meta.estado, prazo: meta.prazo },
      { medida: 'numero', inicial: 20, atual: 20, alvo: 60, unidade: 'min seguidos', estado: 'ativa', prazo: PRAZO },
    );
    assert.equal(meta.progresso, 0);
    assert.equal(meta.alcancada, false);
    assert.equal(meta.diasQueFaltam, 135);
    assert.deepEqual(meta.registos, []);
    assert.equal(meta.area.nome, 'Espiritual');
  });

  it('um marco não guarda valores', () => {
    const meta = ler(viagem(novaArea()));
    assert.deepEqual([meta.medida, meta.valorInicial, meta.valorAtual, meta.valorAlvo, meta.unidade], ['marco', null, null, null, null]);
    assert.equal(meta.progresso, 0);
  });

  it('recusa metas sem prazo, sem descrição ou em áreas arquivadas', () => {
    const area = novaArea();
    assert.throws(() => criarMeta({ areaId: area, descricao: 'Correr 10 km', prazo: '', medida: 'marco' }), /prazo/);
    assert.throws(() => criarMeta({ areaId: area, descricao: '', prazo: PRAZO, medida: 'marco' }), /descrição/);
    assert.throws(() => criarMeta({ areaId: novaArea('Antiga', true), descricao: 'X', prazo: PRAZO, medida: 'marco' }), /área/);
    assert.equal(db.select().from(metas).all().length, 0);
  });

  it('só deixa ter 3 metas ativas por área', () => {
    const area = novaArea();
    const primeira = viagem(area);
    viagem(area);
    viagem(area);
    assert.throws(() => viagem(area), /no máximo 3 metas ativas/);
    viagem(novaArea('Família')); // noutra área cabe

    // Pausar liberta um lugar; voltar a ativar com os 3 ocupados não passa.
    mudarEstadoDaMeta(primeira, 'pausada');
    const quarta = viagem(area);
    assert.throws(() => mudarEstadoDaMeta(primeira, 'ativa'), /no máximo 3 metas ativas/);
    mudarEstadoDaMeta(quarta, 'concluida');
    mudarEstadoDaMeta(primeira, 'ativa');
    assert.equal(ler(primeira).estado, 'ativa');
  });
});

describe('progresso e histórico', () => {
  it('cada atualização fica no histórico, com a data e o valor', () => {
    const id = meditar(novaArea());
    registarValor(id, 25, '2026-11-22');
    registarValor(id, 35, '2026-11-29');
    const meta = ler(id);
    assert.deepEqual(meta.registos, [
      { data: '2026-11-22', valor: 25 },
      { data: '2026-11-29', valor: 35 },
    ]);
    assert.equal(meta.valorAtual, 35);
    assert.equal(meta.progresso, 0.375);
    assert.equal(meta.alcancada, false);
  });

  it('registar outra vez no mesmo dia corrige o valor desse dia', () => {
    const id = meditar(novaArea());
    registarValor(id, 52, '2026-11-22');
    registarValor(id, 25, '2026-11-22');
    assert.deepEqual(ler(id).registos, [{ data: '2026-11-22', valor: 25 }]);
    assert.equal(ler(id).valorAtual, 25);
  });

  it('o valor atual é o da atualização mais recente, e apagar um registo recua', () => {
    const id = meditar(novaArea());
    registarValor(id, 40, '2026-11-29');
    registarValor(id, 30, '2026-11-22'); // registado depois, mas de um dia anterior
    assert.equal(ler(id).valorAtual, 40);
    apagarRegisto(id, '2026-11-29');
    assert.equal(ler(id).valorAtual, 30);
    apagarRegisto(id, '2026-11-22');
    assert.equal(ler(id).valorAtual, 20, 'sem atualizações volta ao valor inicial');
  });

  it('suporta alvos descendentes', () => {
    const id = criarMeta({ areaId: novaArea('Desporto'), descricao: 'Correr 10 km em menos de 50 min', prazo: PRAZO, medida: 'numero', valorInicial: 55, valorAlvo: 50, unidade: 'min' });
    registarValor(id, 53, '2026-11-22');
    assert.equal(ler(id).progresso, 0.4);
    assert.equal(ler(id).alcancada, false);
    registarValor(id, 49.8, '2026-11-29');
    assert.equal(ler(id).progresso, 1);
    assert.equal(ler(id).alcancada, true);
    assert.equal(ler(id).estado, 'ativa', 'chegar ao alvo não muda o estado sozinho: é o utilizador que conclui');
  });

  it('avisa quando a meta não avançou nas últimas 3 atualizações', () => {
    const id = meditar(novaArea());
    registarValor(id, 25, '2026-11-22');
    registarValor(id, 25, '2026-11-29');
    registarValor(id, 24, '2026-12-06');
    assert.equal(ler(id).estagnada, false, 'a primeira das três avançou (20 → 25)');
    registarValor(id, 25, '2026-12-13');
    assert.equal(ler(id).estagnada, true, 'há três atualizações que não passam dos 25');
    registarValor(id, 27, '2026-12-20');
    assert.equal(ler(id).estagnada, false, 'chegou aos 27');
  });

  it('um marco fica alcançado quando é concluído', () => {
    const id = viagem(novaArea());
    assert.throws(() => registarValor(id, 1, HOJE), /número/);
    mudarEstadoDaMeta(id, 'concluida');
    assert.deepEqual([ler(id).estado, ler(id).alcancada, ler(id).progresso], ['concluida', true, 1]);
  });

  it('alterar o valor de partida acompanha o valor atual enquanto não há atualizações', () => {
    const id = meditar(novaArea());
    atualizarMeta(id, { descricao: 'Meditar 1 h seguida', prazo: '2027-06-30', medida: 'marco', valorInicial: 15, valorAlvo: 60, unidade: 'min' });
    assert.deepEqual([ler(id).medida, ler(id).valorInicial, ler(id).valorAtual, ler(id).prazo, ler(id).unidade], ['numero', 15, 15, '2027-06-30', 'min'], 'o tipo de medida não muda');
    registarValor(id, 30, '2026-11-22');
    atualizarMeta(id, { descricao: 'Meditar 1 h seguida', prazo: '2027-06-30', medida: 'numero', valorInicial: 10, valorAlvo: 60 });
    assert.equal(ler(id).valorAtual, 30);
  });
});

describe('estados', () => {
  it('pausar não apaga a meta nem o histórico', () => {
    const area = novaArea();
    const id = meditar(area);
    const tarefa = criarTarefa({ areaId: area, metaId: id, nome: 'Meditar', duracaoMin: 60, recorrencia: { tipo: 'diaria' } }, S1);
    registarValor(id, 25, '2026-11-22');
    mudarEstadoDaMeta(id, 'pausada');
    const pausada = ler(id);
    assert.equal(pausada.estado, 'pausada');
    assert.deepEqual(pausada.registos, [{ data: '2026-11-22', valor: 25 }]);
    assert.equal(pausada.valorAtual, 25);
    assert.deepEqual(pausada.tarefas.map((t) => t.id), [tarefa], 'as tarefas continuam ligadas');
    mudarEstadoDaMeta(id, 'ativa');
    assert.deepEqual(ler(id).registos, [{ data: '2026-11-22', valor: 25 }]);
  });

  it('apagar leva o histórico mas deixa as tarefas, sem meta', () => {
    const area = novaArea();
    const id = meditar(area);
    const tarefa = criarTarefa({ areaId: area, metaId: id, nome: 'Meditar', duracaoMin: 60, recorrencia: null }, S1);
    registarValor(id, 25, '2026-11-22');
    apagarMeta(id);
    assert.equal(db.select().from(metasRegistos).all().length, 0);
    assert.equal(db.select({ metaId: tarefas.metaId }).from(tarefas).where(eq(tarefas.id, tarefa)).get()?.metaId, null);
  });

  it('numa tarefa escolhem-se as metas ativas e as pausadas', () => {
    const area = novaArea();
    const a = meditar(area);
    const b = viagem(area);
    const c = viagem(area);
    mudarEstadoDaMeta(b, 'pausada');
    mudarEstadoDaMeta(c, 'abandonada');
    assert.deepEqual(metasParaTarefas(area).map((m) => m.id), [a, b]);
  });
});

describe('tarefas ligadas', () => {
  it('mostra as tarefas em vigor ligadas à meta, com o ponto em que estão na semana', () => {
    const area = novaArea();
    const id = meditar(area);
    const diaria = criarTarefa({ areaId: area, metaId: id, nome: 'Meditar', duracaoMin: 60, recorrencia: { tipo: 'diaria' } }, S1);
    const unica = criarTarefa({ areaId: area, metaId: id, nome: 'Retiro de silêncio', duracaoMin: 180, recorrencia: null }, S1);
    criarTarefa({ areaId: area, nome: 'Ler', duracaoMin: 30, recorrencia: null }, S1);
    marcarBlocoFeito(alocarTarefa(diaria, S1, '2026-11-16', 390), true);
    marcarBlocoFeito(alocarTarefa(diaria, S1, '2026-11-17', 390), true);

    assert.deepEqual(
      ler(id).tarefas.map((t) => [t.nome, t.feitas, t.total]),
      [
        ['Meditar', 2, 7],
        ['Retiro de silêncio', 0, 1],
      ],
    );

    // Uma tarefa apagada, ou uma tarefa única que ficou numa semana passada, já não aparece.
    apagarTarefa(unica, S1);
    assert.deepEqual(carregarMeta(id, '2026-11-23', '2026-11-23')?.tarefas.map((t) => [t.nome, t.total]), [['Meditar', 0]]);
  });

  it('o detalhe da área traz todas as metas; a revisão só as ativas das áreas por arquivar', () => {
    const area = novaArea();
    const a = meditar(area);
    const b = viagem(area);
    mudarEstadoDaMeta(b, 'pausada');
    const antiga = novaArea('Antiga');
    viagem(antiga);
    db.update(areas).set({ arquivada: true }).where(eq(areas.id, antiga)).run();
    const trabalho = novaArea('Trabalho');
    const c = viagem(trabalho);

    assert.deepEqual(carregarMetasDaArea(area, S1, HOJE).map((m) => [m.id, m.estado]), [
      [a, 'ativa'],
      [b, 'pausada'],
    ]);
    assert.deepEqual(carregarMetasAtivas(S1, HOJE).map((m) => m.id), [a, c]);
    assert.deepEqual(carregarRevisao(HOJE).metas.map((m) => m.id), [a, c]);
  });
});
