const express = require('express');
const cors = require('cors');
const { db, seed } = require('./db');

seed();

const app = express();
app.use(cors());

// GET /api/eventos?q=texto&categoria=ID&data=AAAA-MM-DD  (data = a partir de)
app.get('/api/eventos', (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const categoria = req.query.categoria ? Number(req.query.categoria) : null;
  const data = (req.query.data || '').toString().trim();

  if (req.query.categoria && Number.isNaN(categoria)) {
    return res.status(400).json({ erro: 'Parâmetro "categoria" inválido.' });
  }
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ erro: 'Parâmetro "data" deve estar no formato AAAA-MM-DD.' });
  }

  // Consultas parametrizadas (evita injeção de SQL)
  const eventos = db.prepare(`
    SELECT e.id, e.titulo, e.descricao, e.data, e.horario, e.local, e.organizador, e.link,
           c.id AS categoria_id, c.nome AS categoria
    FROM evento e
    JOIN categoria c ON c.id = e.categoria_id
    WHERE (@q IS NULL OR e.titulo LIKE '%' || @q || '%' OR e.descricao LIKE '%' || @q || '%')
      AND (@categoria IS NULL OR c.id = @categoria)
      AND (@data IS NULL OR e.data >= @data)
    ORDER BY e.data, e.horario
  `).all({ q: q || null, categoria, data: data || null });

  res.json(eventos);
});

app.get('/api/eventos/:id', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ erro: 'Identificador inválido.' });
  const evento = db.prepare(`
    SELECT e.*, c.nome AS categoria
    FROM evento e JOIN categoria c ON c.id = e.categoria_id
    WHERE e.id = ?`).get(id);
  if (!evento) return res.status(404).json({ erro: 'Evento não encontrado.' });
  res.json(evento);
});

app.get('/api/categorias', (_req, res) => {
  res.json(db.prepare('SELECT id, nome FROM categoria ORDER BY nome').all());
});

module.exports = app;
