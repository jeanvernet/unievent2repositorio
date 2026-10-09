process.env.DB_PATH = ':memory:';
const request = require('supertest');
const app = require('../app');

describe('API UniEvent', () => {
  test('lista eventos', async () => {
    const res = await request(app).get('/api/eventos');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('busca por texto', async () => {
    const res = await request(app).get('/api/eventos?q=git');
    expect(res.status).toBe(200);
    expect(res.body.every((e) => /git/i.test(e.titulo + e.descricao))).toBe(true);
  });

  test('filtra por categoria', async () => {
    const cats = (await request(app).get('/api/categorias')).body;
    const res = await request(app).get(`/api/eventos?categoria=${cats[0].id}`);
    expect(res.status).toBe(200);
    expect(res.body.every((e) => e.categoria_id === cats[0].id)).toBe(true);
  });

  test('filtra por data', async () => {
    const res = await request(app).get('/api/eventos?data=2026-11-12');
    expect(res.body.every((e) => e.data >= '2026-11-12')).toBe(true);
  });

  test('detalha evento existente', async () => {
    const lista = (await request(app).get('/api/eventos')).body;
    const res = await request(app).get(`/api/eventos/${lista[0].id}`);
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe(lista[0].titulo);
  });

  test('retorna 404 para evento inexistente', async () => {
    const res = await request(app).get('/api/eventos/99999');
    expect(res.status).toBe(404);
  });

  test('rejeita data inválida', async () => {
    const res = await request(app).get('/api/eventos?data=amanha');
    expect(res.status).toBe(400);
  });
});
