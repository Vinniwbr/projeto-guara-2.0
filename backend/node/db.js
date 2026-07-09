// db.js — Pool de conexão com o PostgreSQL
const { Pool } = require("pg");
if (process.env.NODE_ENV !== "production") {
	require("dotenv").config();
}

const pool = new Pool({
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	database: process.env.DB_NAME,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
});

pool.on("connect", () => {
	console.log("✅ Conectado ao PostgreSQL");
});

pool.on("error", (err) => {
	console.error("❌ Erro no pool do PostgreSQL:", err.message);
});

module.exports = pool;
