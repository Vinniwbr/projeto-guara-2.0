// ============================================================
// chatdirecao.js — Projeto Guará
// Chat Direção com Socket.IO em tempo real
// Token recebido via URL (?token=...)
// ============================================================

const API_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://projeto-guara-api.onrender.com";

let token        = null;
let usuarioAtual = null;
let socket       = null;
let chatId       = null; // ID do chat "direção" no banco

// ─── Utilitário: requisições à API ────────────────────────────
async function apiFetch(path, opcoes = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(API_URL + path, { headers, ...opcoes });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.erro || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

function formatarHora(dataISO) {
  const d = new Date(dataISO);
  return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Lê token da URL ou localStorage
  const params = new URLSearchParams(window.location.search);
  token = params.get("token") || localStorage.getItem("guara_token");

  if (token) {
    localStorage.setItem("guara_token", token);
    if (params.has("token")) {
      const url = new URL(window.location);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url);
    }
  }

  if (!token) {
    mostrarErro("Você precisa estar logado para acessar o chat.");
    return;
  }

  // 2) Carrega usuário
  try {
    usuarioAtual = await apiFetch("/usuarios/me");
    atualizarPerfil();
  } catch (err) {
    mostrarErro("Sessão expirada. Faça login novamente.");
    token = null;
    localStorage.removeItem("guara_token");
    return;
  }

  // 3) Busca o chat de tipo "direcao" no banco
  try {
    const chats = await apiFetch("/chats");
    const chatDirecao = chats.find((c) => c.tipo === "direcao");
    if (!chatDirecao) {
      mostrarErro("Chat Direção não encontrado. Contate o administrador.");
      return;
    }
    chatId = chatDirecao.id;
  } catch (err) {
    mostrarErro("Erro ao carregar o chat: " + err.message);
    return;
  }

  // 4) Inicializa Socket.IO
  inicializarSocket();

  // 5) Carrega mensagens iniciais
  await carregarMensagens();

  // 6) Configura o botão/input de envio
  configurarEnvio();
});

// ═══════════════════════════════════════════════════════════════
// PERFIL
// ═══════════════════════════════════════════════════════════════

function atualizarPerfil() {
  const foto = document.querySelector(".explore__rodape--fotoUser");
  const nome = document.querySelector(".explore__rodape--nameUser");
  if (foto && usuarioAtual?.foto_url) foto.src = usuarioAtual.foto_url;
  if (nome && usuarioAtual?.nome)     nome.textContent = usuarioAtual.nome;
}

// ═══════════════════════════════════════════════════════════════
// SOCKET.IO
// ═══════════════════════════════════════════════════════════════

function inicializarSocket() {
  const script = document.createElement("script");
  script.src = `${API_URL}/socket.io/socket.io.js`;
  script.onload = () => {
    socket = io(API_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("🔌 Socket conectado:", socket.id);
      socket.emit("entrar_chat", chatId);
      atualizarIndicadorSocket(true);
    });

    socket.on("disconnect", () => {
      atualizarIndicadorSocket(false);
    });

    // Recebe mensagem nova em tempo real
    socket.on("nova_mensagem", (msg) => {
      if (String(msg.chat_id) !== String(chatId)) return;
      adicionarMensagem(msg);
    });

    socket.on("connect_error", () => {
      atualizarIndicadorSocket(false);
    });
  };
  document.head.appendChild(script);
}

function atualizarIndicadorSocket(conectado) {
  const indicador = document.getElementById("indicador-socket");
  if (!indicador) return;
  indicador.textContent = conectado ? "🟢 tempo real" : "🔴 offline";
  indicador.style.color = conectado ? "#3B6D11" : "#EA444F";
}

// ═══════════════════════════════════════════════════════════════
// MENSAGENS
// ═══════════════════════════════════════════════════════════════

async function carregarMensagens() {
  const blocoChat = document.getElementById("blocoChat");
  if (!blocoChat) return;

  blocoChat.innerHTML = `<p style="color:#aaa;font-size:13px;text-align:center;padding:20px;">Carregando...</p>`;

  try {
    const msgs = await apiFetch(`/chats/${chatId}/mensagens?limite=50`);
    renderizarMensagens(msgs);
  } catch (err) {
    blocoChat.innerHTML = `<p style="color:#EA444F;font-size:13px;text-align:center;padding:20px;">Erro ao carregar mensagens.</p>`;
  }
}

function renderizarMensagens(mensagens) {
  const blocoChat = document.getElementById("blocoChat");
  if (!blocoChat) return;

  if (mensagens.length === 0) {
    blocoChat.innerHTML = `<p style="color:#aaa;font-size:13px;text-align:center;padding:20px;">Nenhuma mensagem ainda. Seja o primeiro!</p>`;
    return;
  }

  blocoChat.innerHTML = mensagens.map((m) => montarBolha(m)).join("");
  blocoChat.scrollTop = blocoChat.scrollHeight;
}

