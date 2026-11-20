/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas, definicoes, tarefasSemana } from '../db/schema.ts';
import { alocarTarefa, criarOcupado, marcarBlocoFeito } from './calendario.ts';
import { carregarDefinicoes, guardarDefinicoes, precisaDeCopia, registarCopia } from './definicoes.ts';
import { carregarHoje } from './hoje.ts';
import { comecarRevisao, carregarRevisao } from './revisao.ts';
import { carregarPlano, criarTarefa, editarTarefa, garantirSemana, marcarInstancia, marcarVez } from './tarefas.ts';

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
    assert.deepEqual(dia.paraHoje.map((p) => p.tarefa.nome), ['Lição'], 'as tarefas sem duração de todos os dias aparecem no próprio dia');
    assert.deepEqual(dia.semHora, []);
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

describe('aparência', () => {
  it('guarda a preferência de tema e recusa valores desconhecidos', () => {
    assert.equal(carregarDefinicoes().tema, 'automatico');
    guardarDefinicoes({ tema: 'escuro' });
    assert.equal(carregarDefinicoes().tema, 'escuro');
    assert.throws(() => guardarDefinicoes({ tema: 'roxo' as never }), /aparência/);
    assert.equal(carregarDefinicoes().tema, 'escuro');
  });
});

describe('tarefas sem duração com dia', () => {
  const nomesParaHoje = (dia: string) => carregarHoje(dia).paraHoje.map((p) => `${p.tarefa.nome}${p.feita ? ' feita' : ''}`);
  const nomesSemDia = (dia: string) => carregarHoje(dia).semHora.flatMap((g) => g.tarefas.map((tf) => tf.nome));

  it('dias certos e dia escolhido aparecem só nesses dias; "vezes por semana" fica para qualquer dia', () => {
    garantirSemana(SEMANA, AGORA);
    const area = novaArea();
    criarTarefa({ areaId: area, nome: 'Lição', duracaoMin: null, recorrencia: { tipo: 'dias', dias: [1, 3, 5] } }, SEMANA);
    criarTarefa({ areaId: area, nome: 'Ligar à mãe', duracaoMin: null, recorrencia: null, dia: 3 }, SEMANA);
    criarTarefa({ areaId: area, nome: 'Correr', duracaoMin: null, recorrencia: { tipo: 'vezes_por_semana', vezes: 3 } }, SEMANA);
    criarTarefa({ areaId: area, nome: 'Comprar pão', duracaoMin: null, recorrencia: null }, SEMANA);

    assert.deepEqual(nomesParaHoje('2026-11-16'), ['Lição'], 'segunda');
    assert.deepEqual(nomesParaHoje(QUARTA), ['Lição']);
    assert.deepEqual(nomesParaHoje(QUINTA), ['Ligar à mãe']);
    assert.deepEqual(nomesParaHoje('2026-11-17'), [], 'terça: nada com dia');
    assert.deepEqual(nomesSemDia(QUARTA), ['Correr', 'Comprar pão']);
  });

  it('marcar no Hoje marca só a instância desse dia', () => {
    garantirSemana(SEMANA, AGORA);
    const id = criarTarefa({ areaId: novaArea(), nome: 'Lição', duracaoMin: null, recorrencia: { tipo: 'diaria' } }, SEMANA);
    const deQuarta = carregarHoje(QUARTA).paraHoje[0];
    marcarInstancia(deQuarta.instanciaId, true);
    assert.deepEqual(nomesParaHoje(QUARTA), ['Lição feita']);
    assert.deepEqual(nomesParaHoje(QUINTA), ['Lição'], 'a de quinta continua por fazer');
    const lição = carregarPlano(SEMANA).areas[0].tarefas[0];
    assert.deepEqual([lição.feitas, lição.total], [1, 7], 'conta na semana');
    marcarInstancia(deQuarta.instanciaId, false);
    assert.deepEqual(nomesParaHoje(QUARTA), ['Lição']);
    // O contador da semana continua a funcionar.
    marcarVez(id, SEMANA, true);
    assert.equal(carregarPlano(SEMANA).areas[0].tarefas[0].feitas, 1);
  });

  it('mudar a repetição ou o dia acerta os dias, sem perder o que já foi feito', () => {
    garantirSemana(SEMANA, AGORA);
    const area = novaArea();
    const id = criarTarefa({ areaId: area, nome: 'Lição', duracaoMin: null, recorrencia: { tipo: 'diaria' } }, SEMANA);
    marcarInstancia(carregarHoje(QUARTA).paraHoje[0].instanciaId, true);
    editarTarefa(id, SEMANA, { areaId: area, nome: 'Lição', duracaoMin: null, recorrencia: { tipo: 'dias', dias: [3, 5] } });
    assert.deepEqual(nomesParaHoje(QUARTA), ['Lição feita'], 'a de quarta, já feita, fica na quarta');
    assert.deepEqual(nomesParaHoje('2026-11-20'), ['Lição']);
    assert.deepEqual(nomesParaHoje(QUINTA), []);

    const unica = criarTarefa({ areaId: area, nome: 'Ligar à mãe', duracaoMin: null, recorrencia: null, dia: 1 }, SEMANA);
    editarTarefa(unica, SEMANA, { areaId: area, nome: 'Ligar à mãe', duracaoMin: null, recorrencia: null, dia: 3 });
    assert.deepEqual(nomesParaHoje(QUINTA), ['Ligar à mãe']);
    editarTarefa(unica, SEMANA, { areaId: area, nome: 'Ligar à mãe', duracaoMin: 30, recorrencia: null, dia: 3 });
    assert.deepEqual(nomesParaHoje(QUINTA), [], 'com duração deixa de ter dia: vai para o calendário');
    assert.ok(db.select().from(tarefasSemana).all().every((i) => i.tarefaId !== unica || i.dia === null));
  });
});
