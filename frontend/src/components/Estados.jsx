export function Esqueleto({ linhas = 4 }) {
  return (
    <ul className="agenda-lista" aria-hidden="true">
      {Array.from({ length: linhas }).map((_, i) => (
        <li key={i} className="esqueleto">
          <div className="esqueleto-folha" />
          <div className="esqueleto-texto">
            <span style={{ width: '60%' }} />
            <span style={{ width: '40%' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Erro({ mensagem, aoTentarNovamente }) {
  return (
    <div className="aviso aviso-erro" role="alert">
      <p className="aviso-titulo">{mensagem}</p>
      <p>Confira se a API está rodando em http://localhost:3001 e tente de novo.</p>
      {aoTentarNovamente && (
        <button type="button" className="botao" onClick={aoTentarNovamente}>Tentar novamente</button>
      )}
    </div>
  );
}

export function Vazio({ aoLimpar }) {
  return (
    <div className="aviso">
      <p className="aviso-titulo">Nenhum evento encontrado</p>
      <p>Tente outra palavra, escolha outra categoria ou amplie o período.</p>
      {aoLimpar && (
        <button type="button" className="botao botao-secundario" onClick={aoLimpar}>Limpar filtros</button>
      )}
    </div>
  );
}
