/// <reference types="node" />
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { EN } from './en.ts';
import { definirIdioma, escolherIdioma, t } from './index.ts';
import { TEXTOS_DINAMICOS } from './listas.ts';

const src = path.resolve(import.meta.dirname, '..');

function ficheiros(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = path.join(pasta, nome);
    if (statSync(caminho).isDirectory()) return ficheiros(caminho);
    return /\.tsx?$/.test(nome) && !nome.endsWith('.test.ts') ? [caminho] : [];
  });
}

/** Todas as chaves usadas como `t('…')` no código (só textos literais). */
function chavesNoCodigo(): Map<string, string> {
  const chaves = new Map<string, string>();
  for (const ficheiro of ficheiros(src)) {
    const texto = readFileSync(ficheiro, 'utf8');
    for (const m of texto.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) chaves.set(m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n'), path.relative(src, ficheiro));
  }
  return chaves;
}

const chavetas = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('traduções', () => {
  const usadas = chavesNoCodigo();
  for (const chave of TEXTOS_DINAMICOS) usadas.set(chave, 'i18n/listas.ts');

  it('todos os textos têm tradução em inglês', () => {
    const emFalta = [...usadas].filter(([chave]) => !(chave in EN)).map(([chave, ficheiro]) => `${ficheiro}: ${JSON.stringify(chave)}`);
    assert.deepEqual(emFalta, []);
  });

  it('a tradução tem as mesmas {chavetas} que o português', () => {
    const diferentes = Object.entries(EN).filter(([pt, en]) => chavetas(pt).join() !== chavetas(en).join()).map(([pt]) => pt);
    assert.deepEqual(diferentes, []);
  });

  it('não há traduções de textos que já não existem', () => {
    assert.deepEqual(Object.keys(EN).filter((chave) => !usadas.has(chave)), []);
  });

  it('escolhe português para pt-*, inglês para o resto, e traduz com valores', () => {
    assert.equal(escolherIdioma(['pt-PT']), 'pt');
    assert.equal(escolherIdioma(['pt-BR', 'en-US']), 'pt');
    assert.equal(escolherIdioma(['fr-FR']), 'en');
    assert.equal(escolherIdioma([]), 'pt');
    definirIdioma('en');
    try {
      assert.equal(t('Revisão de {dia}', { dia: 'Sunday' }), 'Sunday review');
    } finally {
      definirIdioma('pt');
    }
    assert.equal(t('Revisão de {dia}', { dia: 'domingo' }), 'Revisão de domingo');
  });
});
