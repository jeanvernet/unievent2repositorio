import { useEffect, useState } from 'react';
import EventoItem from '../components/EventoItem.jsx';
import { Esqueleto, Erro } from '../components/Estados.jsx';
import { listarCategorias, listarInstituicoes, listarRecomendacoes } from '../api.js';
import { lerInteresses, salvarInteresses, semInteresses } from '../interesses.js';

const alternar = (lista, valor) => (lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);

export default function ParaVoce() {
  const [interesses, setInteresses] = useState(lerInteresses);
  const [categorias, setCategorias] = useState([]);
  const [instituicoes, setInstituicoes] = useState([]);
  const [palavra, setPalavra] = useState('');
  const [recomendados, setRecomendados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
    listarInstituicoes().then(setInstituicoes).catch(() => {});
  }, []);

  useEffect(() => {
    salvarInteresses(interesses);
    if (semInteresses(interesses)) { setRecomendados([]); setCarregando(false); setErro(false); return undefined; }
    const controle = new AbortController();
    setCarregando(true); setErro(false);
    listarRecomendacoes(interesses, controle.signal)
      .then(setRecomendados)
      .catch((e) => { if (e.name !== 'AbortError') setErro(true); })
      .finally(() => { if (!controle.signal.aborted) setCarregando(false); });
    return () => controle.abort();
  }, [interesses, tentativa]);

  function adicionarPalavra(e) {
    e.preventDefault();
    const termo = palavra.trim().slice(0, 30);
    if (termo && !interesses.palavras.some((p) => p.toLowerCase() === termo.toLowerCase()) && interesses.palavras.length < 10) {
      setInteresses({ ...interesses, palavras: [...interesses.palavras, termo] });
    }
    setPalavra('');
  }

  return (
    <div className="container secao">
      <h1 className="pagina-titulo">Para você</h1>
      <p className="pagina-texto">
        Escolha seus interesses e o UniEvent destaca os eventos que combinam com eles, explicando o motivo de cada sugestão.
        Seus interesses ficam salvos só neste navegador: não pedimos cadastro nem guardamos nada no servidor.
      </p>

      <div className="filtros interesses" role="group" aria-label="Seus interesses">
        <fieldset className="chips">
          <legend>Categorias</legend>
          <div className="chips-lista">
            {categorias.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={interesses.categorias.includes(c.id)}
                onClick={() => setInteresses({ ...interesses, categorias: alternar(interesses.categorias, c.id) })}>{c.nome}</button>
            ))}
          </div>
        </fieldset>

        {instituicoes.length > 1 && (
          <fieldset className="chips">
            <legend>Instituições</legend>
            <div className="chips-lista">
              {instituicoes.map((i) => (
                <button key={i.id} type="button" className="chip" aria-pressed={interesses.instituicoes.includes(i.id)}
                  onClick={() => setInteresses({ ...interesses, instituicoes: alternar(interesses.instituicoes, i.id) })}>{i.nome}</button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="chips">
          <form onSubmit={adicionarPalavra} className="palavra-form">
            <div className="campo">
              <label htmlFor="f-palavra">Temas que você procura (ex.: git, python, IA)</label>
              <div className="campo-entrada">
                <input id="f-palavra" type="text" value={palavra} maxLength={30} autoComplete="off"
                  onChange={(e) => setPalavra(e.target.value)} placeholder="Digite um tema e pressione Enter" />
              </div>
            </div>
            <button type="submit" className="botao botao-secundario">Adicionar tema</button>
          </form>
          {interesses.palavras.length > 0 && (
            <ul className="chips-lista palavras" aria-label="Temas escolhidos">
              {interesses.palavras.map((p) => (
                <li key={p}>
                  <button type="button" className="chip" aria-label={`Remover o tema ${p}`}
                    onClick={() => setInteresses({ ...interesses, palavras: interesses.palavras.filter((x) => x !== p) })}>{p} ×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="resultado-barra">
        <p className="resultado-contagem" role="status" aria-live="polite">
          {semInteresses(interesses) ? '' : carregando ? 'Buscando sugestões...' : erro ? '' :
            `${recomendados.length} ${recomendados.length === 1 ? 'sugestão' : 'sugestões'}`}
        </p>
        {!semInteresses(interesses) && (
          <button type="button" className="link-botao"
            onClick={() => setInteresses({ categorias: [], instituicoes: [], palavras: [] })}>Limpar interesses</button>
        )}
      </div>

      {semInteresses(interesses) && (
        <div className="aviso"><p className="aviso-titulo">Escolha ao menos um interesse</p>
          <p>Marque uma categoria ou adicione um tema para ver as sugestões.</p></div>
      )}
      {carregando && <Esqueleto linhas={3} />}
      {!carregando && erro && <Erro mensagem="Não foi possível carregar as sugestões." aoTentarNovamente={() => setTentativa((n) => n + 1)} />}
      {!carregando && !erro && !semInteresses(interesses) && recomendados.length === 0 && (
        <div className="aviso"><p className="aviso-titulo">Nada combina com seus interesses por enquanto</p>
          <p>Tente outro tema ou veja a <a href="#/eventos">lista completa de eventos</a>.</p></div>
      )}
      {!carregando && !erro && recomendados.length > 0 && (
        <ul className="agenda-lista">
          {recomendados.map((e) => <EventoItem key={e.id} evento={e} motivos={e.motivos} />)}
        </ul>
      )}
    </div>
  );
}
