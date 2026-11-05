// Regras do Realtime que não dependem do React.

// Exclusões não passam pelo RLS nem por filtro: chegam de todas as famílias, só com a chave primária.
// A exclusão só interessa se a chave for de algo que este aparelho conhece.
export function exclusaoEhDaFamilia(
  chave: { id?: unknown; nome_id?: unknown; bebe_id?: unknown },
  conhecidos: Set<string>,
  idsBebes: string[],
) {
  // id: a maioria das tabelas. nome_id: votos de nomes. bebe_id: chá e orçamento, um por bebê.
  return (
    conhecidos.has(String(chave.id)) || conhecidos.has(String(chave.nome_id)) || idsBebes.includes(String(chave.bebe_id))
  );
}
