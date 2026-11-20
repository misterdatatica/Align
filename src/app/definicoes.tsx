import { useEffect, useState } from 'react';
import { AppState, ScrollView, Switch, Text, View } from 'react-native';

import { alarmesExatosPermitidos, avisosDosBlocosDisponiveis, pedirAlarmesExatos, pedirPermissaoDosAvisos, reagendarAvisosDosBlocos } from '@/avisos';
import { avisar, avisarErro, confirmar } from '@/components/dialogos';
import { EtiquetaPlus, SoPlus } from '@/components/Plus';
import { Botao, Cartao, Opcao, Passo, Seccao } from '@/components/ui';
import { exportarCopia, ondeGuardarACopia } from '@/components/exportarCopia';
import { escolherFicheiro } from '@/copiaFicheiro';
import { consultaAreasArquivadas, reporArea } from '@/data/areas';
import { recarregarConsultas, useConsulta } from '@/data/consulta';
import { importarDados, lerCopia, resumirCopia } from '@/data/copia';
import { carregarDefinicoes, guardarDefinicoes, MINUTOS_ANTES, type Definicoes, type PreferenciaDeIdioma, type PreferenciaDeTema } from '@/data/definicoes';
import { pedirParaReabrirDefinicoes } from '@/estado/reabrir';
import { DIAS_DE_REVISAO } from '@/domain/revisao';
import { descreverDia, formatarHora, paraDataISO } from '@/domain/semana';
import { agendarLembrete, cancelarLembrete, lembretesDisponiveis, pedirPermissaoDeLembrete } from '@/lembrete';
import { fontes, useTema } from '@/theme';
import { t } from '@/i18n';

/** Dias pela ordem da semana portuguesa (segunda primeiro), com o número que as definições guardam (0 = domingo). */
const DIAS = [1, 2, 3, 4, 5, 6, 0];

/** Os nomes dos idiomas ficam sempre na própria língua, para se encontrarem em qualquer idioma. */
const IDIOMAS = (): { valor: PreferenciaDeIdioma; titulo: string }[] => [
  { valor: 'automatico', titulo: t('Automático') },
  { valor: 'pt', titulo: 'Português' },
  { valor: 'en', titulo: 'English' },
];

const APARENCIAS = (): { valor: PreferenciaDeTema; titulo: string; ajuda: string }[] => [
  { valor: 'automatico', titulo: t('Automático'), ajuda: t('Segue o modo claro ou escuro do telemóvel.') },
  { valor: 'claro', titulo: t('Claro'), ajuda: t('Sempre clara, mesmo com o telemóvel em modo escuro.') },
  { valor: 'escuro', titulo: t('Escuro'), ajuda: t('Sempre escura, mesmo com o telemóvel em modo claro.') },
];

