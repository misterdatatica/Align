/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { isNotNull } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { blocos } from '../db/schema.ts';
import { ErroDaApp } from '../domain/erros.ts';
import { pedacosDoEvento, type EventoDoTelemovel } from '../domain/eventos.ts';
import { carregarCalendario, criarOcupado, moverBloco, renomearOcupado, retirarBloco } from './calendario.ts';
import { exportarDados } from './copia.ts';
import { apagarEventos, sincronizarEventos } from './eventos.ts';
import { carregarPlanoDaSemana, limparSemana, planearSemana } from './semanas.ts';
import { garantirSemana } from './tarefas.ts';

const S16 = '2026-11-16';
const S23 = '2026-11-23';
const QUARTA = new Date(2026, 10, 18, 8, 0);
/** Uma semana de eventos: de 16 a 23 de novembro (o dia 23 já fica de fora). */
const JANELA = [S16, S23] as const;

const evento = (id: string, inicio: Date, fim: Date, titulo = 'Reunião', diaInteiro = false): EventoDoTelemovel => ({ id, titulo, inicio, fim, diaInteiro });
const reuniao = evento('a', new Date(2026, 10, 18, 10, 0), new Date(2026, 10, 18, 11, 30));
const ocupadosDoTelemovel = (semana: string) =>
  carregarCalendario(semana)
    .blocos.filter((b) => b.doTelemovel)
    .map((b) => `${b.dia} ${b.inicioMin}-${b.fimMin} ${b.nome}`);

beforeEach(() => prepararBd());

describe('os pedaços de um evento', () => {
  it('um evento dentro do dia é um pedaço; um que passa da meia-noite, dois', () => {
    assert.deepEqual(
      pedacosDoEvento(reuniao).map((p) => [p.dia, p.inicioMin, p.fimMin, p.titulo]),
      [['2026-11-18', 600, 690, 'Reunião']],
    );
    const noite = evento('b', new Date(2026, 10, 18, 22, 0), new Date(2026, 10, 19, 1, 30), 'Turno');
    assert.deepEqual(
      pedacosDoEvento(noite).map((p) => [p.dia, p.inicioMin, p.fimMin]),
      [
        ['2026-11-18', 1320, 1440],
        ['2026-11-19', 0, 90],
      ],
    );
    assert.notEqual(pedacosDoEvento(noite)[0].chave, pedacosDoEvento(noite)[1].chave);
  });

  it('os de dia inteiro e os que acabam antes de começar ficam de fora; os segundos arredondam', () => {
    assert.deepEqual(pedacosDoEvento(evento('c', new Date(2026, 10, 18), new Date(2026, 10, 19), 'Feriado', true)), []);
    assert.deepEqual(pedacosDoEvento(evento('d', new Date(2026, 10, 18, 10), new Date(2026, 10, 18, 10))), []);
    const [p] = pedacosDoEvento(evento('e', new Date(2026, 10, 18, 10, 0, 30), new Date(2026, 10, 18, 10, 59, 30), '  '));
    assert.deepEqual([p.inicioMin, p.fimMin, p.titulo], [600, 660, null], 'sem título fica "Ocupado"');
  });

  it('cada repetição de um evento tem a sua chave', () => {
    const segunda = evento('r', new Date(2026, 10, 16, 9), new Date(2026, 10, 16, 10));
    const terca = evento('r', new Date(2026, 10, 17, 9), new Date(2026, 10, 17, 10));
    assert.notEqual(pedacosDoEvento(segunda)[0].chave, pedacosDoEvento(terca)[0].chave);
  });
});

