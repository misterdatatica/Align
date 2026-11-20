import { Stack, useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { CampoData } from '@/components/CampoData';
import { avisarErro, confirmar } from '@/components/dialogos';
import { Botao, Opcao, Seccao } from '@/components/ui';
import { atualizarMeta, criarMeta } from '@/data/metas';
import type { Meta } from '@/db/schema';
import { alvoDescendente, descreverDiasQueFaltam, diasQueFaltam, formatarValor, lerValor, valorComUnidade, type MedidaMeta } from '@/domain/metas';
import { descreverData } from '@/domain/semana';
import { useTema } from '@/theme';
import { t } from '@/i18n';

type Props = {
  areaId: number;
  /** Meta a alterar; sem ela, o formulário cria uma nova. */
  meta?: Meta;
  /** Dia de hoje, AAAA-MM-DD. */
  hoje: string;
  aoFechar: () => void;
};

const MEDIDAS = (): { medida: MedidaMeta; titulo: string; ajuda: string }[] => [
  { medida: 'numero', titulo: t('Número'), ajuda: t('Tem um valor de partida e um alvo, e vai registando por onde anda. O alvo pode ser mais baixo do que a partida (tempo, peso).') },
  { medida: 'marco', titulo: t('Marco'), ajuda: t('Sim ou não: alcançou ou ainda não. Ex.: “Fazer uma viagem com os pais”.') },
];

/**
 * Criar ou alterar uma meta: um resultado a alcançar até uma data, medido com um número ou como um
 * marco. O que se faz para lá chegar são as tarefas, que se ligam à meta no formulário da tarefa.
 *
 * Abre como modal, com "Cancelar" no cabeçalho. Sair com alterações por guardar (Cancelar, voltar
 * atrás ou deslizar o modal) pergunta primeiro "Sair sem guardar?".
 */
export function FormularioMeta({ areaId, meta, hoje, aoFechar }: Props) {
  const { cores, estilos } = useTema();
  const [medida, setMedida] = useState<MedidaMeta>(meta?.medida ?? 'numero');
  const [descricao, setDescricao] = useState(meta?.descricao ?? '');
  const [prazo, setPrazo] = useState(meta?.prazo ?? '');
  const [inicial, setInicial] = useState(meta?.valorInicial != null ? formatarValor(meta.valorInicial) : '');
  const [alvo, setAlvo] = useState(meta?.valorAlvo != null ? formatarValor(meta.valorAlvo) : '');
  const [unidade, setUnidade] = useState(meta?.unidade ?? '');
  const [aGuardar, setAGuardar] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();

  // O que estava no formulário ao abrir, para saber se há alterações por guardar.
  const [noInicio] = useState(() => JSON.stringify([medida, descricao, prazo, inicial, alvo, unidade]));
  const alterado = JSON.stringify([medida, descricao, prazo, inicial, alvo, unidade]) !== noInicio;

  // Depois de guardar, fecha-se sem perguntar nada. Fecha-se depois do render seguinte, para o
  // aviso de alterações por guardar já estar desligado.
  const [guardada, setGuardada] = useState(false);
  useEffect(() => {
    if (guardada) aoFechar();
    // Só quando acaba de guardar: aoFechar muda a cada render e fecharia o ecrã mais do que uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardada]);

  // Ao confirmar "Sair", o aviso desliga-se primeiro e a saída repete-se só depois: se se repetisse logo,
  // voltava a ser travada e a pergunta aparecia outra vez.
  const [saida, setSaida] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);
  useEffect(() => {
    if (saida) navigation.dispatch(saida);
  }, [saida, navigation]);

  usePreventRemove(alterado && !guardada && !saida, ({ data }) => {
    confirmar({ titulo: t('Sair sem guardar?'), mensagem: meta ? t('As alterações a esta meta perdem-se.') : t('A meta não é criada.'), acao: t('Sair'), destrutiva: true }).then((sim) => {
      if (sim) setSaida(data.action);
    });
  });

  const valorInicial = lerValor(inicial);
  const valorAlvo = lerValor(alvo);
  const numeroValido = medida === 'marco' || (valorInicial !== null && valorAlvo !== null && valorInicial !== valorAlvo);
  const valido = descricao.trim().length > 0 && prazo !== '' && numeroValido;
  const faltam = prazo ? diasQueFaltam(hoje, prazo) : null;

  function guardar() {
    const dados = { descricao, prazo, medida, valorInicial, valorAlvo, unidade };
    setAGuardar(true);
    try {
      if (meta) atualizarMeta(meta.id, dados);
      else criarMeta({ areaId, ...dados });
      setGuardada(true);
    } catch (erro) {
      avisarErro(t('Não foi possível guardar a meta'), erro);
      setAGuardar(false);
    }
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ headerLeft: () => <Botao titulo={t('Cancelar')} variante="texto" onPress={() => router.back()} style={{ minHeight: 44, paddingHorizontal: 8 }} /> }} />
      <Seccao titulo={t('Onde quer chegar?')}>
        <TextInput
          value={descricao}
          onChangeText={setDescricao}
          placeholder={t('Ex.: Conseguir meditar 1 h seguida')}
          placeholderTextColor={cores.texto3}
          style={estilos.campo}
          accessibilityLabel={t('Descrição da meta')}
          autoFocus={!meta}
          maxLength={80}
          returnKeyType="done"
        />
        <Text style={estilos.pequeno}>{t('Um resultado, não uma atividade: o que faz para lá chegar são as tarefas.')}</Text>
      </Seccao>

      <Seccao titulo={t('Como se mede?')}>
        {meta ? (
          <Text style={estilos.corpo}>{MEDIDAS().find((m) => m.medida === medida)?.titulo}</Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={t('Como se mede')}>
            {MEDIDAS().map((m) => (
              <Opcao key={m.medida} titulo={m.titulo} ativa={medida === m.medida} onPress={() => setMedida(m.medida)} />
            ))}
          </View>
        )}
        <Text style={estilos.pequeno}>{MEDIDAS().find((m) => m.medida === medida)?.ajuda}</Text>
      </Seccao>

      {medida === 'numero' ? (
        <Seccao titulo={t('Valores')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Text style={estilos.corpo}>{t('De')}</Text>
            <TextInput value={inicial} onChangeText={setInicial} placeholder="20" placeholderTextColor={cores.texto3} keyboardType="decimal-pad" maxLength={9} accessibilityLabel={t('Valor de partida')} style={[estilos.campo, { width: 84 }]} />
            <Text style={estilos.corpo}>{t('para')}</Text>
            <TextInput value={alvo} onChangeText={setAlvo} placeholder="60" placeholderTextColor={cores.texto3} keyboardType="decimal-pad" maxLength={9} accessibilityLabel={t('Valor alvo')} style={[estilos.campo, { width: 84 }]} />
            <TextInput
              value={unidade}
              onChangeText={setUnidade}
              placeholder={t('unidade, ex.: min seguidos')}
              placeholderTextColor={cores.texto3}
              autoCapitalize="none"
              maxLength={24}
              accessibilityLabel={t('Unidade (opcional)')}
              style={[estilos.campo, { flexGrow: 1, flexBasis: 160 }]}
            />
          </View>
          {valorInicial !== null && valorAlvo !== null ? (
            <Text style={estilos.pequeno}>
              {valorInicial === valorAlvo
                ? t('O alvo tem de ser diferente do valor de partida.')
                : alvoDescendente(valorInicial, valorAlvo)
                  ? t('De {inicial} para {alvo}: avançar é descer.', { inicial: formatarValor(valorInicial), alvo: valorComUnidade(valorAlvo, unidade) })
                  : t('De {inicial} para {alvo}.', { inicial: formatarValor(valorInicial), alvo: valorComUnidade(valorAlvo, unidade) })}
            </Text>
          ) : null}
        </Seccao>
      ) : null}

      <Seccao titulo={t('Prazo')}>
        <CampoData valor={prazo} onChange={setPrazo} hoje={hoje} rotulo={t('Prazo')} />
        {prazo && faltam !== null ? (
          <Text style={[estilos.pequeno, faltam < 0 ? { color: cores.perigo } : null]}>{t('Até {dia}: {faltam}.', { dia: descreverData(prazo), faltam: descreverDiasQueFaltam(faltam) })}</Text>
        ) : (
          <Text style={estilos.pequeno}>{t('Uma meta precisa de uma data para lá chegar.')}</Text>
        )}
      </Seccao>

      <Botao titulo={meta ? t('Guardar alterações') : t('Criar meta')} onPress={guardar} disabled={!valido || aGuardar} />
    </ScrollView>
  );
}
