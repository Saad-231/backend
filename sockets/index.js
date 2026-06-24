const registerChatHandlers = require('./chatSocket');

/**
 * Attaches all socket namespaces/handlers to the given io instance.
 */
function initSockets(io) {
  io.on('connection', (socket) => {
    console.log(`[NovaScribe] Socket connected: ${socket.id}`);

    registerChatHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[NovaScribe] Socket disconnected: ${socket.id} (${reason})`);
    });
  });
}

module.exports = initSockets;
