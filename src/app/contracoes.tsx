import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Cabecalho, Cartao, Tela, Texto } from '@/components/ui';
import { useRegistros } from '@/context/registros';
import { useAgora } from '@/hooks/use-agora';
import { duracaoSegundos, type Registro } from '@/lib/registros';
import { cronometro, horaCurta } from '@/lib/tempo';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const MIN = 60_000;
const t = (iso: string) => new Date(iso).getTime();

// Duração média, intervalo médio (de um início ao outro) e a orientação 5-1-1 na última hora.
function estatisticas(feitas: Registro[], agora: number) {
  const ultimaHora = feitas.filter((r) => t(r.inicio) >= agora - 60 * MIN);
  const duracoes = ultimaHora.map((r) => t(r.fim!) - t(r.inicio));
  const intervalos = ultimaHora.slice(1).map((r, i) => t(r.inicio) - t(ultimaHora[i].inicio));
  const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
  const duracaoMedia = media(duracoes);
  const intervaloMedio = media(intervalos);
  const cincoUmUm =
    ultimaHora.length >= 8 &&
    t(ultimaHora[0].inicio) <= agora - 50 * MIN &&
    intervaloMedio <= 5 * MIN &&
    intervalos.every((i) => i <= 6 * MIN) &&
    duracaoMedia >= 55_000;
  return { quantidade: ultimaHora.length, duracaoMedia, intervaloMedio, cincoUmUm };
}

export default function Contracoes() {
  const { doBebe, iniciarContracao, encerrar } = useRegistros();
  const { cores } = useTema();
  const agora = useAgora(1000);

  const todas = doBebe.filter((r) => r.tipo === 'contracao');
  const ativa = todas.find((r) => r.fim === null);
  const feitas = todas.filter((r) => r.fim !== null).sort((a, b) => t(a.inicio) - t(b.inicio));
  const recentes = feitas.filter((r) => t(r.inicio) >= agora - 24 * 60 * MIN).reverse();
  const e = estatisticas(feitas, agora);
  const desdeUltima = feitas.length ? agora - t(feitas.at(-1)!.inicio) : null;

  return (
    <Tela>
      <Cabecalho titulo="Contrações" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ativa ? 'Contração acabou' : 'Contração começou'}
        onPress={() => (ativa ? encerrar(ativa) : iniciarContracao())}
        style={({ pressed }) => ({
          alignSelf: 'center',
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: ativa ? cores.mamada : cores.cartao,
          borderWidth: 3,
          borderColor: cores.mamada,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: pressed ? 0.85 : 1,
        })}>
        <MaterialCommunityIcons name="timer-outline" size={36} color={ativa ? cores.textoNaPrimaria : cores.texto} />
        <Text style={{ fontFamily: fontes.extra, fontSize: 26, color: ativa ? cores.textoNaPrimaria : cores.texto }}>
          {ativa ? 'Acabou' : 'Começou'}
        </Text>
        <Text style={{ fontFamily: fontes.negrito, fontSize: 20, color: ativa ? cores.textoNaPrimaria : cores.textoSuave }}>
          {ativa
            ? cronometro(agora - t(ativa.inicio))
            : desdeUltima !== null && desdeUltima < 2 * 60 * MIN
              ? `${cronometro(desdeUltima)} desde a última`
              : 'toque no início da dor'}
        </Text>
      </Pressable>

      <Cartao>
        <Texto variante="subtitulo">Última hora</Texto>
        {e.quantidade === 0 ? (
          <Texto variante="suave">Toque em Começou quando a contração começar e em Acabou quando passar.</Texto>
        ) : (
          <>
            <Texto>
              {e.quantidade} {e.quantidade === 1 ? 'contração' : 'contrações'} · duração média{' '}
              {duracaoSegundos(e.duracaoMedia)}
              {e.quantidade > 1 ? ` · uma a cada ${Math.round(e.intervaloMedio / MIN)} min` : ''}
            </Texto>
            {e.cincoUmUm && (
              <View style={{ backgroundColor: cores.fralda, borderRadius: 14, padding: 12 }}>
                <Text style={{ fontFamily: fontes.negrito, fontSize: 16, color: cores.textoNaPrimaria }}>
                  Padrão 5-1-1: contrações a cada 5 minutos ou menos, de cerca de 1 minuto, há 1 hora. É a orientação
                  comum para ligar para a obstetra ou ir para a maternidade.
                </Text>
              </View>
            )}
          </>
        )}
      </Cartao>

      <Texto variante="suave">
        Vá para a maternidade a qualquer momento se a bolsa romper, houver sangramento, febre, dor forte que não passa
        ou o bebê mexer menos. Siga sempre o que a sua obstetra orientou.
      </Texto>

      <Cartao>
        <Texto variante="subtitulo">Últimas 24h</Texto>
        {recentes.length === 0 && <Texto variante="suave">Nenhuma contração registrada.</Texto>}
        {recentes.map((r) => {
          const i = feitas.indexOf(r);
          const anterior = i > 0 ? feitas[i - 1] : null;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/registro/[id]', params: { id: r.id } })}
              style={({ pressed }) => ({
                minHeight: ALVO_TOQUE,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: pressed ? 0.7 : 1,
              })}>
              <Text style={{ width: 52, fontFamily: fontes.negrito, fontSize: 15, color: cores.textoSuave }}>
                {horaCurta(r.inicio)}
              </Text>
              <View style={{ flex: 1 }}>
                <Texto style={{ fontFamily: fontes.negrito }}>Durou {duracaoSegundos(t(r.fim!) - t(r.inicio))}</Texto>
                {anterior && (
                  <Texto variante="suave">
                    {Math.round((t(r.inicio) - t(anterior.inicio)) / MIN)} min depois da anterior
                  </Texto>
                )}
              </View>
            </Pressable>
          );
        })}
      </Cartao>
    </Tela>
  );
}