describe('sincronizar os eventos do telemóvel', () => {
  it('acrescenta, acerta e tira, e não escreve nada quando nada mudou', () => {
    garantirSemana(S16, QUARTA);
    assert.deepEqual(sincronizarEventos([reuniao], ...JANELA), { novos: 1, mudados: 0, apagados: 0 });
    assert.deepEqual(ocupadosDoTelemovel(S16), ['2 600-690 Reunião']);
    const bloco = carregarCalendario(S16).blocos.find((b) => b.doTelemovel)!;
    assert.equal(bloco.tipo, 'ocupado');

    assert.deepEqual(sincronizarEventos([reuniao], ...JANELA), { novos: 0, mudados: 0, apagados: 0 });
    assert.deepEqual(sincronizarEventos([{ ...reuniao, titulo: 'Reunião de equipa' }], ...JANELA), { novos: 0, mudados: 1, apagados: 0 });
    assert.deepEqual(ocupadosDoTelemovel(S16), ['2 600-690 Reunião de equipa']);
    assert.deepEqual(sincronizarEventos([], ...JANELA), { novos: 0, mudados: 0, apagados: 1 });
    assert.deepEqual(ocupadosDoTelemovel(S16), []);
  });

  it('só mexe nos dias da janela', () => {
    garantirSemana(S16, QUARTA);
    sincronizarEventos([evento('x', new Date(2026, 10, 24, 9), new Date(2026, 10, 24, 10))], S23, '2026-11-30');
    sincronizarEventos([evento('y', new Date(2026, 10, 30, 9), new Date(2026, 10, 30, 10)), reuniao], ...JANELA);
    assert.equal(db.select().from(blocos).where(isNotNull(blocos.eventoId)).all().length, 2, 'o de dia 24 fica; o de dia 30 é de fora da janela');
    assert.equal(apagarEventos(), 2);
    assert.equal(apagarEventos(), 0);
  });

  it('são só para ver: não se mudam, não se apagam e não mudam de nome', () => {
    garantirSemana(S16, QUARTA);
    sincronizarEventos([reuniao], ...JANELA);
    const id = carregarCalendario(S16).blocos.find((b) => b.doTelemovel)!.id;
    assert.throws(() => moverBloco(id, '2026-11-19', 600, 660), ErroDaApp);
    assert.throws(() => retirarBloco(id), ErroDaApp);
    renomearOcupado(id, 'Outra coisa');
    assert.deepEqual(ocupadosDoTelemovel(S16), ['2 600-690 Reunião']);
  });

  it('não passam para a semana seguinte, não a dão por desatualizada, e "Limpar" não os tira', () => {
    garantirSemana(S16, QUARTA);
    criarOcupado('2026-11-19', 12 * 60, 13 * 60, 'Almoço');
    sincronizarEventos([reuniao], ...JANELA);
    planearSemana(S23, QUARTA);
    assert.deepEqual(
      carregarCalendario(S23).blocos.map((b) => `${b.nome} ${b.doTelemovel}`),
      ['Almoço false'],
      'o "Ocupado" da app copia-se; o evento do telemóvel não',
    );

    sincronizarEventos([reuniao, evento('n', new Date(2026, 10, 20, 15), new Date(2026, 10, 20, 16), 'Dentista')], ...JANELA);
    assert.equal(carregarPlanoDaSemana(S23, '2026-11-18').desatualizada, false, 'um evento novo do telemóvel não pede para refazer');
    criarOcupado('2026-11-20', 18 * 60, 19 * 60, 'Ginásio');
    assert.equal(carregarPlanoDaSemana(S23, '2026-11-18').desatualizada, true, 'um "Ocupado" novo da app pede');

    limparSemana(S16, QUARTA);
    assert.deepEqual(ocupadosDoTelemovel(S16), ['2 600-690 Reunião', '4 900-960 Dentista']);
    assert.equal(carregarCalendario(S16).blocos.filter((b) => !b.doTelemovel).length, 0);
  });

  it('não vão na cópia de segurança, mas vão na fotografia para "Desfazer"', () => {
    garantirSemana(S16, QUARTA);
    criarOcupado('2026-11-19', 12 * 60, 13 * 60, 'Almoço');
    sincronizarEventos([reuniao], ...JANELA);
    assert.deepEqual(exportarDados(QUARTA, { paraFicheiro: true }).dados.blocos.map((b) => b.titulo), ['Almoço']);
    assert.equal(exportarDados(QUARTA).dados.blocos.length, 2);
  });
});
