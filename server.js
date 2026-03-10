require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ IMPORTANT pour Railway — fait confiance au proxy
app.set('trust proxy', 1);

// Security
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-please',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());
require('./middleware/passport')(passport);

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.use('/', require('./routes/pages'));

// Serveur HTTP pour Socket.io
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

const OWNER_ID = '1476955134280863774';
const chatMessages = [];
const MAX_MESSAGES = 100;

let onlineCount = 0;

io.on('connection', (socket) => {
  onlineCount++;
  io.emit('online:count', onlineCount);
  socket.emit('chat:history', chatMessages);

  socket.on('chat:send', (data) => {
    if (!data.message || data.message.trim().length === 0) return;
    const isOwner = data.userId === OWNER_ID;
    const msg = {
      id: Date.now(),
      userId: data.userId,
      username: isOwner ? data.username : 'Anonyme',
      avatar: data.avatar,
      message: data.message.trim().substring(0, 500),
      isOwner,
      timestamp: new Date().toISOString()
    };
    chatMessages.push(msg);
    if (chatMessages.length > MAX_MESSAGES) chatMessages.shift();
    io.emit('chat:message', msg);
  })
  socket.on('disconnect', () => {
    onlineCount = Math.max(0, onlineCount - 1);
    io.emit('online:count', onlineCount);
  });
;
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
