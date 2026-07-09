// ============================================================
// server.js — API REST do Projeto Guará
// ============================================================

const express = require("express");
const cors = require("cors");
const turmasService = require("./turmas");
const http = require("http");
const { inicializarSocket, notificarNovaMensagem } = require("./socket");
const { gerarUrlLogin, buscarPerfilGoogle } = require("./googleLogin");
const {
	loginOuCadastroGoogle,
	gerarToken,
	exigirLogin,
} = require("./authUsuarios");
const jwt = require("jsonwebtoken");

if (process.env.NODE_ENV !== "production") {
	require("dotenv").config();
}

const pool = require("./db");
const { gerarUrlAutenticacao, criarOAuthClient } = require("./googleAuth");
const googleCalendar = require("./googleCalendar");
const app = express();
const servidorHttp = http.createServer(app);
const io = inicializarSocket(servidorHttp);
const PORT = process.env.PORT || 3000;

// ─── Middlewares ─────────────────────────────────────────────

app.use(express.static("public"));
app.use(cors());
app.use(express.json());

// ─── Utilitário: resposta de erro padronizada ────────────────

function erroServidor(res, err, msg = "Erro interno do servidor") {
	console.error(msg, err.message);
	return res.status(500).json({ erro: msg });
}

// ============================================================
// ROTAS — USUÁRIOS
// ============================================================

// GET /usuarios/me — retorna os dados do usuário logado (JWT)
// IMPORTANTE: deve ficar ANTES de /usuarios/:id
app.get("/usuarios/me", exigirLogin, async (req, res) => {
	try {
		const resultado = await pool.query(
			"SELECT id, nome, username, email, foto_url FROM usuarios WHERE id = $1",
			[req.usuario.usuarioId],
		);
		if (resultado.rows.length === 0) {
			return res.status(404).json({ erro: "Usuário não encontrado." });
		}
		res.json(resultado.rows[0]);
	} catch (err) {
		erroServidor(res, err, "Erro ao buscar usuário logado");
	}
});

