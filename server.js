'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Filter = require('bad-words');
const rateLimit = require('express-rate-limit');
const path = require('path');

// ── Configuration ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const MAX_MESSAGE_LENGTH = 500;

// ── App setup ────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false },
  maxHttpBufferSize: 1e4, // 10 KB – prevents oversized payloads
});
const filter = new Filter();

// ── HTTP rate-limiting (prevents DoS on static assets / handshake) ───────────
const httpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(httpLimiter);
app.use(express.static(path.join(__dirname, 'public')));

// ── Chat state ────────────────────────────────────────────────────────────────
// waitingPool – Set<socketId>  – users looking for a partner
// activePairs – Map<socketId, socketId> – bidirectional partner mapping
const waitingPool = new Set();
const activePairs = new Map();

// ── Helper: retrieve a live socket by id ─────────────────────────────────────
function getLiveSocket(id) {
  return io.sockets.sockets.get(id) || null;
}

// ── Helper: cleanly unpair two users and notify the survivor ─────────────────
function unpair(socketId, notify = true) {
  const partnerId = activePairs.get(socketId);
  if (!partnerId) return;

  activePairs.delete(socketId);
  activePairs.delete(partnerId);

  if (notify) {
    const partnerSocket = getLiveSocket(partnerId);
    if (partnerSocket) {
      partnerSocket.emit('partner-disconnected');
    }
  }
}

// ── Helper: match a socket with a waiting peer, or add to waitingPool ────────
function matchOrWait(socket) {
  // Drain stale entries from the pool first
  for (const id of waitingPool) {
    if (!getLiveSocket(id)) {
      waitingPool.delete(id);
    }
  }

  // Find a valid waiting peer (not ourselves)
  for (const candidateId of waitingPool) {
    if (candidateId === socket.id) continue;

    waitingPool.delete(candidateId);
    const candidateSocket = getLiveSocket(candidateId);
    if (!candidateSocket) continue; // candidate just disconnected – try next

    // Pair both sockets
    activePairs.set(socket.id, candidateId);
    activePairs.set(candidateId, socket.id);

    socket.emit('partner-found');
    candidateSocket.emit('partner-found');
    return;
  }

  // No valid peer found – join waiting pool
  waitingPool.add(socket.id);
  socket.emit('waiting');
}

// ── Socket.IO per-connection rate limiter ─────────────────────────────────────
const MESSAGE_RATE_WINDOW_MS = 5000;
const MESSAGE_RATE_LIMIT = 10; // max messages per window per user

// ── Socket event handling ─────────────────────────────────────────────────────
io.on('connection', (socket) => {
  let messageCount = 0;
  let rateLimitTimer = null;

  function resetRateWindow() {
    messageCount = 0;
    rateLimitTimer = null;
  }

  // ── find-partner ────────────────────────────────────────────────────────────
  socket.on('find-partner', () => {
    // Prevent duplicate requests while already paired or waiting
    if (activePairs.has(socket.id) || waitingPool.has(socket.id)) return;
    matchOrWait(socket);
  });

  // ── send-message ────────────────────────────────────────────────────────────
  socket.on('send-message', (raw) => {
    // Type and length validation
    if (typeof raw !== 'string') return;
    const text = raw.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;

    // Must have an active partner
    const partnerId = activePairs.get(socket.id);
    if (!partnerId) return;

    // Per-connection message rate limiting
    messageCount += 1;
    if (messageCount > MESSAGE_RATE_LIMIT) {
      socket.emit('rate-limited', { retryAfter: MESSAGE_RATE_WINDOW_MS });
      return;
    }
    if (!rateLimitTimer) {
      rateLimitTimer = setTimeout(resetRateWindow, MESSAGE_RATE_WINDOW_MS);
    }

    // Sanitize with profanity filter (never crash on unknown words)
    let sanitized;
    try {
      sanitized = filter.clean(text);
    } catch {
      sanitized = text;
    }

    // Deliver to partner; echo back to sender with self flag
    const partnerSocket = getLiveSocket(partnerId);
    if (partnerSocket) {
      partnerSocket.emit('message', { text: sanitized, self: false });
    }
    socket.emit('message', { text: sanitized, self: true });
  });

  // ── skip / voluntary disconnect-from-partner ─────────────────────────────
  socket.on('skip', () => {
    unpair(socket.id, true);
    // Re-enter the pool immediately
    matchOrWait(socket);
  });

  // ── leave-chat ───────────────────────────────────────────────────────────
  socket.on('leave-chat', () => {
    unpair(socket.id, true);
    waitingPool.delete(socket.id);
    socket.emit('idle');
  });

  // ── clean up when the socket closes ──────────────────────────────────────
  socket.on('disconnect', () => {
    if (rateLimitTimer) clearTimeout(rateLimitTimer);
    waitingPool.delete(socket.id);
    unpair(socket.id, true);
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`ORION server listening on http://localhost:${PORT}`);
});
