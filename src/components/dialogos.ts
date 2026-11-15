import { Alert, Platform } from 'react-native';

/*
 * Avisos e confirmações. No telemóvel usam os diálogos nativos; no navegador o `Alert` do
 * React Native não faz nada, por isso usam-se os do próprio navegador.
 */

export function avisar(titulo: string, mensagem?: string) {
  if (Platform.OS === 'web') {
    window.alert(mensagem ? `${titulo}\n\n${mensagem}` : titulo);
    return;
  }
  Alert.alert(titulo, mensagem);
}

/** Mostra o erro de uma ação que falhou. */
export function avisarErro(titulo: string, erro: unknown) {
  avisar(titulo, erro instanceof Error ? erro.message : String(erro));
}

type Confirmacao = {
  titulo: string;
  mensagem?: string;
  /** Texto do botão que confirma, ex.: "Apagar". */
  acao: string;
  /** Ação que não se pode desfazer (botão a vermelho no iOS). */
  destrutiva?: boolean;
};

export function confirmar({ titulo, mensagem, acao, destrutiva }: Confirmacao): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(mensagem ? `${titulo}\n\n${mensagem}` : titulo));
  }
  return new Promise((resolver) => {
    Alert.alert(
      titulo,
      mensagem,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
        { text: acao, style: destrutiva ? 'destructive' : 'default', onPress: () => resolver(true) },
      ],
      { cancelable: true, onDismiss: () => resolver(false) },
    );
  });
}
