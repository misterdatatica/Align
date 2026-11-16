import type { MetaDetalhada } from '@/data/metas';
import { descreverDiasQueFaltam, formatarValor, valorComUnidade } from '@/domain/metas';
import { descreverData } from '@/domain/semana';

/** "35 de 60 min seguidos" (número) ou "Por alcançar" / "Alcançada" (marco). */
export function textoDoProgresso(meta: MetaDetalhada): string {
  if (meta.medida === 'marco' || meta.valorAlvo === null) return meta.alcancada ? 'Alcançada' : 'Por alcançar';
  return `${formatarValor(meta.valorAtual ?? meta.valorInicial ?? 0)} de ${valorComUnidade(meta.valorAlvo, meta.unidade)}`;
}

/** "Até 31 mar 2027 · faltam 135 dias". As metas que já não estão ativas mostram só a data. */
export function textoDoPrazo(meta: MetaDetalhada): string {
  const data = `Até ${descreverData(meta.prazo)}`;
  return meta.estado === 'ativa' || meta.estado === 'pausada' ? `${data} · ${descreverDiasQueFaltam(meta.diasQueFaltam)}` : data;
}

/** O aviso de uma meta que não avançou nas últimas 3 atualizações. */
export const TEXTO_ESTAGNADA = 'Não avançou nas últimas 3 atualizações. Experimente ajustar o alvo, o prazo ou as tarefas ligadas.';
