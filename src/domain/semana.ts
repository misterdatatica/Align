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

/** "16 a 22 nov", "30 nov a 6 dez" — para frases como "Semana de 16 a 22 nov". */
export function descreverSemanaPorExtenso(semana: string): string {
  const ini = deDataISO(semana);
  const fim = deDataISO(somarSemanas(semana, 1));
  fim.setDate(fim.getDate() - 1);
  if (ini.getFullYear() !== fim.getFullYear()) {
    return `${ini.getDate()} ${MESES[ini.getMonth()]} ${ini.getFullYear()} a ${fim.getDate()} ${MESES[fim.getMonth()]} ${fim.getFullYear()}`;
  }
  if (ini.getMonth() !== fim.getMonth()) {
    return `${ini.getDate()} ${MESES[ini.getMonth()]} a ${fim.getDate()} ${MESES[fim.getMonth()]}`;
  }
  return `${ini.getDate()} a ${fim.getDate()} ${MESES[ini.getMonth()]}`;
}

/** "16 – 22 nov 2026": o seletor de semana mostra sempre o ano. */
export function descreverSemanaComAno(semana: string): string {
  const ini = deDataISO(semana);
  const fim = deDataISO(somarSemanas(semana, 1));
  fim.setDate(fim.getDate() - 1);
  if (ini.getFullYear() !== fim.getFullYear()) return descreverSemana(semana);
  if (ini.getMonth() !== fim.getMonth()) {
    return `${ini.getDate()} ${MESES[ini.getMonth()]} – ${fim.getDate()} ${MESES[fim.getMonth()]} ${fim.getFullYear()}`;
  }
  return `${ini.getDate()} – ${fim.getDate()} ${MESES[ini.getMonth()]} ${fim.getFullYear()}`;
}

export const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
export const DIAS_LONGOS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const;

/** Posição do dia na semana: 0 = segunda … 6 = domingo. */
export function indiceDoDia(dataISO: string): number {
  return (deDataISO(dataISO).getDay() + 6) % 7;
}

/** "quarta, 18 nov". */
export function descreverDia(dataISO: string): string {
  const d = deDataISO(dataISO);
  return `${DIAS_LONGOS[indiceDoDia(dataISO)]}, ${d.getDate()} ${MESES[d.getMonth()]}`;
}

/*
 * Data e hora dos blocos: texto local "AAAA-MM-DDTHH:MM". Um bloco fica sempre dentro de um dia,
 * por isso a hora de fim pode ser "24:00" (meia-noite do próprio dia) e a ordem alfabética
 * continua a ser a ordem do tempo.
 */

export const MINUTOS_DIA = 24 * 60;

export function paraDataHora(dia: string, minutos: number): string {
  const m = Math.max(0, Math.min(MINUTOS_DIA, Math.round(minutos)));
  return `${dia}T${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function partirDataHora(dataHora: string): { dia: string; minutos: number } {
  const [dia, hora = '00:00'] = dataHora.split('T');
  const [h, m] = hora.split(':').map(Number);
  return { dia, minutos: h * 60 + m };
}

/** Minutos entre dois momentos do mesmo dia (0 se o fim não for depois do início). */
export function minutosEntre(inicio: string, fim: string): number {
  const a = partirDataHora(inicio);
  const b = partirDataHora(fim);
  if (a.dia !== b.dia) return Math.max(0, Math.round((deDataISO(b.dia).getTime() - deDataISO(a.dia).getTime()) / 60000) + b.minutos - a.minutos);
  return Math.max(0, b.minutos - a.minutos);
}

/** "06:30", "24:00" → 6:30, 0:00 do dia seguinte não existe: fica "24:00". */
export function formatarHora(minutos: number): string {
  return `${pad(Math.floor(minutos / 60))}:${pad(minutos % 60)}`;
}

/** Limites da semana em data e hora, para procurar blocos: [segunda 00:00, segunda seguinte 00:00[. */
export function limitesDaSemana(semana: string): { desde: string; ate: string } {
  return { desde: paraDataHora(semana, 0), ate: paraDataHora(somarSemanas(semana, 1), 0) };
}
