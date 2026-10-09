const Database = require('better-sqlite3');
const path = require('path');

// DB_PATH=':memory:' é usado nos testes
const dbPath = process.env.DB_PATH || path.join(__dirname, 'unievent.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS categoria (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS evento (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo       TEXT NOT NULL,
    descricao    TEXT,
    data         TEXT NOT NULL,   -- AAAA-MM-DD
    horario      TEXT,            -- HH:MM
    local        TEXT,
    organizador  TEXT,
    link         TEXT,
    categoria_id INTEGER NOT NULL REFERENCES categoria(id)
  );
`);

// Dados de EXEMPLO para desenvolvimento e testes de usabilidade.
// Troque por eventos reais antes de validar com o público externo.
function seed() {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM evento').get();
  if (total > 0) return;

  const cats = ['Palestra', 'Workshop', 'Curso', 'Cultural', 'Esporte'];
  const insCat = db.prepare('INSERT OR IGNORE INTO categoria (nome) VALUES (?)');
  cats.forEach((c) => insCat.run(c));
  const catId = (nome) => db.prepare('SELECT id FROM categoria WHERE nome = ?').get(nome).id;

  const ins = db.prepare(`INSERT INTO evento
    (titulo, descricao, data, horario, local, organizador, link, categoria_id)
    VALUES (@titulo, @descricao, @data, @horario, @local, @organizador, @link, @categoria_id)`);

  const exemplos = [
    ['Introdução à Ciência de Dados', 'Palestra de abertura sobre carreira e ferramentas.', '2026-11-03', '19:00', 'Auditório 1', 'Coordenação de TI', '', 'Palestra'],
    ['Workshop de Git e GitHub', 'Oficina prática de versionamento para iniciantes.', '2026-11-05', '14:00', 'Laboratório 3', 'Centro Acadêmico', '', 'Workshop'],
    ['Curso de Excel Intermediário', 'Fórmulas, tabelas dinâmicas e gráficos.', '2026-11-10', '18:30', 'Laboratório 2', 'Extensão', '', 'Curso'],
    ['Sarau Universitário', 'Noite de música e poesia aberta à comunidade.', '2026-11-12', '20:00', 'Pátio central', 'DCE', '', 'Cultural'],
    ['Torneio de Futsal', 'Inscrições abertas para equipes mistas.', '2026-11-14', '09:00', 'Quadra', 'Atlética', '', 'Esporte'],
    ['Palestra: Carreira em Tecnologia', 'Profissionais da área falam sobre mercado e estágio.', '2026-11-18', '19:30', 'Auditório 2', 'Núcleo de Carreiras', '', 'Palestra'],
  ];
  const tx = db.transaction(() => {
    exemplos.forEach(([titulo, descricao, data, horario, local, organizador, link, cat]) =>
      ins.run({ titulo, descricao, data, horario, local, organizador, link, categoria_id: catId(cat) }));
  });
  tx();
}

module.exports = { db, seed };
