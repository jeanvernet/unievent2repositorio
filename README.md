# UniEvent — MVP (código inicial)

Plataforma web para consulta de eventos universitários.
React (Vite) + Node.js/Express + SQLite (better-sqlite3).

## Como rodar

Pré-requisito: Node.js 18+.

```bash
# 1) API (porta 3001)
cd backend
npm install
npm start

# 2) Interface (porta 5173) — em outro terminal
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173.

## Telas

- **Início** (`#/`): busca, atalhos por categoria e próximos eventos.
- **Eventos** (`#/eventos`): busca por texto, filtro por categoria e por data, agenda agrupada por mês. Os filtros ficam na URL e podem ser compartilhados.
- **Detalhes** (`#/eventos/:id`): data, horário, local, organização, descrição e link do evento.

Acessibilidade: link para pular ao conteúdo, foco visível, contraste verificado, anúncio da quantidade de resultados para leitores de tela e respeito a "reduzir movimento".

## Testes automatizados da API

```bash
cd backend
npm test
```

## API

| Método | Rota                | Descrição                                              |
|--------|---------------------|--------------------------------------------------------|
| GET    | /api/eventos        | Lista eventos. Parâmetros: `q`, `categoria`, `data`    |
| GET    | /api/eventos/:id    | Detalhes de um evento                                  |
| GET    | /api/categorias     | Categorias para o filtro                               |

## Atenção para quem testar

- Os 6 eventos iniciais (`backend/db.js`) são **dados de exemplo**. Ainda não implementei um consumo real.
- Quando trocar os eventos de exemplo por eventos reais, apague a frase "Os eventos exibidos nesta versão são de demonstração" no rodapé (`frontend/src/App.jsx`).
- Adicione `.gitignore`, faça o primeiro commit e crie o repositório no GitHub (link vai na capa e na seção 5.1).
