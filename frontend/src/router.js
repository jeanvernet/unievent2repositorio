import { useEffect, useState } from 'react';

function ler() {
  const bruto = window.location.hash.replace(/^#/, '') || '/';
  const [caminho, qs = ''] = bruto.split('?');
  return { caminho, query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function useRota() {
  const [rota, setRota] = useState(ler);
  useEffect(() => {
    const aoMudar = () => setRota(ler());
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);
  return rota;
}

export function irPara(destino) {
  window.location.hash = destino;
}

// Atualiza a URL sem criar nova entrada no histórico (usado pelos filtros).
export function atualizarFiltrosNaUrl(filtros) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
  const texto = params.toString();
  window.history.replaceState(null, '', `#/eventos${texto ? `?${texto}` : ''}`);
}
