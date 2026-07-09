// ============================================================
// agenda.js — Projeto Guará
// Calendário integrado com Google Calendar API
// ============================================================

const API_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://projeto-guara-api.onrender.com";

// ─── Estado global ────────────────────────────────────────────
let token        = localStorage.getItem("guara_token");
let usuarioAtual = null;
let googleStatus = null;
let eventosCache = [];
let dataAtual    = new Date(); // mês/ano sendo exibido no calendário
let eventoEditando = null;     // evento sendo editado (null = criando novo)

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

function formatarDataHora(dataISO) {
  if (!dataISO) return "";
  const d = new Date(dataISO);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function toInputDatetime(dataISO) {
  if (!dataISO) return "";
  const d = new Date(dataISO);
  // Ajusta para o fuso horário local antes de formatar
  const offset = d.getTimezoneOffset() * 60000; // offset em ms
  const local = new Date(d.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", async () => {
  // Carrega token da URL se vier do login
  const params = new URLSearchParams(window.location.search);
  const tokenUrl = params.get("token");
  if (tokenUrl) {
    token = tokenUrl;
    localStorage.setItem("guara_token", token);
    const url = new URL(window.location);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url);
  }

  criarModal();
  criarBotaoCriarEvento();

  if (!token) {
    mostrarAvisoLogin();
    renderizarCalendario(); // mostra calendário vazio mesmo sem login
    return;
  }

  try {
    usuarioAtual = await apiFetch("/usuarios/me");
    atualizarPerfil();
  } catch (err) {
    console.warn("Sessão expirada:", err.message);
    token = null;
    localStorage.removeItem("guara_token");
    mostrarAvisoLogin();
    renderizarCalendario();
    return;
  }

  try {
    googleStatus = await apiFetch(`/usuarios/${usuarioAtual.id}/google/status`);
  } catch (_) {
    googleStatus = { conectado: false };
  }

  if (!googleStatus?.conectado) {
    mostrarAvisoGoogle();
    renderizarCalendario();
    return;
  }

  await carregarEventos();
  renderizarCalendario();
  renderizarAulasHoje();
});

// ═══════════════════════════════════════════════════════════════
// PERFIL DO USUÁRIO
// ═══════════════════════════════════════════════════════════════

function atualizarPerfil() {
  const foto = document.querySelector(".explore__rodape--fotoUser");
  const nome = document.querySelector(".explore__rodape--nameUser");
  if (foto && usuarioAtual?.foto_url) foto.src = usuarioAtual.foto_url;
  if (nome && usuarioAtual?.nome)     nome.textContent = usuarioAtual.nome;
}

// ═══════════════════════════════════════════════════════════════
// AVISOS (sem login / sem Google conectado)
// ═══════════════════════════════════════════════════════════════

function mostrarAvisoLogin() {
  const container = document.querySelector(".principal-agenda-container");
  if (!container) return;
  const aviso = document.createElement("div");
  aviso.style.cssText = "background:#fff3e0;border-radius:12px;padding:20px 30px;margin-bottom:20px;text-align:center;color:#b25400;font-size:15px;";
  aviso.innerHTML = `⚠️ Você precisa fazer login para ver sua agenda. <a href="${API_URL}/auth/login/google" style="color:#4A6FA5;font-weight:bold;">Entrar com Google</a>`;
  container.insertAdjacentElement("beforebegin", aviso);
}

function mostrarAvisoGoogle() {
  const container = document.querySelector(".principal-agenda-container");
  if (!container) return;
  const aviso = document.createElement("div");
  aviso.style.cssText = "background:#fff3e0;border-radius:12px;padding:20px 30px;margin-bottom:20px;text-align:center;color:#b25400;font-size:15px;";
  aviso.innerHTML = `📅 Conecte sua conta Google para sincronizar a agenda. <a href="#" id="btn-conectar-google" style="color:#4A6FA5;font-weight:bold;">Conectar Google Agenda</a>`;
  container.insertAdjacentElement("beforebegin", aviso);
  document.getElementById("btn-conectar-google")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = `${API_URL}/auth/google?token=${token}`;
  });
}

// ═══════════════════════════════════════════════════════════════
// EVENTOS — carregar da API
// ═══════════════════════════════════════════════════════════════

