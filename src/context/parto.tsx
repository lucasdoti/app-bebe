import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking } from 'react-native';

import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useBebes } from './bebes';
import { useSessao } from './sessao';

export type Papel = 'obstetra' | 'maternidade' | 'doula' | 'pediatra' | 'outro';
export type Contato = {
  id: string;
  bebe_id: string;
  papel: Papel;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  observacao: string | null;
};

export type GrupoPlano = 'trabalho' | 'parto' | 'bebe' | 'pos';
export type ItemPlano = { id: string; bebe_id: string; grupo: GrupoPlano; texto: string; preferencia: 'sim' | 'nao' | null };

export const nomePapel: Record<Papel, string> = {
  obstetra: 'Obstetra',
  maternidade: 'Maternidade',
  doula: 'Doula',
  pediatra: 'Pediatra',
  outro: 'Outro',
};

export const GRUPOS_PLANO: { grupo: GrupoPlano; titulo: string }[] = [
  { grupo: 'trabalho', titulo: 'Trabalho de parto' },
  { grupo: 'parto', titulo: 'Na hora do parto' },
  { grupo: 'bebe', titulo: 'Logo depois do nascimento' },
  { grupo: 'pos', titulo: 'Depois do parto' },
];

// Preferências comuns em planos de parto (Caderneta da Gestante e diretrizes de parto do Ministério da Saúde).
// Cada família marca sim, não ou deixa para decidir com a equipe.
export const PLANO_SUGERIDO: Record<GrupoPlano, string[]> = {
  trabalho: [
    'Ter acompanhante o tempo todo (direito garantido por lei)',
    'Poder me movimentar e escolher a posição',
    'Comer e beber líquidos leves, se liberado',
    'Usar bola, chuveiro ou massagem para a dor',
    'Receber analgesia (anestesia) se eu pedir',
    'Ambiente com pouca luz e pouco barulho',
  ],
  parto: [
    'Escolher a posição para o parto',
    'Evitar episiotomia (corte) se não for necessário',
    'Ser avisada antes de qualquer procedimento',
    'Acompanhante cortar o cordão, se possível',
  ],
  bebe: [
    'Contato pele a pele logo após o nascimento',
    'Clampeamento tardio do cordão',
    'Amamentar na primeira hora',
    'Exames e banho do bebê depois do contato pele a pele',
    'Bebê no quarto comigo (alojamento conjunto)',
  ],
  pos: [
    'Sem chupeta e sem mamadeira para o bebê, salvo indicação',
    'Apoio para amamentar nos primeiros dias',
    'Visitas limitadas nas primeiras horas',
  ],
};

type ValorParto = {
  contatos: Contato[];
  plano: ItemPlano[];
  recarregar: () => Promise<void>;
};

const PartoContext = createContext<ValorParto | null>(null);

export function PartoProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const { bebes, bebeAtual } = useBebes();
  const familiaId = familia?.id ?? null;
  const ids = useMemo(() => bebes.map((b) => b.id).sort().join(','), [bebes]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [plano, setPlano] = useState<ItemPlano[]>([]);

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) return;
    const chave = `parto:${familiaId}`;
    const lista = ids.split(',');
    const [ct, pl] = await Promise.all([
      supabase
        .from('contatos_parto')
        .select('id, bebe_id, papel, nome, telefone, endereco, observacao')
        .in('bebe_id', lista)
        .order('criado_em'),
      supabase.from('plano_parto_itens').select('id, bebe_id, grupo, texto, preferencia').in('bebe_id', lista).order('criado_em'),
    ]);
    if (ct.error || pl.error) {
      // Sem internet: os telefones continuam disponíveis no aparelho, que é quando mais importam.
      const cache = lerPref(chave);
      if (cache) {
        const c = JSON.parse(cache);
        setContatos(c.contatos);
        setPlano(c.plano);
      }
      return;
    }
    setContatos(ct.data);
    setPlano(pl.data);
    salvarPref(chave, JSON.stringify({ contatos: ct.data, plano: pl.data }));
  }, [familiaId, ids]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!familiaId || !ids) return;
    const canal = supabase
      .channel(`parto:${familiaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos_parto' }, () => recarregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plano_parto_itens' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const valor = useMemo(
    () => ({
      contatos: contatos.filter((c) => c.bebe_id === bebeAtual?.id),
      plano: plano.filter((p) => p.bebe_id === bebeAtual?.id),
      recarregar,
    }),
    [contatos, plano, bebeAtual, recarregar],
  );

  return <PartoContext.Provider value={valor}>{children}</PartoContext.Provider>;
}

export function useParto() {
  const valor = useContext(PartoContext);
  if (!valor) throw new Error('useParto precisa estar dentro de PartoProvider');
  return valor;
}

// ---------- Ações com um toque ----------

const soDigitos = (t: string) => t.replace(/\D/g, '');

export function ligar(telefone: string) {
  return Linking.openURL(`tel:${soDigitos(telefone)}`);
}

// WhatsApp precisa do número com o código do país; números brasileiros com DDD ganham o 55.
export function abrirWhatsApp(telefone: string, mensagem?: string) {
  let n = soDigitos(telefone);
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  return Linking.openURL(`https://wa.me/${n}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`);
}

export function abrirMapa(endereco: string, app: 'maps' | 'waze' = 'maps') {
  const q = encodeURIComponent(endereco);
  return Linking.openURL(
    app === 'waze' ? `https://waze.com/ul?q=${q}&navigate=yes` : `https://www.google.com/maps/search/?api=1&query=${q}`,
  );
}

export function textoDoPlano(nome: string, plano: ItemPlano[]) {
  const linhas = [`*Plano de parto (${nome})*`];
  for (const { grupo, titulo } of GRUPOS_PLANO) {
    const itens = plano.filter((p) => p.grupo === grupo && p.preferencia);
    if (!itens.length) continue;
    linhas.push('', `*${titulo}*`);
    for (const i of itens) linhas.push(`${i.preferencia === 'sim' ? '✅' : '❌'} ${i.texto}`);
  }
  return linhas.join('\n');
}