// POST /usuarios — Cria um novo usuário
app.post("/usuarios", async (req, res) => {
	const { nome, username, email, foto_url } = req.body;
	if (!nome || !username || !email) {
		return res
			.status(400)
			.json({ erro: "nome, username e email são obrigatórios." });
	}
	try {
		const resultado = await pool.query(
			`INSERT INTO usuarios (nome, username, email, foto_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
			[nome, username, email, foto_url || null],
		);
		res.status(201).json(resultado.rows[0]);
	} catch (err) {
		if (err.code === "23505") {
			return res
				.status(409)
				.json({ erro: "Username ou e-mail já cadastrado." });
		}
		erroServidor(res, err, "Erro ao criar usuário");
	}
});

// GET /usuarios/:id — Busca um usuário por ID
app.get("/usuarios/:id", async (req, res) => {
	try {
		const resultado = await pool.query(
			"SELECT id, nome, username, email, foto_url, criado_em FROM usuarios WHERE id = $1",
			[req.params.id],
		);
		if (resultado.rows.length === 0) {
			return res.status(404).json({ erro: "Usuário não encontrado." });
		}
		res.json(resultado.rows[0]);
	} catch (err) {
		erroServidor(res, err, "Erro ao buscar usuário");
	}
});

// ============================================================
// ROTAS — CHATS
// ============================================================

app.get("/chats", async (req, res) => {
	try {
		const resultado = await pool.query(`
      SELECT c.id, c.nome, c.tipo, c.criado_em,
             COUNT(cm.usuario_id) AS total_membros
      FROM chats c
      LEFT JOIN chat_membros cm ON cm.chat_id = c.id
      GROUP BY c.id
      ORDER BY c.criado_em ASC
    `);
		res.json(resultado.rows);
	} catch (err) {
		erroServidor(res, err, "Erro ao listar chats");
	}
});

app.get("/chats/:id", async (req, res) => {
	try {
		const resultado = await pool.query("SELECT * FROM chats WHERE id = $1", [
			req.params.id,
		]);
		if (resultado.rows.length === 0) {
			return res.status(404).json({ erro: "Chat não encontrado." });
		}
		res.json(resultado.rows[0]);
	} catch (err) {
		erroServidor(res, err, "Erro ao buscar chat");
	}
});

// ============================================================
// ROTAS — MENSAGENS
// ============================================================

app.get("/chats/:id/mensagens", async (req, res) => {
	const limite = parseInt(req.query.limite) || 50;
	try {
		const resultado = await pool.query(
			`
      SELECT m.id, m.texto, m.criado_em,
             u.id AS usuario_id, u.nome AS autor, u.username, u.foto_url
      FROM mensagens m
      JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.chat_id = $1
      ORDER BY m.criado_em ASC
      LIMIT $2
    `,
			[req.params.id, limite],
		);
		res.json(resultado.rows);
	} catch (err) {
		erroServidor(res, err, "Erro ao buscar mensagens");
	}
});

app.post("/chats/:id/mensagens", async (req, res) => {
	const { usuario_id, texto } = req.body;
	if (!usuario_id || !texto) {
		return res
			.status(400)
			.json({ erro: "usuario_id e texto são obrigatórios." });
	}
	if (texto.trim().length === 0) {
		return res.status(400).json({ erro: "Mensagem não pode ser vazia." });
	}
	try {
		const chat = await pool.query("SELECT id FROM chats WHERE id = $1", [
			req.params.id,
		]);
		if (chat.rows.length === 0) {
			return res.status(404).json({ erro: "Chat não encontrado." });
		}
		const nova = await pool.query(
			`
      INSERT INTO mensagens (chat_id, usuario_id, texto)
      VALUES ($1, $2, $3) RETURNING *
    `,
			[req.params.id, usuario_id, texto.trim()],
		);

		const completa = await pool.query(
			`
      SELECT m.id, m.texto, m.criado_em,
             u.id AS usuario_id, u.nome AS autor, u.username, u.foto_url
      FROM mensagens m
      JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.id = $1
    `,
			[nova.rows[0].id],
		);

		notificarNovaMensagem(req.params.id, completa.rows[0]);
		res.status(201).json(completa.rows[0]);
	} catch (err) {
		erroServidor(res, err, "Erro ao enviar mensagem");
	}
});

app.delete("/mensagens/:id", async (req, res) => {
	const { usuario_id } = req.body;
	try {
		const resultado = await pool.query(
			"DELETE FROM mensagens WHERE id = $1 AND usuario_id = $2 RETURNING id",
			[req.params.id, usuario_id],
		);
		if (resultado.rows.length === 0) {
			return res
				.status(404)
				.json({ erro: "Mensagem não encontrada ou sem permissão." });
		}
		res.json({ mensagem: "Mensagem apagada com sucesso." });
	} catch (err) {
		erroServidor(res, err, "Erro ao apagar mensagem");
	}
});

// ============================================================
// ROTAS — MEMBROS
// ============================================================

app.post("/chats/:id/membros", async (req, res) => {
	const { usuario_id } = req.body;
	if (!usuario_id) {
		return res.status(400).json({ erro: "usuario_id é obrigatório." });
	}
	try {
		await pool.query(
			"INSERT INTO chat_membros (chat_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
			[req.params.id, usuario_id],
		);
		res.status(201).json({ mensagem: "Membro adicionado." });
	} catch (err) {
		erroServidor(res, err, "Erro ao adicionar membro");
	}
});

app.delete("/chats/:id/membros/:usuario_id", async (req, res) => {
	try {
		await pool.query(
			"DELETE FROM chat_membros WHERE chat_id = $1 AND usuario_id = $2",
			[req.params.id, req.params.usuario_id],
		);
		res.json({ mensagem: "Membro removido." });
	} catch (err) {
		erroServidor(res, err, "Erro ao remover membro");
	}
});

// ============================================================
// ROTAS — TURMAS
// ============================================================

app.post("/turmas", async (req, res) => {
	const { usuario_id, nome_turma } = req.body;
	if (!usuario_id || !nome_turma) {
		return res
			.status(400)
			.json({ erro: "usuario_id e nome_turma são obrigatórios." });
	}
	try {
		const turma = await turmasService.criarTurma(usuario_id, nome_turma);
		res.status(201).json(turma);
	} catch (err) {
		if (err.message === "APENAS_PROFESSOR_PODE_CRIAR_TURMA") {
			return res
				.status(403)
				.json({ erro: "Apenas professores podem criar turmas." });
		}
		erroServidor(res, err, "Erro ao criar turma");
	}
});

app.post("/turmas/entrar", async (req, res) => {
	const { usuario_id, codigo } = req.body;
	if (!usuario_id || !codigo) {
		return res
			.status(400)
			.json({ erro: "usuario_id e codigo são obrigatórios." });
	}
	try {
		const turma = await turmasService.entrarNaTurma(usuario_id, codigo);
		res.status(200).json(turma);
	} catch (err) {
		if (err.message === "CODIGO_INVALIDO") {
			return res.status(404).json({ erro: "Código de convite inválido." });
		}
		erroServidor(res, err, "Erro ao entrar na turma");
	}
});

app.get("/turmas", async (req, res) => {
	const { usuario_id } = req.query;
	if (!usuario_id) {
		return res
			.status(400)
			.json({ erro: "usuario_id é obrigatório na query string." });
	}
	try {
		const turmas = await turmasService.listarTurmasDoUsuario(usuario_id);
		res.json(turmas);
	} catch (err) {
		erroServidor(res, err, "Erro ao listar turmas");
	}
});

app.get("/turmas/:id/membros", async (req, res) => {
	try {
		const membros = await turmasService.listarMembrosDaTurma(req.params.id);
		res.json(membros);
	} catch (err) {
		erroServidor(res, err, "Erro ao listar membros da turma");
	}
});

// ============================================================
// ROTAS — GOOGLE CALENDAR (Agenda)
// ============================================================

// GET /auth/google — inicia a autorização do Google Calendar
// Aceita token JWT de 3 formas:
//   1) ?token=...       (redirect do browser, usado pelo frontend)
//   2) Authorization: Bearer ...  (chamadas fetch/Postman)
//   3) ?usuario_id=...  (fallback de desenvolvimento)
app.get("/auth/google", async (req, res) => {
	let usuarioId = null;

	// 1) Token via query string
	if (req.query.token) {
		try {
			const dados = jwt.verify(req.query.token, process.env.JWT_SECRET);
			usuarioId = dados.usuarioId;
		} catch (err) {
			return res.status(401).json({ erro: "Token inválido ou expirado." });
		}
	}

	// 2) Token via header Authorization
	if (!usuarioId && req.headers.authorization?.startsWith("Bearer ")) {
		try {
			const tkn = req.headers.authorization.split(" ")[1];
			const dados = jwt.verify(tkn, process.env.JWT_SECRET);
			usuarioId = dados.usuarioId;
		} catch (err) {
			return res.status(401).json({ erro: "Token inválido ou expirado." });
		}
	}

	// 3) Fallback: usuario_id direto na query (desenvolvimento)
	if (!usuarioId && req.query.usuario_id) {
		usuarioId = req.query.usuario_id;
	}

	if (!usuarioId) {
		return res
			.status(401)
			.json({ erro: "Autenticação necessária. Faça login primeiro." });
	}

	const url = gerarUrlAutenticacao(usuarioId);
	res.redirect(url);
});

// GET /auth/google/callback — o Google chama após o consentimento
app.get("/auth/google/callback", async (req, res) => {
	const { code, state, error } = req.query;
	const usuarioId = state;

	if (error) {
		return res.redirect(
			`/agenda-erro.html?motivo=${encodeURIComponent(error)}`,
		);
	}

	try {
		const oauth2Client = criarOAuthClient();
		const { tokens } = await oauth2Client.getToken(code);
		await googleCalendar.salvarTokens(usuarioId, tokens);
		res.redirect("/agenda-conectada.html");
	} catch (err) {
		erroServidor(res, err, "Erro ao concluir autenticação com Google");
	}
});

// GET /usuarios/:id/google/status
app.get("/usuarios/:id/google/status", async (req, res) => {
	try {
		const tokens = await googleCalendar.buscarTokens(req.params.id);
		res.json({ conectado: !!tokens });
	} catch (err) {
		erroServidor(res, err, "Erro ao verificar status do Google");
	}
});

// GET /usuarios/:id/eventos
app.get("/usuarios/:id/eventos", async (req, res) => {
	try {
		const eventos = await googleCalendar.listarEventos(req.params.id);
		res.json(eventos);
	} catch (err) {
		if (err.message === "USUARIO_SEM_GOOGLE_CONECTADO") {
			return res
				.status(403)
				.json({
					erro: "Usuário ainda não conectou a conta Google.",
					precisaConectar: true,
				});
		}
		erroServidor(res, err, "Erro ao listar eventos");
	}
});

// POST /usuarios/:id/eventos
app.post("/usuarios/:id/eventos", async (req, res) => {
	const { titulo, inicio, fim } = req.body;
	if (!titulo || !inicio || !fim) {
		return res
			.status(400)
			.json({ erro: "titulo, inicio e fim são obrigatórios." });
	}
	try {
		const evento = await googleCalendar.criarEvento(req.params.id, req.body);
		res.status(201).json(evento);
	} catch (err) {
		if (err.message === "USUARIO_SEM_GOOGLE_CONECTADO") {
			return res
				.status(403)
				.json({
					erro: "Usuário ainda não conectou a conta Google.",
					precisaConectar: true,
				});
		}
		erroServidor(res, err, "Erro ao criar evento");
	}
});

// DELETE /usuarios/:id/eventos/:eventoId
app.delete("/usuarios/:id/eventos/:eventoId", async (req, res) => {
	try {
		await googleCalendar.apagarEvento(req.params.id, req.params.eventoId);
		res.json({ mensagem: "Evento apagado com sucesso." });
	} catch (err) {
		if (err.message === "USUARIO_SEM_GOOGLE_CONECTADO") {
			return res
				.status(403)
				.json({
					erro: "Usuário ainda não conectou a conta Google.",
					precisaConectar: true,
				});
		}
		erroServidor(res, err, "Erro ao apagar evento");
	}
});

// ============================================================
// ROTAS — LOGIN COM GOOGLE
// ============================================================

app.get("/auth/login/google", (req, res) => {
	const url = gerarUrlLogin();
	res.redirect(url);
});

app.get("/auth/login/google/callback", async (req, res) => {
	const { code, error } = req.query;
	if (error) {
		return res.redirect(`/login-erro.html?motivo=${encodeURIComponent(error)}`);
	}
	try {
		const perfilGoogle = await buscarPerfilGoogle(code);
		const usuario = await loginOuCadastroGoogle(perfilGoogle);
		const token = gerarToken(usuario);
		res.redirect(`/index.html?token=${token}`);
	} catch (err) {
		erroServidor(res, err, "Erro ao concluir login com Google");
	}
});

// ─── Rota raiz — painel de status ────────────────────────────
app.get("/", (req, res) => {
	res.send(`
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <title>Guará API</title>
      <style>
        body { font-family: sans-serif; max-width: 600px; margin: 60px auto; color: #333; }
        h1   { color: #BB6D7B; }
        code { background: #f5f0f0; padding: 2px 7px; border-radius: 4px; font-size: 14px; }
        li   { margin: 8px 0; }
        .ok  { color: #3B6D11; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>🦅 Projeto Guará — API</h1>
      <p class="ok">✅ Servidor rodando na porta ${process.env.PORT || 3000}</p>
      <h2>Rotas disponíveis</h2>
      <ul>
        <li><code>GET  /chats</code> — lista todos os chats</li>
        <li><code>GET  /chats/:id/mensagens</code> — mensagens de um chat</li>
        <li><code>POST /chats/:id/mensagens</code> — enviar mensagem</li>
        <li><code>POST /usuarios</code> — criar usuário</li>
        <li><code>GET  /usuarios/me</code> — usuário logado (JWT)</li>
        <li><code>GET  /auth/login/google</code> — login com Google</li>
        <li><code>GET  /auth/google</code> — conectar agenda Google</li>
        <li><code>GET  /health</code> — health check JSON</li>
      </ul>
      <p>Teste rápido: <a href="/health">/health</a> | <a href="/chats">/chats</a></p>
    </body>
    </html>
  `);
});

// ─── Health check ────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ─── Start ───────────────────────────────────────────────────
servidorHttp.listen(PORT, () => {
	console.log(`🚀 Servidor Guará rodando em http://localhost:${PORT}`);
	console.log(`🔌 Socket.IO pronto para conexões em tempo real`);
});
