import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LARGURA_HORAS, MODO_BANDEJA, MODO_MOVER, useArrasto, type Largada } from '@/components/calendario/arrasto';
import { Bandeja, Fantasma } from '@/components/calendario/Bandeja';
import { Riscas } from '@/components/calendario/Bloco';
import { FolhaDeAmbito } from '@/components/calendario/EscolhaDeAmbito';
import { FolhaBloco, type AlvoDaFolha } from '@/components/calendario/FolhaBloco';
import { Grelha } from '@/components/calendario/Grelha';
import { avisarErro } from '@/components/dialogos';
import { Icone } from '@/components/Icone';
import { SeletorSemana } from '@/components/SeletorSemana';
import { BotaoIcone, Titulo, estilos } from '@/components/ui';
import {
  alocarRestantes,
  alocarTarefa,
  carregarCalendario,
  criarOcupado,
  moverBloco,
  retirarBloco,
  type BlocoCalendario,
  type TarefaPorAlocar,
} from '@/data/calendario';
import { recarregarConsultas, useConsulta } from '@/data/consulta';
import { formatarIntervalo, inicioEncaixado, sobrepostos, type Intervalo } from '@/domain/calendario';
import { sobreposicoesDaSemana, type Ambito } from '@/domain/proposta';
import { DIAS_CURTOS, deDataISO, indiceDoDia, somarSemanas } from '@/domain/semana';
import { escolherSemana, useHoje, usePrepararSemana, useSemanaEscolhida } from '@/estado/semana';
import { cores, corDaArea, fontes } from '@/theme';

const TABELAS = ['areas', 'tarefas', 'tarefas_semana', 'blocos', 'definicoes'] as const;

/** Quantos dias a grelha mostra de cada vez. */
type Vista = 1 | 3 | 7;
const VISTAS: { dias: Vista; titulo: string }[] = [
  { dias: 1, titulo: 'Dia' },
  { dias: 3, titulo: '3 dias' },
  { dias: 7, titulo: 'Semana' },
];
/** A vista escolhida fica entre visitas ao separador. */
let vistaGuardada: Vista = 7;
function guardarVista(vista: Vista) {
  vistaGuardada = vista;
}

/** Primeiro dia visível ao abrir uma semana: o de hoje, se for esta semana, sem passar do domingo. */
function primeiroDiaPara(vista: Vista, dias: string[], hoje: string): number {
  if (vista === 7) return 0;
  const indice = dias.includes(hoje) ? indiceDoDia(hoje) : 0;
  return Math.min(indice, 7 - vista);
}

/** O que está escolhido para pôr no calendário com um toque numa hora (alternativa a arrastar). */
type Escolha = { tipo: 'tarefa'; tarefaId: number } | { tipo: 'ocupado' };

type Aviso = { texto: string; acao?: { titulo: string; executar: () => void } };

/** Uma mudança num bloco de tarefa recorrente, à espera de se saber se vale só esta semana ou também nas seguintes. */
type Pergunta = { titulo: string; executar: (ambito: Ambito) => void };

