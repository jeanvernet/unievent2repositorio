// Sincronização de eventos a partir de fontes externas (várias instituições).
// Cada fonte é uma planilha publicada como CSV ou um calendário iCal (.ics).
// Sem dependências extras: usa apenas fetch nativo (Node 18+) e crypto.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./db');

const LIMITE_BYTES = 2 * 1024 * 1024;
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

/* ---------- gravação no banco ---------- */
function idCategoria(nome) {
  const alvo = semAcento(nome || '');
  const todas = db.prepare('SELECT id, nome FROM categoria').all();
  const achada = alvo && todas.find((c) => semAcento(c.nome) === alvo);
  if (achada) return achada.id;
  db.prepare("INSERT OR IGNORE INTO categoria (nome) VALUES ('Outros')").run();
  return db.prepare("SELECT id FROM categoria WHERE nome = 'Outros'").get().id;
}
function idInstituicao(nome) {
  db.prepare('INSERT OR IGNORE INTO instituicao (nome) VALUES (?)').run(nome);
  return db.prepare('SELECT id FROM instituicao WHERE nome = ?').get(nome).id;
}

function gravar(fonte, brutos) {
  let validos = 0; let ignorados = 0;
  const vistos = [];
  const tx = db.transaction(() => {
    for (const b of brutos) {
      const titulo = cortar(b.titulo, 200);
      if (!titulo || !b.data) { ignorados++; continue; }
      const uid = b.uid || crypto.createHash('sha1').update(`${titulo}|${b.data}`).digest('hex');
      const dados = {
        titulo, descricao: cortar(b.descricao, 2000), data: b.data, horario: b.horario || '',
        local: cortar(b.local, 200), organizador: cortar(b.organizador, 200), link: linkValido((b.link || '').trim()),
        categoria_id: idCategoria(b.categoria), instituicao_id: idInstituicao(cortar(b.instituicao, 120) || fonte.instituicao),
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
  return { validos, ignorados };
}

/* ---------- sincronização ---------- */
async function baixar(url, fetchFn) {
  const resp = await fetchFn(url, { signal: AbortSignal.timeout(10000), redirect: 'follow' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const texto = await resp.text();
  if (texto.length > LIMITE_BYTES) throw new Error('arquivo grande demais');
  return texto;
}

async function sincronizarFonte(fonte, { fetchFn = fetch } = {}) {
  try {
    if (!fonte.chave || !fonte.instituicao || !(fonte.arquivo || linkValido(fonte.url))) throw new Error('fonte mal configurada');
    const texto = fonte.arquivo
      ? fs.readFileSync(path.resolve(__dirname, fonte.arquivo), 'utf8') // arquivo CSV/ICS dentro do projeto
      : await baixar(fonte.url, fetchFn);
    const brutos = fonte.tipo === 'ics' ? eventosDoICS(texto) : eventosDoCSV(texto);
    const r = gravar(fonte, brutos);
    estado.fontes[fonte.chave] = { instituicao: fonte.instituicao, ok: true, eventos: r.validos, ignorados: r.ignorados, em: new Date().toISOString() };
  } catch (e) {
    // Em caso de falha, mantém os eventos já salvos daquela fonte.
    estado.fontes[fonte.chave] = { instituicao: fonte.instituicao, ok: false, erro: e.message, em: new Date().toISOString() };
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
  for (const f of fontes) await sincronizarFonte(f, opcoes); // uma falha não afeta as outras
  return estado;
}

function iniciarSincronizacao(minutos = Number(process.env.SYNC_MINUTOS) || 10) {
  if (carregarFontes().length === 0) return null;
  sincronizarTodas().then(() => console.log('Fontes sincronizadas:', JSON.stringify(estado.fontes)));
  const timer = setInterval(() => sincronizarTodas(), minutos * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = { parseCSV, eventosDoCSV, eventosDoICS, normalizarData, sincronizarFonte, sincronizarTodas, carregarFontes, iniciarSincronizacao, estado };
