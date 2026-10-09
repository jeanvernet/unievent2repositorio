async function get(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) {
    const erro = new Error(`Falha na requisição (${resposta.status})`);
    erro.status = resposta.status;
    throw erro;
  }
  return resposta.json();
}

export function listarEventos({ q, categoria, data } = {}, signal) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (categoria) params.set('categoria', categoria);
  if (data) params.set('data', data);
  const texto = params.toString();
  return fetch(`/api/eventos${texto ? `?${texto}` : ''}`, { signal }).then((r) => {
    if (!r.ok) throw new Error(`Falha na requisição (${r.status})`);
    return r.json();
  });
}

export const obterEvento = (id) => get(`/api/eventos/${id}`);
export const listarCategorias = () => get('/api/categorias');
