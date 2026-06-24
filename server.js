const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const config = require('./config/env');
const initSockets = require('./sockets');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.clientOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

initSockets(io);

server.listen(config.port, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  NovaScribe.AI backend is running');
  console.log(`  → http://localhost:${config.port}`);
  console.log(`  → Allowed client origin: ${config.clientOrigin}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
