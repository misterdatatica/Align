/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { asc, eq } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas, revisoes, tarefasSemana } from '../db/schema.ts';
import { diaEmQueAbre, percentagemCumprida, revisaoDisponivel } from '../domain/revisao.ts';
import { alocarTarefa, marcarBlocoFeito } from './calendario.ts';
import { guardarDefinicoes } from './definicoes.ts';
import { carregarRevisao, fecharRevisao, guardarReflexao, reabrirRevisao, responderBloco, revisaoPorFazer, semanaEmRevisao } from './revisao.ts';
import { carregarPlano, criarTarefa } from './tarefas.ts';

// Semana de 9 a 15 nov 2026 e a seguinte.
const S1 = '2026-11-09';
const S2 = '2026-11-16';
const SABADO = '2026-11-14';
const DOMINGO = '2026-11-15';
const SEGUNDA_SEGUINTE = '2026-11-16';
/** O domingo da revisão, como data: os testes não dependem do dia em que correm. */
const HOJE = new Date(2026, 10, 15);

function novaArea(nome: string, cor = 'violeta'): number {
  return db.insert(areas).values({ nome, cor, icone: 'folha' }).returning({ id: areas.id }).get().id;
}

const estados = (tarefaId: number, semana: string) =>
  db
    .select({ estado: tarefasSemana.estado, semana: tarefasSemana.semana, transitadaDe: tarefasSemana.transitadaDe })
    .from(tarefasSemana)
    .where(eq(tarefasSemana.tarefaId, tarefaId))
    .orderBy(asc(tarefasSemana.id))
    .all()
    .filter((i) => i.semana === semana);

/** A semana do design: Meditar todos os dias, um curso por fazer e uma chamada por alocar. */
function semanaDeExemplo() {
  const espiritual = novaArea('Espiritual');
  const trabalho = novaArea('Trabalho', 'azul');
  const familia = novaArea('Família', 'laranja');
  const meditar = criarTarefa({ areaId: espiritual, nome: 'Meditar', duracaoMin: 120, recorrencia: { tipo: 'diaria' } }, S1);
  const curso = criarTarefa({ areaId: trabalho, nome: 'Curso online', duracaoMin: 120, recorrencia: null }, S1);
  const orcamento = criarTarefa({ areaId: trabalho, nome: 'Rever orçamento', duracaoMin: 60, recorrencia: null }, S1);
  const avos = criarTarefa({ areaId: familia, nome: 'Ligar aos avós', duracaoMin: 30, recorrencia: null }, S1);
  // Meditar: 5 dias no calendário, 4 feitos. Orçamento feito. Curso no calendário mas por marcar. Avós por alocar.
  const blocosMeditar = [0, 1, 2, 3, 4].map((dia) => alocarTarefa(meditar, S1, `2026-11-${String(9 + dia).padStart(2, '0')}`, 390));
  blocosMeditar.slice(0, 4).forEach((b) => marcarBlocoFeito(b, true));
  marcarBlocoFeito(alocarTarefa(orcamento, S1, '2026-11-10', 540), true);
  const blocoCurso = alocarTarefa(curso, S1, '2026-11-12', 540);
  return { meditar, curso, orcamento, avos, blocoCurso, blocoMeditarPorMarcar: blocosMeditar[4] };
}

beforeEach(() => prepararBd());

describe('quando há revisão', () => {
  it('abre no dia escolhido e mantém-se até ser fechada', () => {
    assert.equal(revisaoDisponivel(SABADO, 0), false);
    assert.equal(revisaoDisponivel(DOMINGO, 0), true);
    assert.equal(revisaoDisponivel('2026-11-13', 5), true, 'revisão à sexta');
    assert.equal(diaEmQueAbre(S1, 0), DOMINGO);
    assert.equal(diaEmQueAbre(S1, 5), '2026-11-13');
    assert.equal(percentagemCumprida(26.5 * 60, 34.5 * 60), 77);
    assert.equal(percentagemCumprida(60, 0), 0);
  });

  it('escolhe a semana a rever', () => {
    semanaDeExemplo();
    assert.deepEqual(semanaEmRevisao(SABADO), { semana: S1, disponivel: false }, 'antes de domingo é só antevisão');
    assert.deepEqual(semanaEmRevisao(DOMINGO), { semana: S1, disponivel: true });
    assert.deepEqual(semanaEmRevisao(SEGUNDA_SEGUINTE), { semana: S1, disponivel: true }, 'por fechar, continua disponível na semana seguinte');
    assert.deepEqual(revisaoPorFazer(SEGUNDA_SEGUINTE), { semana: S1, diaRevisao: 0 });
    fecharRevisao(S1, [], HOJE);
    assert.deepEqual(semanaEmRevisao(SEGUNDA_SEGUINTE), { semana: S2, disponivel: false });
    assert.equal(revisaoPorFazer(SEGUNDA_SEGUINTE), null);

    guardarDefinicoes({ diaRevisao: 5 });
    assert.deepEqual(semanaEmRevisao('2026-11-20'), { semana: S2, disponivel: true }, 'com a revisão à sexta');
  });

  it('sem tarefas na semana anterior não há nada para rever', () => {
    assert.deepEqual(semanaEmRevisao(SEGUNDA_SEGUINTE), { semana: S2, disponivel: false });
    assert.equal(revisaoPorFazer(DOMINGO), null);
  });
});

