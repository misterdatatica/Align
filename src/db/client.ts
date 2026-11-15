import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

const NOME = 'align.db';
// enableChangeListener avisa os ecrãs quando os dados mudam (ver useConsulta em src/data/consulta.ts).
const OPCOES = { enableChangeListener: true };
const CHAVES_ESTRANGEIRAS = 'PRAGMA foreign_keys = ON;';

let ligacao: SQLiteDatabase | null = null;
let aAbrir: Promise<SQLiteDatabase> | null = null;

function obterLigacao(): SQLiteDatabase {
  if (!ligacao) {
    ligacao = openDatabaseSync(NOME, OPCOES);
    ligacao.execSync(CHAVES_ESTRANGEIRAS);
  }
  return ligacao;
}

/**
 * Só no navegador. Cada chamada síncrona ao SQLite espera pelo worker num ciclo de um milhão de
 * `Atomics.pause()`, que no Chrome dura cerca de 30 ms. Uma escrita um pouco mais lenta (disco ou
 * processador ocupados) rebentava com "Sync operation timeout" e a alteração do utilizador perdia-se.
 *
 * Aqui cada pausa passa a valer cem, o que estica o limite para cerca de 3 s. A resposta do worker
 * continua a ser lida mal chega: muda apenas o tempo ao fim do qual a biblioteca desiste.
 */
function alargarEsperaNoNavegador() {
  const atomics = Atomics as typeof Atomics & { pause?: (iteracoes?: number) => void };
  const pausa = atomics.pause;
  if (typeof pausa !== 'function') return;
  atomics.pause = (iteracoes) => {
    for (let i = 0; i < 100; i++) pausa.call(atomics, iteracoes);
  };
}

/**
 * Abre a base de dados antes do primeiro ecrã (ver src/db/preparar.ts).
 *
 * No telemóvel abrir é imediato. No navegador o SQLite corre num worker, e as chamadas síncronas só
 * esperam por ele um instante: com o worker ainda a arrancar falhavam ("Sync operation timeout").
 * Abrindo de forma assíncrona espera-se pelo worker; a partir daí as chamadas síncronas respondem logo.
 */
export function abrirBaseDeDados(): Promise<SQLiteDatabase> {
  aAbrir ??= (async () => {
    if (ligacao) return ligacao;
    if (process.env.EXPO_OS !== 'web') return obterLigacao();
    alargarEsperaNoNavegador();
    const aberta = await openDatabaseAsync(NOME, OPCOES);
    await aberta.execAsync(CHAVES_ESTRANGEIRAS);
    ligacao = aberta;
    return aberta;
  })();
  return aAbrir;
}

/** A ligação só é aberta quando é usada, para os módulos poderem importar `db` sem abrir nada. */
export const sqlite: Pick<SQLiteDatabase, 'prepareSync' | 'execSync'> = {
  prepareSync: (fonte) => obterLigacao().prepareSync(fonte),
  execSync: (fonte) => obterLigacao().execSync(fonte),
};

export const db = drizzle(sqlite as SQLiteDatabase, { schema });
