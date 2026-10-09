import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import EventoItem from '../components/EventoItem.jsx';
import { Esqueleto, Erro, Vazio } from '../components/Estados.jsx';
import { listarEventos, listarCategorias } from '../api.js';
import { agruparPorMes } from '../format.js';
import { atualizarFiltrosNaUrl } from '../router.js';

export default function Eventos({ query }) {
  const [q, setQ] = useState(query.q || '');
  const [categoria, setCategoria] = useState(query.categoria || '');
  const [data, setData] = useState(query.data || '');
  const [categorias, setCategorias] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const primeira = useRef(true);

  // Se a URL mudar (ex.: clique numa categoria da página inicial), sincroniza os filtros.
  useEffect(() => {
    setQ(query.q || '');
    setCategoria(query.categoria || '');
    setData(query.data || '');
  }, [query.q, query.categoria, query.data]);

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    setCarregando(true);
    setErro(false);
    const espera = primeira.current ? 0 : 250; // evita uma chamada a cada tecla
    primeira.current = false;
    const t = setTimeout(() => {
      listarEventos({ q: q.trim(), categoria, data }, controle.signal)
        .then((lista) => { setEventos(lista); atualizarFiltrosNaUrl({ q: q.trim(), categoria, data }); })
        .catch((e) => { if (e.name !== 'AbortError') setErro(true); })
        .finally(() => { if (!controle.signal.aborted) setCarregando(false); });
    }, espera);
    return () => { clearTimeout(t); controle.abort(); };
  }, [q, categoria, data, tentativa]);

  const filtrosAtivos = Boolean(q || categoria || data);
  const limpar = () => { setQ(''); setCategoria(''); setData(''); };
  const grupos = agruparPorMes(eventos);
  const total = eventos.length;

  return (
    <div className="container secao">
      <h1 className="pagina-titulo">Eventos</h1>

      <form className="filtros" role="search" onSubmit={(e) => e.preventDefault()} aria-label="Buscar e filtrar eventos">
        <div className="campo campo-busca">
          <label htmlFor="f-busca">Buscar</label>
          <div className="campo-entrada">
            <Icon nome="busca" tamanho={20} />
            <input id="f-busca" type="search" value={q} autoComplete="off"
              onChange={(e) => setQ(e.target.value)} placeholder="Título ou descrição do evento" />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="f-data">A partir de</label>
          <div className="campo-entrada">
            <Icon nome="calendario" tamanho={20} />
            <input id="f-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        <fieldset className="chips">
          <legend>Categoria</legend>
          <div className="chips-lista">
            <button type="button" className="chip" aria-pressed={categoria === ''} onClick={() => setCategoria('')}>Todas</button>
            {categorias.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={String(categoria) === String(c.id)}
                onClick={() => setCategoria(String(categoria) === String(c.id) ? '' : String(c.id))}>
                {c.nome}
              </button>
            ))}
          </div>
        </fieldset>
      </form>

      <div className="resultado-barra">
        <p className="resultado-contagem" role="status" aria-live="polite">
          {carregando ? 'Buscando eventos...' : erro ? '' : `${total} ${total === 1 ? 'evento encontrado' : 'eventos encontrados'}`}
        </p>
        {filtrosAtivos && <button type="button" className="link-botao" onClick={limpar}>Limpar filtros</button>}
      </div>

      {carregando && <Esqueleto linhas={4} />}
      {!carregando && erro && <Erro mensagem="Não foi possível carregar os eventos." aoTentarNovamente={() => setTentativa((n) => n + 1)} />}
      {!carregando && !erro && total === 0 && <Vazio aoLimpar={filtrosAtivos ? limpar : undefined} />}
      {!carregando && !erro && grupos.map((g) => (
        <section key={g.chave} className="agenda-mes" aria-labelledby={`mes-${g.chave}`}>
          <h2 id={`mes-${g.chave}`} className="agenda-mes-titulo">{g.titulo}</h2>
          <ul className="agenda-lista">
            {g.eventos.map((e) => <EventoItem key={e.id} evento={e} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
