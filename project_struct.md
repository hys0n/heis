# project_struct.md
## The Human Ideal — Project File Structure

---

```
facing_fate/
│
├── mission_articulation.py        ← THE MAIN PROGRAM  (2500 lines, v9)
│                                    Run with: python3 mission_articulation.py
│                                    No pip. No external libraries. Pure stdlib.
│
├── value_set.json                 ← VALUE REGISTRY  (machine-readable, runtime)
│                                    Loaded at startup by mission_articulation.py
│                                    12 domains, ~228 values, definitions included
│                                    Fallback to seed list if file not found
│
├── value_set.md                   ← VALUE REGISTRY  (human-readable, canonical)
│                                    The source of truth for value_set.json
│                                    Rules, three-state architecture, full tables
│                                    Version 0.2 — 12 domains, ~228 values
│
├── Arms_of_Humanity.md            ← ENTITY REGISTRY
│                                    All armhs: current (12) and ideal (6)
│                                    Obligations, power estimates, alignment status
│                                    The convergence principle
│
├── doctrine.md                    ← DOCTRINE  (formerly statements0.md)
│                                    Every # comment sentence from the code as doctrine
│                                    The decisive axiom, proclamation categories,
│                                    aggregation tiers, crypto parameters, language layers
│
├── session_hand_off.md            ← SESSION CONTINUITY
│                                    Summary for handing off between Claude instances
│                                    What was done, what remains, key design decisions
│
├── project_struct.md              ← THIS FILE
│                                    Folder tree and file descriptions
│
│
│   ── GENERATED AT RUNTIME (one per contributor) ──
│
├── profile_<name>_<id>.json       ← DENEND  (the contributor's signed record)
│                                    Contains: answers to 7 questions, value scores,
│                                    detected values, cryptographic proof block
│                                    Signed with contributor's RSA-2048 private key
│
└── <name>_<id>_PRIVATE_KEY.pem    ← PRIVATE KEY  (contributor keeps this)
                                     RSA-2048, PKCS#1 format, permissions 0600
                                     The only thing that can prove authorship
                                     No copy exists. Generated once, from entropy.
```

---

## File Roles

| File | Role | Touches |
|------|------|---------|
| `mission_articulation.py` | Main program — runs the full session | Reads `value_set.json`, writes `profile_*.json`, writes `*.pem` |
| `value_set.json` | Machine-readable value registry | Read by `mission_articulation.py` at startup |
| `value_set.md` | Human-readable value registry | Source for `value_set.json`; reference for contributors |
| `Arms_of_Humanity.md` | Entity registry | Reference — not yet read by code |
| `doctrine.md` | Project doctrine | Reference — distilled from code comments |
| `session_hand_off.md` | Session continuity | Written at session end; read at next session start |
| `project_struct.md` | This file | Reference only |
| `profile_*.json` | Contributor denend | Written by program; verified by `verify_profile_signature()` |
| `*_PRIVATE_KEY.pem` | Contributor private key | Written by program; kept by contributor |

---

## Data Flow

```
                  value_set.json
                       │
                       ▼ (loaded at startup)
              mission_articulation.py
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    show_intro    run_extraction  run_value_scoring
          │            │            │
          └────────────┴────────────┘
                       │
                       ▼
                 profile dict
                       │
               generate_keypair
               (entropy XOR pwd)
                       │
                       ▼
             save_profile ──────► profile_<name>_<id>.json
             save_private_key ──► <name>_<id>_PRIVATE_KEY.pem
                       │
                       ▼
             aggregate_visions ──► display_collective
```

---

## What Each Generated File Contains

### `profile_<name>_<id>.json`

```json
{
  "profile_id":      "h_<hex timestamp>",
  "name":            "<contributor name or pseudonym>",
  "recorded_at":     "YYYY-MM-DD HH:MM:SS",
  "detected_values": ["agency", "truth", ...],
  "answers": {
    "The Society You Would Design":             "<answer>",
    "What You Would Do With What There Is":     "<answer>",
    "Who Should Have Power -- ...":             "<answer>",
    "When Pain Is Worth It -- ...":             "<answer>",
    "How People Who Disagree Can Share a World":"<answer>",
    "What Would Make Your Life Feel Worth ...": "<answer>",
    "Where Your Life Currently Falls Short":    "<answer>"
  },
  "value_scores": {
    "agency":    { "given": 60, "given_by": 70, "ought": 90, "gap": 20 },
    "freedom":   { "given": 55, "given_by": 80, "ought": 95, "gap": 15 },
    ...
  },
  "cryptographic_proof": {
    "algorithm":       "RSA-PKCS1v15-SHA256-2048",
    "public_key_pem":  "-----BEGIN PUBLIC KEY-----...",
    "public_key_n":    "<decimal string>",
    "public_key_e":    "65537",
    "key_fingerprint": "AA:BB:CC:...",
    "signature":       "<uppercase hex>",
    "signed_fields":   "All fields above this block, sorted keys, UTF-8"
  }
}
```

