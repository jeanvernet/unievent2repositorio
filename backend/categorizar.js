// Classificação automática de categoria por palavras-chave (regras simples e explicáveis).
// Usada quando a fonte não informa categoria ou informa uma que o UniEvent não conhece.
const semAcento = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// A ordem importa: a primeira regra que casar vence ("minicurso" é Curso, não Workshop).
const REGRAS = [
  ['Curso', ['minicurso', 'curso', 'capacitacao', 'treinamento', 'formacao', 'bootcamp']],
  ['Workshop', ['workshop', 'oficina', 'hackathon', 'maratona', 'laboratorio aberto', 'mao na massa']],
  ['Esporte', ['torneio', 'campeonato', 'futsal', 'futebol', 'corrida', 'olimpiada', 'jogos universitarios', 'esporte']],
  ['Cultural', ['show', 'musica', 'musical', 'teatro', 'exposicao', 'cinema', 'sarau', 'festival', 'danca', 'mostra', 'cultural', 'concerto', 'cine ']],
  ['Palestra', ['palestra', 'seminario', 'simposio', 'congresso', 'conferencia', 'painel', 'mesa-redonda', 'mesa redonda',
    'summit', 'forum', 'encontro', 'defesa de', 'dissertacao', 'tese de', 'proposta de tese', 'qualificacao', 'aula inaugural', 'aula aberta', 'semana academica', 'talk', 'meetup', 'live']],
];

function classificar(titulo, descricao) {
  // O título pesa mais: só olha a descrição se o título não bastar.
  for (const texto of [semAcento(titulo), semAcento(descricao).slice(0, 400)]) {
    for (const [categoria, palavras] of REGRAS) {
      if (palavras.some((p) => new RegExp(`(^|[^a-z])${p}`).test(texto))) return categoria;
    }
  }
  return 'Outros';
}

module.exports = { classificar };
