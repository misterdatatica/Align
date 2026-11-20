import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avisar, avisarErro } from '@/components/dialogos';
import { Icone } from '@/components/Icone';
import { Botao, Cartao, Opcao, Passo } from '@/components/ui';
import { criarArea } from '@/data/areas';
import { recarregarConsultas } from '@/data/consulta';
import { DEFINICOES_INICIAIS, guardarDefinicoes } from '@/data/definicoes';
import { garantirSemana } from '@/data/tarefas';
import { DIAS_DE_REVISAO } from '@/domain/revisao';
import { formatarHora, inicioDaSemana } from '@/domain/semana';
import { agendarLembrete, lembretesDisponiveis, pedirPermissaoDeLembrete } from '@/lembrete';
import { SUGESTOES_DE_AREAS } from '@/sugestoes';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

const NIVEIS = () => [
  { nome: t('Área'), texto: t('Uma responsabilidade da sua vida: Espiritual, Família, Trabalho…') },
  { nome: t('Missão'), texto: t('Uma frase que diz porque é que essa área importa.') },
  { nome: t('Meta'), texto: t('Onde quer chegar, com prazo: conseguir meditar 1 h seguida até 31 de março.') },
  { nome: t('Tarefa'), texto: t('O que faz para lá chegar, semana a semana, com lugar no calendário.') },
];

/** Dias pela ordem da semana portuguesa, com o número que as definições guardam (0 = domingo). */
const DIAS = [1, 2, 3, 4, 5, 6, 0];

/**
 * Primeiro arranque, em três passos: a ideia da app, as primeiras áreas, e o dia e a hora da revisão.
 * Só aparece enquanto não houver áreas nem definições guardadas (ver o ecrã das áreas).
 */
