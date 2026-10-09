import Icon from './Icon.jsx';
import { diaSemanaCurto, dia, dataCompleta, horario, rotuloProximidade, slug } from '../format.js';

export function Folha({ data, grande = false }) {
  return (
    <div className={`folha${grande ? ' folha-grande' : ''}`} aria-hidden="true">
      <span className="folha-semana">{diaSemanaCurto(data)}</span>
      <span className="folha-dia">{dia(data)}</span>
    </div>
  );
}

export function Selo({ categoria }) {
  return <span className={`selo selo-${slug(categoria)}`}>{categoria}</span>;
}

export default function EventoItem({ evento }) {
  const proximidade = rotuloProximidade(evento.data);
  return (
    <li>
      <a className="evento" href={`#/eventos/${evento.id}`}>
        <Folha data={evento.data} />
        <div className="evento-corpo">
          <h3 className="evento-titulo">
            {evento.titulo}
            <span className="sr-only">, {dataCompleta(evento.data)}</span>
          </h3>
          <p className="evento-meta">
            <span className="meta-item"><Icon nome="relogio" tamanho={16} />{horario(evento.horario)}</span>
            <span className="meta-item"><Icon nome="local" tamanho={16} />{evento.local || 'Local a definir'}</span>
          </p>
          <p className="evento-rodape">
            <Selo categoria={evento.categoria} />
            {proximidade && <span className="proximidade">{proximidade}</span>}
          </p>
        </div>
        <span className="evento-seta"><Icon nome="seta" tamanho={22} /></span>
      </a>
    </li>
  );
}