async function carregarEventos() {
  try {
    eventosCache = await apiFetch(`/usuarios/${usuarioAtual.id}/eventos`);
  } catch (err) {
    console.error("Erro ao carregar eventos:", err.message);
    eventosCache = [];
  }
}

// ═══════════════════════════════════════════════════════════════
// CALENDÁRIO — renderização
// ═══════════════════════════════════════════════════════════════

function renderizarCalendario() {
  const container = document.getElementById("calendar");
  if (!container) return;

  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth(); // 0-11
  const hoje = new Date();

  const nomeMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                     "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const diasSemana = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  // Primeiro dia do mês e total de dias
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias   = new Date(ano, mes + 1, 0).getDate();

  // Eventos deste mês, agrupados por dia
  const eventosPorDia = {};
  eventosCache.forEach((ev) => {
    const d = new Date(ev.inicio);
    if (d.getFullYear() === ano && d.getMonth() === mes) {
      const dia = d.getDate();
      if (!eventosPorDia[dia]) eventosPorDia[dia] = [];
      eventosPorDia[dia].push(ev);
    }
  });

  // Monta o HTML do calendário
  let html = `
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:12px;">
      <button onclick="mudarMes(-1)" style="background:none;border:none;font-size:22px;cursor:pointer;color:#BB6D7B;">&#8249;</button>
      <h2 style="margin:0;font-size:1.4rem;color:#5d4b4b;">${nomeMeses[mes]} ${ano}</h2>
      <button onclick="mudarMes(1)" style="background:none;border:none;font-size:22px;cursor:pointer;color:#BB6D7B;">&#8250;</button>
    </div>
    <table>
      <thead>
        <tr>${diasSemana.map((d) => `<th>${d}</th>`).join("")}</tr>
      </thead>
      <tbody>
  `;

  let dia = 1;
  for (let semana = 0; semana < 6; semana++) {
    if (dia > totalDias) break;
    html += "<tr>";
    for (let col = 0; col < 7; col++) {
      if (semana === 0 && col < primeiroDia) {
        html += "<td></td>";
      } else if (dia > totalDias) {
        html += "<td></td>";
      } else {
        const ehHoje = dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
        const eventos = eventosPorDia[dia] || [];
        const temEventos = eventos.length > 0;

        const pontinhos = temEventos
          ? `<div style="display:flex;justify-content:center;gap:3px;margin-top:3px;">
               ${eventos.slice(0, 3).map(() => `<span style="width:6px;height:6px;background:#BB6D7B;border-radius:50%;display:inline-block;"></span>`).join("")}
             </div>`
          : "";

        const eventosAttr = temEventos
          ? `data-eventos='${JSON.stringify(eventos.map((e) => e.id))}'`
          : "";

        html += `
          <td class="${ehHoje ? "hoje" : ""}" 
              ${eventosAttr}
              onclick="clicarNoDia(${dia}, ${mes}, ${ano})"
              style="cursor:pointer;vertical-align:top;padding:8px 6px;min-height:50px;">
            <div>${dia}</div>
            ${pontinhos}
          </td>
        `;
        dia++;
      }
    }
    html += "</tr>";
  }

  html += "</tbody></table>";
  container.innerHTML = html;
}

function mudarMes(delta) {
  dataAtual = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + delta, 1);
  renderizarCalendario();
}

// Ao clicar num dia — abre painel com eventos do dia ou formulário de criação
function clicarNoDia(dia, mes, ano) {
  const dataSelecionada = new Date(ano, mes, dia);
  const eventosNoDia = eventosCache.filter((ev) => {
    const d = new Date(ev.inicio);
    return d.getDate() === dia && d.getMonth() === mes && d.getFullYear() === ano;
  });

  if (eventosNoDia.length > 0) {
    // Mostra lista de eventos do dia
    abrirPainelEventosDia(dataSelecionada, eventosNoDia);
  } else {
    // Abre formulário de criação com a data pré-preenchida
    const inicio = new Date(ano, mes, dia, 8, 0);
    const fim    = new Date(ano, mes, dia, 9, 0);
    abrirModalCriar({ inicio: inicio.toISOString(), fim: fim.toISOString() });
  }
}

// ═══════════════════════════════════════════════════════════════
// PAINEL DE EVENTOS DO DIA
// ═══════════════════════════════════════════════════════════════

