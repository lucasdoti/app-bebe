import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GraficoLinha } from '@/components/grafico-linha';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { nasceu, useBebes } from '@/context/bebes';
import { useRegistros } from '@/context/registros';
import { useRemedios, type SituacaoRemedio } from '@/context/remedios';
import { useSessao } from '@/context/sessao';
import { useAgora } from '@/hooks/use-agora';
import { confirmar } from '@/lib/confirmar';
import { idade } from '@/lib/idade';
import { temperaturaTexto, type Registro } from '@/lib/registros';
import { haQuanto, horaCurta, inicioDoDia } from '@/lib/tempo';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Febre = Extract<Registro, { tipo: 'febre' }>;

function quandoTexto(ms: number, agora: number) {
  const d = new Date(ms);
  const amanha = inicioDoDia(new Date(agora)).getTime() + 24 * 3600_000 <= ms;
  return `${amanha ? 'amanhã ' : ''}às ${horaCurta(d)}`;
}

function CartaoRemedio({ s, agora, onDar }: { s: SituacaoRemedio; agora: number; onDar: () => void }) {
  const { cores } = useTema();
  const { membros } = useSessao();
  const quem = s.ultimaDose ? (membros.find((m) => m.user_id === s.ultimaDose!.autor_id)?.nome ?? 'alguém') : null;
  return (
    <Cartao style={s.liberada ? { borderColor: cores.medidasForte, borderWidth: 2 } : undefined}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/remedio/[id]', params: { id: s.remedio.id } })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: cores.medidas,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <MaterialCommunityIcons name="pill" size={26} color={cores.textoNaPrimaria} />
        </View>
        <View style={{ flex: 1 }}>
          <Texto style={{ fontFamily: fontes.extra, fontSize: 19 }}>{s.remedio.nome}</Texto>
          <Texto variante="suave">
            {s.remedio.dose} · de {String(s.remedio.intervalo_h).replace('.', ',')} em{' '}
            {String(s.remedio.intervalo_h).replace('.', ',')} h
          </Texto>
        </View>
        <MaterialCommunityIcons name="pencil-outline" size={22} color={cores.textoSuave} />
      </Pressable>
      <Texto style={{ fontFamily: fontes.extra, fontSize: 22 }}>
        {s.terminou
          ? 'Tratamento terminou'
          : s.liberada
            ? 'Próxima dose liberada agora'
            : `Próxima dose ${quandoTexto(s.proxima, agora)}`}
      </Texto>
      <Texto variante="suave">
        {s.ultimaDose
          ? `Última dose ${haQuanto(s.ultimaDose.inicio, new Date(agora))}, às ${horaCurta(s.ultimaDose.inicio)}, por ${quem}`
          : 'Nenhuma dose registrada ainda'}
      </Texto>
      {!s.terminou && <Botao titulo="Dei a dose" variante={s.liberada ? 'primario' : 'secundario'} onPress={onDar} />}
    </Cartao>
  );
}

