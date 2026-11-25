// Interesses da pessoa: guardados apenas no navegador (localStorage), sem cadastro e sem envio ao servidor.
const CHAVE = 'unievent.interesses';
const VAZIO = { categorias: [], instituicoes: [], palavras: [] };

export function lerInteresses() {
  try {
    const salvo = JSON.parse(window.localStorage.getItem(CHAVE) || 'null');
    return {
      categorias: Array.isArray(salvo?.categorias) ? salvo.categorias.map(Number).filter(Number.isFinite) : [],
      instituicoes: Array.isArray(salvo?.instituicoes) ? salvo.instituicoes.map(Number).filter(Number.isFinite) : [],
      palavras: Array.isArray(salvo?.palavras) ? salvo.palavras.map(String).slice(0, 10) : [],
    };
  } catch { return { ...VAZIO }; }
}

export function salvarInteresses(interesses) {
  try { window.localStorage.setItem(CHAVE, JSON.stringify(interesses)); } catch { /* armazenamento indisponível: segue sem salvar */ }
}

export const semInteresses = (i) => i.categorias.length + i.instituicoes.length + i.palavras.length === 0;
