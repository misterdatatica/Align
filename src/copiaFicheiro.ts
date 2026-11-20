import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ErroDaApp } from '@/domain/erros';

/*
 * Guardar e abrir o ficheiro da cópia de segurança no telemóvel.
 * Exportar escreve o ficheiro e abre a folha de partilha do sistema (guardar nos ficheiros, enviar
 * por e-mail…). Importar abre o seletor de ficheiros. No navegador: ver copiaFicheiro.web.ts.
 */

/** Guarda o texto num ficheiro e deixa o utilizador escolher para onde o enviar. */
export async function partilharFicheiro(nome: string, texto: string): Promise<void> {
  const ficheiro = new File(Paths.cache, nome);
  if (ficheiro.exists) ficheiro.delete();
  ficheiro.create();
  await ficheiro.write(texto);
  if (!(await Sharing.isAvailableAsync())) throw new ErroDaApp('Este telemóvel não permite partilhar ficheiros.');
  await Sharing.shareAsync(ficheiro.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Guardar a cópia de segurança' });
}

/** Deixa o utilizador escolher um ficheiro e devolve o seu texto, ou null se desistir. */
export async function escolherFicheiro(): Promise<string | null> {
  const resultado = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/*', 'application/octet-stream'], copyToCacheDirectory: true });
  if (resultado.canceled) return null;
  return new File(resultado.assets[0].uri).text();
}
