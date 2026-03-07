# heis
H.I.E.S — the Human Existential Ideals Extraction System — is a tool built to do one thing before ASI arrives: formally ask every human being what they value, record their answer permanently and verifiably, and aggregate all of it into a collective ideal that can be used to align artificial superintelligence to the actual stated preferences of humanity



# Human Ideal Extraction System — Web App

## Setup

```bash
# 1. Install dependencies (Node.js required)
npm install

# 2. Start the server
npm start
# or for auto-reload during development:
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Development shortcuts

| URL | What it does |
|-----|--------------|
| `http://localhost:3000` | Full experience from the cover |
| `http://localhost:3000?dev=1` | Skip intro — go straight to questions (name = "Dev") |
| `http://localhost:3000?screen=collective` | Jump to collective view |
| `http://localhost:3000?screen=questions` | Jump to questions (no name set) |
| `http://localhost:3000?fast=0` | Slow typewriter mode (when implemented) |

---

## Project structure

```
facing_fate/
├── server.js          ← Express backend
├── package.json
├── data.json          ← Questions, facts, visions, proclamations, mission steps
├── value_set.json     ← 202 values across 12 domains
├── database.db        ← SQLite — auto-created on first run
├── public/
│   ├── index.html     ← Shell
│   ├── style.css      ← Design system
│   └── app.js         ← Frontend application
└── README.md
```

---

## API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/data` | Full data.json content |
| GET | `/api/values` | Full value_set.json content |
| POST | `/api/profile` | Save a completed profile |
| GET | `/api/profile/:id` | Retrieve one profile by ID |
| GET | `/api/collective` | Aggregate of all profiles |
| GET | `/api/stats` | Total count + 10 most recent |

---

## Content editing

To change questions, facts, visions, or proclamations — edit `data.json`.
To add or change values — edit `value_set.json`.
Neither requires restarting the server (data is loaded per-request for `/api/data` and `/api/values`).

Wait — actually, `data.json` and `value_set.json` are loaded once at startup in `server.js`.
To hot-reload them, restart the server, or change `loadData()` to read on each request.

---

## Cryptography

The browser generates an **ECDSA P-256** key pair using the Web Crypto API.
This is built into every modern browser — no libraries required.

- The private key is exported as JWK and downloaded by the user.
- The public key is stored in the profile.
- The profile is signed before saving.
- Anyone holding the profile JSON can verify it using the embedded public key.

To verify a profile signature later, the verification function is:
```javascript
const valid = await window.crypto.subtle.verify(
  { name: 'ECDSA', hash: 'SHA-256' },
  publicKey,  // imported from profile.public_key_jwk
  sigBytes,   // decoded from profile.signature
  encoded     // JSON.stringify of profile fields, sorted keys
)
```

---

## Next steps

- [ ] Value scoring screen (202 values,  sliders each)
- [ ] Verify profile page (upload .json + .jwk, check signature)
- [ ] Auth — return to update your denend
- [ ] Gap map visualisation
- [ ] Export collective as CSV/JSON
- [ ] Deploy to production (swap SQLite → PostgreSQL)
