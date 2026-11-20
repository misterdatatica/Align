import { count, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { areas, definicoes } from '@/db/schema';
import { ErroDaApp } from '@/domain/erros';

/** As definições são um registo único (id 1); enquanto não existir valem estas. */
export type Definicoes = {
  /** 0 = domingo … 6 = sábado. */
  diaRevisao: number;
  /** "HH:MM". */
  horaRevisao: string;
  /** Primeira e última hora da grelha do calendário. */
  inicioGrelha: number;
  fimGrelha: number;
  lembreteAtivo: boolean;
  /** Quando foi exportada a última cópia de segurança (ISO); null = nunca. */
  ultimaCopia: string | null;
  /** Aparência: segue o telemóvel, ou fica sempre clara ou escura. */
  tema: PreferenciaDeTema;
};

export type PreferenciaDeTema = 'automatico' | 'claro' | 'escuro';
const PREFERENCIAS_DE_TEMA: readonly PreferenciaDeTema[] = ['automatico', 'claro', 'escuro'];

export const DEFINICOES_INICIAIS: Definicoes = { diaRevisao: 0, horaRevisao: '18:00', inicioGrelha: 6, fimGrelha: 23, lembreteAtivo: false, ultimaCopia: null, tema: 'automatico' };

const ID = 1;

export function carregarDefinicoes(): Definicoes {
  const linha = db.select().from(definicoes).where(eq(definicoes.id, ID)).get();
  if (!linha) return DEFINICOES_INICIAIS;
  return {
    diaRevisao: linha.diaRevisao,
    horaRevisao: linha.horaRevisao,
    inicioGrelha: linha.inicioGrelha,
    fimGrelha: linha.fimGrelha,
    lembreteAtivo: linha.lembreteAtivo,
    ultimaCopia: linha.ultimaCopia,
    tema: linha.tema,
  };
}

/** As definições já foram guardadas alguma vez? (Depois do primeiro arranque, sim.) */
export function haDefinicoes(): boolean {
  return db.select({ id: definicoes.id }).from(definicoes).where(eq(definicoes.id, ID)).get() !== undefined;
}

/** A app acabou de ser instalada: ainda não há áreas (nem arquivadas) nem definições guardadas. */
export function primeiroArranque(): boolean {
  if (haDefinicoes()) return false;
  return (db.select({ n: count() }).from(areas).get()?.n ?? 0) === 0;
}

export function guardarDefinicoes(alteracoes: Partial<Definicoes>): Definicoes {
  const novas = { ...carregarDefinicoes(), ...alteracoes };
  if (!Number.isInteger(novas.diaRevisao) || novas.diaRevisao < 0 || novas.diaRevisao > 6) throw new ErroDaApp('O dia da revisão não é válido.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(novas.horaRevisao)) throw new ErroDaApp('A hora da revisão não é válida.');
  if (!Number.isInteger(novas.inicioGrelha) || !Number.isInteger(novas.fimGrelha) || novas.inicioGrelha < 0 || novas.fimGrelha > 24 || novas.fimGrelha - novas.inicioGrelha < 4) {
    throw new ErroDaApp('O calendário tem de mostrar pelo menos 4 horas.');
  }
  if (!PREFERENCIAS_DE_TEMA.includes(novas.tema)) throw new ErroDaApp('A aparência escolhida não é válida.');
  db.insert(definicoes)
    .values({ id: ID, ...novas })
    .onConflictDoUpdate({ target: definicoes.id, set: { ...novas, atualizadoEm: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` } })
    .run();
  return novas;
}

/** Dias sem cópia de segurança a partir dos quais a app lembra de fazer uma. */
export const DIAS_SEM_COPIA = 30;

/** Regista que acabou de ser exportada uma cópia de segurança. */
export function registarCopia(agora: Date = new Date()): void {
  guardarDefinicoes({ ultimaCopia: agora.toISOString() });
}

/**
 * Já é altura de lembrar a cópia de segurança? Sim, se a última foi há mais de 30 dias ou, se nunca
 * houve nenhuma, se a app já é usada há mais de 30 dias.
 */
export function precisaDeCopia(agora: Date = new Date()): boolean {
  const linha = db.select({ ultimaCopia: definicoes.ultimaCopia, criadoEm: definicoes.criadoEm }).from(definicoes).where(eq(definicoes.id, ID)).get();
  if (!linha) return false;
  const desde = Date.parse(linha.ultimaCopia ?? linha.criadoEm);
  return Number.isFinite(desde) && agora.getTime() - desde > DIAS_SEM_COPIA * 24 * 60 * 60 * 1000;
}
