import { Text, View } from 'react-native';

import { Cabecalho, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useSaude } from '@/context/saude';
import { deISO, idadeTexto } from '@/lib/idade';
import { nomeStatus, type ItemSaude } from '@/lib/saude';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

function Bloco({ titulo, itens, destaque }: { titulo: string; itens: ItemSaude[]; destaque?: boolean }) {
  const { cores } = useTema();
  if (!itens.length) return null;
  return (
    <Cartao style={destaque ? { borderColor: cores.perigo, borderWidth: 2 } : undefined}>
      <Text style={{ fontFamily: fontes.extra, fontSize: 22, color: destaque ? cores.perigo : cores.texto }}>{titulo}</Text>
      {itens.map((i) => (
        <View key={i.id} style={{ gap: 2 }}>
          <Text style={{ fontFamily: fontes.negrito, fontSize: 22, lineHeight: 30, color: cores.texto }}>• {i.nome}</Text>
          {(i.detalhe || (i.status && i.tipo === 'condicao')) && (
            <Text style={{ fontFamily: fontes.regular, fontSize: 17, color: cores.textoSuave, paddingLeft: 18 }}>
              {[i.tipo === 'condicao' && i.status && nomeStatus[i.status], i.detalhe].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
      ))}
    </Cartao>
  );
}

// Tela para virar o celular para o médico: letra grande, só o que importa antes de receitar.
export default function MostrarAoMedico() {
  const { bebeAtual } = useBebes();
  const s = useSaude();
  if (!bebeAtual) return null;
  const condicoes = s.condicoes.filter((c) => c.status !== 'descartado');

  return (
    <Tela>
      <Cabecalho titulo="Para o médico" />
      <View style={{ gap: 2 }}>
        <Texto variante="titulo">{bebeAtual.nome}</Texto>
        {bebeAtual.nascimento && (
          <Texto variante="suave">
            {idadeTexto(bebeAtual.nascimento)} · nasceu em {deISO(bebeAtual.nascimento)}
          </Texto>
        )}
      </View>

      <Bloco titulo="⚠️ Condições" itens={condicoes} destaque />
      <Bloco titulo="🚫 Remédios e substâncias a evitar" itens={s.remediosEvitar} destaque />
      <Bloco titulo="🚫 Alimentos a evitar" itens={s.alimentosEvitar} destaque />
      <Bloco titulo="⚠️ Alergias" itens={s.alergias} destaque />

      {s.fonte && <Texto variante="suave">Lista: {s.fonte.nome}</Texto>}
      {s.pezinho && (
        <Texto>
          Teste do pezinho: {s.pezinho.status ? nomeStatus[s.pezinho.status] : 'sem resultado'}
          {s.pezinho.data ? ` (coleta em ${deISO(s.pezinho.data)})` : ''}
          {s.pezinho.detalhe ? ` – ${s.pezinho.detalhe}` : ''}
        </Texto>
      )}
      {!s.temAlerta && <Texto>Nenhuma condição, restrição ou alergia anotada.</Texto>}
    </Tela>
  );
}
