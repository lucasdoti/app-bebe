import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatar, GraficoCrescimento } from '@/components/grafico-crescimento';
import { Botao, Cabecalho, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { nasceu, useBebes } from '@/context/bebes';
import { useMedidas } from '@/context/medidas';
import { idadeEmDias, percentil, percentilTexto, pontosDe, type Indicador } from '@/lib/crescimento';
import { deISO, hojeISO, idadeTexto } from '@/lib/idade';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const nomes: Record<Indicador, string> = { peso: 'Peso', altura: 'Altura', cabeca: 'Cabeça' };

const abrirMedida = (id: string) => router.push({ pathname: '/medida/[id]', params: { id } });

export default function Medidas() {
  const { bebeAtual } = useBebes();
  const { doBebe } = useMedidas();
  const { cores } = useTema();
  const [indicador, setIndicador] = useState<Indicador>('peso');

  if (!nasceu(bebeAtual)) return null;
  const pontos = pontosDe(bebeAtual, doBebe, indicador);
  const ultimo = pontos.at(-1);

  return (
    <Tela>
      <Cabecalho titulo={`Crescimento de ${bebeAtual.nome}`} />

      <Escolha<Indicador>
        rotulo="Medida"
        opcoes={(['peso', 'altura', 'cabeca'] as Indicador[]).map((i) => ({ valor: i, titulo: nomes[i] }))}
        valor={indicador}
        onChange={setIndicador}
      />

      <Cartao>
        {ultimo ? (
          <View style={{ gap: 2 }}>
            <Texto variante="rotulo">
              {indicador === 'cabeca' ? 'Perímetro cefálico' : nomes[indicador]} em {deISO(ultimo.data)}
            </Texto>
            <Texto style={{ fontFamily: fontes.extra, fontSize: 28, lineHeight: 34 }}>
              {formatar(ultimo.valor, indicador)}
            </Texto>
            <Texto variante="suave">
              {percentilTexto(percentil(indicador, bebeAtual.sexo, ultimo.dias, ultimo.valor))} da OMS
            </Texto>
          </View>
        ) : (
          <Texto variante="suave">Nenhuma medida de {nomes[indicador].toLowerCase()} ainda.</Texto>
        )}
        <GraficoCrescimento
          indicador={indicador}
          sexo={bebeAtual.sexo}
          idadeAtualDias={idadeEmDias(bebeAtual.nascimento, hojeISO())}
          pontos={pontos}
        />
      </Cartao>

      <Botao titulo="Adicionar medida" onPress={() => abrirMedida('novo')} />

      <Cartao>
        <Texto variante="subtitulo">Todas as medidas</Texto>
        {doBebe.length === 0 && (
          <Texto variante="suave">
            Anote as medidas das consultas. O peso e a altura ao nascer já aparecem no gráfico.
          </Texto>
        )}
        {[...doBebe].reverse().map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            onPress={() => abrirMedida(m.id)}
            style={({ pressed }) => ({
              minHeight: ALVO_TOQUE,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}>
            <View style={{ flex: 1 }}>
              <Texto style={{ fontFamily: fontes.negrito }}>
                {deISO(m.data)} · {idadeTexto(bebeAtual.nascimento, new Date(`${m.data}T12:00`))}
              </Texto>
              <Texto variante="suave">
                {[
                  m.peso_kg !== null && formatar(Number(m.peso_kg), 'peso'),
                  m.altura_cm !== null && formatar(Number(m.altura_cm), 'altura'),
                  m.perimetro_cefalico_cm !== null && `cabeça ${formatar(Number(m.perimetro_cefalico_cm), 'cabeca')}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Texto>
            </View>
            <Ionicons name="create-outline" size={22} color={cores.textoSuave} />
          </Pressable>
        ))}
      </Cartao>

      <Texto variante="suave">
        O app mostra os dados e os percentis da OMS, não faz diagnóstico. Em caso de dúvida, converse com o pediatra.
      </Texto>
    </Tela>
  );
}
