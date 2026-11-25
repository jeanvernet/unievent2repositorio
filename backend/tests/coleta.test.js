// Os exemplos abaixo são FIXTURES sintéticas que seguem o formato público de cada tipo de fonte
// (não são dados de instituições reais). Servem para provar que o coletor entende cada formato.
const fs = require('fs'); const os = require('os'); const path = require('path');
const arquivoFontes = path.join(os.tmpdir(), `unievent-fontes-${process.pid}.json`);
fs.writeFileSync(arquivoFontes, '[]');
process.env.FONTES_PATH = arquivoFontes;
process.env.DB_PATH = ':memory:';
const request = require('supertest');
const app = require('../app');
const sync = require('../sync');
const { classificar } = require('../categorizar');
const { permitido } = require('../robots');

const HOJE = '2026-01-01';
const resposta = (texto, ok = true, status = 200) => async () => ({ ok, status, text: async () => texto });
// Responde de acordo com a URL pedida (para testar robots.txt e paginação).
const roteador = (mapa) => async (url) => {
  const chave = Object.keys(mapa).find((k) => url.includes(k));
  if (!chave) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => (typeof mapa[chave] === 'function' ? mapa[chave](url) : mapa[chave]) };
};

describe('categorização automática', () => {
  test('classifica pelo título', () => {
    expect(classificar('Minicurso de Python para iniciantes', '')).toBe('Curso');
    expect(classificar('Workshop de Git e GitHub', '')).toBe('Workshop');
    expect(classificar('Oficina de robótica', '')).toBe('Workshop');
    expect(classificar('Campeonato de futsal', '')).toBe('Esporte');
    expect(classificar('Sarau e música ao vivo', '')).toBe('Cultural');
    expect(classificar('Defesa de Dissertação de Mestrado', '')).toBe('Palestra');
    expect(classificar('Seminário de Pesquisa', '')).toBe('Palestra');
    expect(classificar('Dissertação de Mestrado – Fulano de Tal', '')).toBe('Palestra');
  });
  test('usa a descrição quando o título não basta e cai em Outros sem pistas', () => {
    expect(classificar('Dia da Computação', 'Haverá uma palestra de abertura')).toBe('Palestra');
    expect(classificar('Reunião', 'Assuntos gerais')).toBe('Outros');
  });
  test('não confunde palavras parecidas (ex.: "curso" dentro de "discurso")', () => {
    expect(classificar('Discurso de formatura', '')).toBe('Outros');
  });
});

describe('robots.txt', () => {
  const robots = 'User-agent: *\nDisallow: /privado/\nAllow: /privado/publico\nDisallow: /busca';
  test('respeita Disallow, Allow mais específico e caminhos livres', () => {
    expect(permitido(robots, '/agenda/')).toBe(true);
    expect(permitido(robots, '/privado/x')).toBe(false);
    expect(permitido(robots, '/privado/publico/1')).toBe(true);
    expect(permitido(robots, '/busca?q=1')).toBe(false);
  });
  test('sem robots.txt ou sem regras, permite', () => {
    expect(permitido('', '/qualquer')).toBe(true);
    expect(permitido('User-agent: outrobot\nDisallow: /', '/qualquer')).toBe(true);
  });
  test('Disallow: / bloqueia tudo', () => {
    expect(permitido('User-agent: *\nDisallow: /', '/agenda')).toBe(false);
  });
});

describe('datas ISO', () => {
  test('converte UTC e deslocamento para o horário de Brasília', () => {
    expect(sync.dataHoraISO('2026-12-02T22:00:00Z')).toEqual({ data: '2026-12-02', horario: '19:00' });
    expect(sync.dataHoraISO('2026-12-02T19:00:00-03:00')).toEqual({ data: '2026-12-02', horario: '19:00' });
    expect(sync.dataHoraISO('2026-12-03T01:30:00Z')).toEqual({ data: '2026-12-02', horario: '22:30' });
    expect(sync.dataHoraISO('2026-12-02 19:00:00')).toEqual({ data: '2026-12-02', horario: '19:00' });
    expect(sync.dataHoraISO('2026-12-02')).toEqual({ data: '2026-12-02', horario: '' });
    expect(sync.dataHoraISO('lixo').data).toBeNull();
  });
});

const TRIBE_1 = JSON.stringify({
  events: [
    { id: 101, title: 'Oficina de Acessibilidade &amp; Inclusão', description: '<p>Aprenda a testar com <strong>leitor de tela</strong>.</p>',
      start_date: '2026-12-02 19:00:00', all_day: false, url: 'https://biblioteca.exemplo.edu/evento/101',
      venue: { venue: 'Sala 3', address: 'Av. Exemplo, 100' }, organizer: [{ organizer: 'Biblioteca' }], categories: [{ name: 'Oficinas' }] },
    { id: 102, title: 'Semana do Livro', description: '', start_date: '2026-12-03 00:00:00', all_day: true, url: 'javascript:alert(1)', venue: [], organizer: [], categories: [] },
  ],
  next_rest_url: 'https://biblioteca.exemplo.edu/wp-json/tribe/events/v1/events/?page=2&start_date=2026-01-01&per_page=50',
});
const TRIBE_2 = JSON.stringify({ events: [{ id: 103, title: 'Palestra de encerramento', start_date: '2026-12-05 18:30:00', url: 'https://biblioteca.exemplo.edu/evento/103', venue: [], organizer: [], categories: [] }] });

