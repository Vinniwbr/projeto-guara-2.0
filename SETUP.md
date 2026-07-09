# Projeto Guará — Setup rápido em nova máquina

Siga esta ordem exata. O `.env` já vai junto no repositório (decisão
consciente, repositório privado), então **não precisa recriar credenciais**
— só precisa recriar o banco e instalar dependências.

## 1. Pré-requisitos

- **Node.js** instalado → confirme com `node --version`
- **PostgreSQL** instalado → confirme com `psql --version`
  - Se não tiver, baixe em https://www.postgresql.org/download/windows/
  - Durante a instalação, defina uma senha para o usuário `postgres` (anote!)
  - Adicione `C:\Program Files\PostgreSQL\<versão>\bin` ao PATH do Windows
    (Painel de controle → Variáveis de ambiente → Path → Novo)

## 2. Clonar o repositório

```bash
git clone <URL_DO_SEU_REPOSITORIO_PRIVADO>
cd projeto-guara-main/backend/node
```

## 3. Instalar dependências

```bash
npm install
```

(isso já instala express, pg, googleapis, socket.io, jsonwebtoken, etc. —
tudo que está listado no package.json)

## 4. Criar o banco de dados

```bash
psql -h localhost -U postgres
```

Dentro do `psql`:

```sql
CREATE DATABASE guara_db;
\c guara_db
\i schema_completo.sql
```

(o arquivo `schema_completo.sql` está na raiz do projeto, junto deste guia —
ajuste o caminho no comando `\i` se necessário, ex: `\i ../../schema_completo.sql`)

Confirme que deu certo:

```sql
\dt
```

Devem aparecer 12 tabelas. Saia com `\q`.

## 5. Ajustar o `.env` para esta máquina

O arquivo `.env` já está no repositório com as credenciais do Google e o
JWT_SECRET — **mas a senha do PostgreSQL é específica de cada máquina**.
Abra o `.env` (dentro de `backend/node/`) e confirme/corrija:

```
DB_PASSWORD=<senha do postgres NESTA máquina>
```

Se a porta 3000 estiver ocupada por outro programa nesta máquina, troque
`PORT=3000` para outra porta livre — e, se mudar a porta, atualize também
`GOOGLE_REDIRECT_URI` e `GOOGLE_LOGIN_REDIRECT_URI` no `.env`, **e** cadastre
a nova URL no Google Cloud Console (Credenciais → seu OAuth Client → URIs
de redirecionamento autorizados).

## 6. Rodar

```bash
npm run dev
```

Deve aparecer:
```
🚀 Servidor Guará rodando em http://localhost:3000
🔌 Socket.IO pronto para conexões em tempo real
```

## 7. Testar rapidamente

- `http://localhost:3000/health` → `{"status":"ok"}`
- `http://localhost:3000/chats` → `[]` ou lista de chats (confirma banco OK)
- `http://localhost:3000/auth/login/google` → fluxo de login Google
- `http://localhost:3000/teste_chat_socket.html` → chat em tempo real (se a
  pasta `public` com o arquivo de teste também foi copiada)

---

## Checklist resumido (para colar em qualquer lugar)

- [ ] Node.js instalado
- [ ] PostgreSQL instalado + no PATH
- [ ] `git clone`
- [ ] `npm install` (dentro de `backend/node`)
- [ ] `CREATE DATABASE guara_db;`
- [ ] `\i schema_completo.sql`
- [ ] Confirmar `DB_PASSWORD` no `.env`
- [ ] `npm run dev`
- [ ] Testar `/health` e `/chats`
