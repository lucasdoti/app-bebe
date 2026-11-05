import type { Registro } from './registros';

// Fila de envio dos registros: o que foi feito no aparelho e ainda precisa chegar ao servidor.

export type Operacao =
  | { op: 'inserir'; registro: Registro }
  | { op: 'atualizar'; id: string; mudancas: Partial<Pick<Registro, 'inicio' | 'fim' | 'detalhes'>> }
  | { op: 'excluir'; id: string };

/** Operação que o servidor recusou. Fica guardada até a pessoa tentar de novo ou descartar. */
export type Recusado = { op: Operacao; erro: string };

export const idDaOperacao = (o: Operacao) => (o.op === 'inserir' ? o.registro.id : o.id);

// O servidor recusou a primeira da fila: as seguintes do mesmo registro vão junto,
// porque alterar um registro que não chegou a ser criado se perderia sem erro nenhum.
export function separarRecusada(fila: Operacao[]) {
  const [primeira] = fila;
  if (!primeira) return { recusadas: [] as Operacao[], restante: [] as Operacao[] };
  const id = idDaOperacao(primeira);
  return {
    recusadas: fila.filter((o) => idDaOperacao(o) === id),
    restante: fila.filter((o) => idDaOperacao(o) !== id),
  };
}
