/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas, metas, metasRegistos, semanas, tarefas } from '../db/schema.ts';
import { alocarTarefa, carregarCalendario, criarOcupado, marcarBlocoFeito } from './calendario.ts';
import { exportarDados, importarDados, lerCopia, resumirCopia } from './copia.ts';
import { carregarDefinicoes, guardarDefinicoes } from './definicoes.ts';
import { carregarMetasDaArea, criarMeta, registarValor } from './metas.ts';
import { carregarRevisao, guardarReflexao } from './revisao.ts';
import { carregarPlanoDaSemana } from './semanas.ts';
import { carregarPlano, criarTarefa, garantirSemana } from './tarefas.ts';

const S1 = '2026-11-09';

/** Um pouco de tudo: área, meta com histórico, tarefas, blocos, semana planeada, revisão e definições. */
function encherDeDados() {
  const area = db.insert(areas).values({ nome: 'Espiritual', cor: 'violeta', icone: 'folha', missao: 'Viver com calma e clareza.' }).returning({ id: areas.id }).get().id;
  const meta = criarMeta({ areaId: area, descricao: 'Conseguir meditar 1 h seguida', prazo: '2027-03-31', medida: 'numero', valorInicial: 20, valorAlvo: 60, unidade: 'min seguidos' });
  registarValor(meta, 25, '2026-11-12');
  garantirSemana(S1, new Date(2026, 10, 9));
  const meditar = criarTarefa({ areaId: area, metaId: meta, nome: 'Meditar', duracaoMin: 120, recorrencia: { tipo: 'diaria' } }, S1);
  criarTarefa({ areaId: area, nome: 'Lição ACIM', duracaoMin: null, recorrencia: { tipo: 'dias', dias: [1, 3, 5] } }, S1);
  marcarBlocoFeito(alocarTarefa(meditar, S1, '2026-11-09', 390), true);
  alocarTarefa(meditar, S1, '2026-11-10', 390);
  criarOcupado('2026-11-11', 840, 900, 'Médico');
  guardarReflexao(S1, { correuBem: 'Comecei.' });
  guardarDefinicoes({ diaRevisao: 5, horaRevisao: '19:30', lembreteAtivo: true });
}

function retrato() {
  return {
    plano: carregarPlano(S1),
    calendario: carregarCalendario(S1),
    revisao: carregarRevisao('2026-11-13'),
    metas: carregarMetasDaArea(1, S1, '2026-11-13'),
    semana: carregarPlanoDaSemana(S1, '2026-11-13'),
    definicoes: carregarDefinicoes(),
  };
}

beforeEach(() => prepararBd());

