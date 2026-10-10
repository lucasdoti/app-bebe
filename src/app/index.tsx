import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Folha } from '@/components/folha';
import { InicioGestacao } from '@/components/inicio-gestacao';
import { BotaoRegistro, CartaoResumo, SeletorBebe, type NomeIcone } from '@/components/home';
import { Botao, BotaoIcone, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { nasceu, useBebes } from '@/context/bebes';
import { useClima } from '@/context/clima';
import { useMedidas } from '@/context/medidas';
import { useRegistros } from '@/context/registros';
import { useRemedios } from '@/context/remedios';
import { useVacinas } from '@/context/vacinas';
import { CALENDARIO_BEBE, dataRecomendada, rotuloIdade, situacaoBebe } from '@/lib/vacinas';
import { useRoupa, type Pendente, type Resultado } from '@/context/roupa';
import { useSessao } from '@/context/sessao';
import { useAgora } from '@/hooks/use-agora';
import { useSugestao } from '@/hooks/use-sugestao';
import { descricaoTempo } from '@/lib/clima';
import { formatar } from '@/components/grafico-crescimento';
import { percentil, percentilTexto, pontosDe } from '@/lib/crescimento';
import { deISO, fase, idadeTexto, type Fase } from '@/lib/idade';
import {
  descricao,
  ladoAtual,
  ladoSugerido,
  nomeLado,
  resumo,
  temposPorLado,
  type Lado,
  type Leite,
  type Registro,
  type Tipo,
} from '@/lib/registros';
import { lerPref } from '@/lib/storage';
import { cronometro, duracao, haQuanto, horaCurta, HORA } from '@/lib/tempo';
import { ALVO_TOQUE, fontes, type Paleta } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Painel = 'mamada' | 'fralda' | 'anterior' | null;
type Toast = { texto: string; acao?: { titulo: string; onPress: () => void } };

const VOLUMES = [60, 90, 120, 150, 180, 210];

function corDoTipo(t: Tipo, cores: Paleta) {
  const mapa: Record<Tipo, string> = {
    mamada: cores.mamada,
    mamadeira: cores.mamada,
    refeicao: cores.mamada,
    sono: cores.sono,
    fralda: cores.fralda,
    contracao: cores.mamada,
    movimentos: cores.sono,
    dose: cores.medidas,
    febre: cores.fralda,
  };
  return mapa[t];
}

function iconeDoTipo(r: Registro): NomeIcone {
  if (r.tipo === 'refeicao') return 'food-apple-outline';
  if (r.tipo === 'sono') return 'sleep';
  if (r.tipo === 'contracao') return 'timer-outline';
  if (r.tipo === 'movimentos') return 'gesture-tap';
  if (r.tipo === 'dose') return 'pill';
  if (r.tipo === 'febre') return 'thermometer';
  if (r.tipo === 'fralda') return r.detalhes.penico ? 'toilet' : 'human-baby-changing-table';
  return 'baby-bottle-outline';
}

const abrirRegistro = (id: string) => router.push({ pathname: '/registro/[id]', params: { id } });
const novoRegistro = (tipo: Tipo) => router.push({ pathname: '/registro/[id]', params: { id: 'novo', tipo } });

export default function Inicio() {
  const { familia, membros } = useSessao();
  const { bebes, bebeAtual, escolherBebe, carregando } = useBebes();
  const reg = useRegistros();
  const med = useMedidas();
  const { clima: tempoAgora } = useClima();
  const roupa = useRoupa();
  const sugestaoCasa = useSugestao('casa', 'carrinho', null);
  const { situacao } = useRemedios();
  const { aplicadas: vacinasAplicadas } = useVacinas();
  const [erroFeedback, setErroFeedback] = useState<string | null>(null);
  const { cores } = useTema();
  const r = resumo(reg.doBebe);
  const agora = useAgora(r.peitoAtivo || r.dormindo ? 1000 : 30_000);
  const [painel, setPainel] = useState<Painel>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function avisar(t: Toast) {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), 6000);
  }

  // Registro rápido com opção de desfazer (toque errado de madrugada acontece).
  function registrado(texto: string, registro: Registro | null, extra?: Toast['acao']) {
    setPainel(null);
    if (!registro) return;
    avisar({
      texto,
      acao: extra ?? { titulo: 'Desfazer', onPress: () => (reg.excluir(registro.id), setToast(null)) },
    });
  }

  const topo = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        {bebes.length > 1 ? (
          <SeletorBebe bebes={bebes} atual={bebeAtual} onEscolher={escolherBebe} />
        ) : (
          <Texto variante="suave">{familia?.nome}</Texto>
        )}
      </View>
      <BotaoIcone icone="settings-outline" rotulo="Ajustes" onPress={() => router.push('/ajustes')} />
    </View>
  );

  if (carregando) return <Tela topo={topo}>{null}</Tela>;

  if (!bebeAtual) {
    return (
      <Tela topo={topo}>
        <Cartao style={{ backgroundColor: cores.mamada, borderColor: cores.mamada, marginTop: 24 }}>
          <Texto variante="subtitulo">Vamos cadastrar o bebê?</Texto>
          <Texto>Já nasceu ou está a caminho? Na gestação, o app acompanha as semanas, o pré-natal e a mala; depois do parto, a rotina.</Texto>
          <Botao
            titulo="Cadastrar bebê"
            variante="secundario"
            onPress={() => router.push({ pathname: '/bebe/[id]', params: { id: 'novo' } })}
          />
        </Cartao>
      </Tela>
    );
  }

  if (!nasceu(bebeAtual)) return <InicioGestacao bebe={bebeAtual} topo={topo} />;

  const f: Fase = fase(bebeAtual.nascimento);
  const nomeAutor = (id: string) => membros.find((m) => m.user_id === id)?.nome ?? 'alguém';
  const sugerido: Lado = ladoSugerido(reg.doBebe);
  const ultimaMamadaPeito = reg.doBebe.find((x) => x.tipo === 'mamada');

  // ---------- Cartões ----------

  const alimentacao = (() => {
    const titulo = { mamadas: 'Última mamada', introducao: 'Última mamada ou refeição', crianca: 'Última refeição' }[f];
    const icone: NomeIcone = f === 'mamadas' ? 'baby-bottle-outline' : 'food-apple-outline';
    if (r.peitoAtivo) {
      const lado = ladoAtual(r.peitoAtivo.detalhes)!;
      const outro = lado === 'E' ? 'D' : 'E';
      const tempos = temposPorLado(r.peitoAtivo.detalhes, agora);
      return (
        <CartaoResumo
          key="alimentacao"
          cor={cores.mamada}
          icone="baby-bottle-outline"
          titulo={`Mamando no ${nomeLado[lado]}`}
          valor={cronometro(agora - new Date(r.peitoAtivo.inicio).getTime())}
          detalhe={`Esquerdo ${cronometro(tempos.E)} · Direito ${cronometro(tempos.D)}`}
          onPress={() => abrirRegistro(r.peitoAtivo!.id)}>
          <View style={{ flex: 1 }}>
            <Botao
              titulo={`Trocar p/ ${nomeLado[outro]}`}
              variante="secundario"
              onPress={() => reg.trocarLado(r.peitoAtivo!)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Botao titulo="Encerrar" onPress={() => reg.encerrar(r.peitoAtivo!)} />
          </View>
        </CartaoResumo>
      );
    }
    const ultima = r.ultimaAlimentacao;
    const d = ultima && descricao(ultima, agora);
    return (
      <CartaoResumo
        key="alimentacao"
        cor={cores.mamada}
        icone={icone}
        titulo={titulo}
        valor={ultima ? haQuanto(ultima.inicio, new Date(agora)) : '—'}
        detalhe={
          d
            ? `${d.titulo} · ${d.detalhe}`
            : 'Nenhum registro ainda'
        }
        onPress={ultima ? () => abrirRegistro(ultima.id) : undefined}
      />
    );
  })();

  const sono = r.dormindo ? (
    <CartaoResumo
      key="sono"
      cor={cores.sono}
      icone="sleep"
      titulo={`Dormindo desde ${horaCurta(r.dormindo.inicio)}`}
      valor={cronometro(agora - new Date(r.dormindo.inicio).getTime())}
      detalhe={`${duracao(r.sono24h)} de sono em 24h`}
      onPress={() => abrirRegistro(r.dormindo!.id)}>
      <View style={{ flex: 1 }}>
        <Botao titulo="Acordou" onPress={() => reg.encerrar(r.dormindo!)} />
      </View>
    </CartaoResumo>
  ) : (
    <CartaoResumo
      key="sono"
      cor={cores.sono}
      icone="sleep"
      titulo={r.acordadoDesde ? 'Acordado (janela de vigília)' : f === 'crianca' ? 'Cochilos' : 'Sono'}
      valor={r.acordadoDesde ? haQuanto(r.acordadoDesde, new Date(agora)).replace('há ', '') : '—'}
      detalhe={
        r.sono24h
          ? `${duracao(r.sono24h)} de sono em 24h · ${r.cochilos} ${r.cochilos === 1 ? 'sono' : 'sonos'}`
          : 'Nenhum sono registrado nas últimas 24h'
      }
    />
  );

  const fraldas = (
    <CartaoResumo
      key="fralda"
      cor={cores.fralda}
      icone={f === 'crianca' ? 'toilet' : 'human-baby-changing-table'}
      titulo={f === 'crianca' ? 'Fraldas e penico hoje' : 'Fraldas hoje'}
      valor={String(r.fraldasHoje)}
      detalhe={
        r.ultimaFralda
          ? `${r.xixiHoje} xixi · ${r.cocoHoje} cocô · última ${haQuanto(r.ultimaFralda.inicio, new Date(agora))}`
          : 'Nenhuma troca registrada'
      }
    />
  );

  const clima = (
    <CartaoResumo
      key="clima"
      cor={cores.clima}
      icone="tshirt-crew-outline"
      titulo={
        tempoAgora
          ? `Agora: ${descricaoTempo(tempoAgora.atual.codigo, tempoAgora.atual.dia).texto.toLowerCase()}`
          : 'Clima e roupa'
      }
      valor={
        tempoAgora
          ? `${Math.round(tempoAgora.atual.temp)}° · sensação ${Math.round(tempoAgora.atual.sensacao)}°`
          : 'Ver o clima'
      }
      detalhe={sugestaoCasa ? `Em casa: ${sugestaoCasa.titulo.toLowerCase()}` : 'Toque para a sugestão de roupa'}
      onPress={() => router.push('/roupa')}
    />
  );

  const ultimoPeso = pontosDe(bebeAtual, med.doBebe, 'peso').at(-1);
  const ultimaAltura = pontosDe(bebeAtual, med.doBebe, 'altura').at(-1);
  // Próxima dose do remédio mais urgente (PRD: cartão "próxima dose liberada às 20h").
  const tratamentos = situacao(agora)
    .filter((s) => !s.terminou)
    .sort((a, b) => a.proxima - b.proxima);
  const remedio = tratamentos[0] && (
    <CartaoResumo
      key="remedio"
      cor={cores.medidas}
      icone="pill"
      titulo={tratamentos.length > 1 ? `Remédios (${tratamentos.length})` : `Remédio: ${tratamentos[0].remedio.nome}`}
      valor={
        tratamentos[0].liberada
          ? `${tratamentos[0].remedio.nome} liberado agora`
          : `Próxima dose às ${horaCurta(new Date(tratamentos[0].proxima))}`
      }
      detalhe={
        tratamentos[0].ultimaDose
          ? `Última: ${horaCurta(tratamentos[0].ultimaDose.inicio)} por ${nomeAutor(tratamentos[0].ultimaDose.autor_id)}`
          : 'Nenhuma dose registrada'
      }
      onPress={() => router.push('/remedios')}
    />
  );

  // Vacinas: atrasadas ou para agora primeiro; senão, a próxima do calendário.
  const vacinas = (() => {
    const nasc = bebeAtual.nascimento;
    const comSituacao = CALENDARIO_BEBE.map((d) => ({
      d,
      s: situacaoBebe(d, nasc, vacinasAplicadas.some((a) => a.para === 'bebe' && a.codigo === d.codigo)),
    }));
    const pendentes = comSituacao.filter((x) => x.s === 'atrasada' || x.s === 'agora');
    const proxima = comSituacao.find((x) => x.s === 'proxima' || x.s === 'futura');
    const data = proxima && dataRecomendada(nasc, proxima.d.idadeMeses!);
    return (
      <CartaoResumo
        key="vacinas"
        cor={pendentes.length ? cores.mamada : cores.medidas}
        icone="needle"
        titulo="Vacinas"
        valor={
          pendentes.length
            ? `${pendentes.length} para tomar`
            : proxima
              ? `Próxima: ${rotuloIdade(proxima.d.idadeMeses!).toLowerCase()}`
              : 'Em dia'
        }
        detalhe={
          pendentes.length
            ? pendentes.slice(0, 3).map((x) => `${x.d.vacina.split(' (')[0]} ${x.d.dose.toLowerCase()}`).join(', ')
            : proxima && data
              ? `${proxima.d.vacina.split(' (')[0]} · ${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`
              : undefined
        }
        onPress={() => router.push('/vacinas')}
      />
    );
  })();

  const medidas = (
    <CartaoResumo
      key="medidas"
      cor={cores.medidas}
      icone="ruler"
      titulo="Última medida"
      valor={
        [ultimoPeso && formatar(ultimoPeso.valor, 'peso'), ultimaAltura && formatar(ultimaAltura.valor, 'altura')]
          .filter(Boolean)
          .join(' · ') || '—'
      }
      detalhe={
        ultimoPeso
          ? `${ultimoPeso.dias === 0 ? 'Ao nascer' : deISO(ultimoPeso.data)} · peso no ${percentilTexto(
              percentil('peso', bebeAtual.sexo, ultimoPeso.dias, ultimoPeso.valor),
            )}`
          : 'Toque para anotar peso e altura'
      }
      onPress={() => router.push('/medidas')}
    />
  );

  // ---------- Linha do tempo ----------

  const ultimas24h = reg.doBebe.filter(
    (x) => x.fim === null || new Date(x.inicio).getTime() >= agora - 24 * HORA,
  );

  // ---------- Rodapé ----------

  const botoes: { chave: string; cor: string; icone: NomeIcone; titulo: string; onPress: () => void }[] = [];
  if (f !== 'crianca')
    botoes.push({
      chave: 'mamada',
      cor: cores.mamada,
      icone: 'baby-bottle-outline',
      titulo: 'Mamada',
      onPress: () => setPainel('mamada'),
    });
  if (f !== 'mamadas')
    botoes.push({
      chave: 'refeicao',
      cor: cores.mamada,
      icone: 'food-apple-outline',
      titulo: 'Refeição',
      onPress: () => novoRegistro('refeicao'),
    });
  botoes.push({
    chave: 'sono',
    cor: cores.sono,
    icone: r.dormindo ? 'weather-sunny' : 'sleep',
    titulo: r.dormindo ? 'Acordou' : 'Sono',
    onPress: () => {
      if (r.dormindo) {
        reg.encerrar(r.dormindo);
        avisar({ texto: `Acordou às ${horaCurta(new Date())}` });
      } else {
        registrado(`Sono iniciado às ${horaCurta(new Date())}`, reg.iniciarSono());
      }
    },
  });
  botoes.push({
    chave: 'fralda',
    cor: cores.fralda,
    icone: 'human-baby-changing-table',
    titulo: f === 'crianca' ? 'Fralda/penico' : 'Fralda',
    onPress: () => setPainel('fralda'),
  });

  const rodape = (
    <View style={{ gap: 8 }}>
      {toast && (
        <View
          accessibilityRole="alert"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: cores.texto,
            borderRadius: 16,
            paddingLeft: 16,
            minHeight: ALVO_TOQUE,
          }}>
          <Text style={{ flex: 1, fontFamily: fontes.media, fontSize: 15, color: cores.fundo }}>{toast.texto}</Text>
          {toast.acao && (
            <Pressable
              accessibilityRole="button"
              onPress={toast.acao.onPress}
              style={{ minHeight: ALVO_TOQUE, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fontes.extra, fontSize: 15, color: cores.fundo }}>{toast.acao.titulo}</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {botoes.map(({ chave, ...b }) => (
          <BotaoRegistro key={chave} {...b} />
        ))}
      </View>
    </View>
  );

  return (
    <Tela topo={topo} rodape={rodape}>
      <View style={{ gap: 2 }}>
        <Texto variante="titulo">{bebeAtual.nome}</Texto>
        <Texto variante="suave">
          {idadeTexto(bebeAtual.nascimento)}
          {reg.pendentes > 0 ? ` · ${reg.pendentes} registro(s) aguardando internet` : ''}
        </Texto>
      </View>

      {roupa.perguntas(bebeAtual.id).slice(0, 1).map((p) => (
        <PerguntaRoupa
          key={p.id}
          nome={bebeAtual.nome}
          pendente={p}
          erro={erroFeedback}
          onResponder={async (resultado) => {
            setErroFeedback(await roupa.responder(p, resultado));
          }}
          onDispensar={() => roupa.dispensar(p.id)}
        />
      ))}

      {alimentacao}
      {sono}
      {fraldas}
      {clima}
      {remedio}
      {vacinas}
      {medidas}

      <Cartao>
        <Texto variante="subtitulo">Últimas 24h</Texto>
        {ultimas24h.length === 0 && <Texto variante="suave">Nenhum registro nas últimas 24 horas.</Texto>}
        {ultimas24h.map((x) => {
          const d = descricao(x, agora);
          return (
            <Pressable
              key={x.id}
              accessibilityRole="button"
              onPress={() => abrirRegistro(x.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: ALVO_TOQUE,
                opacity: pressed ? 0.7 : 1,
              })}>
              <Text style={{ width: 48, fontFamily: fontes.negrito, fontSize: 15, color: cores.textoSuave }}>
                {horaCurta(x.inicio)}
              </Text>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: corDoTipo(x.tipo, cores),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <MaterialCommunityIcons name={iconeDoTipo(x)} size={20} color={cores.textoNaPrimaria} />
              </View>
              <View style={{ flex: 1 }}>
                <Texto style={{ fontFamily: fontes.negrito }}>
                  {d.titulo}
                  {x.fim === null && x.tipo !== 'sono' ? ' (agora)' : ''}
                </Texto>
                <Texto variante="suave">{[d.detalhe, `por ${nomeAutor(x.autor_id)}`].filter(Boolean).join(' · ')}</Texto>
              </View>
            </Pressable>
          );
        })}
        <Botao titulo="Registrar algo que já passou" variante="secundario" onPress={() => setPainel('anterior')} />
      </Cartao>

      <Folha aberta={painel === 'mamada'} titulo="Mamada" onFechar={() => setPainel(null)}>
        <PainelMamada
          sugerido={sugerido}
          ultimoLado={ultimaMamadaPeito?.tipo === 'mamada' ? ladoAtual(ultimaMamadaPeito.detalhes) : null}
          ultimaHa={ultimaMamadaPeito ? haQuanto(ultimaMamadaPeito.inicio, new Date(agora)) : null}
          ativa={!!r.peitoAtivo}
          onPeito={(lado) => {
            reg.iniciarPeito(lado);
            setPainel(null);
          }}
          onMamadeira={(ml, leite) => registrado(`Mamadeira de ${ml} ml registrada`, reg.mamadeira(ml, leite))}
          onAnterior={() => {
            setPainel(null);
            novoRegistro('mamada');
          }}
        />
      </Folha>

      <Folha aberta={painel === 'fralda'} titulo="Fralda" onFechar={() => setPainel(null)}>
        <PainelFralda
          mostraPenico={f === 'crianca'}
          onRegistrar={(xixi, coco, penico) => {
            const novo = reg.fralda({ xixi, coco, ...(penico && { penico: true }) });
            const texto = xixi && coco ? 'Xixi e cocô' : coco ? 'Cocô' : 'Xixi';
            registrado(
              `${texto} registrado`,
              novo,
              coco && novo ? { titulo: 'Detalhes', onPress: () => (setToast(null), abrirRegistro(novo.id)) } : undefined,
            );
          }}
        />
      </Folha>

      <Folha aberta={painel === 'anterior'} titulo="Registrar algo que já passou" onFechar={() => setPainel(null)}>
        {(
          [
            ['mamada', 'Mamada no peito'],
            ['mamadeira', 'Mamadeira'],
            ['refeicao', 'Refeição'],
            ['sono', 'Sono'],
            ['fralda', 'Fralda'],
          ] as [Tipo, string][]
        )
          .filter(([t]) => !(f === 'mamadas' && t === 'refeicao'))
          .map(([t, titulo]) => (
            <Botao
              key={t}
              titulo={titulo}
              variante="secundario"
              onPress={() => {
                setPainel(null);
                novoRegistro(t);
              }}
            />
          ))}
      </Folha>
    </Tela>
  );
}

// "Como o bebê ficou?" depois do passeio ou na manhã seguinte ao sono; calibra a sugestão de roupa.
function PerguntaRoupa({
  nome,
  pendente,
  erro,
  onResponder,
  onDispensar,
}: {
  nome: string;
  pendente: Pendente;
  erro: string | null;
  onResponder: (r: Resultado) => void;
  onDispensar: () => void;
}) {
  const { cores } = useTema();
  const onde = { casa: 'em casa', passeio: 'no passeio', sono: 'dormindo' }[pendente.contexto];
  return (
    <Cartao style={{ backgroundColor: cores.clima, borderColor: cores.clima }}>
      <Texto variante="subtitulo" style={{ color: cores.textoNaPrimaria }}>
        Como {nome} ficou {onde}?
      </Texto>
      <Texto style={{ color: cores.textoNaPrimaria }}>
        Roupa das {horaCurta(new Date(pendente.marcadoEm))}: {pendente.sugestao.toLowerCase()}
      </Texto>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(
          [
            ['frio', 'Com frio'],
            ['ok', 'Bem'],
            ['calor', 'Com calor'],
          ] as [Resultado, string][]
        ).map(([r, titulo]) => (
          <View key={r} style={{ flex: 1 }}>
            <Botao titulo={titulo} variante="secundario" onPress={() => onResponder(r)} />
          </View>
        ))}
      </View>
      {erro && <Texto style={{ color: cores.textoNaPrimaria }}>{erro}</Texto>}
      <Botao titulo="Agora não" variante="texto" onPress={onDispensar} />
    </Cartao>
  );
}

