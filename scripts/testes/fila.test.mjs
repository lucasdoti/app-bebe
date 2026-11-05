import assert from 'node:assert/strict';
import { test } from 'node:test';

import { separarRecusada } from '../../src/lib/fila.ts';

const inserir = (id) => ({ op: 'inserir', registro: { id } });
const atualizar = (id) => ({ op: 'atualizar', id, mudancas: {} });
const excluir = (id) => ({ op: 'excluir', id });

test('a operação recusada sai da fila e não se perde', () => {
  const { recusadas, restante } = separarRecusada([inserir('a'), inserir('b')]);
  assert.deepEqual(recusadas, [inserir('a')]);
  assert.deepEqual(restante, [inserir('b')]);
});

test('as operações seguintes do mesmo registro vão junto, na ordem', () => {
  const { recusadas, restante } = separarRecusada([inserir('a'), inserir('b'), atualizar('a'), excluir('a')]);
  assert.deepEqual(recusadas, [inserir('a'), atualizar('a'), excluir('a')]);
  assert.deepEqual(restante, [inserir('b')]);
});

test('fila vazia não quebra', () => {
  assert.deepEqual(separarRecusada([]), { recusadas: [], restante: [] });
});