function adicionarMensagem(msg) {
  const blocoChat = document.getElementById("blocoChat");
  if (!blocoChat) return;

  // Remove placeholder se existir
  const placeholder = blocoChat.querySelector("p");
  if (placeholder) placeholder.remove();

  const div = document.createElement("div");
  div.innerHTML = montarBolha(msg);
  blocoChat.appendChild(div.firstElementChild);
  blocoChat.scrollTop = blocoChat.scrollHeight;
}

function montarBolha(m) {
  const souEu = m.usuario_id === usuarioAtual?.id;
  return `
    <div style="
      display:flex;
      flex-direction:column;
      align-items:${souEu ? "flex-end" : "flex-start"};
      margin: 4px 16px;
    ">
      ${!souEu ? `<span style="font-size:11px;color:#BB6D7B;font-weight:bold;margin-bottom:2px;margin-left:4px;">${m.autor}</span>` : ""}
      <div style="
        max-width:70%;
        background:${souEu ? "#F0C6BF" : "#fff"};
        border-radius:${souEu ? "16px 16px 4px 16px" : "16px 16px 16px 4px"};
        padding:10px 14px;
        font-size:14px;
        line-height:1.5;
        color:#333;
        box-shadow:0 1px 4px rgba(0,0,0,0.08);
      ">
        ${m.texto}
        <span style="font-size:10px;color:#aaa;display:block;text-align:right;margin-top:4px;">${formatarHora(m.criado_em)}</span>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// ENVIO DE MENSAGEM
// ═══════════════════════════════════════════════════════════════

function configurarEnvio() {
  const input  = document.querySelector(".input-chat");
  const rodape = document.querySelector(".rodape");
  if (!input || !rodape) return;

  // Adiciona botão de enviar ao lado do input
  const btn = document.createElement("button");
  btn.textContent = "Enviar";
  btn.style.cssText = `
    margin-left:10px;padding:0.8rem 1.4rem;
    background:#BB6D7B;color:#fff;border:none;
    border-radius:999px;cursor:pointer;font-size:0.95rem;
    font-family:'Comfortaa',sans-serif;white-space:nowrap;
    transition:background 0.2s;
  `;
  btn.onmouseenter = () => { btn.style.background = "#a55a68"; };
  btn.onmouseleave = () => { btn.style.background = "#BB6D7B"; };
  rodape.querySelector(".barra-mensagem").appendChild(btn);

  // Adiciona indicador de status do socket no cabeçalho
  const cabecalho = document.querySelector(".cabecalho");
  if (cabecalho) {
    const indicador = document.createElement("span");
    indicador.id = "indicador-socket";
    indicador.textContent = "⚪ conectando...";
    indicador.style.cssText = "font-size:12px;color:#aaa;margin-left:12px;font-weight:normal;";
    cabecalho.querySelector(".cabecalho--nome").appendChild(indicador);
  }

  const enviar = async () => {
    const texto = input.value.trim();
    if (!texto) return;

    input.value = "";

    // Optimistic UI
    const blocoChat = document.getElementById("blocoChat");
    const temp = document.createElement("div");
    temp.style.cssText = "display:flex;flex-direction:column;align-items:flex-end;margin:4px 16px;";
    temp.innerHTML = `
      <div style="max-width:70%;background:#F0C6BF;border-radius:16px 16px 4px 16px;padding:10px 14px;font-size:14px;color:#aaa;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        ${texto} ✓
      </div>
    `;
    blocoChat?.appendChild(temp);
    blocoChat.scrollTop = blocoChat.scrollHeight;

    try {
      await apiFetch(`/chats/${chatId}/mensagens`, {
        method: "POST",
        body: JSON.stringify({ usuario_id: usuarioAtual.id, texto }),
      });
      temp.remove();
      // Se socket conectado, a mensagem vai chegar via evento nova_mensagem
      // Se não, recarrega manualmente
      if (!socket?.connected) {
        await carregarMensagens();
      }
    } catch (err) {
      temp.innerHTML = `
        <div style="max-width:70%;background:#fdecea;border-radius:16px 16px 4px 16px;padding:10px 14px;font-size:14px;color:#EA444F;">
          ${texto} ✗ (falha ao enviar)
        </div>
      `;
      console.error("Erro ao enviar:", err.message);
    }
  };

  btn.addEventListener("click", enviar);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") enviar(); });
}

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

function mostrarErro(msg) {
  const blocoChat = document.getElementById("blocoChat");
  if (blocoChat) {
    blocoChat.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <p style="color:#EA444F;font-size:14px;margin-bottom:16px;">${msg}</p>
        <a href="${API_URL}/auth/login/google" style="background:#BB6D7B;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-size:14px;">Entrar com Google</a>
      </div>
    `;
  }
}