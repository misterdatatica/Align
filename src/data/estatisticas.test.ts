/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas, metas } from '../db/schema.ts';
import { descreverPeriodo, periodoDe, semanasDoPeriodo, somarPeriodo } from '../domain/estatisticas.ts';
import { alocarTarefa, carregarCalendario, marcarBlocoFeito } from './calendario.ts';
import { carregarEstatisticas } from './estatisticas.ts';
import { criarMeta, mudarEstadoDaMeta, registarValor } from './metas.ts';
import { fecharRevisao, guardarReflexao } from './revisao.ts';
import { planearSemana } from './semanas.ts';
import { criarTarefa, garantirSemana } from './tarefas.ts';

const S16 = '2026-11-16';
const S23 = '2026-11-23';
const NO_DIA_16 = new Date(2026, 10, 16);
const HOJE = '2026-11-25';
const NOVEMBRO = { tipo: 'mes' as const, inicio: '2026-11-01' };

function novaArea(nome: string, cor = 'violeta'): number {
  return db.insert(areas).values({ nome, cor, icone: 'folha' }).returning({ id: areas.id }).get().id;
}

/**
 * Duas semanas de novembro: Meditar 1 h à segunda e à quarta (feita só à segunda, nas duas semanas) e
 * um Relatório de 2 h que ficou por fazer na primeira e passou para a segunda. A revisão da primeira
 * fechou, com uma reflexão.
 */
function cenario() {
  garantirSemana(S16, NO_DIA_16);
  const espiritual = novaArea('Espiritual');
  const trabalho = novaArea('Trabalho', 'azul');
  const meditar = criarTarefa({ areaId: espiritual, nome: 'Meditar', duracaoMin: 60, recorrencia: { tipo: 'dias', dias: [1, 3] } }, S16);
  const relatorio = criarTarefa({ areaId: trabalho, nome: 'Relatório', duracaoMin: 120, recorrencia: null }, S16);
  marcarBlocoFeito(alocarTarefa(meditar, S16, '2026-11-16', 7 * 60), true);
  alocarTarefa(meditar, S16, '2026-11-18', 7 * 60);
  alocarTarefa(relatorio, S16, '2026-11-17', 9 * 60);
  guardarReflexao(S16, { correuBem: 'Meditei de manhã.', queroMudar: '' });
  fecharRevisao(S16, [relatorio], NO_DIA_16);
  planearSemana(S23, NO_DIA_16);
  const segunda = carregarCalendario(S23).blocos.find((b) => b.nome === 'Meditar' && b.dia === 0);
  assert.ok(segunda);
  marcarBlocoFeito(segunda.id, true);
  return { espiritual, trabalho };
}

beforeEach(() => prepararBd());

