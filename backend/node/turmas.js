// turmas.js — Lógica de criação de turma, geração de código de convite,
// entrada via código, e listagem.
const pool = require("./db");

// Gera um código curto e razoavelmente único (6 caracteres, letras+números)
function gerarCodigoConvite() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1 para evitar confusão visual
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    codigo += caracteres[Math.floor(Math.random() * caracteres.length)];
  }
  return codigo;
}

// ─── Criar turma (somente professor) ──────────────────────────
async function criarTurma(usuarioId, nomeTurma) {
  // Confirma que quem está criando é professor
  const usuario = await pool.query("SELECT papel FROM usuarios WHERE id = $1", [usuarioId]);
  if (usuario.rows.length === 0 || usuario.rows[0].papel !== "professor") {
    throw new Error("APENAS_PROFESSOR_PODE_CRIAR_TURMA");
  }

  // Gera um código único (tenta algumas vezes em caso de colisão rara)
  let codigo;
  for (let tentativas = 0; tentativas < 5; tentativas++) {
    codigo = gerarCodigoConvite();
    const existe = await pool.query("SELECT 1 FROM turmas WHERE codigo_convite = $1", [codigo]);
    if (existe.rows.length === 0) break;
  }

  // Cria um chat vinculado a essa turma
  const chat = await pool.query(
    `INSERT INTO chats (nome, tipo) VALUES ($1, 'turma') RETURNING id`,
    [`Chat - ${nomeTurma}`]
  );
  const chatId = chat.rows[0].id;

  // Cria a turma
  const turma = await pool.query(
    `INSERT INTO turmas (nome_turma, codigo_convite, criado_por, chat_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nomeTurma, codigo, usuarioId, chatId]
  );

  // Adiciona o professor como membro da turma e do chat
  await pool.query(
    `INSERT INTO turma_membros (id_turma, usuario_id, papel) VALUES ($1, $2, 'professor')`,
    [turma.rows[0].id_turma, usuarioId]
  );
  await pool.query(
    `INSERT INTO chat_membros (chat_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [chatId, usuarioId]
  );

  return turma.rows[0];
}

// ─── Entrar em turma via código (aluno) ───────────────────────
async function entrarNaTurma(usuarioId, codigo) {
  const turma = await pool.query(
    "SELECT * FROM turmas WHERE codigo_convite = $1",
    [codigo.toUpperCase()]
  );
  if (turma.rows.length === 0) {
    throw new Error("CODIGO_INVALIDO");
  }
  const turmaEncontrada = turma.rows[0];

  // Adiciona como membro da turma (papel padrão: aluno)
  await pool.query(
    `INSERT INTO turma_membros (id_turma, usuario_id, papel)
     VALUES ($1, $2, 'aluno')
     ON CONFLICT (id_turma, usuario_id) DO NOTHING`,
    [turmaEncontrada.id_turma, usuarioId]
  );

  // Adiciona também no chat da turma
  await pool.query(
    `INSERT INTO chat_membros (chat_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [turmaEncontrada.chat_id, usuarioId]
  );

  return turmaEncontrada;
}

// ─── Listar turmas do usuário logado (como professor ou aluno) ─
async function listarTurmasDoUsuario(usuarioId) {
  const resultado = await pool.query(`
    SELECT
      t.id_turma,
      t.nome_turma,
      t.codigo_convite,
      t.chat_id,
      tm.papel AS meu_papel,
      (SELECT COUNT(*) FROM turma_membros WHERE id_turma = t.id_turma) AS total_membros
    FROM turmas t
    JOIN turma_membros tm ON tm.id_turma = t.id_turma
    WHERE tm.usuario_id = $1
    ORDER BY t.criado_em DESC
  `, [usuarioId]);

  return resultado.rows;
}

// ─── Listar membros de uma turma específica ───────────────────
async function listarMembrosDaTurma(idTurma) {
  const resultado = await pool.query(`
    SELECT u.id, u.nome, u.username, u.foto_url, tm.papel, tm.entrou_em
    FROM turma_membros tm
    JOIN usuarios u ON u.id = tm.usuario_id
    WHERE tm.id_turma = $1
    ORDER BY tm.papel DESC, u.nome ASC
  `, [idTurma]);

  return resultado.rows;
}

module.exports = {
  criarTurma,
  entrarNaTurma,
  listarTurmasDoUsuario,
  listarMembrosDaTurma,
};
