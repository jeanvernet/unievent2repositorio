const app = require('./app');
const { iniciarSincronizacao } = require('./sync');
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`UniEvent API em http://localhost:${PORT}`);
  iniciarSincronizacao(); // lê as fontes de fontes.json (se existir) e repete a cada SYNC_MINUTOS
});
