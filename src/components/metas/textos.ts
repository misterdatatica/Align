import type { MetaDetalhada } from '@/data/metas';
import { descreverDiasQueFaltam, formatarValor, valorComUnidade } from '@/domain/metas';
import { descreverData } from '@/domain/semana';
import { t } from '@/i18n';

/** "35 de 60 min seguidos" (número) ou "Por alcançar" / "Alcançada" (marco). */
export function textoDoProgresso(meta: MetaDetalhada): string {
  if (meta.medida === 'marco' || meta.valorAlvo === null) return meta.alcancada ? t('Alcançada') : t('Por alcançar');
  return `${formatarValor(meta.valorAtual ?? meta.valorInicial ?? 0)} de ${valorComUnidade(meta.valorAlvo, meta.unidade)}`;
}

/** "Até 31 mar 2027 · faltam 135 dias". As metas que já não estão ativas mostram só a data. */
export function textoDoPrazo(meta: MetaDetalhada): string {
  const data = t('Até {dia}', { dia: descreverData(meta.prazo) });
  return meta.estado === 'ativa' || meta.estado === 'pausada' ? `${data} · ${descreverDiasQueFaltam(meta.diasQueFaltam)}` : data;
}

/** O aviso de uma meta que não avançou nas últimas 3 atualizações. */
export const textoEstagnada = () => t('Não avançou nas últimas 3 atualizações. Experimente ajustar o alvo, o prazo ou as tarefas ligadas.');
