import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { Bebe } from '@/context/bebes';
import { useEnxoval } from '@/context/enxoval';
import { useVacinas } from '@/context/vacinas';
import { CALENDARIO_MAE, situacaoMae } from '@/lib/vacinas';
import { pontos, useGestacao } from '@/context/gestacao';
import { useRegistros } from '@/context/registros';
import { useAgora } from '@/hooks/use-agora';
import {
  faltamTexto,
  idadeGestacional,
  idadeGestacionalNaData,
  pesoTexto,
  semanasTexto,
  tamanhoNaSemana,
  trimestre,
} from '@/lib/gestacao';
import { deISO, hojeISO } from '@/lib/idade';
import { duracaoSegundos } from '@/lib/registros';
import { duracao, haQuanto, horaCurta } from '@/lib/tempo';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';
import { BotaoRegistro, CartaoResumo } from './home';
import { Botao, Tela, Texto } from './ui';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function dataHoraCurta(iso: string) {
  const d = new Date(iso);
  const dia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${DIAS_SEMANA[d.getDay()]}, ${dia} às ${horaCurta(d)}`;
}

const novoPreNatal = (tipo: string) => router.push({ pathname: '/pre-natal/[id]', params: { id: 'novo', tipo } });

// Tela inicial enquanto o bebê está a caminho.
export function InicioGestacao({ bebe, topo }: { bebe: Bebe; topo: ReactNode }) {
  const { cores } = useTema();
  const { preNatal, mala, nomes } = useGestacao();
  const { doBebe } = useRegistros();
  const { itens: enxoval } = useEnxoval();
  const { aplicadas } = useVacinas();
  const agora = useAgora(30_000);
  const pecas = enxoval.reduce((s, i) => s + i.quantidade, 0);
  const roupas = enxoval.filter((i) => i.categoria === 'roupa').reduce((s, i) => s + i.quantidade, 0);

  const parto = bebe.parto_previsto!;
  const ig = idadeGestacional(parto, hojeISO());
  const tamanho = tamanhoNaSemana(ig.semanas);
  const progresso = Math.min(Math.max(ig.totalDias / 280, 0), 1);

  const proxima = preNatal.find((p) => p.tipo !== 'ultrassom' && new Date(p.data).getTime() >= agora - 60 * 60_000);
  const ultrassons = preNatal.filter((p) => p.tipo === 'ultrassom' && new Date(p.data).getTime() <= agora);
  const ultimoUs = ultrassons.at(-1);
  const contracoes = doBebe.filter((r) => r.tipo === 'contracao');
  const contracaoAtiva = contracoes.find((r) => r.fim === null);
  const mostrarContracoes = ig.semanas >= 28 || contracoes.length > 0;
  const prontos = mala.filter((m) => m.feito).length;
  const movimentos = doBebe.filter((r) => r.tipo === 'movimentos');
  const mostrarMovimentos = ig.semanas >= 28 || movimentos.length > 0;
  const ultimaContagem = movimentos[0];
  const favorito = nomes.find((n) => pontos(n) > 0);

  const rodape = (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <BotaoRegistro cor={cores.clima} icone="stethoscope" titulo="Consulta" onPress={() => novoPreNatal('consulta')} />
      <BotaoRegistro cor={cores.sono} icone="heart-pulse" titulo="Ultrassom" onPress={() => novoPreNatal('ultrassom')} />
      {mostrarMovimentos && (
        <BotaoRegistro cor={cores.sono} icone="gesture-tap" titulo="Mexeu" onPress={() => router.push('/movimentos')} />
      )}
      <BotaoRegistro
        cor={cores.mamada}
        icone="timer-outline"
        titulo="Contração"
        onPress={() => router.push('/contracoes')}
      />
    </View>
  );

  return (
    <Tela topo={topo} rodape={rodape}>
      <View style={{ gap: 4 }}>
        <Texto variante="titulo">{bebe.nome}</Texto>
        <Texto variante="suave">
          {ig.totalDias >= 0 ? semanasTexto(ig.semanas, ig.dias) : 'início da gestação'} · {trimestre(ig.semanas)}º trimestre
        </Texto>
        <View style={{ height: 12, borderRadius: 6, backgroundColor: cores.borda, overflow: 'hidden', marginTop: 6 }}>
          <View style={{ width: `${progresso * 100}%`, height: '100%', borderRadius: 6, backgroundColor: cores.mamada }} />
        </View>
        <Texto variante="suave">
          Parto previsto: {deISO(parto)} · {faltamTexto(ig.faltam)}
        </Texto>
      </View>

      <CartaoResumo
        cor={cores.medidas}
        icone="fruit-cherries"
        titulo={`Na semana ${ig.semanas}, do tamanho de`}
        valor={tamanho.comparacao}
        detalhe={
          tamanho.cm
            ? `cerca de ${String(tamanho.cm).replace('.', ',')} cm${tamanho.gramas ? ` e ${pesoTexto(tamanho.gramas)}` : ''} (média aproximada)`
            : undefined
        }
      />

      <CartaoResumo
        cor={cores.clima}
        icone="calendar-heart"
        titulo="Próxima consulta ou exame"
        valor={proxima ? dataHoraCurta(proxima.data) : 'Nada agendado'}
        detalhe={proxima ? [proxima.titulo, proxima.local].filter(Boolean).join(' · ') : 'Toque para ver o pré-natal'}
        onPress={() => router.push('/pre-natal')}
      />

      <CartaoResumo
        cor={cores.sono}
        icone="heart-pulse"
        titulo="Último ultrassom"
        valor={ultimoUs?.peso_fetal_g ? pesoTexto(ultimoUs.peso_fetal_g) : ultimoUs ? deISO(hojeISO(new Date(ultimoUs.data))) : '—'}
        detalhe={
          ultimoUs
            ? [
                (() => {
                  const g = idadeGestacionalNaData(parto, hojeISO(new Date(ultimoUs.data)));
                  return `${g.semanas} sem e ${g.dias} d`;
                })(),
                ultimoUs.batimentos_bpm && `${ultimoUs.batimentos_bpm} bpm`,
                ultimoUs.percentil_laudo !== null && `percentil ${String(ultimoUs.percentil_laudo).replace('.', ',')}`,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Toque em Ultrassom para registrar o laudo'
        }
        onPress={() => router.push('/pre-natal')}
      />

      {mostrarContracoes && (
        <CartaoResumo
          cor={cores.mamada}
          icone="timer-outline"
          titulo="Contrações"
          valor={
            contracaoAtiva
              ? `Agora · ${duracaoSegundos(agora - new Date(contracaoAtiva.inicio).getTime())}`
              : contracoes[0]
                ? `Última ${haQuanto(contracoes[0].inicio, new Date(agora))}`
                : 'Nenhuma registrada'
          }
          detalhe="Cronômetro com duração e intervalo"
          onPress={() => router.push('/contracoes')}
        />
      )}

      {mostrarMovimentos && (
        <CartaoResumo
          cor={cores.sono}
          icone="gesture-tap"
          titulo="Movimentos do bebê"
          valor={
            ultimaContagem?.tipo === 'movimentos'
              ? ultimaContagem.fim
                ? `${ultimaContagem.detalhes.quantidade} em ${duracao(new Date(ultimaContagem.fim).getTime() - new Date(ultimaContagem.inicio).getTime())}`
                : `Contando: ${ultimaContagem.detalhes.quantidade}`
              : 'Nenhuma contagem'
          }
          detalhe={
            ultimaContagem ? `Última contagem ${haQuanto(ultimaContagem.inicio, new Date(agora))}` : 'Conte 10 movimentos e veja o tempo'
          }
          onPress={() => router.push('/movimentos')}
        />
      )}

      <CartaoResumo
        cor={cores.mamada}
        icone="format-list-text"
        titulo="Nomes"
        valor={favorito ? favorito.nome : nomes.length ? `${nomes.length} na lista` : 'Começar a lista'}
        detalhe={favorito ? `Favorito por enquanto · ${nomes.length} na lista` : 'Cada um sugere e vota'}
        onPress={() => router.push('/nomes')}
      />

      {(() => {
        const tomadas = (c: string) => aplicadas.some((a) => a.para === 'mae' && a.codigo === c);
        const pode = CALENDARIO_MAE.filter((d) => situacaoMae(d, ig.semanas, tomadas(d.codigo)) === 'agora');
        const proxima = CALENDARIO_MAE.find((d) => situacaoMae(d, ig.semanas, tomadas(d.codigo)) === 'futura');
        const feitas = CALENDARIO_MAE.filter((d) => tomadas(d.codigo)).length;
        return (
          <CartaoResumo
            cor={cores.medidas}
            icone="needle"
            titulo="Vacinas da gestação"
            valor={pode.length ? `${pode.length} para tomar agora` : proxima ? `Próxima: ${proxima.vacina.split(' (')[0]}` : 'Em dia'}
            detalhe={
              pode.length
                ? pode.map((d) => d.vacina.split(' (')[0]).join(', ')
                : proxima
                  ? `A partir da ${proxima.semanaMin}ª semana · ${feitas} tomadas`
                  : `${feitas} tomadas`
            }
            onPress={() => router.push({ pathname: '/vacinas', params: { para: 'mae' } })}
          />
        );
      })()}

      <CartaoResumo
        cor={cores.clima}
        icone="hanger"
        titulo="Enxoval"
        valor={pecas ? `${pecas} ${pecas === 1 ? 'item' : 'itens'}` : 'Começar a lista'}
        detalhe={pecas ? `${roupas} ${roupas === 1 ? 'roupa' : 'roupas'} · toque para ver e enviar no WhatsApp` : 'O que vocês já têm, por tamanho'}
        onPress={() => router.push('/enxoval')}
      />

      <CartaoResumo
        cor={cores.fralda}
        icone="bag-suitcase-outline"
        titulo="Mala da maternidade"
        valor={mala.length ? `${prontos} de ${mala.length} prontos` : 'Começar a lista'}
        detalhe={ig.semanas >= 32 ? 'A partir da 32ª semana, vale deixar a mala pronta.' : 'Lista compartilhada entre vocês'}
        onPress={() => router.push('/mala')}
      />

      <Botao titulo="Lembretes das consultas" variante="secundario" onPress={() => router.push('/lembretes')} />

      <Botao
        titulo={`${bebe.nome} nasceu!`}
        variante={ig.semanas >= 37 ? 'primario' : 'secundario'}
        onPress={() => router.push({ pathname: '/bebe/[id]', params: { id: bebe.id, nascer: '1' } })}
      />
      <Texto variante="suave" style={{ textAlign: 'center', fontFamily: fontes.regular }}>
        No nascimento, a rotina de mamadas, sono e fraldas começa e o histórico da gestação fica guardado.
      </Texto>
    </Tela>
  );
}
