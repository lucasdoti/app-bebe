import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { chavesDaConta, encerrarSessao } from '@/lib/limpeza';
import { desativarNotificacoes } from '@/lib/notificacoes';
import { armazenamento, lerPref, salvarPref } from '@/lib/storage';
import { supabase, type Familia, type Membro } from '@/lib/supabase';

type ValorSessao = {
  carregando: boolean;
  sessao: Session | null;
  familia: Familia | null;
  membros: Membro[];
  recarregarFamilia: () => Promise<void>;
  sair: () => Promise<void>;
  /** Entrou pelo link de recuperação de senha e ainda não definiu a nova. */
  trocandoSenha: boolean;
  senhaTrocada: () => void;
};

const SessaoContext = createContext<ValorSessao | null>(null);

const chaveCache = (userId: string) => `familia:${userId}`;

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  // Para qual usuário a família já foi carregada (evita piscar a tela errada ao trocar de conta).
  const [carregadaPara, setCarregadaPara] = useState<string | null | undefined>(undefined);

  const userId = sessao?.user.id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setSessaoPronta(true);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, nova) => {
      setSessao(nova);
      setSessaoPronta(true);
      // Chegou pelo link de "esqueci minha senha": antes de tudo, pede a senha nova.
      if (evento === 'PASSWORD_RECOVERY') setTrocandoSenha(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const recarregarFamilia = useCallback(async () => {
    if (!userId) {
      setFamilia(null);
      setMembros([]);
      setCarregadaPara(null);
      return;
    }
    const { data: meu, error } = await supabase
      .from('membros')
      .select('familia_id')
      .eq('user_id', userId)
      .maybeSingle();

    // Sem internet: usa a última família conhecida neste aparelho.
    if (error) {
      const cache = lerPref(chaveCache(userId));
      if (cache) {
        const salvo = JSON.parse(cache) as { familia: Familia; membros: Membro[] };
        setFamilia(salvo.familia);
        setMembros(salvo.membros);
      }
      setCarregadaPara(userId);
      return;
    }

    if (!meu) {
      setFamilia(null);
      setMembros([]);
      salvarPref(chaveCache(userId), null);
    } else {
      const [{ data: fam }, { data: lista }] = await Promise.all([
        supabase.from('familias').select('id, nome, codigo_convite, criado_por').eq('id', meu.familia_id).single(),
        supabase
          .from('membros')
          .select('familia_id, user_id, nome, papel')
          .eq('familia_id', meu.familia_id)
          .order('entrou_em'),
      ]);
      setFamilia(fam ?? null);
      setMembros(lista ?? []);
      if (fam) salvarPref(chaveCache(userId), JSON.stringify({ familia: fam, membros: lista ?? [] }));
    }
    setCarregadaPara(userId);
  }, [userId]);

  useEffect(() => {
    recarregarFamilia();
  }, [recarregarFamilia]);

  // Atualiza a lista quando alguém entra ou sai da família.
  const familiaId = familia?.id;
  useEffect(() => {
    if (!familiaId) return;
    const canal = supabase
      .channel(`membros:${familiaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'membros', filter: `familia_id=eq.${familiaId}` },
        () => recarregarFamilia(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'membros', filter: `familia_id=eq.${familiaId}` },
        () => recarregarFamilia(),
      )
      // Exclusões não aceitam filtro: chegam de todas as famílias, só com a chave primária.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'membros' }, ({ old }) => {
        if (old.familia_id === familiaId) recarregarFamilia();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, recarregarFamilia]);

  const sair = useCallback(async () => {
    // Sai só deste aparelho; os outros continuam logados.
    await encerrarSessao({
      cancelarNotificacoes: desativarNotificacoes,
      sairDoAparelho: () => supabase.auth.signOut({ scope: 'local' }),
      // Aparelho compartilhado: os dados da família não ficam guardados depois de sair.
      limparDados: () => {
        for (const chave of chavesDaConta(Object.keys(armazenamento ?? {}))) salvarPref(chave, null);
      },
    });
  }, []);

  const carregando = !sessaoPronta || (!!userId && carregadaPara !== userId);

  return (
    <SessaoContext.Provider
      value={{
        carregando,
        sessao,
        familia,
        membros,
        recarregarFamilia,
        sair,
        trocandoSenha,
        senhaTrocada: () => setTrocandoSenha(false),
      }}>
      {children}
    </SessaoContext.Provider>
  );
}

export function useSessao() {
  const valor = useContext(SessaoContext);
  if (!valor) throw new Error('useSessao precisa estar dentro de SessaoProvider');
  return valor;
}
