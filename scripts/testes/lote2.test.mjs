import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { chavesDaConta } from '../../src/lib/limpeza.ts';
import { exclusaoEhDaFamilia } from '../../src/lib/tempo-real.ts';

const raiz = join(import.meta.dirname, '../..');

test('sair da conta apaga os dados da família e mantém o que não é dela', () => {
  const dados = [
    'registros:f1', 'fila:f1', 'recusados:f1', 'saude:f1', 'dentes:f1', 'marcos:f1', 'medidas:f1', 'familia:u1',
    'bebe_atual', 'clima_local', 'clima_cache', 'leite_preferido', 'roupa_contexto', 'temp_quarto',
  ];
  const ficam = ['modo_tema', 'convite_pendente', 'sb-projeto-auth-token', 'cha_nome'];
  assert.deepEqual(chavesDaConta([...dados, ...ficam]), dados);
});

test('as reservas do convidado na página do chá ficam no aparelho', () => {
  const codigo = readFileSync(join(raiz, 'src/app/cha/[token].tsx'), 'utf8');
  const [, prefixo] = codigo.match(/chaveMinhas = `([a-z_]+)/) ?? [];
  assert.ok(prefixo?.startsWith('cha_'), `chave das reservas: ${prefixo}`);
});

test('exclusão de outra família não recarrega; da própria, sim', () => {
  const conhecidos = new Set(['item-meu', 'nome-meu']);
  const bebes = ['bebe-meu'];
  assert.equal(exclusaoEhDaFamilia({ id: 'item-de-outro' }, conhecidos, bebes), false);
  assert.equal(exclusaoEhDaFamilia({ id: 'item-meu' }, conhecidos, bebes), true);
  assert.equal(exclusaoEhDaFamilia({ nome_id: 'nome-meu', user_id: 'x' }, conhecidos, bebes), true);
  assert.equal(exclusaoEhDaFamilia({ bebe_id: 'bebe-meu' }, conhecidos, bebes), true);
  assert.equal(exclusaoEhDaFamilia({ bebe_id: 'bebe-de-outro' }, conhecidos, bebes), false);
  assert.equal(exclusaoEhDaFamilia({}, conhecidos, bebes), false);
});

test('o site manda os cabeçalhos de segurança em todas as rotas', () => {
  const { headers } = JSON.parse(readFileSync(join(raiz, 'vercel.json'), 'utf8'));
  const geral = headers.find((h) => h.source === '/(.*)');
  assert.ok(geral, 'falta a regra geral');
  const nomes = geral.headers.map((h) => h.key);
  for (const n of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy'])
    assert.ok(nomes.includes(n), n);
  const permissoes = geral.headers.find((h) => h.key === 'Permissions-Policy').value;
  assert.match(permissoes, /geolocation=\(self\)/, 'a sugestão de roupa precisa da localização');
});
