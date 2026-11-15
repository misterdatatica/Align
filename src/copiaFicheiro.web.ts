import * as DocumentPicker from 'expo-document-picker';

/*
 * Versão para o navegador de copiaFicheiro.ts: exportar descarrega o ficheiro, importar abre o
 * seletor de ficheiros do navegador. (O Metro escolhe este ficheiro na web.)
 */

export async function partilharFicheiro(nome: string, texto: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const ligacao = document.createElement('a');
  ligacao.href = url;
  ligacao.download = nome;
  document.body.appendChild(ligacao);
  ligacao.click();
  ligacao.remove();
  URL.revokeObjectURL(url);
}

export async function escolherFicheiro(): Promise<string | null> {
  const resultado = await DocumentPicker.getDocumentAsync({ type: ['application/json', '.json'], base64: false });
  if (resultado.canceled) return null;
  const ficheiro = resultado.assets[0].file;
  if (!ficheiro) throw new Error('Não foi possível ler o ficheiro escolhido.');
  return ficheiro.text();
}
