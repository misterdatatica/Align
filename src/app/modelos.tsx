import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { comDesfazer } from '@/components/AvisoTemporario';
import { CartaoDoModelo, TarefasDoModelo } from '@/components/CartaoDoModelo';
import { avisar } from '@/components/dialogos';
import { SoPlus } from '@/components/Plus';
import { Botao } from '@/components/ui';
import { aplicarModelo, novidadesDoModelo } from '@/data/modelos';
import { MODELOS, type Modelo } from '@/domain/modelos';
import { t } from '@/i18n';
import { useTema } from '@/theme';

/**
 * Modelos (Align Plus): áreas com missão e tarefas já com horário. Usar um modelo junta-o ao que já
 * existe (sem repetir áreas nem tarefas com o mesmo nome), com "Desfazer".
 */
export default function ModelosEcra() {
  const { cores, estilos } = useTema();
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(null);

  function usar(modelo: Modelo) {
    const novidades = novidadesDoModelo(modelo);
    if (novidades.areas === 0 && novidades.tarefas === 0) {
      avisar(t('Já tem este modelo'), t('As áreas e as tarefas de “{nome}” já estão todas na app.', { nome: modelo.nome }));
      return;
    }
    const aplicado = comDesfazer(
      t('Modelo “{nome}” aplicado', { nome: modelo.nome }),
      () => {
        aplicarModelo(modelo);
      },
      t('Não foi possível aplicar o modelo'),
    );
    if (aplicado) router.back();
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo}>
      <Text style={[estilos.corpo, { color: cores.texto2 }]}>
        {t('Áreas com missão e tarefas já com horário, para não começar do zero. Juntam-se às que já tem, e depois muda tudo à sua medida.')}
      </Text>
      <SoPlus mensagem={t('Os modelos fazem parte do Align Plus.')}>
        {MODELOS().map((m) => (
          <CartaoDoModelo key={m.id} modelo={m}>
            {aberto === m.id ? <TarefasDoModelo modelo={m} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Botao
                titulo={aberto === m.id ? t('Esconder as tarefas') : t('Ver as tarefas')}
                variante="texto"
                accessibilityLabel={aberto === m.id ? t('Esconder as tarefas de {nome}', { nome: m.nome }) : t('Ver as tarefas de {nome}', { nome: m.nome })}
                onPress={() => setAberto(aberto === m.id ? null : m.id)}
                style={{ minHeight: 44, paddingHorizontal: 4 }}
              />
              <Botao
                titulo={t('Usar este modelo')}
                variante="contorno"
                accessibilityLabel={t('Usar o modelo {nome}', { nome: m.nome })}
                onPress={() => usar(m)}
                style={{ flex: 1 }}
              />
            </View>
          </CartaoDoModelo>
        ))}
      </SoPlus>
    </ScrollView>
  );
}