### `<name>_<id>_PRIVATE_KEY.pem`

```
-----BEGIN RSA PRIVATE KEY-----
<base64-encoded PKCS#1 RSAPrivateKey DER>
-----END RSA PRIVATE KEY-----
```

Permissions: `0600` (owner read-only on Unix).
Not stored anywhere else. Not recoverable if lost.

---

## Key Design Constraints (carry forward always)

1. **Pure stdlib only.** `python3 mission_articulation.py` — no pip, no requirements.
2. **DENENT is the project's word.** Never replace with "want" or "need".
   Both decompositions are in `show_introduction()`.
3. **value_set.json is the runtime source.** `value_set.md` is the human source.
   Keep them in sync whenever values are added.
4. **State 0 and Ideal State have no pause() calls.** Sleep-driven pacing is intentional.
5. **The certificate ceremony is real cryptography.** Not theatre.
6. **"Facing fate" = completing the record.** Use consistently.
7. **sub / denend / armh** vocabulary is now in the code and docs. Use consistently.
8. **Entropy = OS entropy XOR SHA-512(passphrase).** Cross-platform. Cannot reduce security.

---

## What Remains To Be Done

- [ ] Animate `show_proclamations()` — typewriter/sleep treatment, remove `pause()` between statements
- [ ] Make `show_the_gap()` sleep-driven — currently still uses `pause()`
- [ ] Phrasing pass on the 7 questions — "ask of" / "denent for" framing
- [ ] `--verify <file>` command-line mode — `python3 mission_articulation.py --verify profile.json`
- [ ] Sync `value_set.json` ↔ `value_set.md` validation check at startup
- [ ] `Arms_of_Humanity.md` referenced in code (currently docs only)
- [ ] Build the web/GUI layer for value scoring (sliders, 0–100, per-value per-question)

---

*project_struct.md — version 0.1*
*Human Ideal Extraction System*

---

## The Coreh Journey — Roadmap to Certificate

*Every coreh who enters the system walks the same path.*
*The path has two lanes. Either lane delivers a certificate.*
*Both lanes together produce the most complete record the system can hold.*

```
START
  │
  ▼
[ Cover ]
  │  ASI introduction
  │  DENENT introduction
  │  Session map
  │  Name entry
  ▼
[ State 0 ]  ──→  [ Ideal State ]  ──→  [ The Gap ]  ──→  [ Mission ]
  │
  ▼
[ Proclamations ]
  │
  ├──────────────────────────────┐
  ▼                              ▼
[ Section A: SLIDER ]     [ Section B: ASSAY ]
  │                              │
  │  202 values                  │  7 open questions
  │  4 sliders per value         │  Written answers
  │  ~15-25 min                  │  ~20-30 min
  ▼                              ▼
[ Slider Certificate ]    [ Assay Certificate ]
  │   ↑                         │
  │   CERTIFICATE EARNED        │   CERTIFICATE EARNED
  │                             │
  └──────────┬──────────────────┘
             ▼
     [ Full Denend ]
       Both sections complete.
       Maximum depth of record.
       Certificate covers both.
```

### Certificate Levels

| Level | What was completed | What you receive |
|-------|-------------------|-----------------|
| Slider Cert | Section A — all 202 values rated | PDF cert + encrypted key + JSON denend |
| Assay Cert  | Section B — 7 written answers    | PDF cert + encrypted key + JSON denend |
| Full Denend | Both sections                    | PDF cert + encrypted key + JSON denend (combined) |

### What is in a Certificate

Every certificate — regardless of level — contains:

- The coreh's name on record
- The profile ID (permanent, unique)
- The section completed
- The date of record
- The ECDSA-P256 key fingerprint (SHA-256 of public key JWK)
- The cryptographic algorithm used: ECDSA-P256-SHA256

The private key is encrypted with the coreh's passphrase using PBKDF2-SHA256 (100,000 iterations) + AES-256-GCM. The passphrase is never stored. The salt and IV are included in the key file. This is cross-platform — it works identically on phone, tablet, and desktop.

---

*project_struct.md — version 0.2*
*Human Ideal Extraction System — Web Application*
