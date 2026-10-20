# UniEvent — MVP

Plataforma web para consultar eventos universitários de várias instituições em um só lugar.
React (Vite) + Node.js/Express + SQLite (better-sqlite3).

Projeto da disciplina Projeto de Desenvolvimento II (2026/2), Centro Universitário Senac-RS.

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

## Testes automatizados

```bash
cd backend
npm test
```

São 16 testes: 7 da API (listagem, busca, filtros, detalhe e erros) e 9 da leitura das fontes (CSV, iCal, atualização, remoção e falha de fonte).

## API

| Método | Rota                | Descrição                                                                  |
|--------|---------------------|----------------------------------------------------------------------------|
| GET    | /api/eventos        | Lista eventos. Parâmetros: `q`, `categoria`, `instituicao`, `data`         |
| GET    | /api/eventos/:id    | Detalhes de um evento                                                      |
| GET    | /api/categorias     | Categorias para o filtro                                                   |
| GET    | /api/instituicoes   | Instituições que têm eventos                                               |
| GET    | /api/status         | Resultado da última leitura de cada fonte                                  |

O parâmetro `data` traz os eventos a partir da data informada (AAAA-MM-DD).

## De onde vêm os eventos

Os eventos entram por **fontes**, uma lista em `backend/fontes.json`. Cada fonte pode ser:

- um **arquivo CSV** dentro do projeto (`"arquivo": "eventos.csv"`);
- uma **planilha do Google Sheets publicada como CSV** (`"url": "..."`);
- um **calendário iCal (.ics)** público (`"tipo": "ics"`).

Evento novo na fonte aparece no site, evento alterado é atualizado e evento removido da fonte some. Se uma fonte falhar, os eventos que já estavam salvos continuam e as outras fontes não são afetadas.

Hoje a fonte é o arquivo `backend/eventos.csv`, com 14 eventos reais de Porto Alegre (Senac-RS, UFRGS, Tecnopuc/PUCRS, Faculdade Dom Bosco e comunidade de tecnologia). Os eventos foram coletados em 17/10/2026 a partir da agenda pública do Senac-RS e das listagens do Sympla, e cada um tem o link da divulgação.

O CSV usa estas colunas na primeira linha: `título, descrição, data, horário, local, organizador, categoria, link, instituição`. A data pode ser `AAAA-MM-DD` ou `DD/MM/AAAA` e o horário pode ficar vazio. A coluna `instituição` permite misturar várias instituições na mesma planilha; se ficar vazia, vale a instituição da fonte. Categorias fora de Palestra, Workshop, Curso, Cultural e Esporte viram "Outros".

Para usar uma planilha online ou um calendário no lugar do arquivo, veja o modelo em `backend/fontes.exemplo-online.json`.

## Atenção para quem testar

- Os eventos do `eventos.csv` são reais, mas datas, horários e locais podem mudar. Confirme no link de cada evento.
- Por enquanto o `eventos.csv` eu estou editando à mão. Ainda não configurei uma planilha online nem um calendário de instituição, então novos eventos só entram quando eu atualizar a fonte.
- Se não houver `fontes.json`, a API cria 6 eventos de exemplo (`backend/db.js`).
- A medição formal de responsividade e acessibilidade (Lighthouse) já foi feita.
