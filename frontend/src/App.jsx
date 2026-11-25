import { useEffect, useRef } from 'react';
import { useRota } from './router.js';
import Inicio from './pages/Inicio.jsx';
import Eventos from './pages/Eventos.jsx';
import Detalhe from './pages/Detalhe.jsx';
import ParaVoce from './pages/ParaVoce.jsx';

const TITULOS = { '/': 'UniEvent', '/eventos': 'Eventos | UniEvent', '/para-voce': 'Para você | UniEvent' };

export default function App() {
  const { caminho, query } = useRota();
  const principal = useRef(null);
  const partes = caminho.split('/').filter(Boolean);
  const emDetalhe = partes[0] === 'eventos' && partes[1];
  const secao = partes[0] === 'eventos' ? 'eventos' : partes[0] === 'para-voce' ? 'para-voce' : 'inicio';

  // A cada troca de página: volta ao topo, atualiza o título e leva o foco ao conteúdo.
  useEffect(() => {
    if (!emDetalhe) document.title = TITULOS[secao === 'eventos' ? '/eventos' : secao === 'para-voce' ? '/para-voce' : '/'];
    window.scrollTo(0, 0);
    principal.current?.focus({ preventScroll: true });
  }, [emDetalhe ? `d${partes[1]}` : secao]); // eslint-disable-line react-hooks/exhaustive-deps

  let pagina;
  if (emDetalhe) pagina = <Detalhe id={partes[1]} />;
  else if (partes[0] === 'eventos') pagina = <Eventos query={query} />;
  else if (partes[0] === 'para-voce') pagina = <ParaVoce />;
  else pagina = <Inicio />;

  return (
    <>
      <a className="pular" href="#conteudo" onClick={(e) => { e.preventDefault(); principal.current?.focus(); }}>
        Pular para o conteúdo
      </a>

      <header className={`topo${secao === 'inicio' && !emDetalhe ? ' topo-escuro' : ''}`}>
        <div className="container topo-conteudo">
          <a className="marca" href="#/" aria-label="UniEvent, página inicial">
            <span className="marca-ponto" aria-hidden="true" />UniEvent
          </a>
          <nav aria-label="Principal">
            <ul className="menu">
              <li><a href="#/" aria-current={secao === 'inicio' && !emDetalhe ? 'page' : undefined}>Início</a></li>
              <li><a href="#/eventos" aria-current={secao === 'eventos' ? 'page' : undefined}>Eventos</a></li>
              <li><a href="#/para-voce" aria-current={secao === 'para-voce' ? 'page' : undefined}>Para você</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="conteudo" ref={principal} tabIndex={-1}>{pagina}</main>

      <footer className="rodape">
        <div className="container">
          <p>UniEvent é um projeto acadêmico de extensão do Centro Universitário Senac-RS.</p>
          <p>Datas e locais podem mudar. Confirme sempre com o organizador do evento.</p>
        </div>
      </footer>
    </>
  );
}
