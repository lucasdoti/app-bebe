import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { LinhaRegistro } from '@/components/linha-registro';
import { Aviso, Cabecalho, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useRegistros } from '@/context/registros';
import { useSessao } from '@/context/sessao';
import { useAgora } from '@/hooks/use-agora';
import type { Registro, Tipo } from '@/lib/registros';
import { doDia } from '@/lib/sono';
import { diasAtras, duracao, inicioDoDia, MINUTO } from '@/lib/tempo';
import { ALVO_TOQUE, fontes, raio, type Paleta } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Grupo = 'alimentacao' | 'sono' | 'fralda' | 'saude' | 'gestacao';
type Filtro = Grupo | 'todos';

const GRUPOS: { grupo: Grupo; titulo: string; tipos: Tipo[] }[] = [
  { grupo: 'alimentacao', titulo: 'Alimentação', tipos: ['mamada', 'mamadeira', 'refeicao'] },
  { grupo: 'sono', titulo: 'Sono', tipos: ['sono'] },
  { grupo: 'fralda', titulo: 'Fralda', tipos: ['fralda'] },
  { grupo: 'saude', titulo: 'Remédio e febre', tipos: ['dose', 'febre'] },
  { grupo: 'gestacao', titulo: 'Gestação', tipos: ['contracao', 'movimentos'] },
];
const grupoDe = (t: Tipo) => GRUPOS.find((g) => g.tipos.includes(t))!.grupo;

function corDoGrupo(g: Grupo, cores: Paleta) {
  return { alimentacao: cores.mamada, sono: cores.sono, fralda: cores.fralda, saude: cores.medidas, gestacao: cores.clima }[g];
}

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// Resumo de uma linha do dia escolhido: "6 mamadas · 11h20 de sono · 7 fraldas".
function resumoDoDia(registros: Registro[], sonoMs: number) {
  const conta = (tipos: Tipo[]) => registros.filter((r) => tipos.includes(r.tipo)).length;
  const partes = [
    conta(['mamada', 'mamadeira']) && plural(conta(['mamada', 'mamadeira']), 'mamada', 'mamadas'),
    conta(['refeicao']) && plural(conta(['refeicao']), 'refeição', 'refeições'),
    sonoMs >= MINUTO && `${duracao(sonoMs)} de sono`,
    conta(['fralda']) && plural(conta(['fralda']), 'fralda', 'fraldas'),
    conta(['dose']) && plural(conta(['dose']), 'dose de remédio', 'doses de remédio'),
    conta(['febre']) && plural(conta(['febre']), 'medida de temperatura', 'medidas de temperatura'),
    conta(['contracao']) && plural(conta(['contracao']), 'contração', 'contrações'),
    conta(['movimentos']) && plural(conta(['movimentos']), 'contagem de movimentos', 'contagens de movimentos'),
  ].filter(Boolean);
  return partes.join(' · ');
}

