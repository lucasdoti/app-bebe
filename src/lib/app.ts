import type { Href } from 'expo-router';

export const NOME_APP = 'Colinho';

// Tela inicial (aba Início). As rotas tipadas do expo-router não geram "/" quando a home fica no grupo (tabs).
export const INICIO = '/' as Href;
