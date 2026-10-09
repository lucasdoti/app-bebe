import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BotaoRegistro, CartaoResumo, SeletorBebe, type NomeIcone } from '@/components/home';
import { Aviso, Botao, BotaoIcone, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes, type Bebe } from '@/context/bebes';
import { useSessao } from '@/context/sessao';
import { fase, idadeTexto, type Fase } from '@/lib/idade';
import type { Paleta } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type ItemResumo = { chave: string; cor: string; icone: NomeIcone; titulo: string; valor: string; detalhe?: string };
type ItemRegistro = { chave: string; cor: string; icone: NomeIcone; titulo: string };

// Cartões do resumo do dia, na ordem de destaque de cada fase (PRD: "Fases por idade").
// Os valores reais chegam com os registros (etapa 3), o clima (etapa 5) e os remédios (etapa 6).
function cartoesDaFase(f: Fase, bebe: Bebe, cores: Paleta): ItemResumo[] {
  const alimentacao: ItemResumo = {
    chave: 'alimentacao',
    cor: cores.mamada,
    icone: f === 'mamadas' ? 'baby-bottle-outline' : 'food-apple-outline',
    titulo: { mamadas: 'Última mamada', introducao: 'Última mamada ou refeição', crianca: 'Última refeição' }[f],
    valor: '—',
    detalhe: 'Nenhum registro ainda',
  };
  const sono: ItemResumo = {
    chave: 'sono',
    cor: cores.sono,
    icone: 'sleep',
    titulo: f === 'crianca' ? 'Cochilos' : 'Sono',
    valor: '—',
    detalhe: 'A janela de vigília aparece após o primeiro sono',
  };
  const fralda: ItemResumo = {
    chave: 'fralda',
    cor: cores.fralda,
    icone: f === 'crianca' ? 'toilet' : 'human-baby-changing-table',
    titulo: f === 'crianca' ? 'Fraldas e penico hoje' : 'Fraldas hoje',
    valor: '0',
  };
  const clima: ItemResumo = {
    chave: 'clima',
    cor: cores.clima,
    icone: 'tshirt-crew-outline',
    titulo: 'Clima e roupa',
    valor: 'Em breve',
    detalhe: 'Sugestão de roupa pelo clima',
  };
  const medidas: ItemResumo = {
    chave: 'medidas',
    cor: cores.medidas,
    icone: 'ruler',
    titulo: 'Última medida',
    valor: medidaAoNascer(bebe),
    detalhe: bebe.peso_nascer_kg || bebe.altura_nascer_cm ? 'Ao nascer' : 'Nenhuma medida ainda',
  };
  return [alimentacao, sono, fralda, clima, medidas];
}

function medidaAoNascer(b: Bebe) {
  const partes = [];
  if (b.peso_nascer_kg) partes.push(`${String(b.peso_nascer_kg).replace('.', ',')} kg`);
  if (b.altura_nascer_cm) partes.push(`${String(b.altura_nascer_cm).replace('.', ',')} cm`);
  return partes.length ? partes.join(' · ') : '—';
}

function registrosDaFase(f: Fase, cores: Paleta): ItemRegistro[] {
  const mamada: ItemRegistro = { chave: 'mamada', cor: cores.mamada, icone: 'baby-bottle-outline', titulo: 'Mamada' };
  const refeicao: ItemRegistro = { chave: 'refeicao', cor: cores.mamada, icone: 'food-apple-outline', titulo: 'Refeição' };
  const sono: ItemRegistro = { chave: 'sono', cor: cores.sono, icone: 'sleep', titulo: 'Sono' };
  const fralda: ItemRegistro = { chave: 'fralda', cor: cores.fralda, icone: 'human-baby-changing-table', titulo: 'Fralda' };
  if (f === 'mamadas') return [mamada, sono, fralda];
  if (f === 'introducao') return [mamada, refeicao, sono, fralda];
  return [refeicao, sono, fralda];
}

export default function Inicio() {
  const { familia } = useSessao();
  const { bebes, bebeAtual, escolherBebe, carregando } = useBebes();
  const { cores } = useTema();
  const [aviso, setAviso] = useState<string | null>(null);

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
          <Texto>Com o nome e a data de nascimento, o app ajusta a tela inicial para a idade.</Texto>
          <Botao
            titulo="Cadastrar bebê"
            variante="secundario"
            onPress={() => router.push({ pathname: '/bebe/[id]', params: { id: 'novo' } })}
          />
        </Cartao>
      </Tela>
    );
  }

  const f = fase(bebeAtual.nascimento);

  const rodape = (
    <View style={{ gap: 6 }}>
      <Aviso texto={aviso} tipo="info" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {registrosDaFase(f, cores).map((r) => (
          <BotaoRegistro
            key={r.chave}
            cor={r.cor}
            icone={r.icone}
            titulo={r.titulo}
            onPress={() => setAviso(`O registro de ${r.titulo.toLowerCase()} chega na próxima atualização.`)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <Tela topo={topo} rodape={rodape}>
      <View style={{ gap: 2 }}>
        <Texto variante="titulo">{bebeAtual.nome}</Texto>
        <Texto variante="suave">{idadeTexto(bebeAtual.nascimento)}</Texto>
      </View>

      {cartoesDaFase(f, bebeAtual, cores).map(({ chave, ...c }) => (
        <CartaoResumo key={chave} {...c} />
      ))}

      <Cartao>
        <Texto variante="subtitulo">Últimas 24h</Texto>
        <Texto variante="suave">
          Os registros de mamada, sono e fralda vão aparecer aqui, do mais recente para o mais antigo.
        </Texto>
      </Cartao>
    </Tela>
  );
}
