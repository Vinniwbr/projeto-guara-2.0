// authUsuarios.js — Lógica de login: encontra ou cria usuário a partir do perfil Google,
// e gera/valida o token JWT usado pelo frontend.
const jwt = require("jsonwebtoken");
const pool = require("./db");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRA_EM = "7d"; // token válido por 7 dias

// ─── Busca usuário pelo google_id, ou pelo e-mail (caso já exista de outra forma) ─
async function buscarUsuarioPorGoogleOuEmail(googleId, email) {
  const resultado = await pool.query(
    "SELECT * FROM usuarios WHERE google_id = $1 OR email = $2 LIMIT 1",
    [googleId, email]
  );
  return resultado.rows[0] || null;
}

// ─── Cria um novo usuário a partir do perfil do Google ───────
async function criarUsuarioGoogle({ googleId, nome, email, fotoUrl }) {
  // username derivado do e-mail (parte antes do @), garantindo unicidade básica
  const usernameBase = email.split("@")[0];

  const resultado = await pool.query(
    `INSERT INTO usuarios (nome, username, email, foto_url, google_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [nome, usernameBase, email, fotoUrl, googleId]
  );
  return resultado.rows[0];
}

// ─── Vincula google_id a um usuário que já existia (cadastrado antes, sem Google) ─
async function vincularGoogleId(usuarioId, googleId, fotoUrl) {
  const resultado = await pool.query(
    `UPDATE usuarios SET google_id = $1, foto_url = COALESCE($2, foto_url)
     WHERE id = $3 RETURNING *`,
    [googleId, fotoUrl, usuarioId]
  );
  return resultado.rows[0];
}

// ─── Fluxo principal: "login ou cadastro automático" ─────────
async function loginOuCadastroGoogle(perfilGoogle) {
  const { googleId, email, fotoUrl } = perfilGoogle;

  let usuario = await buscarUsuarioPorGoogleOuEmail(googleId, email);

  if (usuario && !usuario.google_id) {
    // Usuário já existia (ex: criado manualmente antes) mas nunca conectou o Google
    usuario = await vincularGoogleId(usuario.id, googleId, fotoUrl);
  } else if (!usuario) {
    // Não existe ainda: cria novo usuário automaticamente
    usuario = await criarUsuarioGoogle(perfilGoogle);
  }

  return usuario;
}

// ─── Gera o JWT que o frontend vai guardar e enviar nas requisições ─
function gerarToken(usuario) {
  return jwt.sign(
    {
      usuarioId: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      papel: usuario.papel || "aluno",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRA_EM }
  );
}

// ─── Middleware Express: protege rotas exigindo um JWT válido ─
function exigirLogin(req, res, next) {
  const cabecalho = req.headers.authorization;
  if (!cabecalho || !cabecalho.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token de autenticação não enviado." });
  }

  const token = cabecalho.split(" ")[1];
  try {
    const dados = jwt.verify(token, JWT_SECRET);
    req.usuario = dados; // disponibiliza { usuarioId, email, nome } nas rotas seguintes
    next();
  } catch (err) {
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

module.exports = {
  loginOuCadastroGoogle,
  gerarToken,
  exigirLogin,
};
