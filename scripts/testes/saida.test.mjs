import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { encerrarSessao } from '../../src/lib/limpeza.ts';

const raiz = join(import.meta.dirname, '../..');

function passos(cancelarNotificacoes) {
  const ordem = [];
  return {
    ordem,
    limiteMs: 30,
    cancelarNotificacoes: () => {
      ordem.push('cancelar');
      return cancelarNotificacoes();
    },
    sairDoAparelho: async () => void ordem.push('sair'),
    limparDados: () => void ordem.push('limpar'),
  };
}

test('cancela as notificações antes de sair, porque apagar a inscrição exige estar logado', async () => {
  const p = passos(async () => {});
  await encerrarSessao(p);
  assert.deepEqual(p.ordem, ['cancelar', 'sair', 'limpar']);
});

test('sem internet, a falha ao cancelar não impede a saída', async () => {
  const p = passos(() => Promise.reject(new Error('sem internet')));
  await encerrarSessao(p);
  assert.deepEqual(p.ordem, ['cancelar', 'sair', 'limpar']);
});

test('cancelamento travado não prende a pessoa na conta', async () => {
  const p = passos(() => new Promise(() => {}));
  await encerrarSessao(p);
  assert.deepEqual(p.ordem, ['cancelar', 'sair', 'limpar']);
});

test('sair encerra só o aparelho atual', () => {
  const codigo = readFileSync(join(raiz, 'src/context/sessao.tsx'), 'utf8');
  assert.match(codigo, /signOut\(\{ scope: 'local' \}\)/);
  assert.doesNotMatch(codigo, /signOut\(\)/);
});

test('nenhuma assinatura filtrada ouve todos os eventos: exclusões não aceitam filtro', () => {
  for (const arquivo of ['sessao', 'bebes', 'roupa']) {
    const codigo = readFileSync(join(raiz, `src/context/${arquivo}.tsx`), 'utf8');
    assert.doesNotMatch(codigo, /event: '\*'[^}]*filter:/, arquivo);
    assert.match(codigo, /event: 'DELETE'/, arquivo);
  }
});
