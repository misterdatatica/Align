import { ScrollView, Switch, Text, View } from 'react-native';

import { avisar, avisarErro, confirmar } from '@/components/dialogos';
import { Botao, Cartao, Opcao, Passo, Seccao, estilos } from '@/components/ui';
import { exportarCopia, ONDE_GUARDAR_A_COPIA } from '@/components/exportarCopia';
import { escolherFicheiro } from '@/copiaFicheiro';
import { consultaAreasArquivadas, reporArea } from '@/data/areas';
import { recarregarConsultas, useConsulta } from '@/data/consulta';
import { importarDados, lerCopia, resumirCopia } from '@/data/copia';
import { carregarDefinicoes, guardarDefinicoes, type Definicoes } from '@/data/definicoes';
import { DIAS_DE_REVISAO } from '@/domain/revisao';
import { descreverDia, formatarHora, paraDataISO } from '@/domain/semana';
import { agendarLembrete, cancelarLembrete, lembretesDisponiveis, pedirPermissaoDeLembrete } from '@/lembrete';
import { cores, corDaArea, fontes } from '@/theme';

/** Dias pela ordem da semana portuguesa (segunda primeiro), com o número que as definições guardam (0 = domingo). */
const DIAS = [1, 2, 3, 4, 5, 6, 0].map((numero) => ({ numero, nome: DIAS_DE_REVISAO[numero] }));

