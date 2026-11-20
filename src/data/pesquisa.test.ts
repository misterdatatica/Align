/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas } from '../db/schema.ts';
import { carregarTodasAsMetas, criarMeta, mudarEstadoDaMeta } from './metas.ts';
import { corresponde, normalizarTexto, pesquisar } from './pesquisa.ts';
import { criarTarefa, editarTarefa, garantirSemana } from './tarefas.ts';

const S1 = '2026-11-09';
const S2 = '2026-11-16';
const HOJE = '2026-11-18';

function novaArea(nome: string): number {
  return db.insert(areas).values({ nome, cor: 'violeta', icone: 'folha', missao: 'Viver com calma' }).returning({ id: areas.id }).get().id;
}
const arquivar = (id: number) => db.update(areas).set({ arquivada: true }).where(eq(areas.id, id)).run();

beforeEach(() => prepararBd());

describe('pesquisa', () => {
  it('não liga a maiúsculas nem a acentos, e aceita as palavras por qualquer ordem', () => {
    assert.equal(normalizarTexto('  Lição ACIM '), 'licao acim');
    assert.ok(corresponde('Lição ACIM', 'licao'));
    assert.ok(corresponde('Rever o orçamento de casa', 'casa orcamento'));
    assert.ok(!corresponde('Rever o orçamento', 'orçamento férias'));
  });

  it('encontra áreas, metas e tarefas em vigor, e abre as tarefas na semana certa', () => {
    garantirSemana(S1, new Date(2026, 10, 10));
    const espiritual = novaArea('Espiritual');
    const arquivada = novaArea('Antiga');
    criarMeta({ areaId: espiritual, descricao: 'Meditar 1 h seguida', prazo: '2027-03-31', medida: 'marco', valorInicial: null, valorAlvo: null, unidade: null });
    const meditar = criarTarefa({ areaId: espiritual, nome: 'Meditar', duracaoMin: 60, recorrencia: { tipo: 'diaria' } }, S1);
    criarTarefa({ areaId: espiritual, nome: 'Meditação guiada', duracaoMin: null, recorrencia: null }, S1);
    criarTarefa({ areaId: arquivada, nome: 'Meditar antigo', duracaoMin: null, recorrencia: null }, S1);
    arquivar(arquivada);
    // Alterar em S2 cria uma versão nova: só essa aparece.
    const nova = editarTarefa(meditar, S2, { areaId: espiritual, nome: 'Meditar', duracaoMin: 90, recorrencia: { tipo: 'diaria' } });

    const r = pesquisar('medit', S2);
    assert.deepEqual(r.metas.map((m) => m.descricao), ['Meditar 1 h seguida']);
    assert.deepEqual(r.tarefas.map((tf) => [tf.nome, tf.semana]), [
      ['Meditação guiada', S1],
      ['Meditar', S2],
    ], 'a que repete abre na semana atual; a única, na última semana em que esteve');
    assert.equal(r.tarefas[1].id, nova, 'só a versão em vigor da tarefa alterada');
    assert.deepEqual(pesquisar('calma', S2).areas.map((a) => a.nome), ['Espiritual'], 'as áreas encontram-se também pela missão');
    assert.deepEqual(pesquisar('   ', S2), { areas: [], metas: [], tarefas: [] });
  });
});

describe('todas as metas', () => {
  it('lista as metas de todas as áreas, em qualquer estado, sem as das áreas arquivadas', () => {
    const a = novaArea('Saúde');
    const b = novaArea('Trabalho');
    const arquivada = novaArea('Antiga');
    const meta = (areaId: number, descricao: string) => criarMeta({ areaId, descricao, prazo: '2027-03-31', medida: 'marco', valorInicial: null, valorAlvo: null, unidade: null });
    const correr = meta(a, 'Correr 10 km');
    meta(b, 'Promoção');
    const curso = meta(b, 'Acabar o curso');
    meta(arquivada, 'Esquecida');
    arquivar(arquivada);
    mudarEstadoDaMeta(correr, 'concluida');
    mudarEstadoDaMeta(curso, 'abandonada');
    assert.deepEqual(
      carregarTodasAsMetas(S2, HOJE).map((m) => `${m.descricao} (${m.estado})`),
      ['Correr 10 km (concluida)', 'Promoção (ativa)', 'Acabar o curso (abandonada)'],
    );
  });
});
