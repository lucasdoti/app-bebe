import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { CATEGORIAS, useEnxoval, type Gasto } from '@/context/enxoval';
import { useSessao } from '@/context/sessao';
import {
  mascaraDinheiro,
  nomeForma,
  paraNumero,
  paraTextoDinheiro,
  parcelasDoMes,
  reais,
  rotuloMes,
  type FormaPagamento,
} from '@/lib/dinheiro';
import { deISO, hojeISO } from '@/lib/idade';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Filtro = 'tudo' | 'compra' | 'presente';

const nomeCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.titulo])) as Record<string, string>;

function Barra({ rotulo, valor, total, detalhe }: { rotulo: string; valor: number; total: number; detalhe: string }) {
  const { cores } = useTema();
  const fracao = total ? valor / total : 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Texto style={{ fontFamily: fontes.media }}>{rotulo}</Texto>
        <Texto style={{ fontFamily: fontes.negrito }}>{detalhe}</Texto>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: cores.borda, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(fracao * 100, 2)}%`, height: '100%', borderRadius: 5, backgroundColor: cores.medidasForte }} />
      </View>
    </View>
  );
}

function descricaoPagamento(g: Gasto) {
  if (!g.forma_pagamento) return '';
  if (g.forma_pagamento === 'credito' && g.parcelas && g.parcelas > 1)
    return `Crédito ${g.parcelas}x de ${reais((g.valor ?? 0) / g.parcelas)}`;
  return nomeForma[g.forma_pagamento];
}

// Quanto foi gasto no enxoval: total, orçamento, categorias, formas de pagamento, parcelas e presentes.
export default function Gastos() {
  const { bebeAtual } = useBebes();
  const { membros } = useSessao();
  const { gastos, orcamento, recarregar } = useEnxoval();
  const { cores } = useTema();
  const [filtro, setFiltro] = useState<Filtro>('tudo');
  const [editandoOrcamento, setEditandoOrcamento] = useState(false);
  const [valorOrcamento, setValorOrcamento] = useState(paraTextoDinheiro(orcamento));
  const [erro, setErro] = useState<string | null>(null);

  if (!bebeAtual) return null;
  const quem = (id: string) => membros.find((m) => m.user_id === id)?.nome ?? 'alguém';

  const compras = gastos.filter((g) => g.tipo === 'compra');
  const presentes = gastos.filter((g) => g.tipo === 'presente');
  const total = compras.reduce((s, g) => s + (g.valor ?? 0), 0);

  const porCategoria = CATEGORIAS.map((c) => ({
    rotulo: c.titulo,
    valor: compras.filter((g) => g.categoria === c.valor).reduce((s, g) => s + (g.valor ?? 0), 0),
  }));
  const semCategoria = compras.filter((g) => !g.categoria).reduce((s, g) => s + (g.valor ?? 0), 0);
  if (semCategoria) porCategoria.push({ rotulo: 'Sem categoria', valor: semCategoria });

  const porForma = (Object.keys(nomeForma) as FormaPagamento[])
    .map((f) => ({ rotulo: nomeForma[f], valor: compras.filter((g) => g.forma_pagamento === f).reduce((s, g) => s + (g.valor ?? 0), 0) }))
    .filter((x) => x.valor > 0);

  // Parcelas do crédito que caem deste mês em diante (estimativa: 1ª parcela no mês seguinte à compra).
  const mesAtual = hojeISO().slice(0, 7);
  const aVencer = new Map<string, number>();
  for (const g of compras)
    if (g.forma_pagamento === 'credito' && g.parcelas && g.parcelas > 1 && g.valor)
      for (const p of parcelasDoMes(g.valor, g.parcelas, g.data))
        if (p.mes >= mesAtual) aVencer.set(p.mes, (aVencer.get(p.mes) ?? 0) + p.valor);
  const mesesAVencer = [...aVencer.entries()].sort(([a], [b]) => a.localeCompare(b));

  const faltaAgradecer = presentes.filter((p) => !p.agradecido).length;
  const lista = gastos.filter((g) => filtro === 'tudo' || g.tipo === filtro);

  async function salvarOrcamento() {
    setErro(null);
    const v = paraNumero(valorOrcamento);
    const r = !v
      ? await supabase.from('enxoval_orcamento').delete().eq('bebe_id', bebeAtual!.id)
      : orcamento !== null
        ? await supabase.from('enxoval_orcamento').update({ valor: v, atualizado_em: new Date().toISOString() }).eq('bebe_id', bebeAtual!.id)
        : await supabase.from('enxoval_orcamento').insert({ bebe_id: bebeAtual!.id, valor: v });
    if (r.error) return setErro(mensagemDeErro(r.error));
    setEditandoOrcamento(false);
    await recarregar();
  }

  async function alternarAgradecido(g: Gasto) {
    const { error } = await supabase.from('enxoval_gastos').update({ agradecido: !g.agradecido }).eq('id', g.id);
    if (error) setErro(mensagemDeErro(error));
    await recarregar();
  }

  return (
    <Tela>
      <Cabecalho titulo="Gastos do enxoval" />

      <Cartao>
        <Texto variante="rotulo">Gasto até agora</Texto>
        <Text style={{ fontFamily: fontes.extra, fontSize: 34, lineHeight: 40, color: cores.texto }}>{reais(total)}</Text>
        <Texto variante="suave">
          {compras.length} {compras.length === 1 ? 'compra' : 'compras'} · {presentes.length}{' '}
          {presentes.length === 1 ? 'presente' : 'presentes'} (não entram no total)
        </Texto>
        {orcamento !== null && !editandoOrcamento && (
          <Barra
            rotulo={total > orcamento ? 'Passou do orçamento' : `Faltam ${reais(orcamento - total)}`}
            valor={Math.min(total, orcamento)}
            total={orcamento}
            detalhe={`de ${reais(orcamento)}`}
          />
        )}
        {editandoOrcamento ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="Orçamento total (R$)"
                value={valorOrcamento}
                onChangeText={(t) => setValorOrcamento(mascaraDinheiro(t))}
                placeholder="Ex.: 5.000,00 (vazio = sem orçamento)"
                keyboardType="number-pad"
                inputMode="numeric"
              />
            </View>
            <View style={{ width: 110 }}>
              <Botao titulo="Salvar" onPress={salvarOrcamento} />
            </View>
          </View>
        ) : (
          <Botao
            titulo={orcamento !== null ? 'Mudar orçamento' : 'Definir orçamento'}
            variante="texto"
            onPress={() => {
              setValorOrcamento(paraTextoDinheiro(orcamento));
              setEditandoOrcamento(true);
            }}
          />
        )}
      </Cartao>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Botao
            titulo="+ Compra"
            onPress={() => router.push({ pathname: '/gasto/[id]', params: { id: 'novo', tipo: 'compra' } })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Botao
            titulo="+ Presente"
            variante="secundario"
            onPress={() => router.push({ pathname: '/gasto/[id]', params: { id: 'novo', tipo: 'presente' } })}
          />
        </View>
      </View>
      <Aviso texto={erro} />

      {total > 0 && (
        <Cartao>
          <Texto variante="subtitulo">Por categoria</Texto>
          {porCategoria
            .filter((c) => c.valor > 0)
            .sort((a, b) => b.valor - a.valor)
            .map((c) => (
              <Barra key={c.rotulo} rotulo={c.rotulo} valor={c.valor} total={total} detalhe={`${reais(c.valor)} · ${Math.round((c.valor / total) * 100)}%`} />
            ))}
        </Cartao>
      )}

      {porForma.length > 0 && (
        <Cartao>
          <Texto variante="subtitulo">Por forma de pagamento</Texto>
          {porForma.map((f) => (
            <Barra key={f.rotulo} rotulo={f.rotulo} valor={f.valor} total={total} detalhe={reais(f.valor)} />
          ))}
        </Cartao>
      )}

      {mesesAVencer.length > 0 && (
        <Cartao>
          <Texto variante="subtitulo">Parcelas no cartão</Texto>
          <Texto variante="suave">Estimativa: 1ª parcela no mês seguinte à compra; confira na fatura.</Texto>
          {mesesAVencer.map(([mes, v]) => (
            <View key={mes} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Texto>{rotuloMes(mes)}</Texto>
              <Texto style={{ fontFamily: fontes.negrito }}>{reais(v)}</Texto>
            </View>
          ))}
        </Cartao>
      )}

      <Cartao>
        <Texto variante="subtitulo">Lançamentos</Texto>
        {presentes.length > 0 && faltaAgradecer > 0 && (
          <Texto variante="suave">
            {faltaAgradecer} {faltaAgradecer === 1 ? 'presente para agradecer' : 'presentes para agradecer'}.
          </Texto>
        )}
        <Escolha<Filtro>
          rotulo="Mostrar"
          opcoes={[
            { valor: 'tudo', titulo: 'Tudo' },
            { valor: 'compra', titulo: 'Compras' },
            { valor: 'presente', titulo: 'Presentes' },
          ]}
          valor={filtro}
          onChange={setFiltro}
        />
        {lista.length === 0 && <Texto variante="suave">Nada lançado ainda.</Texto>}
        {lista.map((g) => (
          <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/gasto/[id]', params: { id: g.id } })}
              style={({ pressed }) => ({ flex: 1, minHeight: ALVO_TOQUE, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Texto style={{ flex: 1, fontFamily: fontes.negrito }}>
                  {g.tipo === 'presente' ? '🎁 ' : ''}
                  {g.descricao}
                </Texto>
                {g.tipo === 'compra' && <Texto style={{ fontFamily: fontes.extra }}>{reais(g.valor ?? 0)}</Texto>}
              </View>
              <Texto variante="suave">
                {[
                  deISO(g.data),
                  g.tipo === 'presente' ? `de ${g.quem_deu}` : descricaoPagamento(g),
                  g.categoria && nomeCategoria[g.categoria],
                  `por ${quem(g.autor_id)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Texto>
            </Pressable>
            {g.tipo === 'presente' && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: g.agradecido }}
                accessibilityLabel={`Agradecido a ${g.quem_deu}`}
                onPress={() => alternarAgradecido(g)}
                style={{ minWidth: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons
                  name={g.agradecido ? 'heart' : 'heart-outline'}
                  size={24}
                  color={g.agradecido ? cores.medidasForte : cores.textoSuave}
                />
                <Text style={{ fontFamily: fontes.media, fontSize: 11, color: cores.textoSuave }}>
                  {g.agradecido ? 'agradecido' : 'agradecer'}
                </Text>
              </Pressable>
            )}
          </View>
        ))}
      </Cartao>
    </Tela>
  );
}
