import type { NomeIcone } from '@/components/Icone';

/** Áreas sugeridas no primeiro arranque e no ecrã das áreas vazio. Todas se podem alterar depois. */
export const SUGESTOES_DE_AREAS: { nome: string; cor: string; icone: NomeIcone }[] = [
  { nome: 'Espiritual', cor: 'violeta', icone: 'folha' },
  { nome: 'Família', cor: 'laranja', icone: 'casa' },
  { nome: 'Trabalho', cor: 'azul', icone: 'pasta' },
  { nome: 'Saúde', cor: 'rosa', icone: 'coracao' },
  { nome: 'Desporto', cor: 'verde', icone: 'bola' },
  { nome: 'Finanças', cor: 'petroleo', icone: 'livro' },
];