describe('períodos', () => {
  it('uma semana conta para o mês da sua quinta-feira', () => {
    assert.deepEqual(semanasDoPeriodo(NOVEMBRO), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    assert.deepEqual(semanasDoPeriodo({ tipo: 'mes', inicio: '2026-12-01' }), ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28']);
    const ano = semanasDoPeriodo({ tipo: 'ano', inicio: '2026-01-01' });
    assert.deepEqual([ano.length, ano[0], ano[ano.length - 1]], [53, '2025-12-29', '2026-12-28'], '2026 começa a uma quinta-feira: tem 53 semanas');
  });

  it('anda pelos meses e anos e descreve-os', () => {
    assert.deepEqual(periodoDe('mes', '2026-11-25'), NOVEMBRO);
    assert.deepEqual(somarPeriodo({ tipo: 'mes', inicio: '2026-12-01' }, 1), { tipo: 'mes', inicio: '2027-01-01' });
    assert.deepEqual(somarPeriodo(periodoDe('ano', '2026-11-25'), -1), { tipo: 'ano', inicio: '2025-01-01' });
    assert.equal(descreverPeriodo(NOVEMBRO), 'novembro de 2026');
    assert.equal(descreverPeriodo({ tipo: 'ano', inicio: '2026-01-01' }), '2026');
  });
});

describe('estatísticas', () => {
  it('soma as horas planeadas e feitas por semana e por área, como na revisão', () => {
    cenario();
    const e = carregarEstatisticas(NOVEMBRO, HOJE);
    assert.deepEqual(
      e.colunas.map((c) => [c.chave, c.minutosPlaneados, c.minutosFeitos, c.futura]),
      [
        ['2026-11-02', 0, 0, false],
        ['2026-11-09', 0, 0, false],
        [S16, 240, 60, false],
        [S23, 240, 60, false],
      ],
    );
    assert.deepEqual([e.minutosPlaneados, e.minutosFeitos, e.vezesFeitas, e.semanasPlaneadas, e.revisoesFechadas], [480, 120, 2, 2, 1]);
    assert.deepEqual(
      e.areas.map((a) => [a.nome, a.minutosPlaneados, a.minutosFeitos]),
      [
        ['Espiritual', 240, 120],
        ['Trabalho', 240, 0],
      ],
    );
  });

  it('conta o que ficou por fazer nas semanas que já acabaram, e junta as reflexões', () => {
    cenario();
    const e = carregarEstatisticas(NOVEMBRO, HOJE);
    assert.deepEqual(
      e.porFazer.map((p) => [p.nome, p.vezes]),
      [
        ['Meditar', 1],
        ['Relatório', 1],
      ],
      'a semana atual ainda não conta',
    );
    assert.deepEqual(e.reflexoes, [{ semana: S16, correuBem: 'Meditei de manhã.', queroMudar: '' }]);
  });

  it('mostra as metas concluídas no período e a evolução das metas de número', () => {
    const { espiritual } = cenario();
    const numero = criarMeta({ areaId: espiritual, descricao: 'Meditar 1 h seguida', prazo: '2027-03-31', medida: 'numero', valorInicial: 20, valorAlvo: 60, unidade: 'min' });
    registarValor(numero, 30, '2026-10-20');
    registarValor(numero, 40, '2026-11-10');
    const marco = criarMeta({ areaId: espiritual, descricao: 'Retiro', prazo: '2027-03-31', medida: 'marco', valorInicial: null, valorAlvo: null, unidade: null });
    mudarEstadoDaMeta(marco, 'concluida');
    assert.ok(db.select().from(metas).where(eq(metas.id, marco)).get()?.concluidaEm, 'concluir guarda a data');
    db.update(metas).set({ concluidaEm: '2026-11-12T10:00:00.000Z' }).where(eq(metas.id, marco)).run();

    const e = carregarEstatisticas(NOVEMBRO, HOJE);
    assert.deepEqual(e.metasConcluidas.map((m) => m.descricao), ['Retiro']);
    assert.deepEqual(
      e.evolucaoDasMetas.map((m) => [m.descricao, m.de, m.para, m.progresso]),
      [['Meditar 1 h seguida', 30, 40, 0.5]],
    );
    assert.deepEqual(carregarEstatisticas({ tipo: 'mes', inicio: '2026-10-01' }, HOJE).evolucaoDasMetas.map((m) => [m.de, m.para]), [[20, 30]], 'em outubro: de 20 (partida) a 30');

    mudarEstadoDaMeta(marco, 'ativa');
    assert.equal(db.select().from(metas).where(eq(metas.id, marco)).get()?.concluidaEm, null, 'voltar a ativar apaga a data');
  });

  it('no ano, as colunas são os meses, e os que ainda não chegaram ficam vazios', () => {
    cenario();
    const e = carregarEstatisticas({ tipo: 'ano', inicio: '2026-01-01' }, HOJE);
    assert.equal(e.colunas.length, 12);
    assert.deepEqual([e.colunas[10].rotulo, e.colunas[10].minutosPlaneados, e.colunas[10].minutosFeitos, e.colunas[10].futura], ['nov', 480, 120, false]);
    assert.equal(e.colunas[11].futura, true);
    assert.deepEqual([e.minutosPlaneados, e.minutosFeitos], [480, 120]);
  });

  it('um período sem nada dá tudo a zero', () => {
    const e = carregarEstatisticas({ tipo: 'mes', inicio: '2026-03-01' }, HOJE);
    assert.deepEqual([e.minutosPlaneados, e.areas, e.porFazer, e.reflexoes, e.metasConcluidas], [0, [], [], [], []]);
  });
});