function minutosDe(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export default function DefinicoesEcra() {
  const definicoes = useConsulta(carregarDefinicoes, ['definicoes']);
  const arquivadas = useConsulta(() => consultaAreasArquivadas().all(), ['areas']);

  function mudar(alteracoes: Partial<Definicoes>) {
    try {
      const novas = guardarDefinicoes(alteracoes);
      // O lembrete acompanha o dia e a hora da revisão.
      if (novas.lembreteAtivo && ('diaRevisao' in alteracoes || 'horaRevisao' in alteracoes)) {
        agendarLembrete(novas.diaRevisao, novas.horaRevisao).catch((erro: unknown) => avisarErro('Não foi possível reagendar o lembrete', erro));
      }
    } catch (erro) {
      avisarErro('Não foi possível guardar', erro);
    }
  }

  /** A permissão para notificações só é pedida aqui, quando o utilizador liga o lembrete. */
  async function alternarLembrete(ativo: boolean) {
    try {
      if (ativo) {
        if (!(await pedirPermissaoDeLembrete())) {
          avisar('Notificações desligadas', 'Para receber o lembrete, autorize as notificações desta app nas definições do telemóvel.');
          return;
        }
        await agendarLembrete(definicoes.diaRevisao, definicoes.horaRevisao);
      } else {
        await cancelarLembrete();
      }
      guardarDefinicoes({ lembreteAtivo: ativo });
    } catch (erro) {
      avisarErro('Não foi possível mudar o lembrete', erro);
    }
  }

  async function importar() {
    try {
      const texto = await escolherFicheiro();
      if (texto === null) return;
      const copia = lerCopia(texto);
      const sim = await confirmar({
        titulo: 'Importar esta cópia?',
        mensagem: `Tem ${resumirCopia(copia)}, guardadas em ${descreverDia(paraDataISO(new Date(copia.exportadoEm)))}. Substitui todos os dados que estão agora na app.`,
        acao: 'Importar',
        destrutiva: true,
      });
      if (!sim) return;
      importarDados(copia);
      recarregarConsultas();
      // O lembrete da cópia só fica ligado se este telemóvel autorizar notificações.
      const importadas = carregarDefinicoes();
      if (importadas.lembreteAtivo && (await pedirPermissaoDeLembrete())) await agendarLembrete(importadas.diaRevisao, importadas.horaRevisao);
      else {
        await cancelarLembrete();
        if (importadas.lembreteAtivo) guardarDefinicoes({ lembreteAtivo: false });
      }
      avisar('Dados importados', `A app tem agora ${resumirCopia(copia)}.`);
    } catch (erro) {
      avisarErro('Não foi possível importar os dados', erro);
    }
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo}>
      <Seccao titulo="Revisão semanal">
        <Cartao style={{ padding: 16, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={estilos.corpo}>Dia da revisão</Text>
            <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel="Dia da revisão">
              {DIAS.map((d) => (
                <Opcao
                  key={d.numero}
                  titulo={d.nome[0].toUpperCase() + d.nome.slice(1, 3)}
                  rotulo={d.nome}
                  ativa={definicoes.diaRevisao === d.numero}
                  onPress={() => mudar({ diaRevisao: d.numero })}
                  style={{ flex: 1, paddingHorizontal: 0 }}
                />
              ))}
            </View>
            <Text style={estilos.pequeno}>{`A revisão da semana fica disponível a partir de ${DIAS_DE_REVISAO[definicoes.diaRevisao]}.`}</Text>
          </View>
          <Linha titulo="Hora da revisão">
            <Passo
              rotulo="Hora da revisão"
              valor={minutosDe(definicoes.horaRevisao)}
              texto={definicoes.horaRevisao}
              minimo={0}
              maximo={23 * 60 + 30}
              passo={30}
              onChange={(minutos) => mudar({ horaRevisao: formatarHora(minutos) })}
            />
          </Linha>
          <View style={{ gap: 4 }}>
            <Linha titulo="Lembrar-me da revisão">
              <Switch
                accessibilityLabel="Lembrar-me da revisão"
                value={definicoes.lembreteAtivo}
                onValueChange={alternarLembrete}
                disabled={!lembretesDisponiveis}
                trackColor={{ false: cores.contorno, true: cores.tinta }}
              />
            </Linha>
            <Text style={estilos.pequeno}>
              {lembretesDisponiveis
                ? `Uma notificação ${DIAS_DE_REVISAO[definicoes.diaRevisao]} às ${definicoes.horaRevisao}, neste telemóvel.`
                : 'O lembrete só funciona na app do telemóvel.'}
            </Text>
          </View>
        </Cartao>
      </Seccao>

      <Seccao titulo="Calendário">
        <Cartao style={{ padding: 16, gap: 12 }}>
          <Linha titulo="Começa às">
            <Passo
              rotulo="Primeira hora do calendário"
              valor={definicoes.inicioGrelha}
              texto={`${definicoes.inicioGrelha}:00`}
              minimo={0}
              maximo={definicoes.fimGrelha - 4}
              onChange={(inicioGrelha) => mudar({ inicioGrelha })}
            />
          </Linha>
          <Linha titulo="Acaba às">
            <Passo
              rotulo="Última hora do calendário"
              valor={definicoes.fimGrelha}
              texto={`${definicoes.fimGrelha}:00`}
              minimo={definicoes.inicioGrelha + 4}
              maximo={24}
              onChange={(fimGrelha) => mudar({ fimGrelha })}
            />
          </Linha>
          <Text style={estilos.pequeno}>Se houver blocos fora destas horas, o calendário alarga-se para os mostrar.</Text>
        </Cartao>
      </Seccao>

      <Seccao titulo="Cópia de segurança">
        <Cartao style={{ padding: 16, gap: 10 }}>
          <Text style={estilos.pequeno}>Guarde os dados num ficheiro para os recuperar noutro telemóvel ou depois de reinstalar a app.</Text>
          <Text style={estilos.pequeno}>{ONDE_GUARDAR_A_COPIA}</Text>
          <Text style={[estilos.pequeno, { color: cores.texto2 }]}>
            {definicoes.ultimaCopia ? `Última cópia: ${descreverDia(paraDataISO(new Date(definicoes.ultimaCopia)))}.` : 'Ainda não fez nenhuma cópia.'}
          </Text>
          <Botao titulo="Exportar dados" variante="contorno" onPress={exportarCopia} />
          <Botao titulo="Importar dados" variante="contorno" onPress={importar} />
        </Cartao>
      </Seccao>

      {arquivadas.length > 0 ? (
        <Seccao titulo="Áreas arquivadas">
          <Cartao>
            {arquivadas.map((a, i) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingLeft: 16, paddingRight: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: corDaArea(a.cor).forte }} />
                <Text style={{ flex: 1, fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }} numberOfLines={1}>
                  {a.nome}
                </Text>
                <Botao
                  titulo="Repor"
                  variante="texto"
                  accessibilityLabel={`Repor a área ${a.nome}`}
                  onPress={() => reporArea(a.id).catch((erro: unknown) => avisarErro('Não foi possível repor a área', erro))}
                  style={{ minHeight: 44 }}
                />
              </View>
            ))}
          </Cartao>
        </Seccao>
      ) : null}

      <Text style={[estilos.pequeno, { textAlign: 'center' }]}>Os seus dados ficam só neste dispositivo. A app não recolhe nem envia nada.</Text>
    </ScrollView>
  );
}

function Linha({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={[estilos.corpo, { flexShrink: 1 }]}>{titulo}</Text>
      {children}
    </View>
  );
}
