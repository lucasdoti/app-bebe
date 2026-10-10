import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Botao, Cabecalho, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { nasceu, useBebes } from '@/context/bebes';
import { useVacinas, type VacinaAplicada } from '@/context/vacinas';
import { idadeGestacional } from '@/lib/gestacao';
import { deISO, hojeISO } from '@/lib/idade';
import {
  CALENDARIO_BEBE,
  CALENDARIO_MAE,
  dataRecomendada,
  FONTE_CALENDARIO,
  rotuloIdade,
  rotuloSituacao,
  situacaoBebe,
  situacaoMae,
  type DoseCalendario,
  type Para,
  type Situacao,
} from '@/lib/vacinas';
import { ALVO_TOQUE, fontes, type Paleta } from '@/theme/cores';
import { useTema } from '@/theme/tema';

function corSituacao(s: Situacao, cores: Paleta) {
  if (s === 'aplicada') return cores.medidas;
  if (s === 'atrasada') return cores.mamada;
  if (s === 'agora' || s === 'proxima' || s === 'verificar') return cores.fralda;
  return cores.borda;
}

const dataCurta = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

function LinhaDose({
  dose,
  situacao,
  aplicada,
  quando,
  para,
}: {
  dose: DoseCalendario;
  situacao: Situacao;
  aplicada?: VacinaAplicada;
  quando?: string;
  para: Para;
}) {
  const { cores } = useTema();
  const tomada = situacao === 'aplicada';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/vacina/[codigo]', params: { codigo: dose.codigo, para, ...(aplicada && { id: aplicada.id }) } })
      }
      style={({ pressed }) => ({ minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
      <MaterialCommunityIcons
        name={tomada ? 'check-circle' : 'checkbox-blank-circle-outline'}
        size={28}
        color={tomada ? cores.medidasForte : cores.textoSuave}
      />
      <View style={{ flex: 1 }}>
        <Texto style={{ fontFamily: fontes.negrito }}>
          {dose.vacina} · {dose.dose}
        </Texto>
        <Texto variante="suave">
          {tomada && aplicada ? `Tomada em ${deISO(aplicada.data)}` : (quando ?? dose.nota ?? dose.protege)}
        </Texto>
      </View>
      {!tomada && (
        <View style={{ backgroundColor: corSituacao(situacao, cores), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontFamily: fontes.negrito, fontSize: 12, color: cores.textoNaPrimaria }}>{rotuloSituacao[situacao]}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Carteirinha: calendário do bebê (0 a 4 anos) e da mãe na gestação, com o que já foi tomado.
export default function Vacinas() {
  const { bebeAtual } = useBebes();
  const { aplicadas } = useVacinas();
  const { para: paraParam } = useLocalSearchParams<{ para?: Para }>();
  const [para, setPara] = useState<Para>(paraParam ?? (bebeAtual?.status === 'gestacao' ? 'mae' : 'bebe'));

  if (!bebeAtual) return null;
  const hoje = hojeISO();
  const tomada = (codigo: string) => aplicadas.find((a) => a.para === para && a.codigo === codigo);
  const extras = aplicadas.filter((a) => a.para === para && !a.codigo);

  let conteudo;
  if (para === 'bebe') {
    if (!nasceu(bebeAtual)) {
      conteudo = (
        <Cartao>
          <Texto>O calendário do bebê começa no nascimento: BCG e hepatite B ainda na maternidade.</Texto>
          <Texto variante="suave">Depois do "Nasceu!", as datas de cada vacina aparecem aqui.</Texto>
        </Cartao>
      );
    } else {
      const idades = [...new Set(CALENDARIO_BEBE.map((d) => d.idadeMeses!))];
      const pendentes = CALENDARIO_BEBE.filter((d) => {
        const s = situacaoBebe(d, bebeAtual.nascimento, !!tomada(d.codigo), hoje);
        return s === 'atrasada' || s === 'agora';
      }).length;
      conteudo = (
        <>
          {pendentes > 0 && (
            <Texto style={{ fontFamily: fontes.negrito }}>
              {pendentes} {pendentes === 1 ? 'vacina para tomar agora ou atrasada' : 'vacinas para tomar agora ou atrasadas'}.
            </Texto>
          )}
          {idades.map((m) => (
            <Cartao key={m}>
              <Texto variante="subtitulo">
                {rotuloIdade(m)} · {dataCurta(dataRecomendada(bebeAtual.nascimento, m))}
              </Texto>
              {CALENDARIO_BEBE.filter((d) => d.idadeMeses === m).map((d) => (
                <LinhaDose
                  key={d.codigo}
                  dose={d}
                  para="bebe"
                  aplicada={tomada(d.codigo)}
                  situacao={situacaoBebe(d, bebeAtual.nascimento, !!tomada(d.codigo), hoje)}
                />
              ))}
            </Cartao>
          ))}
        </>
      );
    }
  } else {
    const semanas = bebeAtual.status === 'gestacao' && bebeAtual.parto_previsto ? idadeGestacional(bebeAtual.parto_previsto, hoje).semanas : null;
    conteudo = (
      <Cartao>
        <Texto variante="subtitulo">Vacinas da gestação</Texto>
        {semanas !== null && <Texto variante="suave">Hoje: {semanas}ª semana.</Texto>}
        {bebeAtual.status === 'nascido' && (
          <Texto variante="suave">A gestação já terminou. dTpa e hepatite B ainda podem ser feitas até 45 dias depois do parto.</Texto>
        )}
        {CALENDARIO_MAE.map((d) => (
          <LinhaDose
            key={d.codigo}
            dose={d}
            para="mae"
            aplicada={tomada(d.codigo)}
            situacao={situacaoMae(d, semanas, !!tomada(d.codigo))}
            quando={
              !tomada(d.codigo) && semanas !== null && d.semanaMin && semanas < d.semanaMin
                ? `A partir da ${d.semanaMin}ª semana`
                : undefined
            }
          />
        ))}
      </Cartao>
    );
  }

  return (
    <Tela>
      <Cabecalho titulo="Vacinas" />
      <Escolha<Para>
        rotulo="Carteirinha de"
        opcoes={[
          { valor: 'bebe', titulo: bebeAtual.nome },
          { valor: 'mae', titulo: 'Mãe (gestação)' },
        ]}
        valor={para}
        onChange={setPara}
      />

      {conteudo}

      <Cartao>
        <Texto variante="subtitulo">Outras vacinas</Texto>
        {extras.length === 0 && (
          <Texto variante="suave">Vacinas fora do calendário do SUS, como as da rede particular.</Texto>
        )}
        {extras.map((v) => (
          <Pressable
            key={v.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/vacina/[codigo]', params: { codigo: 'outra', para, id: v.id } })}
            style={({ pressed }) => ({ minHeight: ALVO_TOQUE, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Texto style={{ fontFamily: fontes.negrito }}>{v.nome}</Texto>
            <Texto variante="suave">Tomada em {deISO(v.data)}</Texto>
          </Pressable>
        ))}
        <Botao
          titulo="Adicionar outra vacina"
          variante="secundario"
          onPress={() => router.push({ pathname: '/vacina/[codigo]', params: { codigo: 'outra', para } })}
        />
      </Cartao>

      <Texto variante="suave">
        Baseado no {FONTE_CALENDARIO}. Confira sempre com a unidade de saúde e leve a caderneta em todas as vacinas.
      </Texto>
    </Tela>
  );
}