function abrirPainelEventosDia(data, eventos) {
  const painel = document.getElementById("painel-eventos-dia");
  const titulo = document.getElementById("painel-dia-titulo");
  const lista  = document.getElementById("painel-dia-lista");
  if (!painel || !titulo || !lista) return;

  titulo.textContent = data.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  lista.innerHTML = eventos.map((ev) => `
    <div style="background:#f9f0ef;border-radius:10px;padding:12px 15px;margin-bottom:10px;">
      <div style="font-weight:bold;color:#5d4b4b;margin-bottom:4px;">${ev.titulo}</div>
      <div style="font-size:13px;color:#888;">
        🕐 ${formatarDataHora(ev.inicio)} → ${formatarDataHora(ev.fim)}
      </div>
      ${ev.local ? `<div style="font-size:13px;color:#888;">📍 ${ev.local}</div>` : ""}
      ${ev.participantes?.length ? `<div style="font-size:12px;color:#aaa;margin-top:4px;">👥 ${ev.participantes.map((p) => p.email).join(", ")}</div>` : ""}
      ${ev.linkMeet ? `<div style="margin-top:6px;"><a href="${ev.linkMeet}" target="_blank" style="color:#4A6FA5;font-size:13px;">🎥 Abrir Google Meet</a></div>` : ""}
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button onclick="abrirModalEditar('${ev.id}')" style="background:#BB6D7B;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px;">✏️ Editar</button>
        <button onclick="deletarEvento('${ev.id}')" style="background:#EA444F;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px;">🗑️ Deletar</button>
      </div>
    </div>
  `).join("");

  painel.style.display = "block";
}

// ═══════════════════════════════════════════════════════════════
// MODAL — Criar / Editar evento
// ═══════════════════════════════════════════════════════════════

function criarModal() {
  if (document.getElementById("modal-evento")) return;

  const modal = document.createElement("div");
  modal.id = "modal-evento";
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.4);
    display:none;align-items:center;justify-content:center;z-index:2000;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;width:480px;max-width:95vw;padding:28px;box-shadow:0 8px 32px rgba(0,0,0,0.2);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 id="modal-titulo" style="margin:0;color:#BB6D7B;font-family:'Henny Penny',serif;font-size:22px;">Novo Evento</h2>
        <button onclick="fecharModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888;">✕</button>
      </div>

      <label style="display:block;margin-bottom:6px;font-size:13px;color:#555;font-weight:bold;">Título *</label>
      <input id="ev-titulo" type="text" placeholder="Ex.: Reunião de coordenação"
        style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:14px;box-sizing:border-box;">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <div>
          <label style="display:block;margin-bottom:6px;font-size:13px;color:#555;font-weight:bold;">Início *</label>
          <input id="ev-inicio" type="datetime-local"
            style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;margin-bottom:6px;font-size:13px;color:#555;font-weight:bold;">Fim *</label>
          <input id="ev-fim" type="datetime-local"
            style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
        </div>
      </div>

      <label style="display:block;margin-bottom:6px;font-size:13px;color:#555;font-weight:bold;">Local</label>
      <input id="ev-local" type="text" placeholder="Ex.: Sala 2, Google Meet..."
        style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:14px;box-sizing:border-box;">

      <label style="display:block;margin-bottom:6px;font-size:13px;color:#555;font-weight:bold;">Descrição</label>
      <textarea id="ev-descricao" rows="3" placeholder="Pauta, observações..."
        style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:14px;box-sizing:border-box;resize:vertical;"></textarea>

      <label style="display:block;margin-bottom:6px;font-size:13px;color:#555;font-weight:bold;">Convidados (e-mails, separados por vírgula)</label>
      <input id="ev-convidados" type="text" placeholder="Ex.: prof@escola.com, coord@escola.com"
        style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:20px;box-sizing:border-box;">

      <div id="modal-erro" style="display:none;background:#fdecea;color:#EA444F;padding:10px;border-radius:8px;font-size:13px;margin-bottom:14px;"></div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="fecharModal()" style="background:#f5f0f0;color:#555;border:none;border-radius:10px;padding:10px 20px;cursor:pointer;font-size:14px;">Cancelar</button>
        <button id="btn-salvar-evento" onclick="salvarEvento()" style="background:#BB6D7B;color:#fff;border:none;border-radius:10px;padding:10px 24px;cursor:pointer;font-size:14px;font-weight:bold;">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Fecha ao clicar fora
  modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });
}

