import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Folha, Selo } from '../components/EventoItem.jsx';
import { obterEvento } from '../api.js';
import { dataCompleta, horario, rotuloProximidade } from '../format.js';

export default function Detalhe({ id }) {
  const [evento, setEvento] = useState(null);
  const [estado, setEstado] = useState('carregando'); // carregando | ok | naoEncontrado | erro
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setEstado('carregando');
    obterEvento(id)
      .then((e) => { if (ativo) { setEvento(e); setEstado('ok'); document.title = `${e.titulo} | UniEvent`; } })
      .catch((e) => { if (ativo) setEstado(e.status === 404 ? 'naoEncontrado' : 'erro'); });
    return () => { ativo = false; };
  }, [id, tentativa]);

  return (
    <div className="container secao detalhe">
      <a className="voltar" href="#/eventos"><Icon nome="voltar" tamanho={18} />Voltar aos eventos</a>

      {estado === 'carregando' && <p className="carregando" role="status">Carregando evento...</p>}

      {estado === 'naoEncontrado' && (
        <div className="aviso">
          <p className="aviso-titulo">Evento não encontrado</p>
          <p>Ele pode ter sido removido. Veja a lista completa para encontrar outro evento.</p>
          <a className="botao" href="#/eventos">Ver todos os eventos</a>
        </div>
      )}

      {estado === 'erro' && (
        <div className="aviso aviso-erro" role="alert">
          <p className="aviso-titulo">Não foi possível carregar o evento.</p>
          <p>Confira se a API está rodando em http://localhost:3001 e tente de novo.</p>
          <button type="button" className="botao" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</button>
        </div>
      )}

      {estado === 'ok' && evento && (
        <article className="detalhe-corpo">
          <header className="detalhe-cabecalho">
            <Folha data={evento.data} grande />
            <div>
              <Selo categoria={evento.categoria} />
              <h1 className="detalhe-titulo">{evento.titulo}</h1>
              {rotuloProximidade(evento.data) && <p className="proximidade">{rotuloProximidade(evento.data)}</p>}
            </div>
          </header>

          <dl className="fatos">
            <div className="fato">
              <dt><Icon nome="calendario" />Data</dt>
              <dd>{dataCompleta(evento.data)}</dd>
            </div>
            <div className="fato">
              <dt><Icon nome="relogio" />Horário</dt>
              <dd>{horario(evento.horario)}</dd>
            </div>
            <div className="fato">
              <dt><Icon nome="local" />Local</dt>
              <dd>{evento.local || 'A definir'}</dd>
            </div>
            {evento.organizador && (
              <div className="fato">
                <dt><Icon nome="organizador" />Organização</dt>
                <dd>{evento.organizador}</dd>
              </div>
            )}
          </dl>

          {evento.descricao && (
            <section className="detalhe-descricao" aria-labelledby="sobre-titulo">
              <h2 id="sobre-titulo">Sobre o evento</h2>
              <p>{evento.descricao}</p>
            </section>
          )}

          {evento.link && (
            <a className="botao botao-destaque" href={evento.link} target="_blank" rel="noopener noreferrer">
              <Icon nome="link" />Ver página do evento
            </a>
          )}
        </article>
      )}
    </div>
  );
}
