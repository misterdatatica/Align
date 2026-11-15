/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { prepararBd } from '../../scripts/testes/bd.ts';
import { db } from '../db/client.ts';
import { areas, metas, tarefas } from '../db/schema.ts';
import { alocarTarefa, carregarCalendario, criarOcupado, marcarBlocoFeito } from './calendario.ts';
import { exportarDados, importarDados, lerCopia, resumirCopia } from './copia.ts';
import { carregarDefinicoes, guardarDefinicoes } from './definicoes.ts';
import { carregarRevisao, guardarReflexao } from './revisao.ts';
import { carregarPlano, criarTarefa } from './tarefas.ts';

const S1 = '2026-11-09';

/** Um pouco de tudo: área, meta, tarefas, blocos, revisão e definições. */
function encherDeDados() {
  const area = db.insert(areas).values({ nome: 'Espiritual', cor: 'violeta', icone: 'folha', missao: 'Viver com calma e clareza.' }).returning({ id: areas.id }).get().id;
  const meta = db.insert(metas).values({ areaId: area, descricao: 'Meditar', tipo: 'horas', alvoSemanal: 14, periodo: 'dia' }).returning({ id: metas.id }).get().id;
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
