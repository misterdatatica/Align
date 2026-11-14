/**
 * Uma semana vai de segunda a domingo e identifica-se pela data da segunda-feira (AAAA-MM-DD).
 * Tudo em datas locais, sem fuso horário, para não mudar de dia perto da meia-noite.
 */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function paraDataISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function deDataISO(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Segunda-feira da semana que contém `data`. */
export function inicioDaSemana(data: Date): string {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const diaSemana = (d.getDay() + 6) % 7; // 0 = segunda … 6 = domingo
  d.setDate(d.getDate() - diaSemana);
  return paraDataISO(d);
}

export function somarSemanas(semana: string, n: number): string {
  const d = deDataISO(semana);
  d.setDate(d.getDate() + 7 * n);
  return paraDataISO(d);
}

/** Os 7 dias da semana, de segunda a domingo. */
export function diasDaSemana(semana: string): string[] {
  const inicio = deDataISO(semana);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return paraDataISO(d);
  });
}

/** "16–22 nov", "30 nov – 6 dez", "29 dez 2025 – 4 jan 2026". */
export function descreverSemana(semana: string): string {
  const ini = deDataISO(semana);
  const fim = deDataISO(somarSemanas(semana, 1));
  fim.setDate(fim.getDate() - 1);
  if (ini.getFullYear() !== fim.getFullYear()) {
    return `${ini.getDate()} ${MESES[ini.getMonth()]} ${ini.getFullYear()} – ${fim.getDate()} ${MESES[fim.getMonth()]} ${fim.getFullYear()}`;
  }
  if (ini.getMonth() !== fim.getMonth()) {
    return `${ini.getDate()} ${MESES[ini.getMonth()]} – ${fim.getDate()} ${MESES[fim.getMonth()]}`;
  }
  return `${ini.getDate()}–${fim.getDate()} ${MESES[ini.getMonth()]}`;
}
