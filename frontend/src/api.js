async function get(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) {
    const erro = new Error(`Falha na requisição (${resposta.status})`);
    erro.status = resposta.status;
    throw erro;
  }
  return resposta.json();
}

export function listarEventos({ q, categoria, instituicao, data } = {}, signal) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (categoria) params.set('categoria', categoria);
  if (instituicao) params.set('instituicao', instituicao);
  if (data) params.set('data', data);
  const texto = params.toString();
  return fetch(`/api/eventos${texto ? `?${texto}` : ''}`, { signal }).then((r) => {
    if (!r.ok) throw new Error(`Falha na requisição (${r.status})`);
    return r.json();
  });
}

export const obterEvento = (id) => get(`/api/eventos/${id}`);
export const listarCategorias = () => get('/api/categorias');
export const listarInstituicoes = () => get('/api/instituicoes');

// Recomendações por interesses (os interesses ficam no navegador e vão só na consulta).
export function listarRecomendacoes({ categorias = [], instituicoes = [], palavras = [] }, signal) {
  const params = new URLSearchParams();
  if (categorias.length) params.set('categorias', categorias.join(','));
  if (instituicoes.length) params.set('instituicoes', instituicoes.join(','));
  if (palavras.length) params.set('palavras', palavras.join(','));
  params.set('limite', '12');
  return fetch(`/api/recomendacoes?${params}`, { signal }).then((r) => {
    if (!r.ok) throw new Error(`Falha na requisição (${r.status})`);
    return r.json();
  });
}