function minutosDe(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export default function DefinicoesEcra() {
  const { cores, estilos, corDaArea } = useTema();
  const definicoes = useConsulta(carregarDefinicoes, ['definicoes']);
  const arquivadas = useConsulta(() => consultaAreasArquivadas().all(), ['areas']);
  // No Android, os avisos dos blocos só chegam à hora certa com "Alarmes e lembretes" permitidos.
  const [exatos, setExatos] = useState(true);
  useEffect(() => {
    if (!definicoes.avisosBlocos) return;
    const ver = () => {
      alarmesExatosPermitidos()
        .then(setExatos)
        .catch(() => {});
    };
    ver();
    // Ao voltar das definições do telemóvel.
    const estado = AppState.addEventListener('change', (e) => {
      if (e === 'active') ver();
    });
    return () => estado.remove();
  }, [definicoes.avisosBlocos]);

  function mudar(alteracoes: Partial<Definicoes>) {
    try {
      const novas = guardarDefinicoes(alteracoes);
      // O lembrete acompanha o dia e a hora da revisão.
      if (novas.lembreteAtivo && ('diaRevisao' in alteracoes || 'horaRevisao' in alteracoes)) {
        agendarLembrete(novas.diaRevisao, novas.horaRevisao).catch((erro: unknown) => avisarErro(t('Não foi possível reagendar o lembrete'), erro));
      }
    } catch (erro) {
      avisarErro(t('Não foi possível guardar'), erro);
    }
  }

  /** A permissão para notificações só é pedida aqui, quando o utilizador liga o lembrete. */
  async function alternarLembrete(ativo: boolean) {
    try {
      if (ativo) {
        if (!(await pedirPermissaoDeLembrete())) {
          avisar(t('Notificações desligadas'), t('Para receber o lembrete, autorize as notificações desta app nas definições do telemóvel.'));
          return;
        }
        await agendarLembrete(definicoes.diaRevisao, definicoes.horaRevisao);
      } else {
        await cancelarLembrete();
      }
      guardarDefinicoes({ lembreteAtivo: ativo });
    } catch (erro) {
      avisarErro(t('Não foi possível mudar o lembrete'), erro);
    }
  }

  /** Como no lembrete, a permissão para notificações só é pedida quando se ligam os avisos. */
  async function alternarAvisos(ativo: boolean) {
    try {
      if (ativo && !(await pedirPermissaoDosAvisos())) {
        avisar(t('Notificações desligadas'), t('Para receber os avisos, autorize as notificações desta app nas definições do telemóvel.'));
        return;
      }
      guardarDefinicoes({ avisosBlocos: ativo });
      await reagendarAvisosDosBlocos();
    } catch (erro) {
      avisarErro(t('Não foi possível mudar os avisos'), erro);
    }
  }

  async function permitirAlarmesExatos() {
    try {
      setExatos(await pedirAlarmesExatos());
      await reagendarAvisosDosBlocos();
    } catch (erro) {
      avisarErro(t('Não foi possível abrir as definições do telemóvel'), erro);
    }
  }

  async function importar() {
    try {
      const texto = await escolherFicheiro();
      if (texto === null) return;
      const copia = lerCopia(texto);
      const sim = await confirmar({
        titulo: t('Importar esta cópia?'),
        mensagem: t('Tem {resumo}, guardadas em {dia}. Substitui todos os dados que estão agora na app.', { resumo: resumirCopia(copia), dia: descreverDia(paraDataISO(new Date(copia.exportadoEm))) }),
        acao: t('Importar'),
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
      // Os avisos dos blocos também (agendam-se sozinhos, quando as definições mudam).
      if (importadas.avisosBlocos && !(await pedirPermissaoDosAvisos())) guardarDefinicoes({ avisosBlocos: false });
      avisar(t('Dados importados'), t('A app tem agora {resumo}.', { resumo: resumirCopia(copia) }));
    } catch (erro) {
      avisarErro(t('Não foi possível importar os dados'), erro);
    }
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo}>
      <Seccao titulo={t('Aparência')}>
        <Cartao style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={t('Aparência')}>
            {APARENCIAS().map((a) => (
              <Opcao key={a.valor} titulo={a.titulo} ativa={definicoes.tema === a.valor} onPress={() => mudar({ tema: a.valor })} style={{ flex: 1, paddingHorizontal: 0 }} />
            ))}
          </View>
          <Text style={estilos.pequeno}>{APARENCIAS().find((a) => a.valor === definicoes.tema)?.ajuda}</Text>
        </Cartao>
      </Seccao>

      <Seccao titulo={t('Idioma')}>
        <Cartao style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={t('Idioma')}>
            {IDIOMAS().map((i) => (
              <Opcao
                key={i.valor}
                titulo={i.titulo}
                ativa={definicoes.idioma === i.valor}
                onPress={() => {
                  if (definicoes.idioma === i.valor) return;
                  pedirParaReabrirDefinicoes();
                  mudar({ idioma: i.valor });
                }}
                style={{ flex: 1, paddingHorizontal: 0 }}
              />
            ))}
          </View>
          <Text style={estilos.pequeno}>{t('Automático segue o idioma do telemóvel.')}</Text>
        </Cartao>
      </Seccao>

      <Seccao titulo={t('Revisão semanal')}>
        <Cartao style={{ padding: 16, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={estilos.corpo}>{t('Dia da revisão')}</Text>
            {/* Sete dias num cartão: em telemóveis estreitos encolhem um pouco, em vez de saírem do cartão. */}
            <View style={{ flexDirection: 'row', gap: 3 }} accessibilityRole="radiogroup" accessibilityLabel={t('Dia da revisão')}>
              {DIAS.map((numero) => ({ numero, nome: t(DIAS_DE_REVISAO[numero]) })).map((d) => (
                <Opcao
                  key={d.numero}
                  titulo={d.nome[0].toUpperCase() + d.nome.slice(1, 3)}
                  rotulo={d.nome}
                  ativa={definicoes.diaRevisao === d.numero}
                  onPress={() => mudar({ diaRevisao: d.numero })}
                  style={{ flex: 1, minWidth: 0, paddingHorizontal: 0 }}
                />
              ))}
            </View>
            <Text style={estilos.pequeno}>{t('A revisão da semana fica disponível a partir de {dia}.', { dia: t(DIAS_DE_REVISAO[definicoes.diaRevisao]) })}</Text>
          </View>
          <Linha titulo={t('Hora da revisão')}>
            <Passo
              rotulo={t('Hora da revisão')}
              valor={minutosDe(definicoes.horaRevisao)}
              texto={definicoes.horaRevisao}
              minimo={0}
              maximo={23 * 60 + 30}
              passo={30}
              onChange={(minutos) => mudar({ horaRevisao: formatarHora(minutos) })}
            />
          </Linha>
          <View style={{ gap: 4 }}>
            <Linha titulo={t('Lembrar-me da revisão')}>
              <Switch
                accessibilityLabel={t('Lembrar-me da revisão')}
                value={definicoes.lembreteAtivo}
                onValueChange={alternarLembrete}
                disabled={!lembretesDisponiveis}
                trackColor={{ false: cores.contorno, true: cores.tinta }}
              />
            </Linha>
            <Text style={estilos.pequeno}>
              {lembretesDisponiveis
                ? t('Uma notificação {dia} às {hora}, neste telemóvel.', { dia: t(DIAS_DE_REVISAO[definicoes.diaRevisao]), hora: definicoes.horaRevisao })
                : t('O lembrete só funciona na app do telemóvel.')}
            </Text>
          </View>
        </Cartao>
      </Seccao>

      <Seccao titulo={t('Calendário')}>
        <Cartao style={{ padding: 16, gap: 12 }}>
          <Linha titulo={t('Começa às')}>
            <Passo
              rotulo={t('Primeira hora do calendário')}
              valor={definicoes.inicioGrelha}
              texto={`${definicoes.inicioGrelha}:00`}
              minimo={0}
              maximo={definicoes.fimGrelha - 4}
              onChange={(inicioGrelha) => mudar({ inicioGrelha })}
            />
          </Linha>
          <Linha titulo={t('Acaba às')}>
            <Passo
              rotulo={t('Última hora do calendário')}
              valor={definicoes.fimGrelha}
              texto={`${definicoes.fimGrelha}:00`}
              minimo={definicoes.inicioGrelha + 4}
              maximo={24}
              onChange={(fimGrelha) => mudar({ fimGrelha })}
            />
          </Linha>
          <Text style={estilos.pequeno}>{t('Se houver blocos fora destas horas, o calendário alarga-se para os mostrar.')}</Text>
        </Cartao>
      </Seccao>

      <Seccao titulo={t('Avisos dos blocos')} direita={<EtiquetaPlus />}>
        <SoPlus mensagem={t('Os avisos antes de cada bloco fazem parte do Align Plus.')}>
          <Cartao style={{ padding: 16, gap: 16 }}>
            <View style={{ gap: 4 }}>
              <Linha titulo={t('Avisar antes de cada bloco')}>
                <Switch
                  accessibilityLabel={t('Avisar antes de cada bloco')}
                  value={definicoes.avisosBlocos}
                  onValueChange={alternarAvisos}
                  disabled={!avisosDosBlocosDisponiveis}
                  trackColor={{ false: cores.contorno, true: cores.tinta }}
                />
              </Linha>
              <Text style={estilos.pequeno}>
                {avisosDosBlocosDisponiveis
                  ? t('Uma notificação antes de cada bloco das tarefas que ainda não fez, neste telemóvel. Os “Ocupado” não avisam.')
                  : t('Os avisos só funcionam na app do telemóvel.')}
              </Text>
            </View>
            {definicoes.avisosBlocos && avisosDosBlocosDisponiveis ? (
              <View style={{ gap: 8 }}>
                <Text style={estilos.corpo}>{t('Quanto tempo antes')}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={t('Quanto tempo antes')}>
                  {MINUTOS_ANTES.map((minutos) => (
                    <Opcao
                      key={minutos}
                      titulo={t('{n} min', { n: minutos })}
                      rotulo={t('{n} minutos antes', { n: minutos })}
                      ativa={definicoes.minutosAntes === minutos}
                      onPress={() => mudar({ minutosAntes: minutos })}
                      style={{ flex: 1, paddingHorizontal: 0 }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {definicoes.avisosBlocos && avisosDosBlocosDisponiveis && !exatos ? (
              <View style={{ gap: 8 }}>
                <Text style={estilos.pequeno}>{t('Para os avisos chegarem à hora certa, permita “Alarmes e lembretes” a esta app. Sem isso, o Android pode atrasá-los.')}</Text>
                <Botao titulo={t('Permitir alarmes e lembretes')} variante="contorno" onPress={permitirAlarmesExatos} />
              </View>
            ) : null}
          </Cartao>
        </SoPlus>
      </Seccao>

      <Seccao titulo={t('Cópia de segurança')}>
        <Cartao style={{ padding: 16, gap: 10 }}>
          <Text style={estilos.pequeno}>{t('Guarde os dados num ficheiro para os recuperar noutro telemóvel ou depois de reinstalar a app.')}</Text>
          <Text style={estilos.pequeno}>{ondeGuardarACopia()}</Text>
          <Text style={[estilos.pequeno, { color: cores.texto2 }]}>
            {definicoes.ultimaCopia ? t('Última cópia: {dia}.', { dia: descreverDia(paraDataISO(new Date(definicoes.ultimaCopia))) }) : t('Ainda não fez nenhuma cópia.')}
          </Text>
          <Botao titulo={t('Exportar dados')} variante="contorno" onPress={exportarCopia} />
          <Botao titulo={t('Importar dados')} variante="contorno" onPress={importar} />
        </Cartao>
      </Seccao>

      {arquivadas.length > 0 ? (
        <Seccao titulo={t('Áreas arquivadas')}>
          <Cartao>
            {arquivadas.map((a, i) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingLeft: 16, paddingRight: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: cores.linhaSuave }}>
                <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: corDaArea(a.cor).forte }} />
                <Text style={{ flex: 1, fontFamily: fontes.textoMedio, fontSize: 15, lineHeight: 20, color: cores.tinta }} numberOfLines={1}>
                  {a.nome}
                </Text>
                <Botao
                  titulo={t('Repor')}
                  variante="texto"
                  accessibilityLabel={t('Repor a área {nome}', { nome: a.nome })}
                  onPress={() => reporArea(a.id).catch((erro: unknown) => avisarErro(t('Não foi possível repor a área'), erro))}
                  style={{ minHeight: 44 }}
                />
              </View>
            ))}
          </Cartao>
        </Seccao>
      ) : null}

      <Text style={[estilos.pequeno, { textAlign: 'center' }]}>{t('Os seus dados ficam só neste dispositivo. A app não recolhe nem envia nada.')}</Text>
    </ScrollView>
  );
}

function Linha({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const { estilos } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={[estilos.corpo, { flexShrink: 1 }]}>{titulo}</Text>
      {children}
    </View>
  );
}
