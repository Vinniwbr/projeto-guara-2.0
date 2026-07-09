// socket.js — Configuração do Socket.IO para chat em tempo real
const { Server } = require("socket.io");

let io = null; // referência global, preenchida em inicializarSocket()

function inicializarSocket(servidorHttp) {
  io = new Server(servidorHttp, {
    cors: {
      origin: "*", // em produção, troque "*" pelo domínio real do frontend
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket conectado: ${socket.id}`);

    // O frontend chama isso ao abrir a tela de um chat específico
    socket.on("entrar_chat", (chatId) => {
      socket.join(`chat_${chatId}`);
      console.log(`Socket ${socket.id} entrou na sala chat_${chatId}`);
    });

    // O frontend chama isso ao fechar/saiar da tela do chat
    socket.on("sair_chat", (chatId) => {
      socket.leave(`chat_${chatId}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket desconectado: ${socket.id}`);
    });
  });

  return io;
}

// Chamado pelo server.js depois de salvar uma mensagem no banco,
// para notificar todo mundo que está na sala daquele chat.
function notificarNovaMensagem(chatId, mensagem) {
  if (!io) return;
  io.to(`chat_${chatId}`).emit("nova_mensagem", mensagem);
}

module.exports = {
  inicializarSocket,
  notificarNovaMensagem,
};
