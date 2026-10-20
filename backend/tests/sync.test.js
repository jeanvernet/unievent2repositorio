process.env.FONTES_PATH = '/caminho/que/nao/existe.json'; // testes não dependem do fontes.json real
process.env.DB_PATH = ':memory:';
const request = require('supertest');
const app = require('../app');
const { eventosDoCSV, eventosDoICS, normalizarData, sincronizarFonte } = require('../sync');

const resposta = (texto, ok = true, status = 200) => async () => ({ ok, status, text: async () => texto });

const CSV = `título,descrição,data,horário,local,organizador,categoria,link
Aula aberta,"Evento com vírgula, e aspas ""legais""",15/12/2026,19h30,Auditório,CA,Palestra,https://exemplo.edu/aula
Sem data,x,,,,,,
Oficina de Git,Prática,2026-12-16,14:00,Lab 3,CA,Workshop,javascript:alert(1)
Torneio,Futsal,2026-12-18,,Quadra,Atlética,CategoriaNova,
`;

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:abc-1@uni
SUMMARY:Seminário de Pesquisa
DESCRIPTION:Linha 1\\nLinha 2 com\\, vírgula
DTSTART:20261201T220000Z
LOCATION:Sala 10
URL:https://outra.edu/sem
END:VEVENT
BEGIN:VEVENT
UID:abc-2@uni
SUMMARY:Dia inteiro
DTSTART;VALUE=DATE:20261202
END:VEVENT
END:VCALENDAR`;

describe('leitura de CSV e iCal', () => {
  test('CSV: aspas, vírgulas, datas dd/mm/aaaa e horário 19h30', () => {
    const [a] = eventosDoCSV(CSV);
    expect(a.titulo).toBe('Aula aberta');
    expect(a.descricao).toBe('Evento com vírgula, e aspas "legais"');
    expect(a.data).toBe('2026-12-15');
    expect(a.horario).toBe('19:30');
  });
  test('datas inválidas são rejeitadas', () => {
    expect(normalizarData('31/02/2026')).toBeNull();
    expect(normalizarData('amanhã')).toBeNull();
  });
  test('iCal: converte UTC para horário de Brasília e trata dia inteiro', () => {
    const [a, b] = eventosDoICS(ICS);
    expect(a.data).toBe('2026-12-01');
    expect(a.horario).toBe('19:00');
    expect(a.descricao).toBe('Linha 1\nLinha 2 com, vírgula');
    expect(b.data).toBe('2026-12-02');
    expect(b.horario).toBe('');
  });
});

describe('sincronização de várias instituições', () => {
  const fonteA = { chave: 'a', instituicao: 'Universidade A', tipo: 'csv', url: 'https://x.test/a.csv' };
  const fonteB = { chave: 'b', instituicao: 'Universidade B', tipo: 'ics', url: 'https://x.test/b.ics' };

  test('importa eventos válidos, ignora inválidos e remove demonstração', async () => {
    const r = await sincronizarFonte(fonteA, { fetchFn: resposta(CSV) });
    expect(r.ok).toBe(true);
    expect(r.eventos).toBe(3);
    expect(r.ignorados).toBe(1);
    const lista = (await request(app).get('/api/eventos')).body;
    expect(lista.every((e) => e.instituicao === 'Universidade A')).toBe(true);
    const oficina = lista.find((e) => e.titulo === 'Oficina de Git');
    expect(oficina.link).toBe(''); // link javascript: descartado
    expect(lista.find((e) => e.titulo === 'Torneio').categoria).toBe('Outros');
  });

  test('segunda fonte convive com a primeira e o filtro por instituição funciona', async () => {
    await sincronizarFonte(fonteB, { fetchFn: resposta(ICS) });
    const inst = (await request(app).get('/api/instituicoes')).body;
    expect(inst.map((i) => i.nome)).toEqual(['Universidade A', 'Universidade B']);
    const idB = inst.find((i) => i.nome === 'Universidade B').id;
    const res = await request(app).get(`/api/eventos?instituicao=${idB}`);
    expect(res.body.length).toBe(2);
    expect(res.body.every((e) => e.instituicao === 'Universidade B')).toBe(true);
  });

  test('atualiza evento alterado e remove o que saiu da fonte', async () => {
    const novoICS = ICS.replace('Seminário de Pesquisa', 'Seminário (novo título)').replace(/BEGIN:VEVENT\nUID:abc-2[\s\S]*?END:VEVENT\n/, '');
    await sincronizarFonte(fonteB, { fetchFn: resposta(novoICS) });
    const idB = (await request(app).get('/api/instituicoes')).body.find((i) => i.nome === 'Universidade B').id;
    const lista = (await request(app).get(`/api/eventos?instituicao=${idB}`)).body;
    expect(lista.map((e) => e.titulo)).toEqual(['Seminário (novo título)']);
  });

  test('falha numa fonte mantém os eventos antigos e não afeta as outras', async () => {
    const antes = (await request(app).get('/api/eventos')).body.length;
    const r = await sincronizarFonte(fonteA, { fetchFn: resposta('', false, 500) });
    expect(r.ok).toBe(false);
    expect((await request(app).get('/api/eventos')).body.length).toBe(antes);
    const status = (await request(app).get('/api/status')).body;
    expect(status.fontes.a.ok).toBe(false);
  });

  test('CSV com coluna "instituição" distribui eventos entre instituições', async () => {
    const csv = 'título,data,instituição\nEvento X,2026-12-20,Universidade C\nEvento Y,2026-12-21,\n';
    await sincronizarFonte({ chave: 'c', instituicao: 'Padrão D', tipo: 'csv', url: 'https://x.test/c.csv' }, { fetchFn: resposta(csv) });
    const lista = (await request(app).get('/api/eventos')).body;
    expect(lista.find((e) => e.titulo === 'Evento X').instituicao).toBe('Universidade C');
    expect(lista.find((e) => e.titulo === 'Evento Y').instituicao).toBe('Padrão D');
  });

  test('rejeita parâmetro instituicao inválido', async () => {
    expect((await request(app).get('/api/eventos?instituicao=abc')).status).toBe(400);
  });
});
