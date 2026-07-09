// googleAuth.js — Configuração do cliente OAuth2 do Google Calendar
const { google } = require("googleapis");


// Escopo: acesso completo à agenda (criar, editar, listar, deletar eventos)
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

function criarOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Gera a URL de consentimento para redirecionar o usuário
function gerarUrlAutenticacao(usuarioId) {
  const oauth2Client = criarOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",   // necessário para receber refresh_token
    scope: SCOPES,
    prompt: "consent",        // força mostrar a tela de consentimento (garante refresh_token)
    state: String(usuarioId), // usamos pra saber de qual usuário é o callback
  });
}

module.exports = {
  criarOAuthClient,
  gerarUrlAutenticacao,
  SCOPES,
};
