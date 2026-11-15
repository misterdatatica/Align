// Prepara o Node para correr os testes da camada de dados sem telemóvel nem emulador:
//  - resolve o atalho "@/..." e os imports sem extensão para os ficheiros .ts de src/;
//  - troca "expo-sqlite" por uma base de dados em memória (node:sqlite), com a mesma API síncrona.
// Uso: node --import ./scripts/testes/registar.mjs --test "src/**/*.test.ts"
import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(import.meta.dirname, '..', '..');
const src = path.join(raiz, 'src');
const expoSqliteFalso = pathToFileURL(path.join(import.meta.dirname, 'expo-sqlite-falso.ts')).href;

function eFicheiro(caminho) {
  return existsSync(caminho) && statSync(caminho).isFile();
}

/** Devolve o URL do ficheiro .ts correspondente, ou null se o caminho não for do projeto. */
function resolverTs(caminho) {
  if (eFicheiro(caminho)) return pathToFileURL(caminho).href;
  for (const candidato of [`${caminho}.ts`, path.join(caminho, 'index.ts')]) {
    if (eFicheiro(candidato)) return pathToFileURL(candidato).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'expo-sqlite') return { url: expoSqliteFalso, shortCircuit: true };

    const pai = context.parentURL?.startsWith('file:') ? fileURLToPath(context.parentURL) : null;
    const doProjeto = pai !== null && !pai.includes(`${path.sep}node_modules${path.sep}`);

    if (specifier.startsWith('@/')) {
      const url = resolverTs(path.join(src, specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
    } else if (doProjeto && (specifier.startsWith('./') || specifier.startsWith('../'))) {
      const url = resolverTs(path.resolve(path.dirname(pai), specifier));
      if (url) return { url, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
