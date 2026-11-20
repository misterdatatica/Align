import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { comDesfazer } from '@/components/AvisoTemporario';
import { CampoAutoGuardado } from '@/components/CampoAutoGuardado';
import { avisarErro } from '@/components/dialogos';
import { Botao, BotaoIcone, Opcao, Passo, estilos } from '@/components/ui';
import { alocarTarefa, marcarBlocoFeito, moverBloco, renomearOcupado, retirarBloco, type BlocoCalendario, type CalendarioDaSemana, type TarefaPorAlocar } from '@/data/calendario';
import { formatarIntervalo, PASSO_MIN, sobrepostos } from '@/domain/calendario';
import type { Ambito } from '@/domain/proposta';
import { DIAS_CURTOS, DIAS_LONGOS, MINUTOS_DIA, descreverDia, formatarHora } from '@/domain/semana';
import { formatarDuracao } from '@/domain/tarefas';
import { cores, corDaArea, fontes } from '@/theme';

import { EscolhaDeAmbito } from './EscolhaDeAmbito';

/** O que a folha mostra: um bloco que já existe, ou uma tarefa a alocar escolhendo dia e hora. */
export type AlvoDaFolha = { tipo: 'bloco'; blocoId: number } | { tipo: 'nova'; tarefaId: number };

type Props = {
  alvo: AlvoDaFolha | null;
  calendario: CalendarioDaSemana;
  aoFechar: () => void;
};

/**
 * Folha que sobe do fundo do ecrã com os detalhes de um bloco. É também a alternativa completa a
 * arrastar: dia, hora de início e duração mudam-se com botões, que funcionam com o leitor de ecrã.
 */
export function FolhaBloco({ alvo, calendario, aoFechar }: Props) {
  const margens = useSafeAreaInsets();
  const bloco = alvo?.tipo === 'bloco' ? calendario.blocos.find((b) => b.id === alvo.blocoId) : undefined;
  const tarefa = alvo?.tipo === 'nova' ? calendario.porAlocar.find((t) => t.tarefaId === alvo.tarefaId) : undefined;
  const aberta = bloco !== undefined || tarefa !== undefined;

  // O bloco pode desaparecer com a folha aberta (ex.: devolvido a "Por alocar"): fecha-se sozinha.
  useEffect(() => {
    if (alvo && !aberta) aoFechar();
  }, [alvo, aberta, aoFechar]);

  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={aoFechar} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(21, 23, 28, 0.45)' }} />
        <View
          accessibilityViewIsModal
          style={{ backgroundColor: cores.fundo, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(margens.bottom, 16), gap: 16 }}
        >
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: cores.contorno }} />
          {bloco ? <DetalheDoBloco key={bloco.id} bloco={bloco} calendario={calendario} aoFechar={aoFechar} /> : null}
          {tarefa ? <NovaAlocacao key={tarefa.tarefaId} tarefa={tarefa} calendario={calendario} aoFechar={aoFechar} /> : null}
        </View>
      </View>
    </Modal>
  );
}

function Cabecalho({ titulo, subtitulo, cor, aoFechar }: { titulo: string; subtitulo: string; cor: string | null; aoFechar: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View style={{ marginTop: 9, width: 10, height: 10, borderRadius: cor ? 999 : 2, backgroundColor: cor ?? cores.tracejado }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fontes.titulo, fontSize: 20, lineHeight: 26, color: cores.tinta }} accessibilityRole="header">
          {titulo}
        </Text>
        <Text style={estilos.pequeno}>{subtitulo}</Text>
      </View>
      <BotaoIcone icone="fechar" rotulo="Fechar" onPress={aoFechar} style={{ marginTop: -6, marginRight: -8 }} />
    </View>
  );
}

type Horario = { dia: number; inicioMin: number; fimMin: number };

