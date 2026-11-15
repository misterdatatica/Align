/// <reference types="node" />
/**
 * Base de dados para os testes: aplica as migrações reais de drizzle/ à base em memória
 * (ver registar.mjs) e esvazia as tabelas entre testes.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { sqlite } from '@/db/client';

const pasta = path.resolve(import.meta.dirname, '..', '..', 'drizzle');
const TABELAS = ['blocos', 'tarefas_semana', 'tarefas', 'metas', 'areas', 'revisoes', 'definicoes'];
let migrada = false;

export function prepararBd() {
  if (!migrada) {
    const diario = JSON.parse(readFileSync(path.join(pasta, 'meta', '_journal.json'), 'utf8')) as { entries: { tag: string }[] };
    for (const entrada of diario.entries) {
      const migracao = readFileSync(path.join(pasta, `${entrada.tag}.sql`), 'utf8');
      for (const instrucao of migracao.split('--> statement-breakpoint')) sqlite.execSync(instrucao);
    }
    migrada = true;
  }
  for (const tabela of TABELAS) sqlite.execSync(`delete from ${tabela}`);
  sqlite.execSync('delete from sqlite_sequence');
}