describe('fonte tribe (The Events Calendar)', () => {
  test('interpreta o formato da API: HTML removido, dia inteiro sem horário', () => {
    const [a, b] = sync.eventosDoTribe(TRIBE_1);
    expect(a.titulo).toBe('Oficina de Acessibilidade & Inclusão');
    expect(a.descricao).toBe('Aprenda a testar com leitor de tela.');
    expect(a.data).toBe('2026-12-02'); expect(a.horario).toBe('19:00');
    expect(a.local).toBe('Sala 3, Av. Exemplo, 100'); expect(a.organizador).toBe('Biblioteca');
    expect(b.horario).toBe('');
  });
  test('sincroniza várias páginas, envia start_date e categoriza automaticamente', async () => {
    const pedidos = [];
    const fetchFn = async (url) => {
      pedidos.push(url);
      return { ok: true, status: 200, text: async () => (url.includes('page=2') ? TRIBE_2 : TRIBE_1) };
    };
    const fonte = { chave: 'bib', instituicao: 'Biblioteca Exemplo', tipo: 'tribe', url: 'https://biblioteca.exemplo.edu/wp-json/tribe/events/v1/events' };
    const r = await sync.sincronizarFonte(fonte, { fetchFn, hoje: HOJE });
    expect(r.ok).toBe(true); expect(r.eventos).toBe(3);
    expect(pedidos[0]).toContain('start_date=2026-01-01'); expect(pedidos.length).toBe(2);
    const lista = (await request(app).get('/api/eventos')).body;
    expect(lista.find((e) => e.titulo.startsWith('Oficina')).categoria).toBe('Workshop'); // "Oficinas" não existe → classificada
    expect(lista.find((e) => e.titulo === 'Semana do Livro').link).toBe(''); // link inseguro descartado
    expect(lista.find((e) => e.titulo === 'Palestra de encerramento').categoria).toBe('Palestra');
  });
});

const JSONLD = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"Event","name":"Hackathon de Dados Abertos","startDate":"2026-12-10T09:00:00-03:00","url":"https://campus.exemplo.edu/e/1",
  "location":{"@type":"Place","name":"Lab 5","address":{"@type":"PostalAddress","streetAddress":"Rua A, 10","addressLocality":"Porto Alegre"}},
  "organizer":{"@type":"Organization","name":"Coordenação de TI"},"description":"Maratona de <b>dados</b>."},
 {"@type":"WebSite","name":"Campus Exemplo"}]}</script>
