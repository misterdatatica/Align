/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { descreverRecorrencia, instanciasPorSemana } from './recorrencia.ts';
import {
  alvoSemanal,
  alvoValido,
  contarUnidade,
  descreverMeta,
  encaixarMeiaHora,
  formatarHoras,
  MAX_AREAS,
  pluralizar,
  podeCriarArea,
  progresso,
} from './regras.ts';
import { descreverSemana, diasDaSemana, inicioDaSemana, somarSemanas } from './semana.ts';

describe('semana', () => {
  it('começa à segunda-feira', () => {
    assert.equal(inicioDaSemana(new Date(2026, 10, 14)), '2026-11-09'); // sábado 14 nov
    assert.equal(inicioDaSemana(new Date(2026, 10, 15)), '2026-11-09'); // domingo 15 nov
    assert.equal(inicioDaSemana(new Date(2026, 10, 16)), '2026-11-16'); // segunda 16 nov
  });

  it('soma semanas através de meses e anos', () => {
    assert.equal(somarSemanas('2026-11-09', 1), '2026-11-16');
    assert.equal(somarSemanas('2026-12-28', 1), '2027-01-04');
    assert.equal(somarSemanas('2026-11-16', -1), '2026-11-09');
  });

  it('lista os 7 dias', () => {
    assert.deepEqual(diasDaSemana('2026-11-16'), [
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
    ]);
  });

  it('descreve a semana em português', () => {
    assert.equal(descreverSemana('2026-11-16'), '16–22 nov');
    assert.equal(descreverSemana('2026-11-30'), '30 nov – 6 dez');
    assert.equal(descreverSemana('2025-12-29'), '29 dez 2025 – 4 jan 2026');
  });
});

describe('regras', () => {
  it('limita a 7 áreas ativas', () => {
    assert.equal(MAX_AREAS, 7);
    assert.equal(podeCriarArea(6), true);
    assert.equal(podeCriarArea(7), false);
  });

  it('converte metas diárias para semanais', () => {
    assert.equal(alvoSemanal(2, 'dia'), 14);
    assert.equal(alvoSemanal(10, 'semana'), 10);
    assert.throws(() => alvoSemanal(0, 'dia'));
  });

  it('formata horas', () => {
    assert.equal(formatarHoras(14), '14 h');
    assert.equal(formatarHoras(7.5), '7,5 h');
    assert.equal(formatarHoras(0.5), '30 min');
    assert.equal(formatarHoras(0), '0 h');
  });

  it('encaixa em meias horas', () => {
    assert.equal(encaixarMeiaHora(9 * 60 + 14), 9 * 60);
    assert.equal(encaixarMeiaHora(9 * 60 + 16), 9 * 60 + 30);
  });

  it('calcula o progresso limitado a 1', () => {
    assert.equal(progresso(10, 14), 10 / 14);
    assert.equal(progresso(20, 14), 1);
    assert.equal(progresso(5, 0), 0);
  });
});

describe('recorrência', () => {
  it('conta instâncias por semana', () => {
    assert.equal(instanciasPorSemana(null), 1);
    assert.equal(instanciasPorSemana({ tipo: 'diaria' }), 7);
    assert.equal(instanciasPorSemana({ tipo: 'vezes_por_semana', vezes: 4 }), 4);
    assert.equal(instanciasPorSemana({ tipo: 'dias', dias: [2, 4, 4, 9] }), 2);
  });

  it('descreve a recorrência', () => {
    assert.equal(descreverRecorrencia({ tipo: 'diaria' }), 'todos os dias');
    assert.equal(descreverRecorrencia({ tipo: 'vezes_por_semana', vezes: 2 }), '2× por semana');
    assert.equal(descreverRecorrencia({ tipo: 'dias', dias: [4, 2] }), 'ter, qui');
    assert.equal(descreverRecorrencia(null), null);
  });
});

describe('metas', () => {
  it('pluraliza unidades', () => {
    assert.equal(pluralizar('lição'), 'lições');
    assert.equal(pluralizar('treino'), 'treinos');
    assert.equal(pluralizar('página'), 'páginas');
    assert.equal(pluralizar('jejum'), 'jejuns');
    assert.equal(pluralizar('lição do livro'), 'lições do livro');
  });

  it('conta unidades', () => {
    assert.equal(contarUnidade(1, 'lição'), '1 lição');
    assert.equal(contarUnidade(3, 'lição'), '3 lições');
    assert.equal(contarUnidade(1, null), '1 vez');
    assert.equal(contarUnidade(4, ''), '4 vezes');
  });

  it('descreve metas', () => {
    assert.equal(descreverMeta({ tipo: 'vezes', alvoSemanal: 7, periodo: 'dia', unidade: 'lição' }), '1 lição por dia · 7 por semana');
    assert.equal(descreverMeta({ tipo: 'vezes', alvoSemanal: 3, periodo: 'semana', unidade: 'treino' }), '3 treinos por semana');
    assert.equal(descreverMeta({ tipo: 'vezes', alvoSemanal: 2, periodo: 'semana', unidade: null }), '2 vezes por semana');
    assert.equal(descreverMeta({ tipo: 'horas', alvoSemanal: 14, periodo: 'dia', unidade: null }), '2 h por dia · 14 h por semana');
    assert.equal(descreverMeta({ tipo: 'horas', alvoSemanal: 10, periodo: 'semana', unidade: null }), '10 h por semana');
  });

  it('valida o alvo', () => {
    assert.equal(alvoValido('horas', 1.5), true);
    assert.equal(alvoValido('vezes', 1.5), false);
    assert.equal(alvoValido('vezes', 1), true);
    assert.equal(alvoValido('vezes', 0), false);
  });
});
