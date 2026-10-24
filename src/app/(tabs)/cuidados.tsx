import { GrupoMenu, ItemMenu } from '@/components/menu';
import { Cabecalho, Tela, Texto } from '@/components/ui';
import { nasceu, useBebes } from '@/context/bebes';
import { useDentes } from '@/context/dentes';
import { useMarcos } from '@/context/marcos';
import { useRegistros } from '@/context/registros';
import { deISO, idade, idadeTexto } from '@/lib/idade';
import { doDia } from '@/lib/sono';
import { duracao, MINUTO } from '@/lib/tempo';
import { useTema } from '@/theme/tema';

// Aba "Bebê": tudo o que não é o registro rápido do dia (sono, saúde, roupa e coisas do bebê).
export default function Cuidados() {
  const { bebeAtual } = useBebes();
  const { doBebe } = useRegistros();
  const { dentes } = useDentes();
  const { marcos } = useMarcos();
  const { cores } = useTema();
  if (!nasceu(bebeAtual)) return null;

  const sonoHoje = doDia(doBebe, 0).total;
  const primeiras = marcos.filter((m) => m.tipo === 'primeira').length;

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

      <GrupoMenu titulo="Desenvolvimento">
        <ItemMenu
          cor={cores.sono}
          icone="star-outline"
          titulo="Marcos"
          detalhe={
            primeiras ? `${primeiras} primeiras vezes · última: ${marcos.filter((m) => m.tipo === 'primeira').at(-1)!.titulo.toLowerCase()}` : 'Primeiras vezes e marcos da Caderneta'
          }
          href="/marcos"
        />
      </GrupoMenu>

      <GrupoMenu titulo="Saúde">
        <ItemMenu cor={cores.medidas} icone="ruler" titulo="Medidas" detalhe="Peso, altura e curvas da OMS" href="/medidas" />
        <ItemMenu cor={cores.medidas} icone="needle" titulo="Vacinas" detalhe="Calendário do SUS e doses tomadas" href="/vacinas" />
        {(idade(bebeAtual.nascimento).meses >= 4 || dentes.length > 0) && (
          <ItemMenu
            cor={cores.clima}
            icone="tooth-outline"
            titulo="Dentinhos"
            detalhe={dentes.length ? `${dentes.length} de 20 · último em ${deISO(dentes.at(-1)!.nasceu_em)}` : 'Anote cada dente que nascer'}
            href="/dentes"
          />
        )}
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
