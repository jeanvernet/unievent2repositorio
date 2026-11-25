// Testa as fontes de fontes.json agora, sem subir o servidor: npm run coletar
// Mostra, para cada fonte, se respondeu, quantos eventos futuros entraram e o motivo de qualquer erro.
const { db, seed } = require('./db');
const { carregarFontes, sincronizarTodas, estado } = require('./sync');

(async () => {
  const fontes = carregarFontes();
  if (fontes.length === 0) { console.log('Nenhuma fonte em fontes.json.'); return; }
  seed();
  await sincronizarTodas();
  console.log('\nResultado por fonte:\n');
  for (const f of fontes) {
    const s = estado.fontes[f.chave];
    if (f.ativa === false) { console.log(`- ${f.chave} (${f.instituicao}): DESLIGADA no fontes.json`); continue; }
    if (!s) { console.log(`- ${f.chave}: não executou`); continue; }
    console.log(s.ok
      ? `- ${f.chave} (${f.instituicao}, ${f.tipo}): OK — ${s.eventos} evento(s) futuro(s), ${s.passados} já passaram, ${s.ignorados} ignorado(s)`
      : `- ${f.chave} (${f.instituicao}, ${f.tipo}): ERRO — ${s.erro}`);
  }
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM evento').get();
  console.log(`\nTotal de eventos no banco agora: ${total}`);
  const porInst = db.prepare(`SELECT COALESCE(i.nome,'(sem instituição)') AS nome, COUNT(*) AS n FROM evento e
    LEFT JOIN instituicao i ON i.id = e.instituicao_id GROUP BY nome ORDER BY n DESC`).all();
  porInst.forEach((r) => console.log(`  ${r.nome}: ${r.n}`));
})();
