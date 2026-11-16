/// <reference types="node" />
/**
 * A migração 0003 corre sobre dados reais: aqui aplica-se a uma base de dados com metas de alvo
 * semanal, tarefas e blocos, para confirmar que nada se perde.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

const pasta = path.resolve(import.meta.dirname, '..', '..', 'drizzle');

function aplicar(bd: DatabaseSync, tag: string) {
  for (const instrucao of readFileSync(path.join(pasta, `${tag}.sql`), 'utf8').split('--> statement-breakpoint')) bd.exec(instrucao);
}

/** Segunda-feira da semana de uma data, como a app a calcula. */
function segunda(data: Date): string {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate() - ((data.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const data = new Date(a, m - 1, d + dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

describe('migração para metas de resultado e semanas com plano', () => {
  it('converte os dados que já existiam sem os perder', () => {
    const bd = new DatabaseSync(':memory:');
    // Como na app: as migrações correm dentro de uma transação, com as chaves estrangeiras ligadas.
    bd.exec('PRAGMA foreign_keys = ON');
    for (const tag of ['0000_inicial', '0001_metas_vezes', '0002_tarefas_por_semana']) aplicar(bd, tag);

    const atual = segunda(new Date());
    const passada = somarDias(atual, -7);
    const seguinte = somarDias(atual, 7);
    const depois = somarDias(atual, 14);
    bd.exec(`
      insert into areas (id, nome, cor, icone) values (1, 'Espiritual', 'violeta', 'folha');
      insert into metas (id, area_id, descricao, tipo, alvo_semanal, periodo, unidade) values
        (1, 1, 'Meditar', 'horas', 14, 'dia', null),
        (2, 1, 'Ler', 'horas', 1.5, 'semana', null),
        (3, 1, 'A Course in Miracles', 'vezes', 7, 'dia', 'lição');
      insert into tarefas (id, area_id, meta_id, nome, duracao_min, recorrencia, semana_inicio, semana_fim) values
        (1, 1, 1, 'Meditar', 120, '{"tipo":"diaria"}', '${passada}', '${atual}'),
        (2, 1, 1, 'Meditar', 60, '{"tipo":"diaria"}', '${atual}', null),
        (3, 1, null, 'Dentista', 60, null, '${atual}', null);
      insert into tarefas_semana (id, tarefa_id, semana, estado) values
        (1, 1, '${passada}', 'feita'),
        (2, 2, '${atual}', 'alocada'),
        (3, 2, '${seguinte}', 'por_alocar'),
        (4, 2, '${depois}', 'alocada');
      insert into blocos (tarefa_semana_id, titulo, inicio, fim, feito) values
        (1, null, '${passada}T06:30', '${passada}T08:30', 1),
        (2, null, '${atual}T06:30', '${atual}T07:30', 0),
        (4, null, '${depois}T06:30', '${depois}T07:30', 0),
        (null, 'Médico', '${somarDias(passada, -1)}T14:00', '${somarDias(passada, -1)}T15:00', 0);
    `);

    bd.exec('BEGIN');
    aplicar(bd, '0003_metas_resultado_e_proposta');
    bd.exec('COMMIT');

    const metas = bd.prepare('select id, descricao, medida, estado, unidade, valor_inicial, valor_atual, valor_alvo, prazo from metas order by id').all();
    assert.deepEqual(
      metas.map((m) => [m.id, m.descricao, m.medida, m.estado, m.unidade, m.valor_alvo]),
      [
        [1, 'Meditar — 2 h por dia', 'marco', 'pausada', null, null],
        [2, 'Ler — 1,5 h por semana', 'marco', 'pausada', null, null],
        [3, 'A Course in Miracles — 1× por dia (lição)', 'marco', 'pausada', null, null],
      ],
      'as metas de alvo semanal ficam pausadas, com o alvo antigo na descrição',
    );
    assert.ok(metas.every((m) => /^\d{4}-\d{2}-\d{2}$/.test(String(m.prazo)) && String(m.prazo) > somarDias(atual, 60)), 'com um prazo provisório, a cerca de 3 meses');
    assert.deepEqual(
      bd.prepare("select name from pragma_table_info('metas') order by cid").all().map((c) => c.name),
      ['id', 'area_id', 'descricao', 'criado_em', 'atualizado_em', 'unidade', 'prazo', 'medida', 'valor_inicial', 'valor_atual', 'valor_alvo', 'estado'],
      'o alvo semanal desapareceu das metas',
    );

    assert.deepEqual(
      bd.prepare('select id, meta_id, serie_id from tarefas order by id').all().map((t) => [t.id, t.meta_id, t.serie_id]),
      [
        [1, 1, null],
        [2, 1, 1],
        [3, null, null],
      ],
      'as tarefas continuam ligadas às metas, e a versão nova de "Meditar" fica na série da antiga',
    );
    assert.equal(bd.prepare('select count(*) as n from tarefas_semana').get()?.n, 4);
    assert.equal(bd.prepare('select count(*) as n from blocos').get()?.n, 4);

    assert.deepEqual(
      bd.prepare('select semana, estado, modelo from semanas order by semana').all().map((s) => [s.semana, s.estado, s.modelo]),
      [
        [somarDias(passada, -7), 'aceite', 0],
        [passada, 'aceite', 0],
        [atual, 'aceite', 0],
        [depois, 'aceite', 0],
      ],
      'as semanas até à atual e as que já tinham blocos ficam aceites; a seguinte, ainda sem blocos, fica por planear',
    );
    bd.close();
  });

  it('numa instalação nova cria as tabelas vazias', () => {
    const bd = new DatabaseSync(':memory:');
    for (const tag of ['0000_inicial', '0001_metas_vezes', '0002_tarefas_por_semana', '0003_metas_resultado_e_proposta']) aplicar(bd, tag);
    for (const tabela of ['metas', 'metas_registos', 'semanas']) assert.equal(bd.prepare(`select count(*) as n from ${tabela}`).get()?.n, 0);
    bd.close();
  });
});
