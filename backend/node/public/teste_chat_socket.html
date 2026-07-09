<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Teste — Chat em tempo real (Guará)</title>
  <style>
    body { font-family: sans-serif; max-width: 500px; margin: 40px auto; color: #333; }
    h1 { color: #BB6D7B; font-size: 20px; }
    #mensagens { border: 1px solid #ddd; border-radius: 8px; padding: 12px; height: 250px; overflow-y: auto; margin-bottom: 12px; background: #fafafa; }
    .msg { margin-bottom: 8px; }
    .msg b { color: #4A6FA5; }
    input, button { padding: 8px; font-size: 14px; }
    input[type="text"] { width: 60%; }
    label { display: block; margin: 6px 0 2px; font-size: 13px; color: #666; }
  </style>
</head>
<body>
  <h1>🦅 Teste — Chat em tempo real</h1>

  <label>ID do chat (sala):</label>
  <input type="number" id="chatId" value="1">
  <button onclick="entrarNoChat()">Entrar no chat</button>

  <div id="mensagens"></div>

  <label>ID do usuário (quem está enviando):</label>
  <input type="number" id="usuarioId" value="1">
  <label>Mensagem:</label>
  <input type="text" id="texto" placeholder="Digite sua mensagem...">
  <button onclick="enviarMensagem()">Enviar</button>

  <!-- Biblioteca cliente do Socket.IO, servida automaticamente pelo backend -->
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io(); // conecta no mesmo host/porta que serviu esta página
    const divMensagens = document.getElementById("mensagens");
    let chatAtual = null;

    function entrarNoChat() {
      const novoChatId = document.getElementById("chatId").value;
      if (chatAtual) socket.emit("sair_chat", chatAtual);
      chatAtual = novoChatId;
      socket.emit("entrar_chat", chatAtual);
      divMensagens.innerHTML = `<i>Entrou na sala do chat ${chatAtual}...</i>`;
    }

    // Recebe mensagens novas em tempo real
    socket.on("nova_mensagem", (msg) => {
      const p = document.createElement("div");
      p.className = "msg";
      p.innerHTML = `<b>${msg.autor}:</b> ${msg.texto}`;
      divMensagens.appendChild(p);
      divMensagens.scrollTop = divMensagens.scrollHeight;
    });

    async function enviarMensagem() {
      const texto = document.getElementById("texto").value;
      const usuarioId = document.getElementById("usuarioId").value;
      if (!texto || !chatAtual) {
        alert("Entre em um chat e digite uma mensagem primeiro.");
        return;
      }

      await fetch(`/chats/${chatAtual}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: usuarioId, texto }),
      });

      document.getElementById("texto").value = "";
      // Não precisamos atualizar a tela manualmente aqui:
      // o evento "nova_mensagem" do socket vai cuidar disso,
      // inclusive para quem está enviando.
    }

    // Permite enviar com Enter
    document.getElementById("texto").addEventListener("keypress", (e) => {
      if (e.key === "Enter") enviarMensagem();
    });

    // Entra automaticamente no chat 1 ao carregar a página
    entrarNoChat();
  </script>
</body>
</html>
