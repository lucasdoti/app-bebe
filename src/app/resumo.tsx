import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Platform, Share, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { nasceu, useBebes, type Bebe, type BebeNascido } from '@/context/bebes';
import { useGestacao } from '@/context/gestacao';
import { useMedidas } from '@/context/medidas';
import { useRegistros } from '@/context/registros';
import { useRemedios } from '@/context/remedios';
import { useVacinas } from '@/context/vacinas';
import { idadeEmDias, percentil, percentilTexto, pontosDe, type Indicador } from '@/lib/crescimento';
import { idadeGestacional, idadeGestacionalNaData, pesoTexto, semanasTexto } from '@/lib/gestacao';
import { deISO, hojeISO, idadeTexto } from '@/lib/idade';
import { numeroBR, resumoDaSemana } from '@/lib/resumo';
import { lerPref, salvarPref } from '@/lib/storage';
import { horaCurta } from '@/lib/tempo';
import { CALENDARIO_BEBE, CALENDARIO_MAE, rotuloSituacao, situacaoBebe, situacaoMae } from '@/lib/vacinas';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Secao = { titulo: string; linhas: string[] };

const dataBR = (iso: string) => deISO(hojeISO(new Date(iso)));
const pressao = (s: number, d: number) => `${numeroBR(s / 10)} por ${numeroBR(d / 10)}`;

function useSecoesGestacao(bebe: Bebe): Secao[] {
  const { preNatal } = useGestacao();
  const { aplicadas } = useVacinas();
  const parto = bebe.parto_previsto!;
  const ig = idadeGestacional(parto);
  const agora = Date.now();

  const consultas = preNatal.filter((p) => p.tipo === 'consulta' && new Date(p.data).getTime() <= agora);
  const comPeso = consultas.filter((c) => c.peso_mae_kg !== null);
  const comPressao = consultas.filter((c) => c.pressao_sistolica !== null && c.pressao_diastolica !== null);
  const ultrassons = preNatal.filter((p) => p.tipo === 'ultrassom' && new Date(p.data).getTime() <= agora);
  const exames = preNatal.filter((p) => p.tipo === 'exame' && new Date(p.data).getTime() <= agora).slice(-3);
  const proxima = preNatal.find((p) => p.tipo !== 'ultrassom' && new Date(p.data).getTime() >= agora - 3600_000);

  const gestacao = [
    `${semanasTexto(ig.semanas, ig.dias)} · parto previsto para ${deISO(parto)}`,
  ];

  const mae: string[] = [];
  if (comPeso.length) {
    const ultimo = comPeso.at(-1)!;
    const ganho = comPeso.length > 1 ? ultimo.peso_mae_kg! - comPeso[0].peso_mae_kg! : null;
    mae.push(
      `Peso: ${numeroBR(ultimo.peso_mae_kg!)} kg em ${dataBR(ultimo.data)}` +
        (ganho !== null ? ` (${ganho >= 0 ? '+' : ''}${numeroBR(Math.round(ganho * 10) / 10)} kg desde ${dataBR(comPeso[0].data)})` : ''),
    );
  }
  if (comPressao.length)
    mae.push(`Pressão: ${comPressao.slice(-4).map((c) => `${pressao(c.pressao_sistolica!, c.pressao_diastolica!)} (${dataBR(c.data)})`).join(', ')}`);

  const us = ultrassons.slice(-3).map((u) => {
    const g = idadeGestacionalNaData(parto, hojeISO(new Date(u.data)));
    return [
      `${dataBR(u.data)} (${g.semanas}s${g.dias}d)`,
      u.peso_fetal_g && pesoTexto(u.peso_fetal_g),
      u.percentil_laudo !== null && `percentil ${numeroBR(u.percentil_laudo)}`,
      u.batimentos_bpm && `${u.batimentos_bpm} bpm`,
    ]
      .filter(Boolean)
      .join(' · ');
  });

  const tomada = (c: string) => aplicadas.find((a) => a.para === 'mae' && a.codigo === c);
  const vacinas = CALENDARIO_MAE.map((d) => {
    const t = tomada(d.codigo);
    return `${d.vacina.split(' (')[0]}: ${t ? `tomada em ${deISO(t.data)}` : rotuloSituacao[situacaoMae(d, ig.semanas, false)].toLowerCase()}`;
  });

  const secoes: Secao[] = [{ titulo: 'Gestação', linhas: gestacao }];
  if (mae.length) secoes.push({ titulo: 'Mãe', linhas: mae });
  if (us.length) secoes.push({ titulo: 'Últimos ultrassons', linhas: us });
  if (exames.length) secoes.push({ titulo: 'Últimos exames', linhas: exames.map((e) => `${dataBR(e.data)}: ${e.titulo}${e.anotacoes ? ` – ${e.anotacoes}` : ''}`) });
  secoes.push({ titulo: 'Vacinas da gestação', linhas: vacinas });
  if (proxima?.perguntas)
    secoes.push({
      titulo: `Perguntas para ${dataBR(proxima.data) === deISO(hojeISO()) ? 'hoje' : dataBR(proxima.data)}`,
      linhas: proxima.perguntas.split('\n').map((l) => l.trim()).filter(Boolean),
    });
  return secoes;
}