export default function BoasVindasEcra() {
  const { cores, estilos, corDaArea } = useTema();
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [diaRevisao, setDiaRevisao] = useState(DEFINICOES_INICIAIS.diaRevisao);
  const [minutos, setMinutos] = useState(18 * 60);
  const [lembrete, setLembrete] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);

  function alternar(nome: string) {
    setEscolhidas((atuais) => (atuais.includes(nome) ? atuais.filter((n) => n !== nome) : [...atuais, nome]));
  }

  async function ligarLembrete(ativo: boolean) {
    if (ativo && !(await pedirPermissaoDeLembrete())) {
      avisar(t('Notificações desligadas'), t('Pode ligar o lembrete mais tarde, nas definições.'));
      return;
    }
    setLembrete(ativo);
  }

  async function comecar() {
    setAGuardar(true);
    try {
      // Pela ordem das sugestões, para a lista ficar sempre igual.
      for (const sugestao of SUGESTOES_DE_AREAS.filter((s) => escolhidas.includes(s.nome))) await criarArea({ ...sugestao, nome: t(sugestao.nome), missao: '' });
      const horaRevisao = formatarHora(minutos);
      guardarDefinicoes({ diaRevisao, horaRevisao, lembreteAtivo: lembrete });
      // A primeira semana não tem de onde copiar: começa já com plano.
      garantirSemana(inicioDaSemana(new Date()));
      if (lembrete) await agendarLembrete(diaRevisao, horaRevisao);
      recarregarConsultas();
      router.replace('/');
    } catch (erro) {
      avisarErro(t('Não foi possível guardar'), erro);
      setAGuardar(false);
    }
  }

  return (
    <SafeAreaView style={estilos.ecra}>
      <ScrollView contentContainerStyle={[estilos.conteudo, { flexGrow: 1, gap: 24 }]}>
        <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={t('Passo {n} de 3', { n: passo + 1 })}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= passo ? cores.tinta : cores.linha }} />
          ))}
        </View>

        {passo === 0 ? (
          <>
            <Cabecalho titulo={t('Uma semana alinhada com o que importa')} texto={t('A app liga cada área da sua vida ao que faz em cada semana, em quatro níveis.')} />
            <Cartao>
              {NIVEIS().map((nivel, i) => (
                <View key={nivel.nome} style={{ flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                  <View style={{ width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.tinta }}>
                    <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, color: cores.sobreTinta }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: fontes.textoForte, fontSize: 16, lineHeight: 22, color: cores.tinta }}>{nivel.nome}</Text>
                    <Text style={{ fontFamily: fontes.texto, fontSize: 14, lineHeight: 20, color: cores.texto2 }}>{nivel.texto}</Text>
                  </View>
                </View>
              ))}
            </Cartao>
            <Text style={estilos.pequeno}>{t('Todas as semanas: planeia, põe no calendário, faz e revê. Os dados ficam só neste dispositivo.')}</Text>
          </>
        ) : null}

        {passo === 1 ? (
          <>
            <Cabecalho titulo={t('Quais são as suas áreas?')} texto={t('Escolha as que fazem sentido para si. Pode mudar os nomes e as cores, e criar outras, quando quiser. Recomendamos até 7.')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {SUGESTOES_DE_AREAS.map((s) => {
                const cor = corDaArea(s.cor);
                const ativa = escolhidas.includes(s.nome);
                return (
                  <Pressable
                    key={s.nome}
                    accessibilityRole="checkbox"
                    accessibilityLabel={t(s.nome)}
                    accessibilityState={{ checked: ativa }}
                    onPress={() => alternar(s.nome)}
                    style={{
                      minHeight: 48,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: ativa ? cor.forte : 'transparent',
                      backgroundColor: ativa ? cor.tinta : cores.superficie,
                    }}
                  >
                    <Icone nome={ativa ? 'certo' : s.icone} tamanho={18} cor={ativa ? cor.texto : cores.texto2} espessura={ativa ? 2.4 : 1.8} />
                    <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, color: ativa ? cor.texto : cores.tinta }}>{t(s.nome)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {passo === 2 ? (
          <>
            <Cabecalho titulo={t('Quando faz a revisão da semana?')} texto={t('Uma vez por semana vê o que fez, passa o que ficou por fazer e planeia a semana seguinte.')} />
            <Cartao style={{ padding: 16, gap: 16 }}>
              {/* Sete dias num cartão: em telemóveis estreitos encolhem um pouco, em vez de saírem do cartão. */}
              <View style={{ flexDirection: 'row', gap: 3 }} accessibilityRole="radiogroup" accessibilityLabel={t('Dia da revisão')}>
                {DIAS.map((dia) => (
                  <Opcao
                    key={dia}
                    titulo={t(DIAS_DE_REVISAO[dia])[0].toUpperCase() + t(DIAS_DE_REVISAO[dia]).slice(1, 3)}
                    rotulo={t(DIAS_DE_REVISAO[dia])}
                    ativa={diaRevisao === dia}
                    onPress={() => setDiaRevisao(dia)}
                    style={{ flex: 1, minWidth: 0, paddingHorizontal: 0 }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text style={estilos.corpo}>{t('Hora')}</Text>
                <Passo rotulo={t('Hora da revisão')} valor={minutos} texto={formatarHora(minutos)} minimo={0} maximo={23 * 60 + 30} passo={30} onChange={setMinutos} />
              </View>
              {lembretesDisponiveis ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={[estilos.corpo, { flexShrink: 1 }]}>{t('Lembrar-me com uma notificação')}</Text>
                  <Switch accessibilityLabel={t('Lembrar-me com uma notificação')} value={lembrete} onValueChange={ligarLembrete} trackColor={{ false: cores.contorno, true: cores.tinta }} />
                </View>
              ) : null}
            </Cartao>
            <Text style={estilos.pequeno}>{t('A revisão fica disponível {dia}. Pode mudar isto nas definições.', { dia: t(DIAS_DE_REVISAO[diaRevisao]) })}</Text>
          </>
        ) : null}

        <View style={{ marginTop: 'auto', gap: 4 }}>
          <Botao titulo={passo === 2 ? t('Começar') : t('Continuar')} onPress={passo === 2 ? comecar : () => setPasso(passo + 1)} disabled={aGuardar} />
          {passo > 0 ? <Botao titulo={t('Voltar')} variante="texto" onPress={() => setPasso(passo - 1)} disabled={aGuardar} style={{ justifyContent: 'center' }} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Cabecalho({ titulo, texto }: { titulo: string; texto: string }) {
  const { cores, estilos } = useTema();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[estilos.titulo, { fontSize: 28, lineHeight: 34 }]} accessibilityRole="header">
        {titulo}
      </Text>
      <Text style={{ fontFamily: fontes.texto, fontSize: 16, lineHeight: 22, color: cores.texto2 }}>{texto}</Text>
    </View>
  );
}
