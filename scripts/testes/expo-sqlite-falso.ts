/// <reference types="node" />
/**
 * Substituto de "expo-sqlite" para os testes em Node: uma base de dados em memória (node:sqlite)
 * com a parte da API síncrona que o Drizzle e src/db/client.ts usam.
 * Sem "parameter properties": o Node corre este ficheiro só a retirar os tipos.
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

class Resultado {
  linhas: unknown[];
  changes: number;
  lastInsertRowId: number;

  constructor(linhas: unknown[], changes: number, lastInsertRowId: number) {
    this.linhas = linhas;
    this.changes = changes;
    this.lastInsertRowId = lastInsertRowId;
  }

  getAllSync() {
    return this.linhas;
  }

  getFirstSync() {
    return this.linhas[0] ?? null;
  }
}

class Instrucao {
  bd: DatabaseSync;
  sql: string;

  constructor(bd: DatabaseSync, sql: string) {
    this.bd = bd;
    this.sql = sql;
  }

  executar(params: unknown[], emListas: boolean) {
    const instrucao = this.bd.prepare(this.sql);
    instrucao.setReturnArrays(emListas);
    const linhas = instrucao.all(...(params as SQLInputValue[]));
    const meta = this.bd.prepare('select changes() as alteradas, last_insert_rowid() as id').get() as { alteradas: number; id: number };
    return new Resultado(linhas, Number(meta.alteradas), Number(meta.id));
  }

  executeSync(params: unknown[] = []) {
    return this.executar(params, false);
  }

  executeForRawResultSync(params: unknown[] = []) {
    return this.executar(params, true);
  }

  finalizeSync() {}
}

class BaseDeDados {
  bd = new DatabaseSync(':memory:');

  prepareSync(sql: string) {
    return new Instrucao(this.bd, sql);
  }

  execSync(sql: string) {
    this.bd.exec(sql);
  }

  closeSync() {
    this.bd.close();
  }
}

export function openDatabaseSync(_nome: string, _opcoes?: unknown) {
  return new BaseDeDados();
}

export async function openDatabaseAsync(_nome: string, _opcoes?: unknown) {
  return new BaseDeDados();
}

export function addDatabaseChangeListener(_ouvinte: unknown) {
  return { remove() {} };
}
