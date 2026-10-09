// Datas chegam da API como "AAAA-MM-DD". Montamos a data localmente para
// evitar o deslocamento de fuso horário que acontece com new Date('AAAA-MM-DD').
export function paraData(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function hojeISO() {
  const h = new Date();
  const mm = String(h.getMonth() + 1).padStart(2, '0');
  const dd = String(h.getDate()).padStart(2, '0');
  return `${h.getFullYear()}-${mm}-${dd}`;
}

export function diaSemanaCurto(iso) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(paraData(iso)).replace('.', '');
}

export function dia(iso) {
  return String(paraData(iso).getDate()).padStart(2, '0');
}

export function mesAno(iso) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(paraData(iso));
}

export function dataCompleta(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(paraData(iso));
}

export function horario(h) {
  if (!h) return 'Horário a definir';
  const [hh, mm] = h.split(':');
  return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`;
}

export function rotuloProximidade(iso) {
  const dias = Math.round((paraData(iso) - paraData(hojeISO())) / 86400000);
  if (dias < 0) return 'Já aconteceu';
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  if (dias <= 7) return `Em ${dias} dias`;
  return '';
}

export function slug(texto = '') {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function agruparPorMes(eventos) {
  const grupos = [];
  eventos.forEach((e) => {
    const chave = e.data.slice(0, 7);
    let g = grupos[grupos.length - 1];
    if (!g || g.chave !== chave) {
      g = { chave, titulo: mesAno(e.data), eventos: [] };
      grupos.push(g);
    }
    g.eventos.push(e);
  });
  return grupos;
}