// Histórico: calendário do mês com um ponto colorido por tipo registrado no dia; tocar no dia mostra tudo dele.
export default function Historico() {
  const { bebeAtual } = useBebes();
  const { membros } = useSessao();
  const reg = useRegistros();
  const { cores } = useTema();
  const agora = useAgora(60_000);
  const hoje = inicioDoDia(new Date(agora));

  const [mes, setMes] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [dia, setDia] = useState(hoje);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [carregando, setCarregando] = useState(false);
  const [semInternet, setSemInternet] = useState(false);

  const { carregarPeriodo } = reg;
  const bebeId = bebeAtual?.id;
  useEffect(() => {
    if (!bebeId) return;
    let ativo = true;
    setCarregando(true);
    carregarPeriodo(mes, new Date(mes.getFullYear(), mes.getMonth() + 1, 1)).then((ok) => {
      if (!ativo) return;
      setSemInternet(!ok);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [bebeId, mes, carregarPeriodo]);

  // Registros do mês agrupados por dia (pelo horário de início).
  const porDia = useMemo(() => {
    const mapa = new Map<string, Registro[]>();
    const fimMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1).getTime();
    for (const r of reg.doBebe) {
      const d = new Date(r.inicio);
      if (d.getTime() < mes.getTime() || d.getTime() >= fimMes) continue;
      const k = chaveDia(d);
      mapa.set(k, [...(mapa.get(k) ?? []), r]);
    }
    return mapa;
  }, [reg.doBebe, mes]);

  if (!bebeAtual) return null;

  const gruposNoMes = new Set([...porDia.values()].flat().map((r) => grupoDe(r.tipo)));
  const opcoesFiltro: { valor: Filtro; titulo: string }[] = [
    { valor: 'todos', titulo: 'Tudo' },
    ...GRUPOS.filter((g) => gruposNoMes.has(g.grupo)).map((g) => ({ valor: g.grupo as Filtro, titulo: g.titulo })),
  ];
  const passa = (r: Registro) => filtro === 'todos' || grupoDe(r.tipo) === filtro;

  const doDiaEscolhido = (porDia.get(chaveDia(dia)) ?? []).filter(passa);
  const sono = filtro === 'todos' || filtro === 'sono' ? doDia(reg.doBebe, diasAtras(dia, hoje), agora).total : 0;
  const resumo = resumoDoDia(doDiaEscolhido, sono);
  const nomeAutor = (id: string) => membros.find((m) => m.user_id === id)?.nome ?? 'alguém';

  // Grade do mês: começa no domingo, como a semana do clima.
  const vazios = mes.getDay();
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celulas: (Date | null)[] = [
    ...Array<null>(vazios).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1)),
  ];

  const ehMesAtual = mes.getFullYear() === hoje.getFullYear() && mes.getMonth() === hoje.getMonth();
  const tituloMes = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  function irPara(delta: number) {
    const novo = new Date(mes.getFullYear(), mes.getMonth() + delta, 1);
    setMes(novo);
    // No mês atual volta para hoje; nos outros, começa no dia 1.
    const mesmoMes = novo.getFullYear() === hoje.getFullYear() && novo.getMonth() === hoje.getMonth();
    setDia(mesmoMes ? hoje : novo);
  }

  const tituloDia = dia.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Tela>
      <Cabecalho titulo="Histórico" />

      <Cartao>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <BotaoMes icone="chevron-left" rotulo="Mês anterior" onPress={() => irPara(-1)} />
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text style={{ fontFamily: fontes.extra, fontSize: 18, color: cores.texto }}>
              {tituloMes.charAt(0).toUpperCase() + tituloMes.slice(1)}
            </Text>
            {carregando && <ActivityIndicator size="small" color={cores.textoSuave} />}
          </View>
          <BotaoMes icone="chevron-right" rotulo="Próximo mês" onPress={() => irPara(1)} desligado={ehMesAtual} />
        </View>

        <View style={{ flexDirection: 'row' }}>
          {SEMANA.map((s, i) => (
            <Text
              key={i}
              style={{ flex: 1, textAlign: 'center', fontFamily: fontes.negrito, fontSize: 13, color: cores.textoSuave }}>
              {s}
            </Text>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {celulas.map((d, i) => {
            if (!d) return <View key={`v${i}`} style={{ width: `${100 / 7}%`, height: 52 }} />;
            const futuro = d.getTime() > hoje.getTime();
            const escolhido = chaveDia(d) === chaveDia(dia);
            const ehHoje = chaveDia(d) === chaveDia(hoje);
            const grupos = [...new Set((porDia.get(chaveDia(d)) ?? []).filter(passa).map((r) => grupoDe(r.tipo)))];
            return (
              <Pressable
                key={chaveDia(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: escolhido, disabled: futuro }}
                accessibilityLabel={`${d.getDate()}${grupos.length ? ', com registros' : ''}`}
                disabled={futuro}
                onPress={() => setDia(d)}
                style={{ width: `${100 / 7}%`, height: 52, padding: 2 }}>
                <View
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    backgroundColor: escolhido ? cores.primaria : 'transparent',
                    borderWidth: ehHoje && !escolhido ? 2 : 0,
                    borderColor: cores.primaria,
                    opacity: futuro ? 0.35 : 1,
                  }}>
                  <Text
                    style={{
                      fontFamily: escolhido || ehHoje ? fontes.extra : fontes.media,
                      fontSize: 16,
                      color: escolhido ? cores.textoNaPrimaria : cores.texto,
                    }}>
                    {d.getDate()}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
                    {grupos.map((g) => (
                      <View
                        key={g}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: corDoGrupo(g, cores),
                          borderWidth: escolhido ? 1 : 0,
                          borderColor: cores.textoNaPrimaria,
                        }}
                      />
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {GRUPOS.filter((g) => gruposNoMes.has(g.grupo)).map((g) => (
            <View key={g.grupo} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: corDoGrupo(g.grupo, cores) }} />
              <Texto variante="suave">{g.titulo}</Texto>
            </View>
          ))}
        </View>
      </Cartao>

      <Aviso
        tipo="info"
        texto={semInternet ? 'Sem internet: mostrando só o que está salvo neste aparelho (os últimos dias).' : null}
      />

      {opcoesFiltro.length > 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {opcoesFiltro.map((o) => {
            const ativo = o.valor === filtro;
            return (
              <Pressable
                key={o.valor}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativo }}
                onPress={() => setFiltro(o.valor)}
                style={{
                  minHeight: ALVO_TOQUE,
                  paddingHorizontal: 18,
                  borderRadius: raio.botao,
                  borderWidth: 1.5,
                  justifyContent: 'center',
                  backgroundColor: ativo ? cores.primaria : cores.cartao,
                  borderColor: ativo ? cores.primaria : cores.borda,
                }}>
                <Text style={{ fontFamily: fontes.negrito, fontSize: 16, color: ativo ? cores.textoNaPrimaria : cores.texto }}>
                  {o.titulo}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Cartao>
        <Texto variante="subtitulo">{tituloDia.charAt(0).toUpperCase() + tituloDia.slice(1)}</Texto>
        {resumo ? <Texto variante="suave">{resumo}</Texto> : null}
        {doDiaEscolhido.length === 0 && (
          <Texto variante="suave">{carregando ? 'Carregando…' : 'Nada registrado neste dia.'}</Texto>
        )}
        {[...doDiaEscolhido].reverse().map((x) => (
          <LinhaRegistro key={x.id} registro={x} agora={agora} autor={nomeAutor(x.autor_id)} />
        ))}
      </Cartao>
    </Tela>
  );
}

function BotaoMes({
  icone,
  rotulo,
  onPress,
  desligado,
}: {
  icone: 'chevron-left' | 'chevron-right';
  rotulo: string;
  onPress: () => void;
  desligado?: boolean;
}) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      disabled={desligado}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: desligado ? 0.25 : pressed ? 0.6 : 1,
      })}>
      <MaterialCommunityIcons name={icone} size={30} color={cores.texto} />
    </Pressable>
  );
}
