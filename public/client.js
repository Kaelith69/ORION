'use strict';

// ── Socket connection ─────────────────────────────────────────────────────────
const socket = io({ autoConnect: true, reconnectionAttempts: 5 });

// ── DOM references ────────────────────────────────────────────────────────────
const statusBar   = document.getElementById('status-bar');
const statusDot   = document.getElementById('status-dot');   // visual state via CSS on statusBar
const statusText  = document.getElementById('status-text');
const chatBox     = document.getElementById('chat-box');
const inputArea   = document.getElementById('input-area');
const messageInput = document.getElementById('message-input');
const sendBtn     = document.getElementById('send-btn');
const newChatBtn  = document.getElementById('new-chat-btn');
const skipBtn     = document.getElementById('skip-btn');
const leaveBtn    = document.getElementById('leave-btn');

// ── UI state helpers ──────────────────────────────────────────────────────────
const States = Object.freeze({ IDLE: 'idle', WAITING: 'waiting', CONNECTED: 'connected' });
let currentState = States.IDLE;

function setStatus(state, text) {
  currentState = state;
  statusBar.className = `status-bar ${state}`;
  statusText.innerHTML = text;
}

function enableInput(on) {
  inputArea.setAttribute('aria-hidden', String(!on));
  messageInput.disabled = !on;
  sendBtn.disabled = !on;
  if (on) messageInput.focus();
}

function showControls(state) {
  newChatBtn.classList.toggle('hidden', state === States.WAITING || state === States.CONNECTED);
  skipBtn.classList.toggle('hidden',    state !== States.CONNECTED);
  leaveBtn.classList.toggle('hidden',   state !== States.CONNECTED);
}

function applyState(state, statusHtml) {
  setStatus(state, statusHtml);
  enableInput(state === States.CONNECTED);
  showControls(state);
}

// ── Chat box helpers ──────────────────────────────────────────────────────────
function clearChat() {
  chatBox.innerHTML = '<div class="chat-placeholder"><p>Your messages will appear here.</p></div>';
}

function appendMessage(text, type) {
  // Remove placeholder on first real message
  const placeholder = chatBox.querySelector('.chat-placeholder');
  if (placeholder) placeholder.remove();

  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendSystem(text) {
  appendMessage(text, 'system');
}

// ── Button handlers ───────────────────────────────────────────────────────────
newChatBtn.addEventListener('click', () => {
  clearChat();
  applyState(States.WAITING, 'Searching for a partner…');
  socket.emit('find-partner');
});

skipBtn.addEventListener('click', () => {
  appendSystem('You skipped to the next stranger.');
  clearChat();
  applyState(States.WAITING, 'Searching for a new partner…');
  socket.emit('skip');
});

leaveBtn.addEventListener('click', () => {
  appendSystem('You left the chat.');
  clearChat();
  applyState(States.IDLE, 'Idle — click <strong>New Chat</strong> to begin');
  socket.emit('leave-chat');
});

// ── Send message ──────────────────────────────────────────────────────────────
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || currentState !== States.CONNECTED) return;
  socket.emit('send-message', text);
  messageInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ── Socket event handlers ─────────────────────────────────────────────────────
socket.on('waiting', () => {
  applyState(States.WAITING, 'Searching for a partner…');
});

socket.on('partner-found', () => {
  applyState(States.CONNECTED, 'Connected to a stranger');
  appendSystem('You are now chatting with a stranger. Say hi!');
});

socket.on('message', ({ text, self }) => {
  appendMessage(text, self ? 'self' : 'other');
});

socket.on('partner-disconnected', () => {
  appendSystem('Your partner has disconnected.');
  applyState(States.IDLE, 'Partner left — click <strong>New Chat</strong> to find someone new');
});

socket.on('rate-limited', ({ retryAfter }) => {
  const secs = Math.ceil(retryAfter / 1000);
  appendSystem(`You are sending messages too fast. Please wait ${secs}s.`);
  setStatus(States.CONNECTED, `⚠ Slow down — rate limited for ${secs}s`);
  // Restore normal status after the window
  setTimeout(() => {
    if (currentState === States.CONNECTED) {
      setStatus(States.CONNECTED, 'Connected to a stranger');
    }
  }, retryAfter);
});

socket.on('idle', () => {
  applyState(States.IDLE, 'Idle — click <strong>New Chat</strong> to begin');
});

socket.on('disconnect', () => {
  applyState(States.IDLE, 'Disconnected from server — refresh to reconnect');
  enableInput(false);
});

socket.on('connect_error', () => {
  setStatus(States.IDLE, 'Connection error — retrying…');
});