describe('conteúdo da revisão', () => {
  it('soma horas feitas e planeadas, no total e por área (critério de aceitação 7)', () => {
    semanaDeExemplo();
    const r = carregarRevisao(DOMINGO);
    assert.equal(r.semana, S1);
    assert.equal(r.minutosPlaneados, 14 * 60 + 120 + 60 + 30);
    assert.equal(r.minutosFeitos, 4 * 120 + 60);
    assert.deepEqual(
      r.areas.map((a) => [a.nome, a.minutosFeitos, a.minutosPlaneados]),
      [
        ['Espiritual', 480, 840],
        ['Trabalho', 60, 180],
        ['Família', 0, 30],
      ],
    );
  });

  it('pergunta "Feito?" pelos blocos por marcar e lista as tarefas únicas por fazer', () => {
    const { blocoCurso, blocoMeditarPorMarcar } = semanaDeExemplo();
    let r = carregarRevisao(DOMINGO);
    assert.deepEqual(
      r.porConfirmar.map((b) => [b.nome, b.dia, b.inicioMin]),
      [
        ['Curso online', 3, 540],
        ['Meditar', 4, 390],
      ],
    );
    assert.deepEqual(
      r.porFazer.map((t) => t.nome),
      ['Curso online', 'Ligar aos avós'],
      'as recorrentes e as feitas não entram',
    );

    responderBloco(blocoMeditarPorMarcar, true);
    responderBloco(blocoCurso, false);
    r = carregarRevisao(DOMINGO);
    assert.equal(r.porConfirmar.length, 0);
    assert.equal(r.minutosFeitos, 5 * 120 + 60);
    assert.deepEqual(
      r.porFazer.map((t) => t.nome),
      ['Curso online', 'Ligar aos avós'],
    );
  });

  it('guarda as notas de reflexão enquanto a revisão está aberta', () => {
    semanaDeExemplo();
    guardarReflexao(S1, { correuBem: ' Meditei quase todos os dias. ' });
    guardarReflexao(S1, { queroMudar: 'Alocar o curso logo à segunda.' });
    const r = carregarRevisao(DOMINGO);
    assert.equal(r.correuBem, 'Meditei quase todos os dias.');
    assert.equal(r.queroMudar, 'Alocar o curso logo à segunda.');
    assert.equal(r.fechadaEm, null);
    assert.equal(db.select().from(revisoes).all().length, 1);
  });
});

describe('fechar a revisão', () => {
  it('passa as tarefas escolhidas para a semana seguinte (critério de aceitação 8)', () => {
    const { meditar, curso, avos } = semanaDeExemplo();
    guardarReflexao(S1, { correuBem: 'Boa semana.' });
    fecharRevisao(S1, [curso, meditar], HOJE);

    const r = carregarRevisao(DOMINGO);
    assert.ok(r.fechadaEm);
    assert.equal(r.correuBem, 'Boa semana.');
    assert.deepEqual(
      r.porFazer.map((t) => [t.nome, t.transitou]),
      [
        ['Curso online', true],
        ['Ligar aos avós', false],
      ],
    );

    assert.deepEqual(estados(curso, S1), [{ estado: 'nao_feita', semana: S1, transitadaDe: null }]);
    assert.deepEqual(estados(curso, S2), [{ estado: 'por_alocar', semana: S2, transitadaDe: S1 }]);
    assert.deepEqual(estados(avos, S2), [], 'não foi escolhida');
    assert.equal(estados(meditar, S2).length, 7, 'a recorrente recebe instâncias novas…');
    assert.ok(estados(meditar, S2).every((i) => i.transitadaDe === null), '…mas não transita');
    assert.deepEqual(
      estados(meditar, S1).map((i) => i.estado),
      ['feita', 'feita', 'feita', 'feita', 'nao_feita', 'nao_feita', 'nao_feita'],
    );

    const seguinte = carregarPlano(S2);
    const linhaCurso = seguinte.areas.flatMap((a) => a.tarefas).find((t) => t.nome === 'Curso online');
    assert.equal(linhaCurso?.veioDaSemanaPassada, true);
    assert.equal(linhaCurso?.porAlocar, 1);
  });

  it('fechar duas vezes não duplica, e reabrir repõe os estados', () => {
    const { curso, blocoCurso } = semanaDeExemplo();
    fecharRevisao(S1, [curso], HOJE);
    fecharRevisao(S1, [curso], HOJE);
    assert.equal(estados(curso, S2).length, 1);

    reabrirRevisao(S1);
    const r = carregarRevisao(DOMINGO);
    assert.equal(r.fechadaEm, null);
    assert.deepEqual(
      r.porConfirmar.map((b) => b.blocoId).includes(blocoCurso),
      true,
      'o bloco volta a estar por marcar',
    );
    assert.deepEqual(estados(curso, S1), [{ estado: 'alocada', semana: S1, transitadaDe: null }]);
  });
});
