// Sincronização de eventos a partir de fontes externas (várias instituições).
// Tipos de fonte: csv (planilha publicada), ics (calendário iCal), tribe (API REST do plugin
// The Events Calendar, comum em sites WordPress de universidades), json (lista de eventos em JSON)
// e jsonld (página HTML com marcação schema.org/Event; só é lida se o robots.txt permitir).
// Sem dependências extras: usa apenas fetch nativo (Node 18+) e crypto.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./db');
const { classificar } = require('./categorizar');
const { permitido } = require('./robots');

const LIMITE_BYTES = 8 * 1024 * 1024;
const USER_AGENT = 'UniEventBot/1.0 (projeto academico Unisenac-RS; leitura de agendas publicas)';
const estado = { ultimaSincronizacao: null, fontes: {} };

/* ---------- utilitários ---------- */
const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const cortar = (t, n) => (t || '').toString().trim().slice(0, n);
const linkValido = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol) ? u : ''; } catch { return ''; } };

function normalizarData(texto) {
  const t = (texto || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let a, mes, d;
  if (m) [, a, mes, d] = m;
  else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { [, d, mes, a] = m; }
  else return null;
  const iso = `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso ? null : iso;
}
function normalizarHorario(texto) {
  const m = (texto || '').trim().match(/^(\d{1,2})(?::|h)(\d{2})?/i);
  if (!m) return '';
  const h = Number(m[1]); const min = Number(m[2] || 0);
  return h > 23 || min > 59 ? '' : `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/* ---------- CSV (RFC 4180 simplificado: aspas, vírgula ou ponto e vírgula) ---------- */
function parseCSV(texto) {
  const limpo = texto.replace(/^﻿/, '');
  const primeira = limpo.split(/\r?\n/)[0] || '';
  const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = []; let campo = ''; let linha = []; let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpo[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
  if (linhas.length < 2) return [];
  const cab = linhas[0].map(semAcento);
  return linhas.slice(1).map((l) => Object.fromEntries(cab.map((k, i) => [k, (l[i] || '').trim()])));
}

function eventosDoCSV(texto) {
  return parseCSV(texto).map((r) => ({
    titulo: r.titulo, descricao: r.descricao, data: normalizarData(r.data),
    horario: normalizarHorario(r.horario), local: r.local, organizador: r.organizador,
    categoria: r.categoria, link: r.link, instituicao: r.instituicao, uid: null,
  }));
}

/* ---------- iCal (.ics) ---------- */
const desescapar = (t) => t.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
function dataHoraICS(valor) {
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return { data: null, horario: '' };
  const [, a, mes, d, h, min, , z] = m;
  if (h === undefined) return { data: `${a}-${mes}-${d}`, horario: '' };
  if (z) { // UTC -> horário de Brasília
    const f = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
      .format(new Date(Date.UTC(+a, +mes - 1, +d, +h, +min)));
    return { data: f.slice(0, 10), horario: f.slice(11, 16) };
  }
  return { data: `${a}-${mes}-${d}`, horario: `${h}:${min}` };
}
function eventosDoICS(texto) {
  const linhas = texto.replace(/\r?\n[ \t]/g, '').split(/\r?\n/); // "unfolding"
  const eventos = []; let atual = null;
  for (const l of linhas) {
    if (l === 'BEGIN:VEVENT') { atual = {}; continue; }
    if (l === 'END:VEVENT') {
      if (atual) {
        const { data, horario } = dataHoraICS(atual.dtstart || '');
        eventos.push({
          titulo: atual.summary, descricao: atual.description, data, horario,
          local: atual.location, organizador: '', categoria: atual.categories, link: atual.url, uid: atual.uid || null,
        });
      }
      atual = null; continue;
    }
    if (!atual) continue;
    const i = l.indexOf(':');
    if (i < 0) continue;
    const chave = l.slice(0, i).split(';')[0].toLowerCase();
    if (['summary', 'description', 'location', 'url', 'uid', 'dtstart', 'categories'].includes(chave)) {
      atual[chave] = chave === 'dtstart' ? l.slice(i + 1).trim() : desescapar(l.slice(i + 1));
    }
  }
  return eventos;
}


/* ---------- datas ISO (JSON / JSON-LD) ---------- */
function dataHoraISO(valor) {
  const t = String(valor || '').trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!m) return { data: null, horario: '' };
  const [, a, mes, d, h, min, fuso] = m;
  if (h === undefined) return { data: `${a}-${mes}-${d}`, horario: '' };
  if (!fuso) return { data: `${a}-${mes}-${d}`, horario: `${h}:${min}` };
  const instante = new Date(t.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  if (Number.isNaN(instante.getTime())) return { data: null, horario: '' };
  const f = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(instante);
  return { data: f.slice(0, 10), horario: f.slice(11, 16) };
}

const semHtml = (t) => (t || '').toString()
  .replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#8211;/g, '–').replace(/&#8217;/g, '’')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

/* ---------- The Events Calendar (WordPress): /wp-json/tribe/events/v1/events ---------- */
function eventosDoTribe(texto) {
  const json = JSON.parse(texto);
  const lista = Array.isArray(json.events) ? json.events : [];
  return lista.map((e) => {
    const { data, horario } = dataHoraISO(e.start_date);
    const local = [].concat(e.venue && !Array.isArray(e.venue) ? e.venue : (e.venue && e.venue[0]) || [])[0] || {};
    const org = [].concat(e.organizer || [])[0] || {};
    return {
      titulo: semHtml(e.title), descricao: semHtml(e.description || e.excerpt), data,
      horario: e.all_day ? '' : horario,
      local: [semHtml(local.venue), semHtml(local.address)].filter(Boolean).join(', '),
      organizador: semHtml(org.organizer), categoria: ((e.categories || [])[0] || {}).name || '',
      link: e.url, uid: e.id ? `tribe-${e.id}` : null,
    };
  });
}

/* ---------- JSON genérico e JSON-LD (schema.org/Event) ---------- */
function deEventoSchema(o) {
  const { data, horario } = dataHoraISO(o.startDate || o.start_date || o.data || o.start);
  const loc = Array.isArray(o.location) ? o.location[0] : o.location;
  const end = loc && typeof loc === 'object' ? (loc.address && typeof loc.address === 'object'
    ? [loc.address.streetAddress, loc.address.addressLocality].filter(Boolean).join(', ') : loc.address) : '';
  const org = Array.isArray(o.organizer) ? o.organizer[0] : o.organizer;
  return {
    titulo: semHtml(o.name || o.title || o.titulo), descricao: semHtml(o.description || o.descricao), data, horario,
    local: typeof loc === 'string' ? loc : [loc && loc.name, end].filter(Boolean).join(', ') || o.local || '',
    organizador: typeof org === 'string' ? org : (org && org.name) || '', categoria: o.categoria || '',
    link: o.url || o.link || '', uid: o['@id'] || o.id || null,
  };
}

function eventosDoJSON(texto, fonte = {}) {
  let json = JSON.parse(texto);
  if (fonte.caminho) json = fonte.caminho.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), json);
  const lista = Array.isArray(json) ? json : (json && (json.events || json.eventos || json.items)) || [];
  return lista.map(deEventoSchema);
}

function eventosDoJSONLD(html) {
  const achados = [];
  const visitar = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visitar); return; }
    const tipo = [].concat(n['@type'] || []).join(' ');
    if (/(^|\s)(\w*Event)(\s|$)/.test(tipo)) achados.push(deEventoSchema(n));
    ['@graph', 'itemListElement', 'item', 'event', 'subEvent'].forEach((k) => visitar(n[k]));
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visitar(JSON.parse(m[1])); } catch { /* bloco inválido: ignora */ }
  }
  return achados;
}

