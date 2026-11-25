// Verificação simplificada de robots.txt (User-agent: *). Fontes HTML só são lidas se o site permitir.
function permitido(textoRobots, caminho) {
  let aplica = false; let anterior = '';
  const regras = [];
  for (const bruta of (textoRobots || '').split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    const i = linha.indexOf(':');
    if (i < 0) continue;
    const chave = linha.slice(0, i).trim().toLowerCase();
    const valor = linha.slice(i + 1).trim();
    if (chave === 'user-agent') {
      aplica = anterior === 'user-agent' ? aplica || valor === '*' : valor === '*';
    } else if ((chave === 'disallow' || chave === 'allow') && aplica) {
      if (valor) regras.push({ permite: chave === 'allow', prefixo: valor });
    }
    anterior = chave;
  }
  // A regra mais específica (prefixo mais longo) vence; empate favorece "allow".
  const casam = regras.filter((r) => caminho.startsWith(r.prefixo));
  if (casam.length === 0) return true;
  casam.sort((a, b) => b.prefixo.length - a.prefixo.length || (b.permite ? 1 : -1));
  return casam[0].permite;
}

module.exports = { permitido };
