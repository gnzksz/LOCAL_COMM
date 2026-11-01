import http from 'node:http';
import { Server } from 'socket.io';
import { app, corsOrigin } from './app.js';
import { config } from './config.js';
import { verifyToken } from './middleware/auth.js';
import { attachSocket } from './services/notify.js';

const server = http.createServer(app);

// Real-time channel: clients connect with { auth: { token } } and are placed in
// "user:<id>" (personal notifications) and "role:<role>" (e.g. admin dashboard feed).
const io = new Server(server, { cors: { origin: corsOrigin } });
io.use((socket, next) => {
  try {
    socket.data.user = verifyToken(socket.handshake.auth?.token);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});
io.on('connection', (socket) => {
  const { id, role } = socket.data.user;
  socket.join(`user:${id}`);
  socket.join(`role:${role}`);
});
attachSocket(io);

server.listen(config.port, () => {
  console.log(`LOCAL_COMM backend listening on http://localhost:${config.port}`);
});
