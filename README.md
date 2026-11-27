# UniEvent — MVP

Plataforma web para consultar eventos universitários de várias instituições em um só lugar.
React (Vite) + Node.js/Express + SQLite (better-sqlite3).

Projeto da disciplina Projeto de Desenvolvimento II (2026/2), Centro Universitário Senac-RS.

Autor: Jean-Philippe Vernet. Orientador: Prof. Dr. Roberto Zanoni. A versão entregue para avaliação é a tag `v1.0` (commit `9d853f9`).

## Como rodar

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

Ao iniciar, a API lê os eventos das fontes configuradas em `backend/fontes.json` e confere de novo a cada 10 minutos. Para ver se a leitura deu certo, abra http://localhost:3001/api/status.

## Telas

- **Início** (`#/`): busca, atalhos por categoria e próximos eventos.
- **Eventos** (`#/eventos`): busca por texto, filtros por categoria, instituição e data, e agenda agrupada por mês. Os filtros ficam na URL e podem ser compartilhados.
- **Detalhes** (`#/eventos/:id`): data, horário, local, instituição, organização, descrição e link do evento.
- **Para você** (`#/para-voce`): a pessoa escolhe categorias, instituições e temas (ex.: git, python) e vê os eventos futuros que combinam, com o motivo de cada sugestão. Os interesses ficam salvos só no navegador (localStorage); não há cadastro e o servidor não guarda nada.

## Testes automatizados

```bash
cd backend
npm test
```

São 35 testes: 7 da API (listagem, busca, filtros, detalhe e erros), 9 da leitura das fontes (CSV, iCal, atualização, remoção e falha de fonte) e 19 da coleta automática e das recomendações (categorização, robots.txt, API do The Events Calendar, JSON-LD, JSON, filtro de eventos passados e pontuação das recomendações). Os testes de formato usam exemplos sintéticos, não dados de instituições reais.

## API

| Método | Rota                | Descrição                                                                  |
|--------|---------------------|----------------------------------------------------------------------------|
| GET    | /api/eventos        | Lista eventos. Parâmetros: `q`, `categoria`, `instituicao`, `data`         |
| GET    | /api/eventos/:id    | Detalhes de um evento                                                      |
| GET    | /api/categorias     | Categorias para o filtro                                                   |
| GET    | /api/instituicoes   | Instituições que têm eventos                                               |
| GET    | /api/recomendacoes  | Eventos futuros que combinam com interesses. Parâmetros: `categorias`, `instituicoes` (ids separados por vírgula), `palavras`, `limite` |
| GET    | /api/status         | Resultado da última leitura de cada fonte                                  |

O parâmetro `data` traz os eventos a partir da data informada (AAAA-MM-DD).

## De onde vêm os eventos

Os eventos entram sozinhos, por **fontes** listadas em `backend/fontes.json`. A API lê todas ao iniciar e de novo a cada 10 minutos, sem ninguém digitar eventos. Os tipos de fonte aceitos são:

| tipo       | o que lê                                                                                         |
|------------|--------------------------------------------------------------------------------------------------|
| `ics`      | calendário iCal público                                                                          |
| `tribe`    | API REST do plugin The Events Calendar (`/wp-json/tribe/events/v1/events`), comum em sites WordPress de universidades |
| `json`     | lista de eventos em JSON (`caminho` opcional indica onde está a lista)                           |
| `jsonld`   | página HTML com marcação schema.org/Event; só é lida se o `robots.txt` do site permitir          |
| `csv`      | planilha publicada como CSV (por exemplo, a resposta de um Google Forms de organizadores) ou arquivo do projeto |

Regras do coletor: só entram eventos que ainda vão acontecer; evento novo na fonte aparece, alterado é atualizado e removido some; se uma fonte falhar, os eventos já salvos dela continuam e as outras não são afetadas; links que não sejam http/https são descartados; a API se identifica como `UniEventBot` e usa só informações públicas dos eventos, sem dados pessoais.

**Categoria automática.** Quando a fonte não informa categoria, ou informa uma que o UniEvent não conhece, a categoria é definida por palavras-chave no título e na descrição (`backend/categorizar.js`). Por exemplo, "Oficina…" vira Workshop e "Defesa de Dissertação…" vira Palestra. Sem pistas, vira Outros.

**Conferir as fontes.** Rode `npm run coletar` na pasta `backend`: o comando lê cada fonte e mostra se respondeu, quantos eventos futuros entraram e o motivo de qualquer erro. Depois do `npm start`, o mesmo resultado fica em http://localhost:3001/api/status.

As fontes configuradas hoje em `fontes.json` são calendários públicos da UFRGS (Instituto de Informática, Bibliotecas e Pós-Graduação). Para incluir outra instituição, basta acrescentar uma linha com `chave`, `instituicao`, `tipo` e `url`; o modelo está em `backend/fontes.exemplo-online.json`. Uma fonte pode ser desligada com `"ativa": false`. O arquivo `eventos.csv` (eventos de Porto Alegre que reuni à mão em 17/10 e 23/11/2026, cada um com o link de origem) é uma contingência: continua ligado, mas só entram os eventos que ainda vão acontecer.

O CSV usa estas colunas na primeira linha: `título, descrição, data, horário, local, organizador, categoria, link, instituição`. A data pode ser `AAAA-MM-DD` ou `DD/MM/AAAA` e o horário pode ficar vazio.

## Recomendações ("Para você")

A recomendação é feita por regras simples e explicáveis, sem modelo de IA (`backend/recomendar.js`): categoria escolhida +3, instituição escolhida +2, tema no título +2, tema na descrição +1 e +1 se o evento acontece nos próximos 7 dias (a proximidade só desempata: não traz evento sem relação com os interesses). Só entram eventos futuros com pontuação maior que zero, e cada sugestão mostra os motivos.

## Atenção para quem testar

- Datas, horários e locais vêm das fontes e podem mudar. Confirme no link do evento.
- Quais eventos aparecem depende do que as fontes publicam no dia; se uma fonte não tiver eventos futuros, ela aparece com 0 eventos em `/api/status`.
- Se não houver `fontes.json`, a API cria 6 eventos de exemplo (`backend/db.js`).
- Medi o Lighthouse duas vezes: em modo de desenvolvimento (20/10/2026) e na versão de produção, com `npm run build` e `npm run preview` (25/11/2026), que deu 100 de desempenho e 100 de acessibilidade, no celular e no computador.
