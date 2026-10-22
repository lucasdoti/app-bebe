import { router } from 'expo-router';

import { CartaoResumo } from '@/components/home';
import { Cabecalho, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useEnxoval } from '@/context/enxoval';
import { pontos, useGestacao } from '@/context/gestacao';
import { useParto } from '@/context/parto';
import { useVacinas } from '@/context/vacinas';
import { reais } from '@/lib/dinheiro';
import { idadeGestacional } from '@/lib/gestacao';
import { hojeISO } from '@/lib/idade';
import { CALENDARIO_MAE, situacaoMae } from '@/lib/vacinas';
import { useTema } from '@/theme/tema';

// Aba "Preparar" (gestação): enxoval, chá de bebê, mala, nomes, vacinas da mãe e o dia do parto.
export default function Preparar() {
  const { bebeAtual } = useBebes();
  const { cores } = useTema();
  const { mala, nomes } = useGestacao();
  const { itens: enxoval, faltam, gastos, cha, reservas } = useEnxoval();
  const { aplicadas } = useVacinas();
  const { contatos, plano } = useParto();
  if (!bebeAtual?.parto_previsto) return null;

  const ig = idadeGestacional(bebeAtual.parto_previsto, hojeISO());
  const qtdFaltam = faltam.reduce((s, i) => s + i.quantidade, 0);
  const gastoTotal = gastos.filter((g) => g.tipo === 'compra').reduce((s, g) => s + (g.valor ?? 0), 0);
  const pecas = enxoval.reduce((s, i) => s + i.quantidade, 0);
  const roupas = enxoval.filter((i) => i.categoria === 'roupa').reduce((s, i) => s + i.quantidade, 0);
  const prontos = mala.filter((m) => m.feito).length;
  const favorito = nomes.find((n) => pontos(n) > 0);
  const temObstetra = contatos.some((c) => c.papel === 'obstetra');
  const temMaternidade = contatos.some((c) => c.papel === 'maternidade');

  const tomadas = (c: string) => aplicadas.some((a) => a.para === 'mae' && a.codigo === c);
  const vacinasAgora = CALENDARIO_MAE.filter((d) => situacaoMae(d, ig.semanas, tomadas(d.codigo)) === 'agora');
  const proximaVacina = CALENDARIO_MAE.find((d) => situacaoMae(d, ig.semanas, tomadas(d.codigo)) === 'futura');
  const vacinasFeitas = CALENDARIO_MAE.filter((d) => tomadas(d.codigo)).length;

  return (
    <Tela>
      <Cabecalho titulo="Preparativos" semVoltar />
      <Texto variante="suave">Tudo para a chegada de {bebeAtual.nome}, dividido entre vocês.</Texto>

      <CartaoResumo
        cor={cores.clima}
        icone="hanger"
        titulo="Enxoval"
        valor={pecas ? `${pecas} ${pecas === 1 ? 'item' : 'itens'}` : 'Começar a lista'}
        detalhe={
          pecas
            ? `${roupas} ${roupas === 1 ? 'roupa' : 'roupas'}${qtdFaltam ? ` · faltam ${qtdFaltam}` : ''}${gastoTotal ? ` · ${reais(gastoTotal)} gastos` : ''}`
            : qtdFaltam
              ? `Faltam ${qtdFaltam} itens`
              : 'O que vocês já têm e o que falta'
        }
        onPress={() => router.push('/enxoval')}
      />

      <CartaoResumo
        cor={cores.mamada}
        icone="gift-outline"
        titulo="Chá de bebê"
        valor={cha ? `${reservas.reduce((s, r) => s + r.quantidade, 0)} presentes reservados` : 'Lista de presentes'}
        detalhe={
          cha
            ? cha.data_evento
              ? `Dia ${new Date(cha.data_evento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${cha.ativo ? 'link ativo' : 'link pausado'}`
              : cha.ativo
                ? 'Link ativo'
                : 'Link pausado'
            : 'Convidados reservam o presente por um link, sem repetir'
        }
        onPress={() => router.push('/cha')}
      />

      <CartaoResumo
        cor={cores.fralda}
        icone="bag-suitcase-outline"
        titulo="Mala da maternidade"
        valor={mala.length ? `${prontos} de ${mala.length} prontos` : 'Começar a lista'}
        detalhe={ig.semanas >= 32 ? 'A partir da 32ª semana, vale deixar a mala pronta.' : 'Lista compartilhada entre vocês'}
        onPress={() => router.push('/mala')}
      />

      <CartaoResumo
        cor={cores.mamada}
        icone="hospital-building"
        titulo="Chegou a hora"
        valor={temObstetra && temMaternidade ? 'Contatos prontos' : 'Contatos e plano de parto'}
        detalhe={
          temObstetra && temMaternidade
            ? `${plano.filter((p) => p.preferencia).length} preferências no plano de parto`
            : 'Cadastre obstetra e maternidade para ligar com um toque'
        }
        onPress={() => router.push('/parto')}
      />

      <CartaoResumo
        cor={cores.sono}
        icone="format-list-text"
        titulo="Nomes"
        valor={favorito ? favorito.nome : nomes.length ? `${nomes.length} na lista` : 'Começar a lista'}
        detalhe={favorito ? `Favorito por enquanto · ${nomes.length} na lista` : 'Cada um sugere e vota'}
        onPress={() => router.push('/nomes')}
      />

      <CartaoResumo
        cor={cores.medidas}
        icone="needle"
        titulo="Vacinas da gestação"
        valor={
          vacinasAgora.length
            ? `${vacinasAgora.length} para tomar agora`
            : proximaVacina
              ? `Próxima: ${proximaVacina.vacina.split(' (')[0]}`
              : 'Em dia'
        }
        detalhe={
          vacinasAgora.length
            ? vacinasAgora.map((d) => d.vacina.split(' (')[0]).join(', ')
            : proximaVacina
              ? `A partir da ${proximaVacina.semanaMin}ª semana · ${vacinasFeitas} tomadas`
              : `${vacinasFeitas} tomadas`
        }
        onPress={() => router.push({ pathname: '/vacinas', params: { para: 'mae' } })}
      />
    </Tela>
  );
}