// Remédios com a próxima dose liberada (evita dose dobrada) e registro de febre.
export default function Remedios() {
  const { bebeAtual } = useBebes();
  const { situacao } = useRemedios();
  const { doBebe, criar } = useRegistros();
  const { cores } = useTema();
  const agora = useAgora(30_000);
  const [temp, setTemp] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!bebeAtual) return null;
  const lista = situacao(agora);

  function darDose(s: SituacaoRemedio) {
    const registrar = () => {
      const momento = new Date().toISOString();
      criar({
        tipo: 'dose',
        inicio: momento,
        fim: momento,
        detalhes: { remedio_id: s.remedio.id, nome: s.remedio.nome, dose: s.remedio.dose },
      } as Parameters<typeof criar>[0]);
      setAviso(`${s.remedio.nome} registrado às ${horaCurta(momento)}.`);
    };
    if (s.liberada) return registrar();
    confirmar(
      `A próxima dose de ${s.remedio.nome} só fica liberada ${quandoTexto(s.proxima, agora)}. Registrar mesmo assim?`,
      'Registrar',
      registrar,
    );
  }

  function registrarFebre() {
    setErro(null);
    const t = Number(temp.replace(',', '.'));
    if (!(t >= 34 && t <= 43)) return setErro('Temperatura em °C, por exemplo 37,8.');
    const momento = new Date().toISOString();
    criar({ tipo: 'febre', inicio: momento, fim: momento, detalhes: { temperatura: t } } as Parameters<typeof criar>[0]);
    setTemp('');
  }

  const hoje = inicioDoDia(new Date(agora)).getTime();
  const febres = doBebe.filter((r): r is Febre => r.tipo === 'febre' && new Date(r.inicio).getTime() >= agora - 24 * 3600_000);
  const febresHoje = [...febres].reverse().filter((r) => new Date(r.inicio).getTime() >= hoje - 12 * 3600_000);
  const menorDe3Meses = nasceu(bebeAtual) && idade(bebeAtual.nascimento).meses < 3;
  const teveFebre = febres.some((f) => f.detalhes.temperatura >= 37.8);

  return (
    <Tela>
      <Cabecalho titulo="Remédios e febre" />

      {lista.map((s) => (
        <CartaoRemedio key={s.remedio.id} s={s} agora={agora} onDar={() => darDose(s)} />
      ))}
      <Aviso texto={aviso} tipo="info" />
      <Botao
        titulo="Adicionar remédio"
        variante={lista.length ? 'secundario' : 'primario'}
        onPress={() => router.push({ pathname: '/remedio/[id]', params: { id: 'novo' } })}
      />
      <Texto variante="suave">
        O app não calcula dose: anote exatamente o que o pediatra receitou. O lembrete chega para os dois na hora da
        próxima dose.
      </Texto>

      <Cartao>
        <Texto variante="subtitulo">Febre</Texto>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="Temperatura agora (°C)"
              value={temp}
              onChangeText={setTemp}
              placeholder="Ex.: 37,8"
              keyboardType="decimal-pad"
              inputMode="decimal"
              onSubmitEditing={registrarFebre}
            />
          </View>
          <View style={{ width: 120 }}>
            <Botao titulo="Anotar" onPress={registrarFebre} />
          </View>
        </View>
        <Aviso texto={erro} />
        {febresHoje.length > 1 && (
          <GraficoLinha
            pontos={febresHoje.map((f) => {
              const d = new Date(f.inicio);
              return {
                x: (d.getTime() - hoje) / 3600_000,
                y: f.detalhes.temperatura,
                descricao: `${horaCurta(d)}: ${temperaturaTexto(f.detalhes.temperatura)}`,
              };
            })}
            rotuloX={(h) => `${String(((Math.round(h) % 24) + 24) % 24).padStart(2, '0')}h`}
            rotuloY={(t) => `${t.toFixed(1).replace('.', ',')}°`}
            legenda="Temperaturas das últimas horas."
          />
        )}
        {febres.map((f) => (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/registro/[id]', params: { id: f.id } })}
            style={({ pressed }) => ({
              minHeight: ALVO_TOQUE,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}>
            <Text style={{ width: 52, fontFamily: fontes.negrito, fontSize: 15, color: cores.textoSuave }}>
              {horaCurta(f.inicio)}
            </Text>
            <Texto style={{ fontFamily: fontes.negrito }}>{temperaturaTexto(f.detalhes.temperatura)}</Texto>
          </Pressable>
        ))}
        {(teveFebre || menorDe3Meses) && (
          <View style={{ backgroundColor: cores.fralda, borderRadius: 14, padding: 12 }}>
            <Text style={{ fontFamily: fontes.media, fontSize: 15, color: cores.textoNaPrimaria }}>
              {menorDe3Meses
                ? 'Bebê com menos de 3 meses e temperatura a partir de 37,8 °C: procure atendimento médico.'
                : 'Procure o pediatra se a febre passar de 39 °C, durar mais de 48 h ou vier com moleza, manchas, dificuldade para respirar ou recusa para mamar.'}
            </Text>
          </View>
        )}
      </Cartao>
    </Tela>
  );
}
