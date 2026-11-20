/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas, definicoes } from '../db/schema.ts';
import { alocarTarefa, criarOcupado, marcarBlocoFeito } from './calendario.ts';
import { guardarDefinicoes, precisaDeCopia, registarCopia } from './definicoes.ts';
import { carregarHoje } from './hoje.ts';
import { comecarRevisao, carregarRevisao } from './revisao.ts';
import { criarTarefa, garantirSemana } from './tarefas.ts';

const SEMANA = '2026-11-16';
const QUARTA = '2026-11-18';
const QUINTA = '2026-11-19';
const AGORA = new Date(2026, 10, 18);

function novaArea(nome = 'Espiritual', cor = 'violeta'): number {
  return db.insert(areas).values({ nome, cor, icone: 'folha' }).returning({ id: areas.id }).get().id;
}

beforeEach(() => prepararBd());

describe('hoje', () => {
  it('mostra só os blocos de hoje, por ordem de hora, e as tarefas sem duração', () => {
    garantirSemana(SEMANA, AGORA);
    const area = novaArea();
    const meditar = criarTarefa({ areaId: area, nome: 'Meditar', duracaoMin: 60, recorrencia: { tipo: 'diaria' } }, SEMANA);
    criarTarefa({ areaId: area, nome: 'Lição', duracaoMin: null, recorrencia: { tipo: 'diaria' } }, SEMANA);
    const ler = criarTarefa({ areaId: area, nome: 'Ler', duracaoMin: 30, recorrencia: null }, SEMANA);

    marcarBlocoFeito(alocarTarefa(meditar, SEMANA, QUARTA, 18 * 60), true);
    alocarTarefa(meditar, SEMANA, QUINTA, 7 * 60);
    alocarTarefa(ler, SEMANA, QUARTA, 9 * 60);
    criarOcupado(QUARTA, 13 * 60, 14 * 60, 'Almoço');

    const dia = carregarHoje(QUARTA);
    assert.deepEqual(
      dia.blocos.map((b) => `${b.nome} ${b.inicioMin}${b.feito ? ' feito' : ''}`),
      ['Ler 540', 'Almoço 780', 'Meditar 1080 feito'],
    );
    assert.deepEqual(dia.semHora.map((g) => g.tarefas.map((t) => t.nome)), [['Lição']]);
    assert.equal(dia.porAlocar, 5, 'Meditar tem 7 por semana e só 2 estão no calendário');
    assert.equal(dia.temAreas, true);
  });

  it('sem áreas não há nada para mostrar', () => {
    const dia = carregarHoje(QUARTA);
    assert.deepEqual([dia.blocos, dia.semHora, dia.porAlocar, dia.temAreas], [[], [], 0, false]);
  });
});

describe('lembrete da cópia de segurança', () => {
  it('lembra passados 30 dias desde a última cópia, ou desde o primeiro arranque se nunca houve', () => {
    assert.equal(precisaDeCopia(AGORA), false, 'antes do primeiro arranque não lembra');
    guardarDefinicoes({});
    db.update(definicoes).set({ criadoEm: '2026-10-01T10:00:00.000Z' }).where(eq(definicoes.id, 1)).run();
    assert.equal(precisaDeCopia(AGORA), true, 'nunca fez cópia e usa a app há mais de 30 dias');
    registarCopia(new Date(2026, 10, 1));
    assert.equal(precisaDeCopia(AGORA), false);
    assert.equal(precisaDeCopia(new Date(2026, 11, 5)), true);
  });
});

describe('fazer a revisão mais cedo', () => {
  it('"Fazer a revisão agora" abre a revisão antes do dia marcado', () => {
    guardarDefinicoes({ diaRevisao: 0 });
    garantirSemana(SEMANA, AGORA);
    criarTarefa({ areaId: novaArea(), nome: 'Ler', duracaoMin: 30, recorrencia: null }, SEMANA);
    assert.equal(carregarRevisao(QUARTA).disponivel, false);
    comecarRevisao(SEMANA);
    assert.deepEqual([carregarRevisao(QUARTA).semana, carregarRevisao(QUARTA).disponivel], [SEMANA, true]);
  });
});