function useSecoesBebe(bebe: BebeNascido, perguntas: string): Secao[] {
  const { doBebe } = useRegistros();
  const { doBebe: medidas } = useMedidas();
  const { situacao } = useRemedios();
  const { aplicadas } = useVacinas();
  const r = resumoDaSemana(doBebe, 7);

  const rotina = [
    `Mamadas: ${numeroBR(r.mamadasPorDia)} por dia` + (r.peitoMinPorMamada !== null ? ` (peito, em média ${r.peitoMinPorMamada} min)` : ''),
  ];
  if (r.mamadeiraMlPorDia !== null) rotina.push(`Mamadeira: ${r.mamadeiraMlPorDia} ml por dia`);
  if (r.refeicoesPorDia) rotina.push(`Refeições: ${numeroBR(r.refeicoesPorDia)} por dia`);
  rotina.push(`Sono: ${numeroBR(r.sonoHorasPorDia)} h por dia, ${numeroBR(r.sonosPorDia)} sonos`);
  rotina.push(`Fraldas: ${numeroBR(r.fraldasPorDia)} por dia (${numeroBR(r.xixiPorDia)} xixi, ${numeroBR(r.cocoPorDia)} cocô)`);
  if (r.febreMaxima !== null) rotina.push(`Febre: máxima de ${numeroBR(r.febreMaxima)} °C`);

  const nomes: Record<Indicador, string> = { peso: 'Peso', altura: 'Altura', cabeca: 'Perímetro cefálico' };
  const unidade: Record<Indicador, string> = { peso: 'kg', altura: 'cm', cabeca: 'cm' };
  const crescimento = (['peso', 'altura', 'cabeca'] as Indicador[]).flatMap((i) => {
    const p = pontosDe(bebe, medidas, i).at(-1);
    if (!p) return [];
    return [`${nomes[i]}: ${numeroBR(p.valor)} ${unidade[i]} em ${deISO(p.data)} (${percentilTexto(percentil(i, bebe.sexo, p.dias, p.valor))} da OMS)`];
  });

  const remedios = situacao(Date.now())
    .filter((s) => !s.terminou)
    .map((s) => `${s.remedio.nome} ${s.remedio.dose} de ${numeroBR(s.remedio.intervalo_h)} em ${numeroBR(s.remedio.intervalo_h)} h${s.ultimaDose ? ` (última às ${horaCurta(s.ultimaDose.inicio)})` : ''}`);

  const tomada = (c: string) => aplicadas.some((a) => a.para === 'bebe' && a.codigo === c);
  const pendentes = CALENDARIO_BEBE.filter((d) => {
    const s = situacaoBebe(d, bebe.nascimento, tomada(d.codigo));
    return s === 'atrasada' || s === 'agora';
  }).map((d) => `${d.vacina.split(' (')[0]} ${d.dose.toLowerCase()}`);
  const ultimas = aplicadas
    .filter((a) => a.para === 'bebe')
    .slice(-3)
    .map((a) => `${a.nome} em ${deISO(a.data)}`);

  const secoes: Secao[] = [
    { titulo: 'Bebê', linhas: [`${idadeTexto(bebe.nascimento)} · nasceu em ${deISO(bebe.nascimento)} (${idadeEmDias(bebe.nascimento, hojeISO())} dias)`] },
    { titulo: `Rotina (média dos últimos ${r.dias} dias)`, linhas: rotina },
  ];
  if (crescimento.length) secoes.push({ titulo: 'Crescimento', linhas: crescimento });
  if (remedios.length) secoes.push({ titulo: 'Remédios em uso', linhas: remedios });
  secoes.push({
    titulo: 'Vacinas',
    linhas: [
      ...(pendentes.length ? [`Para tomar: ${pendentes.join(', ')}`] : ['Em dia com o calendário']),
      ...(ultimas.length ? [`Últimas: ${ultimas.join('; ')}`] : []),
    ],
  });
  const ps = perguntas.split('\n').map((l) => l.trim()).filter(Boolean);
  if (ps.length) secoes.push({ titulo: 'Perguntas', linhas: ps });
  return secoes;
}

