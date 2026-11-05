// Roda todas as migrações num Postgres em memória (PGlite), sem tocar no Supabase de verdade.
// As partes do Supabase que as migrações usam (auth, papéis, publicação) são simuladas abaixo.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, test } from 'node:test';

const PASTA = join(import.meta.dirname, '../../supabase/migrations');
const MAE = '00000000-0000-0000-0000-00000000000a';
const PAI = '00000000-0000-0000-0000-00000000000b';
const INTRUSO = '00000000-0000-0000-0000-00000000000c';
const OUTRO = '00000000-0000-0000-0000-00000000000d';

let db;

// Roda como um usuário logado, com as mesmas permissões do app.
async function como(uid, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('app.uid', '${uid}', false);`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role;');
  }
}

const familiaDe = async (uid) =>
  (await db.query('select familia_id from public.membros where user_id = $1', [uid])).rows[0]?.familia_id;
const codigoDe = async (fid) => (await db.query('select codigo_convite from public.familias where id = $1', [fid])).rows[0].codigo_convite;
const entrar = (uid, codigo) => como(uid, `select (public.entrar_familia($1, 'Fulano', 'outro')).id as id`, [codigo]);
const inscrever = (uid, endpoint) => como(uid, `select public.salvar_inscricao_push($1, 'chave', 'auth', 'teste')`, [endpoint]);

before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema extensions;
    create extension pgcrypto schema extensions;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    grant usage on schema public, auth, extensions to anon, authenticated;
    grant execute on all functions in schema extensions to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    create publication supabase_realtime;
    insert into auth.users values ('${MAE}'), ('${PAI}'), ('${INTRUSO}'), ('${OUTRO}');
  `);
  for (const arquivo of readdirSync(PASTA).sort()) await db.exec(readFileSync(join(PASTA, arquivo), 'utf8'));
  await como(MAE, `select public.criar_familia('Família', 'Mãe', 'mae')`);
});

test('código certo entra na família; novo código invalida o antigo', async () => {
  const fid = await familiaDe(MAE);
  const antigo = await codigoDe(fid);
  const [entrou] = await entrar(PAI, antigo);
  assert.equal(entrou.id, fid);

  await como(PAI, 'select public.novo_codigo_convite()');
  assert.notEqual(await codigoDe(fid), antigo);
  const [falhou] = await entrar(INTRUSO, antigo);
  assert.equal(falhou.id, null);
  assert.equal(await familiaDe(INTRUSO), undefined);
});

test('a tentativa errada fica registrada e a 11ª é recusada, mesmo com o código certo', async () => {
  const fid = await familiaDe(MAE);
  await db.exec(`delete from public.convite_tentativas`);
  for (let i = 0; i < 10; i++) assert.equal((await entrar(OUTRO, 'BEBE-ZZZZZZ'))[0].id, null);
  await assert.rejects(entrar(OUTRO, 'BEBE-ZZZZZZ'), /Muitas tentativas/);
  await assert.rejects(entrar(OUTRO, await codigoDe(fid)), /Muitas tentativas/);

  // Passada a hora, volta a poder tentar.
  await db.exec(`update public.convite_tentativas set em = now() - interval '2 hours'`);
  assert.equal((await entrar(OUTRO, await codigoDe(fid)))[0].id, fid);
  await como(OUTRO, 'select public.sair_familia()');
});

test('remover membro tira o acesso e troca o código', async () => {
  const fid = await familiaDe(MAE);
  await entrar(INTRUSO, await codigoDe(fid));
  await como(MAE, `insert into public.bebes (familia_id, nome, nascimento, sexo, criado_por) values ($1, 'Bebê', '2026-01-01', 'F', $2)`, [fid, MAE]);
  assert.equal((await como(INTRUSO, 'select id from public.bebes')).length, 1);

  const antigo = await codigoDe(fid);
  await como(MAE, 'select public.remover_membro($1)', [INTRUSO]);
  assert.equal((await como(INTRUSO, 'select id from public.bebes')).length, 0);
  assert.notEqual(await codigoDe(fid), antigo);
  assert.equal((await entrar(INTRUSO, antigo))[0].id, null);
});

test('quem pode e quem não pode ser removido', async () => {
  const fid = await familiaDe(MAE);
  await assert.rejects(como(PAI, 'select public.remover_membro($1)', [MAE]), /criou a família/);
  await assert.rejects(como(PAI, 'select public.remover_membro($1)', [PAI]), /Sair da família/);
  await assert.rejects(como(PAI, 'select public.remover_membro($1)', [OUTRO]), /não faz parte/);
  await assert.rejects(como(INTRUSO, 'select public.remover_membro($1)', [PAI]), /não faz parte de uma família/);
  await assert.rejects(como(INTRUSO, 'select public.novo_codigo_convite()'), /não faz parte de uma família/);
  assert.equal(await familiaDe(PAI), fid);
});

test('as tentativas não ficam visíveis para o app', async () => {
  await assert.rejects(como(MAE, 'select * from public.convite_tentativas'), /permission denied/);
});

test('push aceita os serviços conhecidos', async () => {
  for (const e of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ]) await inscrever(OUTRO, e);
  assert.equal((await como(OUTRO, 'select endpoint from public.push_inscricoes')).length, 4);
});

test('push recusa qualquer outro endereço', async () => {
  for (const e of [
    'https://exemplo.com/fcm.googleapis.com/',
    'https://fcm.googleapis.com.exemplo.com/a',
    'https://fcm.googleapis.com@exemplo.com/a',
    'https://fcm.googleapis.com:443@exemplo.com/a',
    'http://fcm.googleapis.com/a',
    'https://localhost/a',
    `https://fcm.googleapis.com/${'a'.repeat(1000)}`,
  ]) await assert.rejects(inscrever(PAI, e), /não reconhece/, e);
});

test('no máximo 5 aparelhos por pessoa', async () => {
  for (let i = 0; i < 7; i++) await inscrever(PAI, `https://fcm.googleapis.com/fcm/send/${i}`);
  assert.equal((await como(PAI, 'select endpoint from public.push_inscricoes')).length, 5);
});

test('as tabelas do tempo real têm a coluna do filtro e estão na publicação', async () => {
  const contextos = readdirSync(join(import.meta.dirname, '../../src/context'));
  const filtradas = new Set();
  for (const arquivo of contextos) {
    const codigo = readFileSync(join(import.meta.dirname, '../../src/context', arquivo), 'utf8');
    const chamada = codigo.match(/useTempoReal\('[^']+', \w+, \w+, \[([^\]]+)\], recarregar, .*?(?:, \[([^\]]*)\])?\);/);
    if (!chamada) continue;
    const sem = new Set((chamada[2] ?? '').match(/[a-z_]+/g) ?? []);
    for (const t of chamada[1].match(/[a-z_]+/g)) if (!sem.has(t)) filtradas.add(t);
    for (const t of chamada[1].match(/[a-z_]+/g)) {
      const { rows } = await db.query('select 1 from pg_publication_tables where pubname = $1 and tablename = $2', ['supabase_realtime', t]);
      assert.equal(rows.length, 1, `${t} fora da publicação`);
    }
  }
  assert.ok(filtradas.size >= 15, `só achei ${filtradas.size} tabelas`);
  for (const t of filtradas) {
    const { rows } = await db.query(
      `select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = 'bebe_id'`,
      [t],
    );
    assert.equal(rows.length, 1, `${t} sem bebe_id`);
  }
});
