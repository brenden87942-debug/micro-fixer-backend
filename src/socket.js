let io;

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: { origin: '*' } });
  io.on('connection', (socket) => {
    console.log('socket connected', socket.id);
    socket.on('join', (room) => {
      socket.join(room);
    });
  });
}

function emit(event, payload) {
  if (io) io.emit(event, payload);
}

module.exports = { initSocket, emit };
