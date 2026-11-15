import type { SQLiteDatabase } from 'expo-sqlite';

import migracoes from '../../drizzle/migrations';
import { abrirBaseDeDados } from './client';

type Diario = { entries: { idx: number; when: number; tag: string }[] };

const TABELA = '"__drizzle_migrations"';

/**
 * Aplica as migrações de drizzle/ que ainda faltam.
 *
 * Faz o mesmo que o migrador do Drizzle para a Expo (mesma tabela de registo, mesmas regras), mas com a
 * API assíncrona do SQLite. O do Drizzle é síncrono, e no navegador a primeira escrita — que cria o
 * ficheiro da base de dados — demora mais do que uma chamada síncrona consegue esperar.
 */
async function aplicarMigracoes(bd: SQLiteDatabase) {
  const { journal, migrations } = migracoes as { journal: Diario; migrations: Record<string, string> };
  await bd.execAsync(`CREATE TABLE IF NOT EXISTS ${TABELA} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`);
  const ultima = await bd.getFirstAsync<{ created_at: number | string | null }>(`SELECT created_at FROM ${TABELA} ORDER BY created_at DESC LIMIT 1`);
  const aplicadasAte = ultima?.created_at == null ? -1 : Number(ultima.created_at);
  const emFalta = journal.entries.filter((entrada) => entrada.when > aplicadasAte);
  if (emFalta.length === 0) return;

  await bd.withTransactionAsync(async () => {
    for (const entrada of emFalta) {
      const texto = migrations[`m${String(entrada.idx).padStart(4, '0')}`];
      if (!texto) throw new Error(`Falta a migração ${entrada.tag}.`);
      for (const instrucao of texto.split('--> statement-breakpoint')) await bd.execAsync(instrucao);
      await bd.runAsync(`INSERT INTO ${TABELA} ("hash", "created_at") VALUES (?, ?)`, '', entrada.when);
    }
  });
}

let preparacao: Promise<void> | null = null;

/** Abre a base de dados e aplica as migrações em falta. Chamar várias vezes devolve a mesma promessa. */
export function prepararBaseDeDados(): Promise<void> {
  preparacao ??= abrirBaseDeDados().then(aplicarMigracoes);
  return preparacao;
}
