

--/ em caso de desgraça: DROP TABLE IF EXISTS vinculo_escola CASCADE; DROP TABLE IF EXISTS funcionarios CASCADE; DROP TABLE IF EXISTS turmas CASCADE; DROP TABLE IF EXISTS disciplinas CASCADE; DROP TABLE IF EXISTS funcao CASCADE; DROP TABLE IF EXISTS setor CASCADE;


CREATE TABLE setor (
    id_setor          SERIAL PRIMARY KEY,
    nome_setor        VARCHAR(100) NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE funcao (
    id_funcao         SERIAL PRIMARY KEY,
    id_setor          INT          NOT NULL,
    nome_funcao       VARCHAR(100) NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_funcao_setor FOREIGN KEY (id_setor) REFERENCES setor(id_setor) ON DELETE CASCADE
);

CREATE TABLE disciplinas (
    id_disciplina     SERIAL PRIMARY KEY,
    nome_disciplina   VARCHAR(150) NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE turmas (
    id_turma          SERIAL PRIMARY KEY, 
    nome_turma        VARCHAR(100) NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE funcionarios (
    id_funcionario    SERIAL PRIMARY KEY,
    nome_funcionario  VARCHAR(255) NOT NULL,
    id_setor          INT          NOT NULL,
    id_funcao         INT          NOT NULL,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_func_setor  FOREIGN KEY (id_setor)  REFERENCES setor(id_setor)   ON DELETE RESTRICT,
    CONSTRAINT fk_func_funcao FOREIGN KEY (id_funcao) REFERENCES funcao(id_funcao) ON DELETE RESTRICT
);

CREATE TABLE vinculo_escola (
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

-- migracao_turmas.sql
-- Adiciona papel (professor/aluno) e estrutura de vínculo de turmas
 
-- 1) Papel do usuário — definido manualmente pelo admin no banco.
--    Por padrão todo novo cadastro entra como 'aluno'; o admin promove
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS papel VARCHAR(20) NOT NULL DEFAULT 'aluno'
  CHECK (papel IN ('aluno', 'professor'));
 
-- 2) Código de convite único por turma (a tabela "turmas" já existe).
ALTER TABLE turmas
  ADD COLUMN IF NOT EXISTS codigo_convite VARCHAR(10) UNIQUE,
  ADD COLUMN IF NOT EXISTS criado_por INT REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS chat_id INT REFERENCES chats(id);
 
-- 3) Vínculo usuário <-> turma (quem está em qual turma, e com que papel
--    DENTRO daquela turma — útil se um professor também quiser entrar
--    como membro comum em outra turma, por exemplo).
CREATE TABLE IF NOT EXISTS turma_membros (
    id_turma    INT NOT NULL REFERENCES turmas(id_turma) ON DELETE CASCADE,
    usuario_id  INT NOT NULL REFERENCES usuarios(id)      ON DELETE CASCADE,
    papel       VARCHAR(20) NOT NULL DEFAULT 'aluno' CHECK (papel IN ('aluno', 'professor')),
    entrou_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_turma, usuario_id)
);
 
-- ─── Exemplo: promover um usuário a professor manualmente ────
-- UPDATE usuarios SET papel = 'professor' WHERE email = 'professor@escola.com';
