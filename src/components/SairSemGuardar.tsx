import { Stack, useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { confirmar } from '@/components/dialogos';
import { Botao } from '@/components/ui';
import { t } from '@/i18n';

/**
 * Para os formulários abertos em modal (metas e tarefas): sair com alterações por guardar (Cancelar,
 * voltar atrás ou deslizar o modal) pergunta primeiro "Sair sem guardar?".
 *
 * Devolve `fecharSemPerguntar`, para depois de guardar (ou apagar): o aviso desliga-se e o formulário
 * fecha no render seguinte.
 */
export function useSairSemGuardar({ alterado, mensagem, aoFechar }: { alterado: boolean; mensagem: string; aoFechar: () => void }) {
  const navigation = useNavigation();
  const [terminado, setTerminado] = useState(false);
  // Ao confirmar "Sair", o aviso desliga-se primeiro e a saída repete-se só depois: se se repetisse logo,
  // voltava a ser travada e a pergunta aparecia outra vez.
  const [saida, setSaida] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);

  useEffect(() => {
    if (terminado) aoFechar();
    // Só quando termina: aoFechar muda a cada render e fecharia o ecrã mais do que uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminado]);
  useEffect(() => {
    if (saida) navigation.dispatch(saida);
  }, [saida, navigation]);

  usePreventRemove(alterado && !terminado && !saida, ({ data }) => {
    confirmar({ titulo: t('Sair sem guardar?'), mensagem, acao: t('Sair'), destrutiva: true }).then((sim) => {
      if (sim) setSaida(data.action);
    });
  });

  return { fecharSemPerguntar: () => setTerminado(true) };
}

/** "Cancelar" no lado esquerdo do cabeçalho do modal. Se houver alterações, o aviso acima pergunta antes. */
export function CancelarNoCabecalho() {
  const router = useRouter();
  return <Stack.Screen options={{ headerLeft: () => <Botao titulo={t('Cancelar')} variante="texto" onPress={() => router.back()} style={{ minHeight: 44, paddingHorizontal: 8 }} /> }} />;
}
