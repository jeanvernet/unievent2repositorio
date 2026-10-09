// Ilustração original (SVG) de uma palestra: palestrante, telão e plateia.
// Feita para o UniEvent; não depende de imagens externas nem de banco de fotos.
const FUNDO_PLATEIA = [20, 95, 170, 245, 320, 395, 470, 545];
const FUNDO_ATRAS = [58, 132, 206, 280, 354, 428, 502];

export default function Ilustracao() {
  return (
    <svg className="hero-arte" viewBox="0 0 520 440" role="img" aria-labelledby="ilustracao-titulo">
      <title id="ilustracao-titulo">
        Ilustração de uma palestra: uma pessoa apresenta ao lado de um telão, com a plateia assistindo
      </title>
      <defs>
        <linearGradient id="feixe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="recorte"><rect width="520" height="440" rx="28" /></clipPath>
      </defs>

      <g clipPath="url(#recorte)">
        <rect width="520" height="440" fill="#1d1d1d" />

        {/* feixes de luz do palco */}
        <polygon points="96,0 146,0 262,300 52,300" fill="url(#feixe)" />
        <polygon points="404,0 454,0 480,300 292,300" fill="url(#feixe)" />

        {/* palco */}
        <rect x="0" y="290" width="520" height="150" fill="#2a2a2a" />
        <rect x="0" y="290" width="520" height="6" fill="#d91e2a" />

        {/* telão */}
        <rect x="124" y="246" width="272" height="6" rx="3" fill="#000" opacity=".4" />
        <rect x="120" y="70" width="280" height="170" rx="10" fill="#ffffff" />
        <path d="M120 80a10 10 0 0 1 10-10h260a10 10 0 0 1 10 10v24H120z" fill="#d91e2a" />
        <circle cx="140" cy="87" r="4" fill="#fff" />
        <circle cx="154" cy="87" r="4" fill="#fff" />
        <circle cx="168" cy="87" r="4" fill="#fff" />
        <rect x="146" y="124" width="150" height="13" rx="6.5" fill="#111" />
        <rect x="146" y="150" width="210" height="8" rx="4" fill="#bdbdbd" />
        <rect x="146" y="168" width="176" height="8" rx="4" fill="#bdbdbd" />
        <rect x="146" y="186" width="124" height="8" rx="4" fill="#bdbdbd" />
        <rect x="146" y="208" width="64" height="18" rx="9" fill="#111" />

        {/* palestrante */}
        <rect x="436" y="292" width="12" height="38" rx="5" fill="#111" />
        <rect x="454" y="292" width="12" height="38" rx="5" fill="#111" />
        <rect x="430" y="224" width="42" height="76" rx="18" fill="#d91e2a" />
        <path d="M434 240L406 214" stroke="#d91e2a" strokeWidth="10" strokeLinecap="round" />
        <circle cx="451" cy="204" r="17" fill="#f1f1f1" />

        {/* cartão de calendário */}
        <rect x="40" y="46" width="104" height="120" rx="14" fill="#000" opacity=".4" />
        <rect x="34" y="40" width="104" height="120" rx="14" fill="#ffffff" />
        <path d="M34 54a14 14 0 0 1 14-14h76a14 14 0 0 1 14 14v18H34z" fill="#d91e2a" />
        <text x="86" y="63" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="inherit">qui</text>
        <text x="86" y="131" textAnchor="middle" fontSize="52" fontWeight="800" fill="#111" fontFamily="inherit">05</text>

        {/* etiqueta */}
        <rect x="318" y="26" width="160" height="32" rx="16" fill="#d91e2a" />
        <text x="398" y="47" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="inherit">Hoje às 19h</text>

        {/* plateia: fileira de trás */}
        {FUNDO_ATRAS.map((x, i) => (
          <g key={`a${x}`}>
            <ellipse cx={x} cy={384} rx="30" ry="26" fill={i === 2 || i === 5 ? '#d91e2a' : '#3d3d3d'} />
            <circle cx={x} cy={338} r="15" fill={i === 2 || i === 5 ? '#d91e2a' : '#3d3d3d'} />
          </g>
        ))}
        {/* plateia: fileira da frente */}
        {FUNDO_PLATEIA.map((x, i) => (
          <g key={`f${x}`}>
            <ellipse cx={x} cy={446} rx="40" ry="34" fill="#0a0a0a" />
            <circle cx={x} cy={392} r="21" fill="#0a0a0a" />
          </g>
        ))}
      </g>
    </svg>
  );
}
