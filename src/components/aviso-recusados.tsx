import { View } from 'react-native';

import { Botao, Texto } from '@/components/ui';
import { useRegistros } from '@/context/registros';
import { confirmar } from '@/lib/confirmar';
import type { Operacao } from '@/lib/fila';
import { descricao } from '@/lib/registros';
import { horaCurta } from '@/lib/tempo';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

function textoDa(o: Operacao) {
  if (o.op === 'atualizar') return 'Alteração em um registro';
  if (o.op === 'excluir') return 'Exclusão de um registro';
  const d = new Date(o.registro.inicio);
  return `${descricao(o.registro).titulo}, ${d.getDate()}/${d.getMonth() + 1} às ${horaCurta(d)}`;
}

// Registros que o servidor recusou: a pessoa precisa saber que eles não foram salvos.
export function AvisoRecusados() {
  const { recusados, tentarRecusados, descartarRecusados } = useRegistros();
  const { cores } = useTema();
  if (!recusados.length) return null;
  const n = recusados.length;
  return (
    <View style={{ backgroundColor: cores.aviso, borderWidth: 1, borderColor: cores.fralda, borderRadius: 16, padding: 14, gap: 8 }}>
      <Texto style={{ fontFamily: fontes.negrito }}>
        {n === 1 ? '1 registro não foi salvo' : `${n} registros não foram salvos`}
      </Texto>
      {recusados.slice(0, 5).map((r, i) => (
        <Texto key={i}>• {textoDa(r.op)}</Texto>
      ))}
      {n > 5 && <Texto>e mais {n - 5}</Texto>}
      <Botao titulo="Tentar de novo" variante="secundario" onPress={tentarRecusados} />
      <Botao
        titulo="Descartar"
        variante="texto"
        onPress={() => confirmar('Descartar o que não foi salvo? Isso não pode ser desfeito.', 'Descartar', descartarRecusados)}
      />
    </View>
  );
}
