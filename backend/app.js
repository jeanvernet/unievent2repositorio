const express = require('express');
const cors = require('cors');
const { db, seed } = require('./db');
const { carregarFontes, estado, hojeISO } = require('./sync');
const { recomendar } = require('./recomendar');

// Com fontes reais configuradas, os dados de demonstração não são criados.
if (carregarFontes().length > 0) process.env.SEM_SEED = '1';
seed();

const app = express();
app.use(cors());

// GET /api/eventos?q=texto&categoria=ID&instituicao=ID&data=AAAA-MM-DD  (data = a partir de)
app.get('/api/eventos', (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const categoria = req.query.categoria ? Number(req.query.categoria) : null;
  const instituicao = req.query.instituicao ? Number(req.query.instituicao) : null;
  const data = (req.query.data || '').toString().trim();

  if (req.query.categoria && Number.isNaN(categoria)) {
    return res.status(400).json({ erro: 'Parâmetro "categoria" inválido.' });
  }
  if (req.query.instituicao && Number.isNaN(instituicao)) {
    return res.status(400).json({ erro: 'Parâmetro "instituicao" inválido.' });
  }
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ erro: 'Parâmetro "data" deve estar no formato AAAA-MM-DD.' });
  }

  // Consultas parametrizadas (evita injeção de SQL)
  const eventos = db.prepare(`
    SELECT e.id, e.titulo, e.descricao, e.data, e.horario, e.local, e.organizador, e.link,
           c.id AS categoria_id, c.nome AS categoria,
           i.id AS instituicao_id, i.nome AS instituicao
    FROM evento e
    JOIN categoria c ON c.id = e.categoria_id
    LEFT JOIN instituicao i ON i.id = e.instituicao_id
    WHERE (@q IS NULL OR e.titulo LIKE '%' || @q || '%' OR e.descricao LIKE '%' || @q || '%')
      AND (@categoria IS NULL OR c.id = @categoria)
      AND (@instituicao IS NULL OR e.instituicao_id = @instituicao)
      AND (@data IS NULL OR e.data >= @data)
    ORDER BY e.data, e.horario
  `).all({ q: q || null, categoria, instituicao, data: data || null });

  res.json(eventos);
});

// GET /api/recomendacoes?categorias=1,2&instituicoes=3&palavras=git,ia&limite=10&data=AAAA-MM-DD
// Os interesses não são guardados no servidor: valem apenas para esta consulta.
app.get('/api/recomendacoes', (req, res) => {
  const ids = (t) => (t || '').toString().split(',').map((x) => x.trim()).filter(Boolean);
  const categorias = ids(req.query.categorias).map(Number);
  const instituicoes = ids(req.query.instituicoes).map(Number);
  const palavras = ids(req.query.palavras).map((p) => p.slice(0, 30)).slice(0, 10);
  const limite = req.query.limite ? Number(req.query.limite) : 10;
  const data = (req.query.data || hojeISO()).toString();
  if ([...categorias, ...instituicoes].some(Number.isNaN)) return res.status(400).json({ erro: 'Categorias e instituições devem ser números.' });
  if (Number.isNaN(limite) || limite < 1 || limite > 50) return res.status(400).json({ erro: 'Parâmetro "limite" deve estar entre 1 e 50.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ erro: 'Parâmetro "data" deve estar no formato AAAA-MM-DD.' });
  if (categorias.length + instituicoes.length + palavras.length === 0) return res.status(400).json({ erro: 'Informe ao menos um interesse.' });
  const futuros = db.prepare(`
    SELECT e.id, e.titulo, e.descricao, e.data, e.horario, e.local, e.organizador, e.link,
           c.id AS categoria_id, c.nome AS categoria, i.id AS instituicao_id, i.nome AS instituicao
    FROM evento e JOIN categoria c ON c.id = e.categoria_id LEFT JOIN instituicao i ON i.id = e.instituicao_id
    WHERE e.data >= ? ORDER BY e.data, e.horario`).all(data);
  res.json(recomendar(futuros, { categorias, instituicoes, palavras }, data).slice(0, limite));
});

app.get('/api/eventos/:id', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ erro: 'Identificador inválido.' });
  const evento = db.prepare(`
    SELECT e.id, e.titulo, e.descricao, e.data, e.horario, e.local, e.organizador, e.link,
           c.nome AS categoria, i.nome AS instituicao
    FROM evento e JOIN categoria c ON c.id = e.categoria_id
    LEFT JOIN instituicao i ON i.id = e.instituicao_id
    WHERE e.id = ?`).get(id);
  if (!evento) return res.status(404).json({ erro: 'Evento não encontrado.' });
  res.json(evento);
});

app.get('/api/categorias', (_req, res) => {
  res.json(db.prepare('SELECT id, nome FROM categoria ORDER BY nome').all());
});

app.get('/api/instituicoes', (_req, res) => {
  res.json(db.prepare(`SELECT id, nome FROM instituicao
    WHERE id IN (SELECT instituicao_id FROM evento) ORDER BY nome`).all());
});

// Estado da última sincronização de cada fonte (útil para conferir se está atualizando).
app.get('/api/status', (_req, res) => res.json(estado));

module.exports = app;
