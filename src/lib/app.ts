import type { Href } from 'expo-router';

export const NOME_APP = 'Colinho';

export const SENHA_MINIMA = 8;

// Tela inicial (aba Início). As rotas tipadas do expo-router não geram "/" quando a home fica no grupo (tabs).
export const INICIO = '/' as Href;
