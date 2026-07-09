// ============================================================
// main.js — Projeto Guará
// Versão com integração à API REST (Node + PostgreSQL)
// ============================================================

// ─── Configuração da API ─────────────────────────────────────
// Troque pela URL do seu servidor quando for para produção
const API_URL = "http://localhost:3000";

// ID do usuário logado — em produção vem do login/sessão
const USUARIO_ID = localStorage.getItem("guara_usuario_id") || null;

// ─── Estado ──────────────────────────────────────────────────
let chatAtivo  = null;  // { id, nome, tipo }
let chatsCache = [];    // Lista de chats carregados da API

// ─── Utilitário: requisições à API ───────────────────────────

async function apiFetch(path, opcoes = {}) {
  const res = await fetch(API_URL + path, {
    headers: { "Content-Type": "application/json" },
    ...opcoes,
  });
  if (!res.ok) {
    const erro = await res.json().catch(() => ({ erro: "Erro desconhecido" }));
    throw new Error(erro.erro || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Utilitário: hora formatada ───────────────────────────────

function formatarHora(dataISO) {
  const d = new Date(dataISO);
  return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
}

// ─── Carregar e renderizar os cards da <main> ─────────────────

async function carregarChats() {
  try {
    chatsCache = await apiFetch("/chats");
    renderizarCards(chatsCache);
  } catch (err) {
    console.error("Erro ao carregar chats:", err.message);
    mostrarErroBanner("Não foi possível conectar ao servidor.");
  }
}

function renderizarCards(chats) {
  const mapaCards = {
    direcao:  "card-direcao",
    agenda:   "card-agenda",
    turma:    "card-turma",
    amigavel: "card-amigavel",
  };

  chats.forEach((chat) => {
    const cardEl = document.getElementById(mapaCards[chat.tipo]);
    if (!cardEl) return;

    // Atualiza contagem de membros vinda do banco
    const spanMembros = cardEl.querySelector("[data-membros]");
    if (spanMembros) {
      spanMembros.textContent =
        `${Number(chat.total_membros).toLocaleString("pt-BR")} Membros`;
    }

    cardEl.style.position = "relative";
    cardEl.style.cursor   = "pointer";
    cardEl.setAttribute("tabindex", "0");
    cardEl.setAttribute("role", "button");
    cardEl.setAttribute("aria-label", `Abrir ${chat.nome}`);

    cardEl.onclick   = () => abrirChat(chat);
    cardEl.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") abrirChat(chat);
    };
  });
}

// ─── Criar modal (uma única vez no DOM) ──────────────────────

function criarModal() {
  const overlay = document.createElement("div");
  overlay.id = "guara-overlay";
  overlay.style.cssText = `
    position:fixed; inset:0;
    background:rgba(0,0,0,0.35);
    display:flex; align-items:center; justify-content:center;
    z-index:1000;
    opacity:0; pointer-events:none;
    transition:opacity 0.2s;
  `;

  overlay.innerHTML = `
    <div id="guara-modal" role="dialog" aria-modal="true"
         aria-labelledby="guara-modal-titulo" style="
      background:#fff; border-radius:16px;
      width:440px; max-width:95vw;
      box-shadow:rgba(100,100,111,.22) 0 8px 32px 0;
      display:flex; flex-direction:column;
      max-height:90vh; overflow:hidden;
    ">
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:16px 20px 12px;
        border-bottom:1px solid #f0e8e8;
      ">
        <h2 id="guara-modal-titulo" style="
          font-size:16px; font-family:'Henny Penny',serif;
          color:#BB6D7B; margin:0;
        "></h2>
        <button id="guara-fechar" aria-label="Fechar chat" style="
          background:none; border:none; cursor:pointer;
          font-size:20px; color:#888; line-height:1; padding:0 4px;
        ">✕</button>
      </div>

      <div id="guara-mensagens" style="
        flex:1; padding:16px 20px;
        overflow-y:auto;
        display:flex; flex-direction:column; gap:10px;
        min-height:200px; max-height:340px;
      ">
        <p style="color:#aaa; font-size:13px; text-align:center;">
          Carregando mensagens...
        </p>
      </div>

      <div style="padding:12px 20px 16px; border-top:1px solid #f0e8e8; display:flex; gap:8px;">
        <input id="guara-input" placeholder="Digite uma mensagem..."
               autocomplete="off" style="
          flex:1; border:1px solid #e0d0d0; border-radius:20px;
          padding:9px 15px;
          font-family:'Comfortaa',sans-serif; font-size:13px; outline:none;
        ">
        <button id="guara-enviar" style="
          background:#c16a61; color:#fff; border:none;
          border-radius:20px; padding:9px 18px;
          font-family:'Comfortaa',sans-serif; font-size:13px;
          cursor:pointer; transition:background 0.15s;
        ">Enviar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharChat();
  });
  document.getElementById("guara-fechar").addEventListener("click", fecharChat);
  document.getElementById("guara-enviar").addEventListener("click", enviarMensagem);
  document.getElementById("guara-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") enviarMensagem();
  });
}

// ─── Abrir chat ───────────────────────────────────────────────

async function abrirChat(chat) {
  chatAtivo = chat;
  document.getElementById("guara-modal-titulo").textContent = chat.nome;

  const overlay = document.getElementById("guara-overlay");
  overlay.style.opacity       = "1";
  overlay.style.pointerEvents = "all";

  removerNotificacao(chat.tipo);
  await carregarMensagens(chat.id);
  setTimeout(() => document.getElementById("guara-input").focus(), 50);
}

// ─── Fechar chat ──────────────────────────────────────────────

function fecharChat() {
  const overlay = document.getElementById("guara-overlay");
  overlay.style.opacity       = "0";
  overlay.style.pointerEvents = "none";
  chatAtivo = null;
}

// ─── Buscar mensagens da API ──────────────────────────────────

async function carregarMensagens(chatId) {
  const container = document.getElementById("guara-mensagens");
  container.innerHTML =
    `<p style="color:#aaa; font-size:13px; text-align:center;">Carregando...</p>`;

  try {
    const mensagens = await apiFetch(`/chats/${chatId}/mensagens?limite=50`);
    renderizarMensagens(mensagens);
  } catch (err) {
    container.innerHTML =
      `<p style="color:#EA444F; font-size:13px; text-align:center;">
        Erro ao carregar mensagens.
      </p>`;
    console.error("Erro ao carregar mensagens:", err.message);
  }
}

// ─── Renderizar mensagens ─────────────────────────────────────

function renderizarMensagens(mensagens) {
  const container = document.getElementById("guara-mensagens");

  if (mensagens.length === 0) {
    container.innerHTML =
      `<p style="color:#aaa; font-size:13px; text-align:center;">
        Nenhuma mensagem ainda. Seja o primeiro a enviar!
      </p>`;
    return;
  }

  container.innerHTML = mensagens.map((m) => {
    const sou_eu = m.usuario_id === USUARIO_ID;
    return `
      <div style="
        align-self:${sou_eu ? "flex-end" : "flex-start"};
        max-width:80%;
        background:${sou_eu ? "#F0C6BF66" : "#f5f0f0"};
        border-radius:${sou_eu ? "14px 14px 4px 14px" : "14px 14px 14px 4px"};
        padding:9px 13px; font-size:13px; line-height:1.5; color:#333;
      ">
        ${!sou_eu
          ? `<span style="font-size:10px; color:#BB6D7B; font-weight:600;
                          display:block; margin-bottom:2px;">${m.autor}</span>`
          : ""}
        ${m.texto}
        <span style="font-size:10px; color:#aaa; display:block;
                     text-align:right; margin-top:3px;">
          ${formatarHora(m.criado_em)}
        </span>
      </div>
    `;
  }).join("");

  container.scrollTop = container.scrollHeight;
}

// ─── Enviar mensagem para a API ───────────────────────────────

async function enviarMensagem() {
  const input = document.getElementById("guara-input");
  const texto = input.value.trim();

  if (!texto || !chatAtivo) return;

  if (!USUARIO_ID) {
    alert("Você precisa estar logado para enviar mensagens.");
    return;
  }

  // Optimistic UI: mostra a mensagem antes da resposta do servidor
  const container = document.getElementById("guara-mensagens");
  const msgTemp   = document.createElement("div");
  msgTemp.style.cssText = `
    align-self:flex-end; max-width:80%;
    background:#F0C6BF66;
    border-radius:14px 14px 4px 14px;
    padding:9px 13px; font-size:13px; color:#aaa;
  `;
  msgTemp.textContent = texto + " ✓";
  container.appendChild(msgTemp);
  container.scrollTop = container.scrollHeight;
  input.value = "";

  try {
    await apiFetch(`/chats/${chatAtivo.id}/mensagens`, {
      method: "POST",
      body: JSON.stringify({ usuario_id: USUARIO_ID, texto }),
    });
    msgTemp.remove();
    await carregarMensagens(chatAtivo.id);
  } catch (err) {
    msgTemp.style.color = "#EA444F";
    msgTemp.textContent = texto + " ✗ (falha ao enviar)";
    console.error("Erro ao enviar mensagem:", err.message);
  }
}

// ─── Notificações visuais nos cards ───────────────────────────

function adicionarNotificacao(tipo) {
  const mapaCards = {
    direcao: "card-direcao", agenda: "card-agenda",
    turma:   "card-turma",   amigavel: "card-amigavel",
  };
  const card = document.getElementById(mapaCards[tipo]);
  if (!card || card.querySelector(".notif-dot")) return;

  const dot = document.createElement("span");
  dot.className = "notif-dot";
  dot.style.cssText = `
    position:absolute; top:12px; right:14px;
    width:10px; height:10px;
    background:#EA444F; border-radius:50%;
    border:2px solid #fff;
  `;
  card.appendChild(dot);
}

function removerNotificacao(tipo) {
  const mapaCards = {
    direcao: "card-direcao", agenda: "card-agenda",
    turma:   "card-turma",   amigavel: "card-amigavel",
  };
  const card = document.getElementById(mapaCards[tipo]);
  card?.querySelector(".notif-dot")?.remove();
}

// ─── Banner de erro ───────────────────────────────────────────

function mostrarErroBanner(msg) {
  const banner = document.createElement("div");
  banner.style.cssText = `
    position:fixed; top:16px; left:50%; transform:translateX(-50%);
    background:#EA444F; color:#fff; padding:10px 22px;
    border-radius:8px; font-size:13px; z-index:9999;
    font-family:'Comfortaa',sans-serif;
  `;
  banner.textContent = msg;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 4000);
}

// ─── Fechar com Escape ────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && chatAtivo) fecharChat();
});

// ─── Init ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  criarModal();
  carregarChats();
});
