// googleCalendar.js — Funções para interagir com o Google Calendar
const { google } = require("googleapis");
const pool = require("./db");
const { criarOAuthClient } = require("./googleAuth");

// ─── Tokens: salvar no banco após o usuário autorizar ────────
async function salvarTokens(usuarioId, tokens) {
  await pool.query(`
    INSERT INTO google_tokens (usuario_id, access_token, refresh_token, expiry_date, scope, token_type, atualizado_em)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (usuario_id) DO UPDATE SET
      access_token  = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, google_tokens.refresh_token),
      expiry_date   = EXCLUDED.expiry_date,
      scope         = EXCLUDED.scope,
      token_type    = EXCLUDED.token_type,
      atualizado_em = NOW()
  `, [
    usuarioId,
    tokens.access_token,
    tokens.refresh_token || null,
    tokens.expiry_date || null,
    tokens.scope || null,
    tokens.token_type || null,
  ]);
}

// ─── Tokens: buscar no banco ──────────────────────────────────
async function buscarTokens(usuarioId) {
  const resultado = await pool.query(
    "SELECT * FROM google_tokens WHERE usuario_id = $1",
    [usuarioId]
  );
  return resultado.rows[0] || null;
}

// ─── Retorna um cliente OAuth2 autenticado e pronto pra usar ─
// Atualiza o token automaticamente se tiver expirado, e persiste
// o novo access_token no banco.
async function obterClienteAutenticado(usuarioId) {
  const tokensSalvos = await buscarTokens(usuarioId);

  if (!tokensSalvos) {
    return null; // usuário ainda não conectou a conta Google
  }

  const oauth2Client = criarOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokensSalvos.access_token,
    refresh_token: tokensSalvos.refresh_token,
    expiry_date: Number(tokensSalvos.expiry_date),
  });

  // Se o googleapis renovar o token automaticamente, salvamos de volta
  oauth2Client.on("tokens", async (novosTokens) => {
    await salvarTokens(usuarioId, {
      access_token: novosTokens.access_token,
      refresh_token: novosTokens.refresh_token || tokensSalvos.refresh_token,
      expiry_date: novosTokens.expiry_date,
      scope: novosTokens.scope,
      token_type: novosTokens.token_type,
    });
  });

  return oauth2Client;
}

// ─── Lista os próximos eventos da agenda do usuário ───────────
async function listarEventos(usuarioId, maxResultados = 20) {
  const auth = await obterClienteAutenticado(usuarioId);
  if (!auth) throw new Error("USUARIO_SEM_GOOGLE_CONECTADO");

  const calendar = google.calendar({ version: "v3", auth });

  const resposta = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: maxResultados,
    singleEvents: true,
    orderBy: "startTime",
  });

  return resposta.data.items.map((evento) => ({
    id: evento.id,
    titulo: evento.summary || "(Sem título)",
    descricao: evento.description || "",
    inicio: evento.start?.dateTime || evento.start?.date,
    fim: evento.end?.dateTime || evento.end?.date,
    local: evento.location || "",
    participantes: (evento.attendees || []).map((p) => ({
      email: p.email,
      status: p.responseStatus,
    })),
    linkMeet: evento.hangoutLink || null,
    linkEvento: evento.htmlLink,
  }));
}

// ─── Cria um novo evento na agenda do usuário ─────────────────
// dadosEvento = { titulo, descricao, inicio, fim, local, participantes: [emails] }
async function criarEvento(usuarioId, dadosEvento) {
  const auth = await obterClienteAutenticado(usuarioId);
  if (!auth) throw new Error("USUARIO_SEM_GOOGLE_CONECTADO");

  const calendar = google.calendar({ version: "v3", auth });

  const eventoGoogle = {
    summary: dadosEvento.titulo,
    description: dadosEvento.descricao || "",
    location: dadosEvento.local || "",
    start: { dateTime: dadosEvento.inicio, timeZone: "America/Sao_Paulo" },
    end:   { dateTime: dadosEvento.fim,    timeZone: "America/Sao_Paulo" },
    attendees: (dadosEvento.participantes || []).map((email) => ({ email })),
    reminders: { useDefault: true },
  };

  // Se quiser gerar link automático do Google Meet, descomente:
  // eventoGoogle.conferenceData = {
  //   createRequest: { requestId: String(Date.now()) },
  // };

  const resposta = await calendar.events.insert({
    calendarId: "primary",
    resource: eventoGoogle,
    sendUpdates: "all", // envia e-mail de convite pros participantes
    // conferenceDataVersion: 1, // necessário se usar conferenceData acima
  });

  return resposta.data;
}

// ─── Apaga um evento ───────────────────────────────────────────
async function apagarEvento(usuarioId, eventoId) {
  const auth = await obterClienteAutenticado(usuarioId);
  if (!auth) throw new Error("USUARIO_SEM_GOOGLE_CONECTADO");

  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({
    calendarId: "primary",
    eventId: eventoId,
    sendUpdates: "all",
  });
}

module.exports = {
  salvarTokens,
  buscarTokens,
  obterClienteAutenticado,
  listarEventos,
  criarEvento,
  apagarEvento,
};
