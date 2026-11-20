import { NOME_DO_ESTADO } from '../domain/metas.ts';
import { DIAS_ABREVIADOS } from '../domain/recorrencia.ts';
import { DIAS_DE_REVISAO } from '../domain/revisao.ts';
import { DIAS_CURTOS, DIAS_LONGOS, MESES, MESES_LONGOS } from '../domain/semana.ts';
import { SUGESTOES_DE_AREAS } from '../sugestoes.ts';
import { coresAreaClaras } from '../coresArea.ts';

/**
 * Textos traduzidos a partir de listas (dias, meses, cores, estados…), com `t(lista[i])` em vez de um
 * texto literal. Vivem aqui para o teste de traduções os conhecer.
 */
export const TEXTOS_DINAMICOS: string[] = [
  ...DIAS_CURTOS,
  ...DIAS_LONGOS,
  ...MESES,
  ...MESES_LONGOS,
  ...DIAS_DE_REVISAO,
  ...DIAS_ABREVIADOS,
  ...Object.values(NOME_DO_ESTADO),
  ...SUGESTOES_DE_AREAS.map((s) => s.nome),
  ...coresAreaClaras.map((c) => c.nome),
];