/* ---------- gravação no banco ---------- */
function idCategoria(nome, titulo = '', descricao = '') {
  const todas = db.prepare('SELECT id, nome FROM categoria').all();
  const alvo = semAcento(nome || '');
  const achada = alvo && todas.find((c) => semAcento(c.nome) === alvo);
  if (achada) return achada.id;
  // Categoria ausente ou desconhecida: o UniEvent classifica pelo título e pela descrição.
  const sugerida = classificar(titulo, descricao);
  db.prepare('INSERT OR IGNORE INTO categoria (nome) VALUES (?)').run(sugerida);
  return db.prepare('SELECT id FROM categoria WHERE nome = ?').get(sugerida).id;
}
function idInstituicao(nome) {
  db.prepare('INSERT OR IGNORE INTO instituicao (nome) VALUES (?)').run(nome);
  return db.prepare('SELECT id FROM instituicao WHERE nome = ?').get(nome).id;
}

function hojeISO() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function gravar(fonte, brutos, hoje = hojeISO()) {
  let validos = 0; let ignorados = 0; let passados = 0;
  const vistos = [];
  const tx = db.transaction(() => {
    for (const b of brutos) {
      const titulo = cortar(b.titulo, 200);
      if (!titulo || !b.data) { ignorados++; continue; }
      if (fonte.somente_futuros !== false && b.data < hoje) { passados++; continue; } // agenda mostra só o que ainda vai acontecer
      const uid = b.uid || crypto.createHash('sha1').update(`${titulo}|${b.data}`).digest('hex');
      const dados = {
        titulo, descricao: cortar(b.descricao, 2000), data: b.data, horario: b.horario || '',
        local: cortar(b.local, 200), organizador: cortar(b.organizador, 200), link: linkValido((b.link || '').trim()),
        categoria_id: idCategoria(b.categoria, titulo, b.descricao), instituicao_id: idInstituicao(cortar(b.instituicao, 120) || fonte.instituicao),
        fonte: fonte.chave, uid,
      };
      const existe = db.prepare('SELECT id FROM evento WHERE fonte = ? AND uid_externo = ?').get(fonte.chave, uid);
      if (existe) {
        db.prepare(`UPDATE evento SET titulo=@titulo, descricao=@descricao, data=@data, horario=@horario, local=@local,
          organizador=@organizador, link=@link, categoria_id=@categoria_id, instituicao_id=@instituicao_id WHERE id=@id`)
          .run({ titulo: dados.titulo, descricao: dados.descricao, data: dados.data, horario: dados.horario, local: dados.local,
            organizador: dados.organizador, link: dados.link, categoria_id: dados.categoria_id, instituicao_id: dados.instituicao_id, id: existe.id });
      } else {
        db.prepare(`INSERT INTO evento (titulo, descricao, data, horario, local, organizador, link, categoria_id, instituicao_id, fonte, uid_externo)
          VALUES (@titulo, @descricao, @data, @horario, @local, @organizador, @link, @categoria_id, @instituicao_id, @fonte, @uid)`).run(dados);
      }
      vistos.push(uid); validos++;
    }
    // Eventos que saíram da fonte também saem do site.
    const naFonte = db.prepare('SELECT id, uid_externo FROM evento WHERE fonte = ?').all(fonte.chave);
    const remover = db.prepare('DELETE FROM evento WHERE id = ?');
    naFonte.filter((e) => !vistos.includes(e.uid_externo)).forEach((e) => remover.run(e.id));
    // Dados de demonstração (sem fonte) deixam de aparecer quando há dados reais.
    if (validos > 0) db.prepare('DELETE FROM evento WHERE fonte IS NULL').run();
  });
  tx();
  return { validos, ignorados, passados };
}