function abrirModalCriar(preenchido = {}) {
  if (!usuarioAtual) { alert("Faça login primeiro."); return; }
  if (!googleStatus?.conectado) {
    alert("Conecte sua conta Google Agenda primeiro.");
    window.location.href = `${API_URL}/auth/google?token=${token}`;
    return;
  }

  eventoEditando = null;
  document.getElementById("modal-titulo").textContent = "Novo Evento";
  document.getElementById("ev-titulo").value      = "";
  document.getElementById("ev-inicio").value      = toInputDatetime(preenchido.inicio) || "";
  document.getElementById("ev-fim").value         = toInputDatetime(preenchido.fim)    || "";
  document.getElementById("ev-local").value       = "";
  document.getElementById("ev-descricao").value   = "";
  document.getElementById("ev-convidados").value  = "";
  document.getElementById("modal-erro").style.display = "none";
  document.getElementById("modal-evento").style.display = "flex";
  setTimeout(() => document.getElementById("ev-titulo").focus(), 50);
}

function abrirModalEditar(eventoId) {
  const ev = eventosCache.find((e) => e.id === eventoId);
  if (!ev) return;

  eventoEditando = ev;
  document.getElementById("modal-titulo").textContent    = "Editar Evento";
  document.getElementById("ev-titulo").value             = ev.titulo || "";
  document.getElementById("ev-inicio").value             = toInputDatetime(ev.inicio);
  document.getElementById("ev-fim").value                = toInputDatetime(ev.fim);
  document.getElementById("ev-local").value              = ev.local || "";
  document.getElementById("ev-descricao").value          = ev.descricao || "";
  document.getElementById("ev-convidados").value         = (ev.participantes || []).map((p) => p.email).join(", ");
  document.getElementById("modal-erro").style.display    = "none";
  document.getElementById("modal-evento").style.display  = "flex";

  // Fecha o painel do dia se estiver aberto
  const painel = document.getElementById("painel-eventos-dia");
  if (painel) painel.style.display = "none";
}

function fecharModal() {
  document.getElementById("modal-evento").style.display = "none";
  eventoEditando = null;
}

// ═══════════════════════════════════════════════════════════════
// SALVAR EVENTO (criar ou editar)
// ═══════════════════════════════════════════════════════════════