describe('cópia de segurança', () => {
  it('exportar, apagar tudo e importar recupera os mesmos dados (critério de aceitação 11)', () => {
    encherDeDados();
    const antes = retrato();
    const texto = JSON.stringify(exportarDados(new Date(2026, 10, 14)));

    prepararBd(); // como uma app acabada de instalar
    assert.equal(db.select().from(areas).all().length, 0);

    const copia = lerCopia(texto);
    assert.equal(resumirCopia(copia), '1 área e 2 tarefas');
    importarDados(copia);
    assert.deepEqual(retrato(), antes);
    assert.deepEqual(
      db.select({ recorrencia: tarefas.recorrencia }).from(tarefas).all(),
      [{ recorrencia: { tipo: 'diaria' } }, { recorrencia: { tipo: 'dias', dias: [1, 3, 5] } }],
    );
  });

  it('importar substitui o que lá estava', () => {
    encherDeDados();
    const copia = lerCopia(JSON.stringify(exportarDados()));
    db.insert(areas).values({ nome: 'Outra', cor: 'azul', icone: 'pasta' }).run();
    importarDados(copia);
    assert.deepEqual(
      db.select({ nome: areas.nome }).from(areas).all(),
      [{ nome: 'Espiritual' }],
    );
  });

  it('recusa ficheiros que não são cópias desta app', () => {
    assert.throws(() => lerCopia('isto não é JSON'), /válida/);
    assert.throws(() => lerCopia('{"app":"outra","versao":1,"dados":{}}'), /desta app/);
    assert.throws(() => lerCopia('{"app":"align","versao":99,"dados":{}}'), /mais recente/);
    assert.throws(() => lerCopia('{"app":"align","versao":1,"dados":{"areas":[]}}'), /incompleta/);
  });

  it('lê uma cópia da versão 1: as metas de alvo semanal ficam pausadas e as semanas com dados ficam aceites', () => {
    const antiga = {
      app: 'align',
      versao: 1,
      exportadoEm: '2026-11-14T10:00:00.000Z',
      dados: {
        areas: [{ id: 1, nome: 'Espiritual', cor: 'violeta', icone: 'folha', missao: '', ordem: 0, arquivada: false, criadoEm: '2026-11-01T10:00:00.000Z', atualizadoEm: '2026-11-01T10:00:00.000Z' }],
        metas: [
          { id: 1, areaId: 1, descricao: 'Meditar', tipo: 'horas', alvoSemanal: 14, periodo: 'dia', unidade: null, criadoEm: '2026-11-01T10:00:00.000Z', atualizadoEm: '2026-11-01T10:00:00.000Z' },
          { id: 2, areaId: 1, descricao: 'A Course in Miracles', tipo: 'vezes', alvoSemanal: 3, periodo: 'semana', unidade: 'lição', criadoEm: '2026-11-01T10:00:00.000Z', atualizadoEm: '2026-11-01T10:00:00.000Z' },
        ],
        tarefas: [{ id: 1, areaId: 1, metaId: 1, nome: 'Meditar', nomeCurto: null, duracaoMin: 120, recorrencia: { tipo: 'diaria' }, semanaInicio: S1, semanaFim: null, criadoEm: '2026-11-09T10:00:00.000Z', atualizadoEm: '2026-11-09T10:00:00.000Z' }],
        tarefasSemana: [
          { id: 1, tarefaId: 1, semana: S1, estado: 'alocada', transitadaDe: null, criadoEm: '2026-11-09T10:00:00.000Z', atualizadoEm: '2026-11-09T10:00:00.000Z' },
          { id: 2, tarefaId: 1, semana: '2026-11-23', estado: 'por_alocar', transitadaDe: null, criadoEm: '2026-11-09T10:00:00.000Z', atualizadoEm: '2026-11-09T10:00:00.000Z' },
        ],
        blocos: [
          { id: 1, tarefaSemanaId: 1, titulo: null, inicio: '2026-11-09T06:30', fim: '2026-11-09T08:30', feito: false, criadoEm: '2026-11-09T10:00:00.000Z', atualizadoEm: '2026-11-09T10:00:00.000Z' },
          { id: 2, tarefaSemanaId: null, titulo: 'Médico', inicio: '2026-11-08T14:00', fim: '2026-11-08T15:00', feito: false, criadoEm: '2026-11-09T10:00:00.000Z', atualizadoEm: '2026-11-09T10:00:00.000Z' },
        ],
        revisoes: [],
        definicoes: [],
      },
    };
    importarDados(lerCopia(JSON.stringify(antiga), new Date(2026, 10, 14)));

    assert.deepEqual(
      db.select({ descricao: metas.descricao, prazo: metas.prazo, medida: metas.medida, estado: metas.estado }).from(metas).all(),
      [
        { descricao: 'Meditar — 2 h por dia', prazo: '2027-02-14', medida: 'marco', estado: 'pausada' },
        { descricao: 'A Course in Miracles — 3× por semana (lição)', prazo: '2027-02-14', medida: 'marco', estado: 'pausada' },
      ],
    );
    assert.equal(db.select().from(metasRegistos).all().length, 0);
    assert.equal(db.select({ metaId: tarefas.metaId }).from(tarefas).get()?.metaId, 1, 'a tarefa continua ligada à meta');
    assert.deepEqual(
      db.select({ semana: semanas.semana, estado: semanas.estado }).from(semanas).orderBy(semanas.semana).all(),
      [
        { semana: '2026-11-02', estado: 'aceite' },
        { semana: S1, estado: 'aceite' },
      ],
      'a semana do bloco Ocupado e a semana com tarefas; a de 23 nov, ainda sem blocos, fica por planear',
    );
  });

  it('uma cópia estragada não apaga os dados atuais', () => {
    encherDeDados();
    const copia = lerCopia(JSON.stringify(exportarDados()));
    // Uma tarefa a apontar para uma área que não existe: a importação falha a meio…
    copia.dados.tarefas[0] = { ...copia.dados.tarefas[0], areaId: 999 };
    assert.throws(() => importarDados(copia));
    // …e fica tudo como estava.
    assert.equal(db.select().from(areas).all().length, 1);
    assert.equal(db.select().from(tarefas).all().length, 2);
  });
});
