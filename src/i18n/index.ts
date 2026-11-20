import { EN } from './en.ts';

/*
 * Traduções. O texto em português de Portugal fica no código e serve de chave: `t('Revisão fechada.')`
 * devolve o próprio texto em português, ou a tradução de `en.ts` em inglês. Os valores entram entre
 * chavetas: `t('Revisão de {dia}', { dia })`. Um texto sem tradução aparece em português (o teste
 * i18n.test.ts não deixa isso acontecer).
 *
 * Não depende do React Native: também o usam as regras do domínio e os scripts dos testes, em Node.
 */

export type Idioma = 'pt' | 'en';

let atual: Idioma = 'pt';

/** Muda o idioma de toda a app. O layout principal chama-a com o idioma do telemóvel. */
export function definirIdioma(idioma: Idioma): void {
  atual = idioma;
}

export function idiomaAtual(): Idioma {
  return atual;
}

/** O idioma da app para uma lista de idiomas preferidos (BCP 47): português, ou inglês para todos os outros. */
export function escolherIdioma(preferidos: readonly (string | null | undefined)[]): Idioma {
  const primeiro = preferidos.find((p) => !!p)?.toLowerCase() ?? 'pt';
  return primeiro.startsWith('pt') ? 'pt' : 'en';
}

export type Valores = Record<string, string | number>;

/** Substitui `{nome}` pelos valores. */
function preencher(modelo: string, valores?: Valores): string {
  if (!valores) return modelo;
  return modelo.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));
}

/** O texto no idioma atual. `pt` é o texto em português (a chave); `valores` preenche as `{chavetas}`. */
export function t(pt: string, valores?: Valores): string {
  return preencher(atual === 'en' ? (EN[pt] ?? pt) : pt, valores);
}

/** Separador decimal do idioma atual: "7,5 h" em português, "7.5 h" em inglês. */
export function separadorDecimal(): string {
  return atual === 'en' ? '.' : ',';
}
