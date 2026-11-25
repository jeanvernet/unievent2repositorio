// Recomendação por interesses: regras simples e explicáveis (sem modelo de IA, sem coleta de dados pessoais).
// Os interesses ficam só no navegador da pessoa e chegam à API como parâmetros da consulta.
const semAcento = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// O tema vale quando começa uma palavra: "ia" acha "IA aplicada", mas não "Fitotecnia"; "intelig" acha "Inteligência".
const comecaPalavra = (texto, termo) => new RegExp(`(^|[^a-z0-9])${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(texto);

const PESO = { categoria: 3, instituicao: 2, tituloPalavra: 2, descricaoPalavra: 1, estaSemana: 1 };

function recomendar(eventos, { categorias = [], instituicoes = [], palavras = [] }, hoje) {
  const termos = palavras.map(semAcento).filter(Boolean);
  const limite = new Date(`${hoje}T00:00:00Z`).getTime() + 7 * 86400000;
  return eventos.map((e) => {
    let pontos = 0; const motivos = [];
    if (categorias.includes(e.categoria_id)) { pontos += PESO.categoria; motivos.push(`Categoria: ${e.categoria}`); }
    if (instituicoes.includes(e.instituicao_id)) { pontos += PESO.instituicao; motivos.push(`Instituição: ${e.instituicao}`); }
    const titulo = semAcento(e.titulo); const desc = semAcento(e.descricao);
    for (const t of termos) {
      if (comecaPalavra(titulo, t)) { pontos += PESO.tituloPalavra; motivos.push(`"${t}" no título`); }
      else if (comecaPalavra(desc, t)) { pontos += PESO.descricaoPalavra; motivos.push(`"${t}" na descrição`); }
    }
    // A proximidade só desempata: não traz evento que não tenha relação com os interesses.
    if (pontos > 0 && new Date(`${e.data}T00:00:00Z`).getTime() <= limite) { pontos += PESO.estaSemana; motivos.push('Acontece nesta semana'); }
    return { ...e, pontos, motivos };
  }).filter((e) => e.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || a.data.localeCompare(b.data) || (a.horario || '').localeCompare(b.horario || ''));
}

module.exports = { recomendar, PESO };
