/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas } from '../db/schema.ts';
import { avisosParaAgendar, eAvisoDeBloco, type BlocoParaAvisar } from '../domain/avisos.ts';
import { blocosParaAvisar } from './avisos.ts';
import { alocarTarefa, criarOcupado, marcarBlocoFeito } from './calendario.ts';
import { carregarPlanoDaSemana } from './semanas.ts';
import { criarTarefa, garantirSemana } from './tarefas.ts';

const SEMANA = '2026-11-16';
/** Quarta-feira, 8:00. */
const AGORA = new Date(2026, 10, 18, 8, 0);

const bloco = (id: number, dia: string, inicioMin: number, nome = 'Meditar'): BlocoParaAvisar => ({ id, nome, area: 'Espiritual', dia, inicioMin, fimMin: inicioMin + 60 });

beforeEach(() => prepararBd());

describe('avisos dos blocos', () => {
  it('avisa uns minutos antes dos blocos que ainda estão para vir, os mais próximos primeiro', () => {
    const avisos = avisosParaAgendar(
      [bloco(1, '2026-11-19', 9 * 60), bloco(2, '2026-11-18', 9 * 60), bloco(3, '2026-11-18', 7 * 60 + 30), bloco(4, '2026-11-26', 9 * 60), bloco(5, '2026-11-18', 8 * 60 + 5)],
      AGORA,
      10,
    );
    assert.deepEqual(
      avisos.map((a) => [a.titulo, a.quando.getHours(), a.quando.getMinutes(), a.quando.getDate()]),
      [
        ['Meditar', 8, 50, 18],
        ['Meditar', 8, 50, 19],
      ],
      'o das 7:30 já passou, o das 8:05 já devia ter avisado (7:55) e o de dia 26 fica fora dos 7 dias',
    );
    assert.equal(avisos[0].corpo, 'Daqui a 10 min · 09:00–10:00 · Espiritual');
    assert.ok(avisos.every((a) => eAvisoDeBloco(a.identificador)));
  });

  it('o identificador muda quando muda o nome, a hora ou a antecedência', () => {
    const [a] = avisosParaAgendar([bloco(1, '2026-11-18', 9 * 60)], AGORA, 10);
    assert.equal(avisosParaAgendar([bloco(1, '2026-11-18', 9 * 60)], AGORA, 10)[0].identificador, a.identificador);
    assert.notEqual(avisosParaAgendar([bloco(1, '2026-11-18', 9 * 60, 'Ler')], AGORA, 10)[0].identificador, a.identificador);
    assert.notEqual(avisosParaAgendar([bloco(1, '2026-11-18', 10 * 60)], AGORA, 10)[0].identificador, a.identificador);
    assert.notEqual(avisosParaAgendar([bloco(1, '2026-11-18', 9 * 60)], AGORA, 15)[0].identificador, a.identificador);
    assert.notEqual(avisosParaAgendar([bloco(1, '2026-11-18', 9 * 60)], AGORA, 10, { variante: '-i' })[0].identificador, a.identificador, 'e quando muda a forma de agendar');
  });

  it('não passa do máximo de notificações agendadas', () => {
    const muitos = Array.from({ length: 100 }, (_, i) => bloco(i + 1, '2026-11-19', 6 * 60 + i * 5));
    assert.equal(avisosParaAgendar(muitos, AGORA, 10).length, 60);
  });

  it('só os blocos das tarefas por fazer; à sexta já planeia a semana seguinte', () => {
    garantirSemana(SEMANA, AGORA);
    const area = db.insert(areas).values({ nome: 'Espiritual', cor: 'violeta', icone: 'folha' }).returning({ id: areas.id }).get().id;
    const meditar = criarTarefa({ areaId: area, nome: 'Meditar', duracaoMin: 60, recorrencia: { tipo: 'diaria' } }, SEMANA);
    marcarBlocoFeito(alocarTarefa(meditar, SEMANA, '2026-11-18', 7 * 60), true);
    alocarTarefa(meditar, SEMANA, '2026-11-19', 7 * 60);
    criarOcupado('2026-11-19', 12 * 60, 13 * 60, 'Almoço');

    assert.deepEqual(
      blocosParaAvisar(AGORA).map((b) => `${b.nome} ${b.dia} ${b.inicioMin}`),
      ['Meditar 2026-11-19 420'],
      'o feito e o "Ocupado" não avisam',
    );
    assert.equal(carregarPlanoDaSemana('2026-11-23', '2026-11-18').estado, 'por_planear', 'à quarta a semana seguinte fica por planear');

    const sexta = new Date(2026, 10, 20, 8, 0);
    const blocos = blocosParaAvisar(sexta);
    assert.equal(carregarPlanoDaSemana('2026-11-23', '2026-11-20').estado, 'aceite', 'à sexta já fica planeada');
    assert.deepEqual(
      blocos.filter((b) => b.dia >= '2026-11-23').map((b) => b.dia),
      ['2026-11-25', '2026-11-26'],
      'e os seus blocos (cópia desta, e por fazer, mesmo o que aqui já foi feito) já avisam',
    );
  });
});