function PainelMamada({
  sugerido,
  ultimoLado,
  ultimaHa,
  ativa,
  onPeito,
  onMamadeira,
  onAnterior,
}: {
  sugerido: Lado;
  ultimoLado: Lado | null;
  ultimaHa: string | null;
  ativa: boolean;
  onPeito: (lado: Lado) => void;
  onMamadeira: (ml: number, leite: Leite) => void;
  onAnterior: () => void;
}) {
  const { cores } = useTema();
  const [leite, setLeite] = useState<Leite>(() => (lerPref('leite_preferido') as Leite) || 'materno');

  return (
    <>
      {ativa ? (
        <Texto variante="suave">Já tem uma mamada no peito em andamento. Encerre pelo cartão da tela inicial.</Texto>
      ) : (
        <>
          <Texto variante="rotulo">
            Peito{ultimoLado ? ` · último foi o ${nomeLado[ultimoLado]}, ${ultimaHa}` : ''}
          </Texto>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['E', 'D'] as Lado[]).map((lado) => {
              const destaque = lado === sugerido;
              return (
                <Pressable
                  key={lado}
                  accessibilityRole="button"
                  accessibilityLabel={`Começar no peito ${nomeLado[lado]}${destaque ? ', sugerido' : ''}`}
                  onPress={() => onPeito(lado)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 96,
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor: destaque ? cores.texto : cores.borda,
                    backgroundColor: destaque ? cores.mamada : cores.cartao,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    opacity: pressed ? 0.8 : 1,
                  })}>
                  <Text
                    style={{
                      fontFamily: fontes.extra,
                      fontSize: 20,
                      color: destaque ? cores.textoNaPrimaria : cores.texto,
                    }}>
                    {lado === 'E' ? 'Esquerdo' : 'Direito'}
                  </Text>
                  {destaque && (
                    <Text style={{ fontFamily: fontes.media, fontSize: 14, color: cores.textoNaPrimaria }}>
                      sugerido
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Texto variante="rotulo">Mamadeira</Texto>
      <Escolha<Leite>
        rotulo="Leite"
        opcoes={[
          { valor: 'materno', titulo: 'Materno' },
          { valor: 'formula', titulo: 'Fórmula' },
        ]}
        valor={leite}
        onChange={setLeite}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {VOLUMES.map((ml) => (
          <Pressable
            key={ml}
            accessibilityRole="button"
            accessibilityLabel={`Registrar mamadeira de ${ml} ml`}
            onPress={() => onMamadeira(ml, leite)}
            style={({ pressed }) => ({
              flexBasis: '30%',
              flexGrow: 1,
              minHeight: ALVO_TOQUE,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: cores.borda,
              backgroundColor: cores.cartao,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}>
            <Text style={{ fontFamily: fontes.negrito, fontSize: 17, color: cores.texto }}>{ml} ml</Text>
          </Pressable>
        ))}
      </View>
      <Botao titulo="Outro volume ou horário anterior" variante="texto" onPress={onAnterior} />
    </>
  );
}

function PainelFralda({
  mostraPenico,
  onRegistrar,
}: {
  mostraPenico: boolean;
  onRegistrar: (xixi: boolean, coco: boolean, penico: boolean) => void;
}) {
  const [penico, setPenico] = useState(false);
  const opcoes: [string, boolean, boolean][] = [
    ['Xixi', true, false],
    ['Cocô', false, true],
    ['Os dois', true, true],
  ];
  return (
    <>
      {mostraPenico && (
        <Escolha
          rotulo="Onde"
          opcoes={[
            { valor: 'fralda', titulo: 'Na fralda' },
            { valor: 'penico', titulo: 'No penico' },
          ]}
          valor={penico ? 'penico' : 'fralda'}
          onChange={(v) => setPenico(v === 'penico')}
        />
      )}
      {opcoes.map(([titulo, xixi, coco]) => (
        <Botao key={titulo} titulo={titulo} variante="secundario" onPress={() => onRegistrar(xixi, coco, penico)} />
      ))}
      <Texto variante="suave">Cor e consistência do cocô podem ser adicionadas depois, tocando no registro.</Texto>
    </>
  );
}