/* ---------- sincronização ---------- */
async function baixar(url, fetchFn) {
  const resp = await fetchFn(url, { signal: AbortSignal.timeout(15000), redirect: 'follow', headers: { 'User-Agent': USER_AGENT, Accept: '*/*' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const texto = await resp.text();
  if (texto.length > LIMITE_BYTES) throw new Error('arquivo grande demais');
  return texto;
}

async function lerFonte(fonte, fetchFn, hoje) {
  if (fonte.arquivo) { // arquivo dentro do projeto
    const texto = fs.readFileSync(path.resolve(__dirname, fonte.arquivo), 'utf8');
    return fonte.tipo === 'ics' ? eventosDoICS(texto) : eventosDoCSV(texto);
  }
  if (fonte.tipo === 'tribe') { // API do The Events Calendar, com paginação (até 5 páginas)
    const u = new URL(fonte.url);
    if (!u.searchParams.has('start_date')) u.searchParams.set('start_date', hoje);
    if (!u.searchParams.has('per_page')) u.searchParams.set('per_page', '50');
    let proxima = u.toString(); const todos = [];
    for (let p = 0; proxima && p < 5; p++) {
      const texto = await baixar(proxima, fetchFn);
      todos.push(...eventosDoTribe(texto));
      proxima = linkValido(JSON.parse(texto).next_rest_url || '');
    }
    return todos;
  }
  if (fonte.tipo === 'jsonld') {
    const u = new URL(fonte.url);
    let robots = '';
    try { robots = await baixar(`${u.origin}/robots.txt`, fetchFn); } catch { /* sem robots.txt acessível: segue */ }
    if (!permitido(robots, u.pathname + u.search)) throw new Error('o robots.txt do site não permite a leitura desta página');
    return eventosDoJSONLD(await baixar(fonte.url, fetchFn));
  }
  const texto = await baixar(fonte.url, fetchFn);
  if (fonte.tipo === 'ics') return eventosDoICS(texto);
  if (fonte.tipo === 'json') return eventosDoJSON(texto, fonte);
  return eventosDoCSV(texto);
}

async function sincronizarFonte(fonte, { fetchFn = fetch, hoje = hojeISO() } = {}) {
  try {
    if (!fonte.chave || !fonte.instituicao || !(fonte.arquivo || linkValido(fonte.url))) throw new Error('fonte mal configurada');
    const brutos = await lerFonte(fonte, fetchFn, hoje);
    const r = gravar(fonte, brutos, hoje);
    estado.fontes[fonte.chave] = { instituicao: fonte.instituicao, tipo: fonte.tipo, ok: true, eventos: r.validos, ignorados: r.ignorados, passados: r.passados, em: new Date().toISOString() };
  } catch (e) {
    // Em caso de falha, mantém os eventos já salvos daquela fonte.
    estado.fontes[fonte.chave] = { instituicao: fonte.instituicao, tipo: fonte.tipo, ok: false, erro: e.message, em: new Date().toISOString() };
  }
  estado.ultimaSincronizacao = new Date().toISOString();
  return estado.fontes[fonte.chave];
}

function carregarFontes(arquivo = process.env.FONTES_PATH || path.join(__dirname, 'fontes.json')) {
  if (!fs.existsSync(arquivo)) return [];
  try {
    const lista = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    return Array.isArray(lista) ? lista : [];
  } catch (e) { console.error('fontes.json inválido:', e.message); return []; }
}

async function sincronizarTodas(opcoes) {
  const fontes = carregarFontes();
  for (const f of fontes.filter((x) => x.ativa !== false)) await sincronizarFonte(f, opcoes); // uma falha não afeta as outras
  return estado;
}

function iniciarSincronizacao(minutos = Number(process.env.SYNC_MINUTOS) || 10) {
  if (carregarFontes().length === 0) return null;
  sincronizarTodas().then(() => console.log('Fontes sincronizadas:', JSON.stringify(estado.fontes)));
  const timer = setInterval(() => sincronizarTodas(), minutos * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = { parseCSV, eventosDoCSV, eventosDoICS, eventosDoTribe, eventosDoJSON, eventosDoJSONLD, dataHoraISO, hojeISO, normalizarData, sincronizarFonte, sincronizarTodas, carregarFontes, iniciarSincronizacao, estado };