async function salvarEvento() {
  const titulo     = document.getElementById("ev-titulo").value.trim();
  const inicio     = document.getElementById("ev-inicio").value;
  const fim        = document.getElementById("ev-fim").value;
  const local      = document.getElementById("ev-local").value.trim();
  const descricao  = document.getElementById("ev-descricao").value.trim();
  const convidados = document.getElementById("ev-convidados").value
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));

  const erroEl = document.getElementById("modal-erro");

  if (!titulo || !inicio || !fim) {
    erroEl.textContent = "Título, início e fim são obrigatórios.";
    erroEl.style.display = "block";
    return;
  }

  if (new Date(inicio) >= new Date(fim)) {
    erroEl.textContent = "O fim deve ser depois do início.";
    erroEl.style.display = "block";
    return;
  }

  erroEl.style.display = "none";
  const btn = document.getElementById("btn-salvar-evento");
  btn.textContent = "Salvando...";
  btn.disabled = true;

  const corpo = {
    titulo,
    inicio: new Date(inicio).toISOString(),
    fim:    new Date(fim).toISOString(),
    local,
    descricao,
    participantes: convidados,
  };

  try {
    if (eventoEditando) {
      // Por enquanto a API não tem rota PUT/PATCH de evento — deleta e recria
      await apiFetch(`/usuarios/${usuarioAtual.id}/eventos/${eventoEditando.id}`, { method: "DELETE" });
      await apiFetch(`/usuarios/${usuarioAtual.id}/eventos`, {
        method: "POST",
        body: JSON.stringify(corpo),
      });
    } else {
      await apiFetch(`/usuarios/${usuarioAtual.id}/eventos`, {
        method: "POST",
        body: JSON.stringify(corpo),
      });
    }

    fecharModal();
    await carregarEventos();
    renderizarCalendario();
    renderizarAulasHoje();
    mostrarToast(eventoEditando ? "Evento atualizado com sucesso! ✅" : "Evento criado com sucesso! ✅");
  } catch (err) {
    erroEl.textContent = "Erro ao salvar: " + err.message;
    erroEl.style.display = "block";
  } finally {
    btn.textContent = "Salvar";
    btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETAR EVENTO
// ═══════════════════════════════════════════════════════════════

async function deletarEvento(eventoId) {
  if (!confirm("Tem certeza que deseja deletar este evento? Ele será removido da sua agenda do Google.")) return;

  try {
    await apiFetch(`/usuarios/${usuarioAtual.id}/eventos/${eventoId}`, { method: "DELETE" });
    await carregarEventos();
    renderizarCalendario();
    renderizarAulasHoje();

    // Fecha o painel do dia
    const painel = document.getElementById("painel-eventos-dia");
    if (painel) painel.style.display = "none";

    mostrarToast("Evento deletado com sucesso! 🗑️");
  } catch (err) {
    alert("Erro ao deletar evento: " + err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ORDEM DE AULAS DE HOJE
// ═══════════════════════════════════════════════════════════════

function renderizarAulasHoje() {
  const lista = document.getElementById("listaAulas");
  if (!lista) return;

  const hoje = new Date();
  const eventosHoje = eventosCache.filter((ev) => {
    const d = new Date(ev.inicio);
    return d.getDate()     === hoje.getDate() &&
           d.getMonth()    === hoje.getMonth() &&
           d.getFullYear() === hoje.getFullYear();
  }).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  if (eventosHoje.length === 0) {
    lista.innerHTML = `<p style="color:#aaa;font-size:14px;text-align:center;">Nenhum evento para hoje.</p>`;
    return;
  }

  lista.innerHTML = eventosHoje.map((ev) => {
    const hora = new Date(ev.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#fff;border-radius:10px;margin-bottom:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <span style="font-weight:bold;color:#BB6D7B;font-size:15px;min-width:45px;">${hora}</span>
        <span style="flex:1;color:#5d4b4b;font-size:14px;">${ev.titulo}</span>
        ${ev.linkMeet ? `<a href="${ev.linkMeet}" target="_blank" style="color:#4A6FA5;font-size:13px;">🎥 Meet</a>` : ""}
        <button onclick="abrirModalEditar('${ev.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;" title="Editar">✏️</button>
        <button onclick="deletarEvento('${ev.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;" title="Deletar">🗑️</button>
      </div>
    `;
  }).join("");
}

// ═══════════════════════════════════════════════════════════════
// BOTÃO FLUTUANTE "NOVO EVENTO"
// ═══════════════════════════════════════════════════════════════

function criarBotaoCriarEvento() {
  const btn = document.createElement("button");
  btn.id = "btn-novo-evento";
  btn.textContent = "+ Novo Evento";
  btn.style.cssText = `
    position:fixed;bottom:30px;right:30px;
    background:#BB6D7B;color:#fff;border:none;border-radius:30px;
    padding:14px 24px;font-size:15px;font-weight:bold;cursor:pointer;
    box-shadow:0 4px 16px rgba(187,109,123,0.4);z-index:1000;
    transition:transform 0.2s,box-shadow 0.2s;font-family:'Comfortaa',sans-serif;
  `;
  btn.onmouseenter = () => { btn.style.transform = "translateY(-3px)"; btn.style.boxShadow = "0 6px 20px rgba(187,109,123,0.5)"; };
  btn.onmouseleave = () => { btn.style.transform = ""; btn.style.boxShadow = "0 4px 16px rgba(187,109,123,0.4)"; };
  btn.onclick = () => abrirModalCriar();
  document.body.appendChild(btn);
}

// ═══════════════════════════════════════════════════════════════
// TOAST — feedback visual rápido
// ═══════════════════════════════════════════════════════════════

function mostrarToast(msg) {
  const toast = document.createElement("div");
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed;bottom:100px;right:30px;
    background:#3B6D11;color:#fff;padding:12px 20px;
    border-radius:10px;font-size:14px;z-index:3000;
    box-shadow:0 4px 12px rgba(0,0,0,0.2);
    animation:fadeIn 0.3s ease;font-family:'Comfortaa',sans-serif;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}