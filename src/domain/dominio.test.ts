/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { descreverRecorrencia, instanciasPorSemana } from './recorrencia.ts';
import {
  alvoAlcancado,
  dataValida,
  descreverDiasQueFaltam,
  diasQueFaltam,
  estagnada,
  formatarValor,
  lerValor,
  MAX_METAS_ATIVAS,
  normalizarMeta,
  podeAtivarMeta,
  pontosDaLinha,
  progressoDaMeta,
  valorComUnidade,
} from './metas.ts';
import { fimCopiado, lugaresACopiar, sobreposicoesDaSemana } from './proposta.ts';
import { encaixarMeiaHora, formatarHoras, MAX_AREAS, podeCriarArea, progresso } from './regras.ts';
import { descreverData, descreverSemana, diasDaSemana, inicioDaSemana, somarMeses, somarSemanas } from './semana.ts';

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

  it('descreve datas e soma meses sem sair do mês', () => {
    assert.equal(descreverData('2027-03-31'), '31 mar 2027');
    assert.equal(somarMeses('2026-11-16', 3), '2027-02-16');
    assert.equal(somarMeses('2027-01-31', 1), '2027-02-28');
    assert.equal(somarMeses('2026-11-30', 12), '2027-11-30');
  });
});

describe('regras', () => {
  it('limita a 7 áreas ativas', () => {
    assert.equal(MAX_AREAS, 7);
    assert.equal(podeCriarArea(6), true);
    assert.equal(podeCriarArea(7), false);
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
  it('limita a 3 metas ativas por área', () => {
    assert.equal(MAX_METAS_ATIVAS, 3);
    assert.equal(podeAtivarMeta(2), true);
    assert.equal(podeAtivarMeta(3), false);
  });

  it('mede o caminho feito, a subir e a descer', () => {
    assert.equal(progressoDaMeta({ valorInicial: 20, valorAtual: 40, valorAlvo: 60 }), 0.5, '20 → 60 min seguidos, vai em 40');
    assert.equal(progressoDaMeta({ valorInicial: 55, valorAtual: 52, valorAlvo: 50 }), 0.6, '10 km: 55 → 50 min, vai em 52');
    assert.equal(progressoDaMeta({ valorInicial: 80, valorAtual: 82, valorAlvo: 75 }), 0, 'andar para trás não dá progresso negativo');
    assert.equal(progressoDaMeta({ valorInicial: 20, valorAtual: 70, valorAlvo: 60 }), 1, 'passar o alvo fica em 100%');
  });

  it('sabe quando o alvo foi alcançado, nos dois sentidos', () => {
    assert.equal(alvoAlcancado({ valorInicial: 20, valorAtual: 60, valorAlvo: 60 }), true);
    assert.equal(alvoAlcancado({ valorInicial: 20, valorAtual: 59, valorAlvo: 60 }), false);
    assert.equal(alvoAlcancado({ valorInicial: 55, valorAtual: 49.5, valorAlvo: 50 }), true);
    assert.equal(alvoAlcancado({ valorInicial: 80, valorAtual: 76, valorAlvo: 75 }), false);
  });

  it('deteta que a meta não avançou nas últimas 3 atualizações', () => {
    assert.equal(estagnada(20, 60, [25, 25]), false, 'ainda só há 2 atualizações');
    assert.equal(estagnada(20, 60, [20, 20, 20]), true, 'três atualizações sem sair do ponto de partida');
    assert.equal(estagnada(20, 60, [25, 25, 25, 24]), true, 'as últimas três não passaram do valor anterior');
    assert.equal(estagnada(20, 60, [25, 25, 25, 26]), false, 'a última avançou');
    assert.equal(estagnada(20, 60, [30, 25, 26, 26]), true, 'recuou e ainda não voltou aos 30');
    assert.equal(estagnada(20, 60, [30, 25, 26, 31]), false, 'passou os 30');
    assert.equal(estagnada(55, 50, [53.5, 53, 53, 53.2, 53]), true, 'a descer: oscilar à volta de 53 não é avançar');
    assert.equal(estagnada(55, 50, [53.5, 53, 53, 53.2, 52.5]), false, 'a descer: 52,5 é melhor do que 53');
    assert.equal(estagnada(80, 75, [79, 79, 79, 80]), true, 'a descer: subir não é avançar');
  });

  it('conta os dias que faltam para o prazo', () => {
    assert.equal(diasQueFaltam('2026-11-16', '2027-03-31'), 135);
    assert.equal(diasQueFaltam('2026-11-16', '2026-11-16'), 0);
    assert.equal(diasQueFaltam('2026-11-16', '2026-11-13'), -3);
    assert.equal(diasQueFaltam('2027-03-27', '2027-03-29'), 2, 'não se engana na mudança da hora');
    assert.equal(descreverDiasQueFaltam(135), 'faltam 135 dias');
    assert.equal(descreverDiasQueFaltam(1), 'falta 1 dia');
    assert.equal(descreverDiasQueFaltam(0), 'termina hoje');
    assert.equal(descreverDiasQueFaltam(-3), 'o prazo passou há 3 dias');
  });

  it('lê e escreve números à portuguesa', () => {
    assert.equal(formatarValor(52.5), '52,5');
    assert.equal(formatarValor(60), '60');
    assert.equal(valorComUnidade(35, 'min seguidos'), '35 min seguidos');
    assert.equal(valorComUnidade(35, null), '35');
    assert.equal(lerValor('52,5'), 52.5);
    assert.equal(lerValor(' 60 '), 60);
    assert.equal(lerValor(''), null);
    assert.equal(lerValor('dez'), null);
  });

  it('valida a meta antes de a guardar', () => {
    assert.equal(dataValida('2027-02-28'), true);
    assert.equal(dataValida('2027-02-31'), false);
    assert.throws(() => normalizarMeta({ descricao: ' ', prazo: '2027-03-31', medida: 'marco' }), /descrição/);
    assert.throws(() => normalizarMeta({ descricao: 'Correr 10 km', prazo: '', medida: 'marco' }), /prazo/);
    assert.throws(() => normalizarMeta({ descricao: 'Correr 10 km', prazo: '2027-03-31', medida: 'numero', valorInicial: 55 }), /chegar/);
    assert.throws(() => normalizarMeta({ descricao: 'Correr 10 km', prazo: '2027-03-31', medida: 'numero', valorInicial: 50, valorAlvo: 50 }), /diferente/);
    assert.deepEqual(normalizarMeta({ descricao: ' Viagem com os pais ', prazo: '2027-03-31', medida: 'marco', valorInicial: 3, unidade: 'x' }), {
      descricao: 'Viagem com os pais',
      prazo: '2027-03-31',
      medida: 'marco',
      valorInicial: null,
      valorAlvo: null,
      unidade: null,
    });
  });

  it('monta a linha de progresso a partir do valor inicial', () => {
    assert.deepEqual(pontosDaLinha('2026-11-01', 20, [{ data: '2026-11-15', valor: 30 }, { data: '2026-11-08', valor: 25 }]), [
      { data: '2026-11-01', valor: 20 },
      { data: '2026-11-08', valor: 25 },
      { data: '2026-11-15', valor: 30 },
    ]);
  });
});

describe('proposta da semana', () => {
  const bloco = (id: number, dia: number, inicioMin: number, fimMin: number, areaId: number | null = 1) => ({ id, dia, inicioMin, fimMin, nome: `B${id}`, areaId });

  it('copia os lugares que a semana ainda não tem, até ao número de instâncias livres', () => {
    const origem = [
      { dia: 2, inicioMin: 390, fimMin: 510 },
      { dia: 0, inicioMin: 390, fimMin: 510 },
      { dia: 1, inicioMin: 390, fimMin: 510 },
    ];
    assert.deepEqual(lugaresACopiar(origem, [], 7).map((l) => l.dia), [0, 1, 2]);
    assert.deepEqual(lugaresACopiar(origem, [{ dia: 1, inicioMin: 390 }], 7).map((l) => l.dia), [0, 2], 'o de terça já lá está');
    assert.deepEqual(lugaresACopiar(origem, [], 2).map((l) => l.dia), [0, 1], 'só há duas instâncias livres');
    assert.deepEqual(lugaresACopiar(origem, [], 0), []);
  });

  it('o bloco copiado segue a duração de agora, a não ser que tenha sido ajustado à mão', () => {
    assert.equal(fimCopiado({ dia: 0, inicioMin: 390, fimMin: 510 }, 120, 60), 450, 'a tarefa passou de 2 h para 1 h');
    assert.equal(fimCopiado({ dia: 0, inicioMin: 390, fimMin: 480 }, 120, 60), 480, 'o bloco tinha sido encurtado para 1,5 h: fica');
    assert.equal(fimCopiado({ dia: 0, inicioMin: 23 * 60, fimMin: 24 * 60 }, 60, 180), 24 * 60, 'não passa da meia-noite');
  });

  it('encontra as sobreposições da semana', () => {
    const blocos = [bloco(1, 0, 540, 660), bloco(2, 0, 600, 720), bloco(3, 0, 720, 780), bloco(4, 1, 540, 660), bloco(5, 0, 630, 640)];
    assert.deepEqual(
      sobreposicoesDaSemana(blocos).map((s) => [s.a.id, s.b.id, s.inicioMin, s.fimMin]),
      [
        [1, 2, 600, 660],
        [1, 5, 630, 640],
        [2, 5, 630, 640],
      ],
    );
    assert.deepEqual(sobreposicoesDaSemana([bloco(1, 0, 540, 600), bloco(2, 0, 600, 660)]), [], 'um a seguir ao outro não é sobreposição');
  });
});
