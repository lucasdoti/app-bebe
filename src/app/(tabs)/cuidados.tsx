import { GrupoMenu, ItemMenu } from '@/components/menu';
import { Cabecalho, Tela, Texto } from '@/components/ui';
import { nasceu, useBebes } from '@/context/bebes';
import { useRegistros } from '@/context/registros';
import { idadeTexto } from '@/lib/idade';
import { doDia } from '@/lib/sono';
import { duracao, MINUTO } from '@/lib/tempo';
import { useTema } from '@/theme/tema';

// Aba "Bebê": tudo o que não é o registro rápido do dia (sono, saúde, roupa e coisas do bebê).
export default function Cuidados() {
  const { bebeAtual } = useBebes();
  const { doBebe } = useRegistros();
  const { cores } = useTema();
  if (!nasceu(bebeAtual)) return null;

  const sonoHoje = doDia(doBebe, 0).total;

  return (
    <Tela>
      <Cabecalho titulo={bebeAtual.nome} semVoltar />
      <Texto variante="suave">{idadeTexto(bebeAtual.nascimento)}</Texto>

      <GrupoMenu titulo="Rotina">
        <ItemMenu
          cor={cores.sono}
          icone="sleep"
          titulo="Sono"
          detalhe={sonoHoje >= MINUTO ? `Hoje: ${duracao(sonoHoje)} · relógio e média da semana` : 'Relógio do dia e média da semana'}
          href="/sono"
        />
        <ItemMenu cor={cores.clima} icone="tshirt-crew-outline" titulo="Clima e roupa" detalhe="Que roupa vestir hoje" href="/roupa" />
      </GrupoMenu>

      <GrupoMenu titulo="Saúde">
        <ItemMenu cor={cores.medidas} icone="ruler" titulo="Medidas" detalhe="Peso, altura e curvas da OMS" href="/medidas" />
        <ItemMenu cor={cores.medidas} icone="needle" titulo="Vacinas" detalhe="Calendário do SUS e doses tomadas" href="/vacinas" />
        <ItemMenu cor={cores.medidas} icone="pill" titulo="Remédios e febre" detalhe="Doses, horários e temperatura" href="/remedios" />
        <ItemMenu
          cor={cores.mamada}
          icone="clipboard-pulse-outline"
          titulo="Ficha de saúde"
          detalhe="Teste do pezinho, alergias e o que evitar"
          href="/saude"
        />
        <ItemMenu
          cor={cores.clima}
          icone="stethoscope"
          titulo="Resumo para a consulta"
          detalhe="Últimos 7 dias para mostrar ao pediatra"
          href="/resumo"
        />
      </GrupoMenu>

      <GrupoMenu titulo="Coisas do bebê">
        <ItemMenu cor={cores.clima} icone="hanger" titulo="Enxoval" detalhe="O que vocês têm, o que falta e os gastos" href="/enxoval" />
        <ItemMenu cor={cores.mamada} icone="gift-outline" titulo="Chá de bebê" detalhe="Lista de presentes por link" href="/cha" />
      </GrupoMenu>
    </Tela>
  );
}
