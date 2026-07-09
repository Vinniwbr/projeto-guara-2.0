-- ============================================================
-- schema_completo.sql — Projeto Guará
-- Script único com TODAS as tabelas, na ordem correta de criação.
-- Use este arquivo para configurar o banco do zero em qualquer máquina.
--
-- Como usar:
--   1) Crie o banco antes (fora deste script):
--        CREATE DATABASE guara_db;
--   2) Conecte nele:
--        \c guara_db
--   3) Rode este arquivo inteiro:
--        \i caminho/para/schema_completo.sql
-- ============================================================

-- ─── Estrutura administrativa da escola ───────────────────────

CREATE TABLE IF NOT EXISTS setor (
    id_setor          SERIAL PRIMARY KEY,
    nome_setor        VARCHAR(100) NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS funcao (
    id_funcao         SERIAL PRIMARY KEY,
    id_setor          INT          NOT NULL,
    nome_funcao       VARCHAR(100) NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_funcao_setor FOREIGN KEY (id_setor) REFERENCES setor(id_setor) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS disciplinas (
    id_disciplina     SERIAL PRIMARY KEY,
    nome_disciplina   VARCHAR(150) NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS turmas (
    id_turma          SERIAL PRIMARY KEY,
    nome_turma        VARCHAR(100) NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS funcionarios (
    id_funcionario    SERIAL PRIMARY KEY,
    nome_funcionario  VARCHAR(255) NOT NULL,
    id_setor          INT          NOT NULL,
    id_funcao         INT          NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_func_setor  FOREIGN KEY (id_setor)  REFERENCES setor(id_setor)   ON DELETE RESTRICT,
    CONSTRAINT fk_func_funcao FOREIGN KEY (id_funcao) REFERENCES funcao(id_funcao) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS vinculo_escola (
    id_vinculo        SERIAL PRIMARY KEY,
    id_funcionario    INT          NOT NULL,
    id_disciplina     INT          NOT NULL,
    id_turma          INT          NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vinculo_func  FOREIGN KEY (id_funcionario) REFERENCES funcionarios(id_funcionario) ON DELETE CASCADE,
    CONSTRAINT fk_vinculo_disc  FOREIGN KEY (id_disciplina)  REFERENCES disciplinas(id_disciplina)   ON DELETE CASCADE,
    CONSTRAINT fk_vinculo_turma FOREIGN KEY (id_turma)       REFERENCES turmas(id_turma)             ON DELETE CASCADE,
    CONSTRAINT uq_vinculo       UNIQUE (id_funcionario, id_disciplina, id_turma)
);

-- ─── Usuários (login, chat, agenda, turmas) ───────────────────

CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(255) NOT NULL,
    username    VARCHAR(100) NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    foto_url    TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    google_id   VARCHAR(255) UNIQUE,
    papel       VARCHAR(20) NOT NULL DEFAULT 'aluno' CHECK (papel IN ('aluno', 'professor'))
);

-- ─── Chat ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chats (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(255) NOT NULL,
    tipo        VARCHAR(50),
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_membros (
    chat_id     INT NOT NULL,
    usuario_id  INT NOT NULL,
    entrou_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, usuario_id),
    CONSTRAINT fk_membro_chat    FOREIGN KEY (chat_id)    REFERENCES chats(id)    ON DELETE CASCADE,
    CONSTRAINT fk_membro_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mensagens (
    id          SERIAL PRIMARY KEY,
    chat_id     INT NOT NULL,
    usuario_id  INT NOT NULL,
    texto       TEXT NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_chat    FOREIGN KEY (chat_id)    REFERENCES chats(id)    ON DELETE CASCADE,
    CONSTRAINT fk_msg_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ─── Google Calendar (Agenda) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS google_tokens (
    usuario_id     INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    access_token   TEXT NOT NULL,
    refresh_token  TEXT,
    expiry_date    BIGINT,
    scope          TEXT,
    token_type     TEXT,
    criado_em      TIMESTAMP DEFAULT NOW(),
    atualizado_em  TIMESTAMP DEFAULT NOW()
);

-- ─── Turmas: código de convite + vínculo de membros ───────────

ALTER TABLE turmas
  ADD COLUMN IF NOT EXISTS codigo_convite VARCHAR(10) UNIQUE,
  ADD COLUMN IF NOT EXISTS criado_por INT REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS chat_id INT REFERENCES chats(id);

CREATE TABLE IF NOT EXISTS turma_membros (
    id_turma    INT NOT NULL REFERENCES turmas(id_turma) ON DELETE CASCADE,
    usuario_id  INT NOT NULL REFERENCES usuarios(id)      ON DELETE CASCADE,
    papel       VARCHAR(20) NOT NULL DEFAULT 'aluno' CHECK (papel IN ('aluno', 'professor')),
    entrou_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_turma, usuario_id)
);

-- ============================================================
-- FIM. Confirme com \dt — devem aparecer 11 tabelas:
-- setor, funcao, disciplinas, turmas, funcionarios, vinculo_escola,
-- usuarios, chats, chat_membros, mensagens, google_tokens, turma_membros
-- (12 no total, incluindo turma_membros)
-- ============================================================
