import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Ilustracao from '../components/Ilustracao.jsx';
import EventoItem from '../components/EventoItem.jsx';
import { Esqueleto, Erro } from '../components/Estados.jsx';
import { listarEventos, listarCategorias } from '../api.js';
import { hojeISO } from '../format.js';
import { irPara } from '../router.js';

export default function Inicio() {
  const [busca, setBusca] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [proximos, setProximos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    setCarregando(true);
    setErro(false);
    listarEventos({ data: hojeISO() }, controle.signal)
      .then((lista) => setProximos(lista.slice(0, 4)))
      .catch((e) => { if (e.name !== 'AbortError') setErro(true); })
      .finally(() => setCarregando(false));
    return () => controle.abort();
  }, [tentativa]);

  function enviar(e) {
    e.preventDefault();
    const termo = busca.trim();
    irPara(termo ? `/eventos?q=${encodeURIComponent(termo)}` : '/eventos');
  }

  return (
    <>
      <section className="hero" aria-labelledby="hero-titulo">
        <div className="container hero-grade">
          <div className="hero-coluna">
          <h1 id="hero-titulo" className="hero-titulo">O que está acontecendo na sua universidade</h1>
          <p className="hero-texto">
            Palestras, cursos, workshops e atividades culturais reunidos em um só lugar.
            Sem cadastro, sem pagamento.
          </p>

          <form className="hero-busca" role="search" onSubmit={enviar}>
            <label htmlFor="busca-inicio" className="sr-only">Buscar eventos</label>
            <Icon nome="busca" tamanho={22} />
            <input
              id="busca-inicio" type="search" value={busca} autoComplete="off"
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Busque por tema, ex.: Git"
            />
            <button type="submit" className="botao botao-destaque">Buscar eventos</button>
          </form>

          {categorias.length > 0 && (
            <nav className="hero-categorias" aria-label="Explorar por categoria">
              <span className="hero-categorias-rotulo">Explorar por categoria</span>
              <ul>
                {categorias.map((c) => (
                  <li key={c.id}><a href={`#/eventos?categoria=${c.id}`}>{c.nome}</a></li>
                ))}
              </ul>
            </nav>
          )}
          </div>
          <Ilustracao />
        </div>
      </section>

      <section className="container secao" aria-labelledby="proximos-titulo">
        <div className="secao-cabecalho">
          <h2 id="proximos-titulo">Próximos eventos</h2>
          <a className="link-secundario" href="#/eventos">Ver todos os eventos</a>
        </div>

        {carregando && <Esqueleto linhas={4} />}
        {!carregando && erro && <Erro mensagem="Não foi possível carregar os eventos." aoTentarNovamente={() => setTentativa((n) => n + 1)} />}
        {!carregando && !erro && proximos.length === 0 && (
          <div className="aviso">
            <p className="aviso-titulo">Ainda não há eventos futuros cadastrados</p>
            <p>Volte em breve ou veja a lista completa.</p>
          </div>
        )}
        {!carregando && !erro && proximos.length > 0 && (
          <ul className="agenda-lista">
            {proximos.map((e) => <EventoItem key={e.id} evento={e} />)}
          </ul>
        )}
      </section>
    </>
  );
}
