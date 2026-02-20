<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!--                         ORION  ·  README.md                           -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->

<div align="center">

<!-- ── Hero SVG Banner ─────────────────────────────────────────────────── -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 200" width="860" height="200" role="img" aria-label="ORION banner">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#0f0f13"/>
      <stop offset="100%" stop-color="#1a1a2e"/>
    </linearGradient>
    <linearGradient id="txt" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#7c6af7"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="860" height="200" rx="16" fill="url(#bg)"/>

  <!-- Decorative orbit rings -->
  <g transform="translate(100,100)" fill="none" stroke="#7c6af7" opacity="0.18">
    <circle cx="0" cy="0" r="72" stroke-width="1.2"/>
    <circle cx="0" cy="0" r="48" stroke-width="0.8"/>
    <line x1="-80" y1="0" x2="80" y2="0" stroke-width="0.8"/>
    <line x1="0" y1="-80" x2="0" y2="80" stroke-width="0.8"/>
    <line x1="-57" y1="-57" x2="57" y2="57" stroke-width="0.6"/>
    <line x1="57" y1="-57" x2="-57" y2="57" stroke-width="0.6"/>
  </g>
  <!-- Core star -->
  <g transform="translate(100,100)" filter="url(#glow)">
    <circle cx="0" cy="0" r="7" fill="#7c6af7"/>
    <circle cx="0"  cy="-72" r="3" fill="#a78bfa"/>
    <circle cx="72" cy="0"   r="3" fill="#a78bfa"/>
    <circle cx="0"  cy="72"  r="3" fill="#a78bfa"/>
    <circle cx="-72" cy="0" r="3" fill="#a78bfa"/>
  </g>

  <!-- Title -->
  <text x="210" y="105" font-family="'Segoe UI',system-ui,sans-serif"
        font-size="72" font-weight="700" letter-spacing="18"
        fill="url(#txt)" filter="url(#glow)">ORION</text>

  <!-- Subtitle -->
  <text x="214" y="140" font-family="'Segoe UI',system-ui,sans-serif"
        font-size="14" fill="#888899" letter-spacing="2.5">
    OPTIMAL RANDOM INTERACTIVE ONLINE NETWORK
  </text>

  <!-- Accent line -->
  <line x1="210" y1="152" x2="720" y2="152" stroke="#7c6af7" stroke-width="1" opacity="0.4"/>
</svg>

<!-- ── Badges ──────────────────────────────────────────────────────────── -->

[![Version](https://img.shields.io/badge/version-1.0.0-7c6af7?style=flat-square&logo=git&logoColor=white)](https://github.com/Kaelith69/ORION)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D14-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?style=flat-square&logo=socketdotio&logoColor=white)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Project Structure](#project-structure)
5. [Installation](#installation)
6. [Usage](#usage)
7. [Configuration](#configuration)
8. [Contributing](#contributing)
9. [License](#license)

---

## Overview

ORION is a **real-time, anonymous random chat platform** built on Node.js.  
Two strangers are instantly paired together for a private, ephemeral conversation — no accounts, no history, no trace.

> 🎬 *Imagine a quirky little GIF of two satellites pinging each other here — pure cosmic vibes.*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                        │
│                                                                 │
│   index.html  ◄─── styles.css        client.js                 │
│                                           │                     │
│                                    Socket.IO client             │
└──────────────────────────────────────┬────────────────────────┘
                                       │  WebSocket / HTTP
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         server.js (Node.js)                     │
│                                                                 │
│  ┌───────────┐   ┌──────────────┐   ┌────────────────────────┐ │
│  │  Express  │   │  Socket.IO   │   │     Chat Engine        │ │
│  │  (HTTP +  │   │  (real-time  │   │  waitingPool : Set<id> │ │
│  │  static)  │   │  transport)  │   │  activePairs : Map<id> │ │
│  └───────────┘   └──────┬───────┘   └────────────────────────┘ │
│                         │                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Middleware: HTTP rate-limit · Message rate-limit          │ │
│  │             Bad-Words filter · Payload size guard         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key design decisions

| Concern | Solution |
|---|---|
| Partner matching | `waitingPool` (`Set`) + `activePairs` (`Map`) — O(1) operations |
| Stale-socket safety | Pool is purged of dead sockets before each match attempt |
| Message abuse | Per-connection sliding-window rate limiter (10 msg / 5 s) |
| HTTP abuse | `express-rate-limit` (200 req / 15 min) |
| Content safety | `bad-words` filter; unknown-word errors are caught gracefully |
| Oversized payloads | `maxHttpBufferSize: 10 KB` on the Socket.IO server |
| Memory leaks | Full cleanup on every `disconnect` event |

---

## Features

- 🔒 **Fully anonymous** — no sign-up, no stored messages
- ⚡ **Real-time** — sub-millisecond delivery via WebSocket
- 🔄 **Skip / Next** — move to the next stranger without leaving the page
- 🚫 **Profanity filter** — `bad-words` scrubs messages before delivery
- 🛡️ **Rate limiting** — both HTTP (express) and per-socket (message layer)
- 💬 **System messages** — in-chat notifications for join / leave / skip events
- 📱 **Responsive** — fluid layout down to 320 px wide
- 🎨 **Dark-mode UI** — easy on the eyes at any hour

---

## Project Structure

```
ORION/
├── public/
│   ├── index.html      # App shell — semantic HTML, accessible markup
│   ├── styles.css      # CSS custom-properties, dark theme, animations
│   └── client.js       # Socket.IO client, DOM state machine
├── server.js           # Express + Socket.IO server, chat engine
├── package.json        # Dependencies & npm scripts
├── .gitignore          # Excludes node_modules, .env, build artefacts
└── README.md           # You are here 🚀
```

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) **v14 or later**
- npm (bundled with Node.js)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/ORION.git
cd ORION

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open in your browser
#    http://localhost:3000
```

For a live-reload development workflow:

```bash
npm run dev   # uses nodemon
```

---

## Usage

| Action | How |
|---|---|
| Start chatting | Click **New Chat** |
| Send a message | Type and press **Enter** or click ▶ |
| Move to next stranger | Click **Skip** |
| End the session | Click **Leave** |

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | TCP port the server listens on |

```bash
PORT=8080 npm start
```

---

## Configuration

Fine-tune behaviour by editing the constants at the top of `server.js`:

```js
const PORT                = process.env.PORT || 3000;
const MAX_MESSAGE_LENGTH  = 500;   // characters per message
const MESSAGE_RATE_LIMIT  = 10;    // messages per window per user
const MESSAGE_RATE_WINDOW_MS = 5000; // sliding window (ms)
```

---

## Contributing

Contributions are welcome! Here's the flow:

```bash
# 1. Fork & clone
git clone https://github.com/<your-handle>/ORION.git

# 2. Create a feature branch
git checkout -b feat/my-improvement

# 3. Make changes, then commit
git commit -m "feat: add my improvement"

# 4. Push and open a Pull Request
git push origin feat/my-improvement
```

Please follow existing code style (no linter is configured yet — keep it clean).

---

## License

Distributed under the **MIT License**.  
See [`LICENSE`](https://opensource.org/licenses/MIT) for details.

---

<div align="center">

*Built with ☕ and Socket.IO magic*

---

> **Why do programmers prefer dark mode?**  
> *Because light attracts bugs.* 🐛

</div>

