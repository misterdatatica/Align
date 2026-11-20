import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { planearSemana } from '@/data/semanas';
import { deDataISO, inicioDaSemana, paraDataISO } from '@/domain/semana';

/*
 * O dia de hoje e a semana escolhida nos separadores Semana e Calendário (partilhada entre os dois,
 * para "Alocar no calendário" abrir a mesma semana).
 */

let hoje = paraDataISO(new Date());
/** null = acompanha a semana atual (muda sozinha à segunda-feira). */
let escolhida: string | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

function subscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function atualizarHoje() {
  const agora = paraDataISO(new Date());
  if (agora === hoje) return;
  hoje = agora;
  avisar();
}

// O dia pode mudar com a app aberta ou em segundo plano.
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') atualizarHoje();
});
setInterval(atualizarHoje, 60_000);

function semanaAtual(): string {
  return inicioDaSemana(deDataISO(hoje));
}

/**
 * Planeia a semana (igual à anterior) e cria as instâncias das tarefas recorrentes, se ainda
 * faltarem. Nunca interrompe o ecrã.
 */
function prepararSemana(semana: string) {
  try {
    planearSemana(semana);
  } catch (erro) {
    console.warn('Não foi possível preparar a semana', erro);
  }
}

/** Dia de hoje, AAAA-MM-DD. */
export function useHoje(): string {
  return useSyncExternalStore(
    subscrever,
    () => hoje,
    () => hoje,
  );
}

/** Segunda-feira da semana de hoje. */
export function useSemanaAtual(): string {
  return inicioDaSemana(deDataISO(useHoje()));
}

export function escolherSemana(semana: string) {
  prepararSemana(semana);
  escolhida = semana === semanaAtual() ? null : semana;
  avisar();
}

/** Semana mostrada nos separadores Semana e Calendário. */
export function useSemanaEscolhida(): string {
  return useSyncExternalStore(
    subscrever,
    () => escolhida ?? semanaAtual(),
    () => escolhida ?? semanaAtual(),
  );
}

/** Prepara a semana sempre que o ecrã ganha foco ou a semana muda. */
export function usePrepararSemana(semana: string) {
  useFocusEffect(
    useCallback(() => {
      prepararSemana(semana);
    }, [semana]),
  );
}