<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@type":"Event","name":"Show de calouros","startDate":"2026-12-11T22:00:00Z"}}]}</script>
<script type="application/ld+json">{ bloco quebrado </script></head></html>`;

describe('fonte jsonld (schema.org/Event em página HTML)', () => {
  test('lê eventos de @graph e ItemList e ignora blocos inválidos', () => {
    const lista = sync.eventosDoJSONLD(JSONLD);
    expect(lista.map((e) => e.titulo)).toEqual(['Hackathon de Dados Abertos', 'Show de calouros']);
    expect(lista[0].local).toBe('Lab 5, Rua A, 10, Porto Alegre'); expect(lista[0].descricao).toBe('Maratona de dados.');
    expect(lista[1].data).toBe('2026-12-11'); expect(lista[1].horario).toBe('19:00');
  });
  test('só lê a página se o robots.txt permitir', async () => {
    const fonte = { chave: 'camp', instituicao: 'Campus Exemplo', tipo: 'jsonld', url: 'https://campus.exemplo.edu/agenda' };
    const bloqueado = await sync.sincronizarFonte(fonte, { fetchFn: roteador({ 'robots.txt': 'User-agent: *\nDisallow: /agenda', '/agenda': JSONLD }), hoje: HOJE });
    expect(bloqueado.ok).toBe(false); expect(bloqueado.erro).toMatch(/robots/);
    const livre = await sync.sincronizarFonte(fonte, { fetchFn: roteador({ 'robots.txt': 'User-agent: *\nDisallow: /admin', '/agenda': JSONLD }), hoje: HOJE });
    expect(livre.ok).toBe(true); expect(livre.eventos).toBe(2);
  });
});

describe('fonte json genérica e filtro de eventos passados', () => {
  test('usa o caminho indicado para achar a lista', () => {
    const texto = JSON.stringify({ dados: { lista: [{ name: 'Aula aberta', startDate: '2026-12-12T19:00:00-03:00', location: 'Auditório' }] } });
    const [e] = sync.eventosDoJSON(texto, { caminho: 'dados.lista' });
    expect(e.titulo).toBe('Aula aberta'); expect(e.local).toBe('Auditório'); expect(e.horario).toBe('19:00');
  });
  test('eventos que já passaram não entram na agenda', async () => {
    const texto = JSON.stringify([{ name: 'Evento antigo', startDate: '2025-05-01T10:00:00-03:00' }, { name: 'Evento futuro', startDate: '2026-12-15T10:00:00-03:00' }]);
    const r = await sync.sincronizarFonte({ chave: 'j', instituicao: 'Fonte JSON', tipo: 'json', url: 'https://x.test/e.json' }, { fetchFn: resposta(texto), hoje: HOJE });
    expect(r.eventos).toBe(1); expect(r.passados).toBe(1);
  });
  test('fonte com ativa:false é pulada na sincronização geral', async () => {
    fs.writeFileSync(arquivoFontes, JSON.stringify([{ chave: 'off', instituicao: 'Desligada', tipo: 'csv', url: 'https://x.test/off.csv', ativa: false }]));
    const estado = await sync.sincronizarTodas({ fetchFn: resposta('título,data\nX,2026-12-30\n'), hoje: HOJE });
    expect(estado.fontes.off).toBeUndefined();
  });
});

describe('recomendações por interesses', () => {
  beforeAll(async () => {
    require('../db').db.prepare('DELETE FROM evento').run(); // isola dos eventos criados nos testes anteriores
    const csv = [
      'título,descrição,data,horário,local,categoria,instituição',
      'Workshop de Git e GitHub,Controle de versão na prática,2026-01-03,19:00,Lab 1,Workshop,Unisenac',
      'Palestra sobre Inteligência Artificial,Aplicações de IA,2026-01-20,19:00,Auditório,Palestra,Unisenac',
      'Sarau de poesia,Noite cultural,2026-01-04,20:00,Pátio,Cultural,UFRGS',
      'Curso de Python,Introdução à programação com git,2026-02-10,18:00,Lab 2,Curso,UFRGS',
    ].join('\n');
    await sync.sincronizarFonte({ chave: 'rec', instituicao: 'Padrão', tipo: 'csv', url: 'https://x.test/rec.csv' }, { fetchFn: resposta(csv), hoje: HOJE });
  });
  const buscar = (qs) => request(app).get(`/api/recomendacoes?data=${HOJE}&${qs}`);

  test('exige ao menos um interesse e valida os parâmetros', async () => {
    expect((await buscar('')).status).toBe(400);
    expect((await buscar('categorias=abc')).status).toBe(400);
    expect((await buscar('palavras=git&limite=0')).status).toBe(400);
  });
  test('ordena por pontuação e explica o motivo de cada recomendação', async () => {
    const cats = (await request(app).get('/api/categorias')).body;
    const idWorkshop = cats.find((c) => c.nome === 'Workshop').id;
    const res = await buscar(`categorias=${idWorkshop}&palavras=git`);
    expect(res.status).toBe(200);
    // Workshop: categoria (3) + "git" no título (2) + esta semana (1) = 6; Curso de Python: "git" só na descrição (1).
    expect(res.body.map((e) => e.titulo)).toEqual(['Workshop de Git e GitHub', 'Curso de Python']);
    expect(res.body[0].pontos).toBe(6);
    expect(res.body[0].motivos).toEqual(['Categoria: Workshop', '"git" no título', 'Acontece nesta semana']);
    expect(res.body[1].motivos).toEqual(['"git" na descrição']);
  });
  test('palavra sem acento acha texto com acento e eventos sem relação não aparecem', async () => {
    const res = await buscar('palavras=inteligencia');
    expect(res.body.map((e) => e.titulo)).toEqual(['Palestra sobre Inteligência Artificial']);
  });
  test('o tema vale só no começo de uma palavra (ia não acha "Fitotecnia")', async () => {
    await sync.sincronizarFonte({ chave: 'ia', instituicao: 'Padrão', tipo: 'csv', url: 'https://x.test/ia.csv' }, { fetchFn: resposta('título,data\nIA aplicada à saúde,2026-01-06\nDefesa de Tese em Fitotecnia,2026-01-05\n'), hoje: HOJE });
    const res = await buscar('palavras=ia');
    expect(res.body.map((e) => e.titulo)).toEqual(['IA aplicada à saúde', 'Palestra sobre Inteligência Artificial']); // o segundo tem "IA" na descrição; "Fitotecnia" não entra
  });
  test('filtra por instituição e respeita o limite', async () => {
    const inst = (await request(app).get('/api/instituicoes')).body;
    const ufrgs = inst.find((i) => i.nome === 'UFRGS').id;
    const res = await buscar(`instituicoes=${ufrgs}&limite=1`);
    expect(res.body.length).toBe(1); expect(res.body[0].instituicao).toBe('UFRGS');
  });
});