/** Dia, hora de início e duração, escolhidos com botões. */
function EscolhaDeHorario({ horario, dias, duracaoFixa, aoMudar }: { horario: Horario; dias: string[]; duracaoFixa?: boolean; aoMudar: (h: Horario) => void }) {
  const duracao = horario.fimMin - horario.inicioMin;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel="Dia">
        {DIAS_CURTOS.map((nome, i) => (
          <Opcao
            key={nome}
            titulo={nome}
            rotulo={descreverDia(dias[i])}
            ativa={horario.dia === i}
            onPress={() => aoMudar({ ...horario, dia: i })}
            style={{ flex: 1, paddingHorizontal: 0 }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text style={estilos.rotulo}>INÍCIO</Text>
          <Passo
            rotulo="Hora de início"
            valor={horario.inicioMin}
            texto={formatarHora(horario.inicioMin)}
            minimo={0}
            maximo={MINUTOS_DIA - duracao}
            passo={PASSO_MIN}
            onChange={(inicioMin) => aoMudar({ ...horario, inicioMin, fimMin: inicioMin + duracao })}
          />
        </View>
        {duracaoFixa ? null : (
          <View style={{ gap: 6 }}>
            <Text style={estilos.rotulo}>DURAÇÃO</Text>
            <Passo
              rotulo="Duração"
              valor={duracao}
              texto={formatarDuracao(duracao) ?? ''}
              minimo={PASSO_MIN}
              maximo={MINUTOS_DIA - horario.inicioMin}
              passo={PASSO_MIN}
              onChange={(nova) => aoMudar({ ...horario, fimMin: horario.inicioMin + nova })}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function DetalheDoBloco({ bloco, calendario, aoFechar }: { bloco: BlocoCalendario; calendario: CalendarioDaSemana; aoFechar: () => void }) {
  const ocupado = bloco.tipo === 'ocupado';
  // Nos blocos de tarefas recorrentes o horário só se guarda depois de se escolher o âmbito.
  const [pendente, setPendente] = useState<Horario | null>(null);
  const [aPerguntar, setAPerguntar] = useState<'mudar' | 'retirar' | null>(null);
  const horario = pendente ?? bloco;
  const mudou = pendente !== null && (pendente.dia !== bloco.dia || pendente.inicioMin !== bloco.inicioMin || pendente.fimMin !== bloco.fimMin);
  const outros = sobrepostos(
    calendario.blocos.filter((b) => b.dia === horario.dia),
    { id: bloco.id, inicioMin: horario.inicioMin, fimMin: horario.fimMin },
  );

  function tentar(titulo: string, acao: () => void): boolean {
    try {
      acao();
      return true;
    } catch (erro) {
      avisarErro(titulo, erro);
      return false;
    }
  }

  const mover = (h: Horario, ambito?: Ambito) => tentar('Não foi possível mudar o bloco', () => moverBloco(bloco.id, calendario.dias[h.dia], h.inicioMin, h.fimMin, ambito));
  const retirar = (ambito?: Ambito) => {
    const texto = ocupado ? `“${bloco.nome}” apagado` : `“${bloco.nome}” voltou a “Por alocar”`;
    if (comDesfazer(texto, () => retirarBloco(bloco.id, ambito), 'Não foi possível retirar o bloco')) aoFechar();
  };

  function responder(ambito: Ambito) {
    if (aPerguntar === 'retirar') {
      retirar(ambito);
      return;
    }
    if (pendente && mover(pendente, ambito)) setPendente(null);
    setAPerguntar(null);
  }

  if (aPerguntar) {
    const titulo =
      aPerguntar === 'retirar'
        ? `Devolver “${bloco.nome}” a “Por alocar”?`
        : `Mudar “${bloco.nome}” para ${DIAS_LONGOS[horario.dia]}, ${formatarIntervalo(horario.inicioMin, horario.fimMin)}?`;
    return <EscolhaDeAmbito titulo={titulo} aoEscolher={responder} aoCancelar={() => setAPerguntar(null)} />;
  }

  return (
    <>
      <Cabecalho
        titulo={bloco.nome}
        subtitulo={`${ocupado ? 'Ocupado' : bloco.area} · ${descreverDia(calendario.dias[bloco.dia])} · ${formatarIntervalo(bloco.inicioMin, bloco.fimMin)}`}
        cor={bloco.cor ? corDaArea(bloco.cor).forte : null}
        aoFechar={aoFechar}
      />
      {bloco.soEstaSemana ? <Text style={estilos.pequeno}>Mudado só nesta semana: a semana seguinte volta ao horário habitual.</Text> : null}
      {outros.length > 0 ? (
        <Text style={[estilos.pequeno, { color: cores.perigo }]} accessibilityLiveRegion="polite">
          {`Sobrepõe-se a “${outros[0].nome}”${outros.length > 1 ? ` e a mais ${outros.length - 1}` : ''}.`}
        </Text>
      ) : null}
      {ocupado ? (
        <View style={{ gap: 6 }}>
          <Text style={estilos.rotulo}>TÍTULO</Text>
          <CampoAutoGuardado
            inicial={bloco.nome === 'Ocupado' ? '' : bloco.nome}
            guardar={async (titulo) => renomearOcupado(bloco.id, titulo)}
            erro="Não foi possível guardar o título"
            placeholder="Ex.: Reunião, Médico"
            maxLength={40}
            accessibilityLabel="Título do bloco"
            style={estilos.campo}
          />
        </View>
      ) : null}
      <EscolhaDeHorario horario={horario} dias={calendario.dias} aoMudar={(h) => (bloco.recorrente ? setPendente(h) : mover(h))} />
      <View style={{ gap: 8 }}>
        {mudou ? <Botao titulo="Guardar o novo horário" onPress={() => setAPerguntar('mudar')} /> : null}
        {ocupado ? (
          <Botao titulo="Apagar bloco" icone="lixo" variante="perigo" onPress={() => retirar()} />
        ) : (
          <>
            <Botao
              titulo={bloco.feito ? 'Desmarcar como feito' : 'Marcar como feito'}
              icone="certo"
              variante={bloco.feito || mudou ? 'contorno' : 'primario'}
              onPress={() => tentar('Não foi possível marcar o bloco', () => marcarBlocoFeito(bloco.id, !bloco.feito))}
            />
            <Botao titulo="Devolver a “Por alocar”" variante="contorno" onPress={() => (bloco.recorrente ? setAPerguntar('retirar') : retirar())} />
          </>
        )}
      </View>
    </>
  );
}

function NovaAlocacao({ tarefa, calendario, aoFechar }: { tarefa: TarefaPorAlocar; calendario: CalendarioDaSemana; aoFechar: () => void }) {
  // Sugere as 9:00 de segunda, ou o início da grelha se começar mais tarde.
  const inicial = Math.min(Math.max(calendario.inicioMin, 9 * 60), MINUTOS_DIA - tarefa.duracaoMin);
  const [horario, setHorario] = useState<Horario>({ dia: 0, inicioMin: inicial, fimMin: inicial + tarefa.duracaoMin });

  function alocar() {
    try {
      alocarTarefa(tarefa.tarefaId, calendario.semana, calendario.dias[horario.dia], horario.inicioMin);
      aoFechar();
    } catch (erro) {
      avisarErro('Não foi possível alocar a tarefa', erro);
    }
  }

  return (
    <>
      <Cabecalho titulo={tarefa.nome} subtitulo={`${tarefa.area} · ${formatarDuracao(tarefa.duracaoMin)}`} cor={corDaArea(tarefa.cor).forte} aoFechar={aoFechar} />
      <EscolhaDeHorario horario={horario} dias={calendario.dias} duracaoFixa aoMudar={setHorario} />
      <Botao titulo={`Alocar ${DIAS_LONGOS[horario.dia]} às ${formatarHora(horario.inicioMin)}`} onPress={alocar} />
    </>
  );
}