export default function CalendarioEcra() {
  const router = useRouter();
  const semana = useSemanaEscolhida();
  const hoje = useHoje();
  usePrepararSemana(semana);
  const calendario = useConsulta(() => carregarCalendario(semana), TABELAS, semana);
  const { dias, blocos, porAlocar, legenda } = calendario;
  const [vista, setVista] = useState<Vista>(vistaGuardada);
  // O primeiro dia visível vale para uma semana; noutra semana (setas da semana) volta ao início, ou a hoje.
  const [janela, setJanela] = useState(() => ({ semana, primeiro: primeiroDiaPara(vistaGuardada, dias, hoje) }));
  const primeiroDia = janela.semana === semana ? janela.primeiro : primeiroDiaPara(vista, dias, hoje);
  const setPrimeiroDia = (primeiro: number, daSemana = semana) => setJanela({ semana: daSemana, primeiro });

  const [pegado, setPegado] = useState<{ modo: number; id: number } | null>(null);
  const [destino, setDestino] = useState('');
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [folha, setFolha] = useState<AlvoDaFolha | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);

  // Os blocos que se sobrepõem ficam destacados até o utilizador os arrumar.
  const emAtencao = useMemo(() => new Set(sobreposicoesDaSemana(blocos).flatMap((s) => [s.a.id, s.b.id])), [blocos]);

  function mudarVista(nova: Vista) {
    guardarVista(nova);
    setVista(nova);
    setPrimeiroDia(nova === 7 ? 0 : Math.min(dias.includes(hoje) && vista === 7 ? indiceDoDia(hoje) : primeiroDia, 7 - nova));
  }

  /** Setas dos dias (vistas de 1 e 3 dias): andam uma janela; nas pontas passam para a semana ao lado. */
  function andarDias(sentido: -1 | 1) {
    const ultimo = 7 - vista;
    const novo = primeiroDia + sentido * vista;
    if (novo >= 0 && novo <= ultimo) setPrimeiroDia(novo);
    else if (sentido < 0 && primeiroDia > 0) setPrimeiroDia(0);
    else if (sentido > 0 && primeiroDia < ultimo) setPrimeiroDia(ultimo);
    else {
      const outra = somarSemanas(semana, sentido);
      setPrimeiroDia(sentido < 0 ? ultimo : 0, outra);
      escolherSemana(outra);
    }
  }

  /** Na vista da semana, tocar no dia abre esse dia. */
  function abrirDia(indice: number) {
    guardarVista(1);
    setVista(1);
    setPrimeiroDia(indice);
  }

  const visiveis = dias.map((dia, i) => ({ dia, i })).slice(primeiroDia, primeiroDia + vista);

  // Os avisos saem sozinhos; os que pedem uma decisão ficam mais tempo.
  useEffect(() => {
    if (!aviso) return;
    const temporizador = setTimeout(() => setAviso(null), aviso.acao ? 12000 : 6000);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  const blocosNaGrelha = useMemo(() => blocos.map((b) => ({ id: b.id, dia: b.dia, inicio: b.inicioMin, fim: b.fimMin, coluna: b.coluna, colunas: b.colunas })), [blocos]);

  const { grelhaRef, bandejaRef, camadaRef, ...arrasto } = useArrasto({
    inicioMin: calendario.inicioMin,
    fimMin: calendario.fimMin,
    blocos: blocosNaGrelha,
    aoPegar: (modo, id) => {
      setPegado({ modo, id });
      setDestino('');
      setEscolha(null);
      setAviso(null);
    },
    aoMudarAlvo: (dia, inicioMin, fimMin, naGrelha) => setDestino(naGrelha ? `${DIAS_CURTOS[dia]} ${formatarIntervalo(inicioMin, fimMin)}` : ''),
    aoLargar,
  });

  const blocoPegado = pegado && pegado.modo !== MODO_BANDEJA ? blocos.find((b) => b.id === pegado.id) : undefined;
  const tarefaPegada = pegado?.modo === MODO_BANDEJA ? porAlocar.find((t) => t.tarefaId === pegado.id) : undefined;
  const corPegada = blocoPegado?.cor ?? tarefaPegada?.cor ?? null;
  const tarefaEscolhida = escolha?.tipo === 'tarefa' ? porAlocar.find((t) => t.tarefaId === escolha.tarefaId) : undefined;

  /** "X sobrepõe-se a Y", se o bloco ficar por cima de outro: a app deixa, mas avisa (regra 7). */
  function textoDeSobreposicao(nome: string, bloco: Intervalo & { dia: number }): string | null {
    const outros = sobrepostos(
      blocos.filter((b) => b.dia === bloco.dia),
      bloco,
    );
    if (outros.length === 0) return null;
    return `“${nome}” sobrepõe-se a “${outros[0].nome}”${outros.length > 1 ? ` e a mais ${outros.length - 1}` : ''}.`;
  }

  function alocar(tarefa: TarefaPorAlocar, dia: number, inicioMin: number) {
    const id = alocarTarefa(tarefa.tarefaId, semana, dias[dia], inicioMin);
    const partes = [textoDeSobreposicao(tarefa.nome, { id, dia, inicioMin, fimMin: inicioMin + tarefa.duracaoMin })];
    // Tarefas de todos os dias (ou de dias certos): oferece pôr as restantes à mesma hora de uma só vez.
    const restantes = tarefa.quantas - 1;
    const emDiasCertos = tarefa.recorrencia?.tipo === 'diaria' || tarefa.recorrencia?.tipo === 'dias';
    if (restantes > 0 && emDiasCertos) {
      partes.push(restantes === 1 ? 'Pôr a outra à mesma hora?' : `Pôr as outras ${restantes} à mesma hora?`);
      setAviso({
        texto: partes.filter(Boolean).join(' '),
        acao: {
          titulo: 'Alocar',
          executar: () => {
            try {
              alocarRestantes(tarefa.tarefaId, semana, inicioMin);
              setEscolha(null);
              recarregarConsultas();
            } catch (erro) {
              avisarErro('Não foi possível alocar as restantes', erro);
            }
          },
        },
      });
    } else {
      setAviso(partes[0] ? { texto: partes[0] } : null);
    }
  }

  function aoLargar(largada: Largada) {
    setPegado(null);
    setDestino('');
    try {
      if (largada.modo === MODO_BANDEJA) {
        const tarefa = porAlocar.find((t) => t.tarefaId === largada.id);
        if (tarefa && largada.naGrelha) alocar(tarefa, largada.dia, largada.inicioMin);
      } else {
        const bloco = blocos.find((b) => b.id === largada.id);
        if (bloco && largada.naGrelha) {
          if (bloco.dia !== largada.dia || bloco.inicioMin !== largada.inicioMin || bloco.fimMin !== largada.fimMin) {
            const mover = (ambito?: Ambito) => {
              moverBloco(bloco.id, dias[largada.dia], largada.inicioMin, largada.fimMin, ambito);
              const texto = textoDeSobreposicao(bloco.nome, { id: bloco.id, dia: largada.dia, inicioMin: largada.inicioMin, fimMin: largada.fimMin });
              setAviso(texto ? { texto } : null);
            };
            // Um bloco de uma tarefa recorrente fica onde estava até se responder à pergunta.
            if (bloco.recorrente) setPergunta({ titulo: `Mudar “${bloco.nome}” para ${DIAS_CURTOS[largada.dia].toLowerCase()}, ${formatarIntervalo(largada.inicioMin, largada.fimMin)}?`, executar: mover });
            else mover();
          }
        } else if (bloco && largada.naBandeja && largada.modo === MODO_MOVER && bloco.tipo === 'tarefa') {
          // Largar um bloco em cima da bandeja devolve-o a "Por alocar".
          if (bloco.recorrente) setPergunta({ titulo: `Devolver “${bloco.nome}” a “Por alocar”?`, executar: (ambito) => retirarBloco(bloco.id, ambito) });
          else retirarBloco(bloco.id);
        }
      }
    } catch (erro) {
      avisarErro('Não foi possível mudar o calendário', erro);
    }
    recarregarConsultas();
    // Só depois de o ecrã mostrar o bloco no sítio novo é que o destino tracejado desaparece.
    requestAnimationFrame(() => arrasto.aPousar.set(false));
  }

  function aoTocarVazio(dia: number, minutos: number) {
    if (!escolha) return;
    try {
      if (escolha.tipo === 'ocupado') {
        const inicio = inicioEncaixado(minutos, 60, calendario.inicioMin, calendario.fimMin);
        const id = criarOcupado(dias[dia], inicio, inicio + 60);
        setEscolha(null);
        setFolha({ tipo: 'bloco', blocoId: id });
      } else if (tarefaEscolhida) {
        alocar(tarefaEscolhida, dia, inicioEncaixado(minutos, tarefaEscolhida.duracaoMin, calendario.inicioMin, calendario.fimMin));
        // Com várias instâncias por alocar, a tarefa continua escolhida para os toques seguintes.
        if (tarefaEscolhida.quantas <= 1) setEscolha(null);
      } else {
        setEscolha(null);
      }
      recarregarConsultas();
    } catch (erro) {
      avisarErro('Não foi possível pôr no calendário', erro);
    }
  }

  function responder(ambito: Ambito) {
    const { executar } = pergunta ?? {};
    setPergunta(null);
    try {
      executar?.(ambito);
    } catch (erro) {
      avisarErro('Não foi possível mudar o calendário', erro);
    }
    recarregarConsultas();
  }

  function aoEscolher(tarefa: TarefaPorAlocar) {
    setAviso(null);
    setEscolha(escolha?.tipo === 'tarefa' && escolha.tarefaId === tarefa.tarefaId ? null : { tipo: 'tarefa', tarefaId: tarefa.tarefaId });
  }

  return (
    <SafeAreaView style={estilos.ecra} edges={['top']}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Titulo tamanho={24}>Calendário</Titulo>
          <View style={{ marginRight: -12 }}>
            <SeletorSemana semana={semana} aoMudar={escolherSemana} compacto />
          </View>
        </View>

        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }} accessibilityLabel="Legenda">
            {legenda.map((a) => (
              <ItemDaLegenda key={a.id} nome={a.nome}>
                <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: corDaArea(a.cor).forte }} />
              </ItemDaLegenda>
            ))}
            <ItemDaLegenda nome="Ocupado">
              <View style={{ width: 10, height: 10, borderRadius: 2, overflow: 'hidden' }}>
                <Riscas legenda />
              </View>
            </ItemDaLegenda>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Novo bloco Ocupado"
            accessibilityHint="Depois toque na hora do compromisso"
            accessibilityState={{ selected: escolha?.tipo === 'ocupado' }}
            hitSlop={6}
            onPress={() => {
              setAviso(null);
              setEscolha(escolha?.tipo === 'ocupado' ? null : { tipo: 'ocupado' });
            }}
            style={{
              height: 32,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: escolha?.tipo === 'ocupado' ? cores.tinta : cores.contorno,
              backgroundColor: escolha?.tipo === 'ocupado' ? cores.tinta : cores.superficie,
            }}
          >
            <Icone nome="mais" tamanho={14} cor={escolha?.tipo === 'ocupado' ? '#FFFFFF' : cores.tinta} espessura={2.2} />
            <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, color: escolha?.tipo === 'ocupado' ? '#FFFFFF' : cores.tinta }}>Ocupado</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', padding: 2, borderRadius: 10, backgroundColor: cores.pista }} accessibilityRole="radiogroup" accessibilityLabel="Dias visíveis">
            {VISTAS.map((v) => {
              const ativa = vista === v.dias;
              return (
                <Pressable
                  key={v.dias}
                  accessibilityRole="radio"
                  accessibilityLabel={`Mostrar ${v.titulo.toLowerCase()}`}
                  accessibilityState={{ selected: ativa }}
                  onPress={() => mudarVista(v.dias)}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={{ minHeight: 30, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: ativa ? cores.superficie : 'transparent' }}
                >
                  <Text style={{ fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, color: ativa ? cores.tinta : cores.texto2 }}>{v.titulo}</Text>
                </Pressable>
              );
            })}
          </View>
          {vista === 7 ? null : (
            <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', marginRight: -10 }}>
              <BotaoIcone icone="seta-esquerda" rotulo={vista === 1 ? 'Dia anterior' : 'Dias anteriores'} tamanho={18} onPress={() => andarDias(-1)} />
              <BotaoIcone icone="seta-direita" rotulo={vista === 1 ? 'Dia seguinte' : 'Dias seguintes'} tamanho={18} onPress={() => andarDias(1)} />
            </View>
          )}
        </View>

        <View style={{ marginTop: 10, flexDirection: 'row', paddingLeft: LARGURA_HORAS }}>
          {visiveis.map(({ dia, i }) => {
            const eHoje = dia === hoje;
            return (
              <Pressable
                key={dia}
                disabled={vista !== 7}
                onPress={() => abrirDia(i)}
                style={{ flex: 1, alignItems: 'center' }}
                accessibilityRole={vista === 7 ? 'button' : 'header'}
                accessibilityLabel={`${DIAS_CURTOS[i]} ${deDataISO(dia).getDate()}${eHoje ? ', hoje' : ''}`}
                accessibilityHint={vista === 7 ? 'Mostra só este dia' : undefined}
              >
                <Text style={{ fontFamily: fontes.texto, fontSize: 11, lineHeight: 14, color: cores.texto3 }}>{DIAS_CURTOS[i]}</Text>
                <View style={{ minWidth: 24, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: eHoje ? cores.tinta : 'transparent' }}>
                  <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: eHoje ? '#FFFFFF' : cores.tinta }}>{deDataISO(dia).getDate()}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flex: 1, marginTop: 2 }}>
          <Grelha
            calendario={calendario}
            arrasto={arrasto}
            grelhaRef={grelhaRef}
            blocoArrastado={blocoPegado?.id ?? null}
            corDoArrasto={corPegada ? corDaArea(corPegada) : null}
            blocosEmAtencao={emAtencao}
            primeiroDia={primeiroDia}
            numDias={vista}
            aoTocarBloco={(bloco: BlocoCalendario) => {
              setEscolha(null);
              setFolha({ tipo: 'bloco', blocoId: bloco.id });
            }}
            aoTocarVazio={aoTocarVazio}
          />
          {/*
            Por cima do fundo da grelha, para a grelha não mudar de tamanho quando a faixa aparece.
            Um aviso (sobreposição, ou a oferta de alocar as restantes) tem prioridade sobre a instrução
            do modo "tocar para alocar"; quando o aviso sai, a instrução volta.
          */}
          {aviso ? (
            <Faixa
              texto={aviso.texto}
              acao={
                aviso.acao
                  ? {
                      titulo: aviso.acao.titulo,
                      executar: () => {
                        aviso.acao?.executar();
                        setAviso(null);
                      },
                    }
                  : undefined
              }
              aoFechar={() => setAviso(null)}
              rotuloFechar="Fechar aviso"
            />
          ) : escolha ? (
            <Faixa
              texto={tarefaEscolhida ? `Toque na hora de início de “${tarefaEscolhida.nome}”.` : 'Toque na hora em que está ocupado.'}
              acao={tarefaEscolhida ? { titulo: 'Escolher dia e hora', executar: () => setFolha({ tipo: 'nova', tarefaId: tarefaEscolhida.tarefaId }) } : undefined}
              aoFechar={() => setEscolha(null)}
              rotuloFechar="Cancelar"
            />
          ) : null}
        </View>

        <View style={{ marginTop: 10 }}>
          <Bandeja
            calendario={calendario}
            arrasto={arrasto}
            bandejaRef={bandejaRef}
            escolhida={tarefaEscolhida?.tarefaId ?? null}
            arrastada={tarefaPegada?.tarefaId ?? null}
            aoEscolher={aoEscolher}
            aoPlanear={() => router.navigate('/semana')}
          />
        </View>
      </View>

      <Fantasma arrasto={arrasto} camadaRef={camadaRef} nome={blocoPegado?.nome ?? tarefaPegada?.nome ?? null} destino={destino} />
      <FolhaBloco alvo={folha} calendario={calendario} aoFechar={() => setFolha(null)} />
      <FolhaDeAmbito pergunta={pergunta?.titulo ?? null} aoEscolher={responder} aoCancelar={() => setPergunta(null)} />
    </SafeAreaView>
  );
}

function ItemDaLegenda({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {children}
      <Text style={{ fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, color: cores.texto2 }}>{nome}</Text>
    </View>
  );
}

/** Faixa escura por cima do fundo da grelha: instruções do modo "tocar para alocar" e avisos de sobreposição. */
function Faixa({ texto, acao, aoFechar, rotuloFechar }: { texto: string; acao?: { titulo: string; executar: () => void }; aoFechar: () => void; rotuloFechar: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 14, paddingVertical: 4, borderRadius: 14, backgroundColor: cores.tinta }}
    >
      <Text style={{ flex: 1, paddingVertical: 6, fontFamily: fontes.textoMedio, fontSize: 13, lineHeight: 18, color: '#FFFFFF' }}>{texto}</Text>
      {acao ? (
        <Pressable
          accessibilityRole="button"
          onPress={acao.executar}
          style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#FFFFFF' }}
        >
          <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, color: cores.tinta }}>{acao.titulo}</Text>
        </Pressable>
      ) : null}
      <BotaoIcone icone="fechar" rotulo={rotuloFechar} cor="#FFFFFF" tamanho={18} onPress={aoFechar} />
    </View>
  );
}
