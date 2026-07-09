// googleLogin.js — OAuth2 para LOGIN social (identidade apenas)
// Separado do googleAuth.js (que é usado para a Agenda/Calendar),
// porque aqui só precisamos saber QUEM é a pessoa, não acessar a agenda dela.
const { google } = require("googleapis");


// Escopos mínimos: só identidade (nome, e-mail, foto)
const LOGIN_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function criarOAuthClientLogin() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_LOGIN_REDIRECT_URI // rota de callback dedicada ao login
  );
}

function gerarUrlLogin() {
  const oauth2Client = criarOAuthClientLogin();
  return oauth2Client.generateAuthUrl({
    access_type: "online", // não precisamos de refresh_token aqui, é só leitura de perfil
    scope: LOGIN_SCOPES,
    prompt: "select_account", // sempre permite escolher conta, não força login automático
  });
}

// Troca o "code" do callback pelos dados de perfil do usuário Google
async function buscarPerfilGoogle(code) {
  const oauth2Client = criarOAuthClientLogin();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  return {
    googleId: data.id,
    nome: data.name,
    email: data.email,
    fotoUrl: data.picture,
  };
}

module.exports = {
  gerarUrlLogin,
  buscarPerfilGoogle,
};