function texto(titulo: string, secoes: Secao[]) {
  return [`*${titulo}*`, ...secoes.flatMap((s) => ['', `*${s.titulo}*`, ...s.linhas.map((l) => `• ${l}`)])].join('\n');
}

function Conteudo({ titulo, secoes, extra }: { titulo: string; secoes: Secao[]; extra?: ReactNode }) {
  const { cores } = useTema();
  const [aviso, setAviso] = useState<string | null>(null);
  const mensagem = texto(titulo, secoes);

  async function compartilhar() {
    try {
      if (Platform.OS === 'web' && !navigator.share) {
        await navigator.clipboard.writeText(mensagem);
        setAviso('Resumo copiado. Cole onde quiser.');
        return;
      }
      await Share.share({ message: mensagem });
    } catch {
      // Cancelado.
    }
  }

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Botao
            titulo="WhatsApp"
            onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(mensagem)}`)}
            icone={<MaterialCommunityIcons name="whatsapp" size={20} color={cores.textoNaPrimaria} />}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Botao titulo="Compartilhar" variante="secundario" onPress={compartilhar} />
        </View>
      </View>
      <Aviso texto={aviso} tipo="info" />
      {secoes.map((s) => (
        <Cartao key={s.titulo}>
          <Texto variante="subtitulo">{s.titulo}</Texto>
          {s.linhas.map((l, i) => (
            <Texto key={i}>• {l}</Texto>
          ))}
        </Cartao>
      ))}
      {extra}
      <Texto variante="suave" style={{ fontFamily: fontes.regular }}>
        Resumo feito pelo app a partir do que vocês registraram. Não substitui a caderneta nem a avaliação médica.
      </Texto>
    </>
  );
}

function ResumoGestacao({ bebe }: { bebe: Bebe }) {
  const secoes = useSecoesGestacao(bebe);
  const { preNatal } = useGestacao();
  const proxima = preNatal.find((p) => p.tipo !== 'ultrassom' && new Date(p.data).getTime() >= Date.now() - 3600_000);
  return (
    <Conteudo
      titulo={`Pré-natal · ${bebe.nome}`}
      secoes={secoes}
      extra={
        <Botao
          titulo={proxima ? 'Anotar perguntas na próxima consulta' : 'Agendar a próxima consulta'}
          variante="secundario"
          onPress={() =>
            router.push({ pathname: '/pre-natal/[id]', params: proxima ? { id: proxima.id } : { id: 'novo', tipo: 'consulta' } })
          }
        />
      }
    />
  );
}

function ResumoBebe({ bebe }: { bebe: BebeNascido }) {
  const chave = `perguntas_pediatra:${bebe.id}`;
  const [perguntas, setPerguntas] = useState(() => lerPref(chave) ?? '');
  const secoes = useSecoesBebe(bebe, perguntas);
  return (
    <Conteudo
      titulo={`Resumo para o pediatra · ${bebe.nome}`}
      secoes={secoes}
      extra={
        <Campo
          rotulo="Perguntas para o pediatra (ficam neste celular)"
          value={perguntas}
          onChangeText={(t) => {
            setPerguntas(t);
            salvarPref(chave, t);
          }}
          placeholder="Uma por linha"
          multiline
          style={{ minHeight: 96, paddingTop: 14, textAlignVertical: 'top' }}
        />
      }
    />
  );
}

// Resumo para mostrar na consulta ou mandar pelo WhatsApp: pré-natal na gestação, pediatra depois.
export default function Resumo() {
  const { bebeAtual } = useBebes();
  if (!bebeAtual) return null;
  return (
    <Tela>
      <Cabecalho titulo={nasceu(bebeAtual) ? 'Resumo para o pediatra' : 'Resumo do pré-natal'} />
      {nasceu(bebeAtual) ? <ResumoBebe bebe={bebeAtual} /> : <ResumoGestacao bebe={bebeAtual} />}
    </Tela>
  );
}
