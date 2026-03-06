/**
 * server.js — Human Ideal Extraction System
 * Storage: plain JSON files in ./profiles/
 * Docs:    .md files via /api/docs/:name
 * Admin:   /admin (password gated)
 * Consult: /api/consult (Anthropic API, requires ANTHROPIC_API_KEY env var)
 */

const express = require('express')
const path    = require('path')
const fs      = require('fs')
const crypto  = require('crypto')

const app          = express()
const PORT         = process.env.PORT         || 3000
const ADMIN_PASS   = process.env.ADMIN_PASSWORD || 'hies2026'
const ANTHROPIC_KEY= process.env.ANTHROPIC_API_KEY || null
const PROFILES_DIR = path.join(__dirname, 'profiles')

// ── Docs routes ─────────────────────────────────────────────────────────────

const DOCS = {
  value_set:          'value_set.md',
  doctrine:           'doctrine.md',
  arms:               'Arms_of_Humanity.md',
  project_struct:     'project_struct.md',
  coreh_essay:        'coreh_essay.md',
  existential_rights: 'existential_rights.md',
  hand_off:           'hand_off.md',
}

app.get('/api/docs', (req, res) => {
  const list = Object.entries(DOCS).map(([key, file]) => ({
    key, file, exists: fs.existsSync(path.join(__dirname, file))
  }))
  res.json(list)
})

app.get('/api/docs/:name', (req, res) => {
  const key = req.params.name
  const filename = DOCS[key]
  if (!filename) return res.status(404).json({ error: 'Document not found' })
  const fullPath = path.join(__dirname, filename)

  // Also try lowercase variant in case user saved it lowercase
  const fallbacks = [
    fullPath,
    path.join(__dirname, filename.toLowerCase()),
    path.join(__dirname, key + '.md'),
  ]
  const found = fallbacks.find(p => fs.existsSync(p))
  if (!found) {
    return res.status(404).json({ error: `File not found. Place "${filename}" in the same folder as server.js and restart.` })
  }
  try {
    res.json({ key, filename, content: fs.readFileSync(found, 'utf8') })
  } catch (e) {
    res.status(500).json({ error: 'Read failed: ' + e.message })
  }
})

if (!fs.existsSync(PROFILES_DIR)) {
  fs.mkdirSync(PROFILES_DIR)
  console.log('  Created profiles/ directory')
}

// ── Auth helpers ────────────────────────────────────────────────────────────

const USERS_FILE = path.join(__dirname, 'users.json')

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) } catch(e) { return {} }
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8')
}
function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'hies-salt-v1', 100000, 32, 'sha256').toString('hex')
}

let VALUE_SET = {}
function loadData() {
  try {
    VALUE_SET = JSON.parse(fs.readFileSync(path.join(__dirname, 'value_set.json'), 'utf8'))
    console.log(`  value_set.json loaded — ${(VALUE_SET.value_set || []).length} values`)
    if (ANTHROPIC_KEY) console.log('  Anthropic API key: configured ✓')
    else               console.log('  Anthropic API key: not set (consultation will be unavailable)')
  } catch(e) {
    console.error('  Failed to load data files:', e.message)
  }
}
loadData()

// ── Profile helpers ────────────────────────────────────────────────────────

function profilePath(id) {
  return path.join(PROFILES_DIR, `${id.replace(/[^a-zA-Z0-9_-]/g,'')}.json`)
}
function profileExists(id)    { return fs.existsSync(profilePath(id)) }
function saveProfile(profile) { fs.writeFileSync(profilePath(profile.id), JSON.stringify(profile,null,2),'utf8') }
function loadProfile(id) {
  const p = profilePath(id)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,'utf8')) : null
}
function loadAllProfiles() {
  try {
    return fs.readdirSync(PROFILES_DIR).filter(f=>f.endsWith('.json')).map(f=>{
      try { return JSON.parse(fs.readFileSync(path.join(PROFILES_DIR,f),'utf8')) } catch(e) { return null }
    }).filter(Boolean)
  } catch(e) { return [] }
}

function generateId()  { return 'h_'+crypto.randomBytes(12).toString('hex') }

function detectValues(answersObj, valueList) {
  const allText = Object.values(answersObj).join(' ').toLowerCase()
  return valueList.filter(v => allText.includes(v.replace(/-/g,' ').toLowerCase()))
}

function aggregate(profiles) {
  if (!profiles.length) return { total_contributors:0, strong:{}, broad:{}, contested:{}, outliers:{} }
  const total=profiles.length, counts={}
  for (const p of profiles)
    for (const v of (p.detected_values||[])) counts[v]=(counts[v]||0)+1
  const result = { total_contributors:total, strong:{}, broad:{}, contested:{}, outliers:{} }
  for (const [value,count] of Object.entries(counts)) {
    const pct=count/total
    if      (pct>0.9)  result.strong[value]    = Math.round(pct*1000)/1000
    else if (pct>0.6)  result.broad[value]      = Math.round(pct*1000)/1000
    else if (pct>=0.4) result.contested[value]  = Math.round(pct*1000)/1000
    else               result.outliers[value]   = Math.round(pct*1000)/1000
  }
  return result
}

// Aggregate slider gap data across all profiles
function aggregateGaps(profiles) {
  const sums = {}, counts = {}
  for (const p of profiles) {
    const scores = p.slider_scores || {}
    for (const [term, sc] of Object.entries(scores)) {
      if (!sums[term]) { sums[term]=0; counts[term]=0 }
      const gap = ((sc.Ss_you_other - sc.S0_you_other) + (sc.Ss_other_you - sc.S0_other_you)) / 2
      sums[term]  += gap
      counts[term]++
    }
  }
  return Object.entries(sums)
    .map(([term,sum]) => ({ term, avg_gap: Math.round(sum/counts[term]*10)/10, n: counts[term] }))
    .sort((a,b) => b.avg_gap - a.avg_gap)
}

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '4mb' }))
app.use(express.static(path.join(__dirname, 'public')))

// ── Data routes ────────────────────────────────────────────────────────────
app.get('/api/data', (req,res) => {
  try { res.json(JSON.parse(fs.readFileSync(path.join(__dirname,'data.json'),'utf8'))) }
  catch(e) { res.status(500).json({ error:'Could not read data.json' }) }
})
app.get('/api/values', (req,res) => {
  try { res.json(JSON.parse(fs.readFileSync(path.join(__dirname,'value_set.json'),'utf8'))) }
  catch(e) { res.status(500).json({ error:'Could not read value_set.json' }) }
})


// ── Profile routes ─────────────────────────────────────────────────────────
app.post('/api/profile', (req,res) => {
  const body=req.body
  if (!body.name||!body.answers) return res.status(400).json({error:'name and answers are required'})
  const id=body.id||generateId()
  if (profileExists(id)) {
    const existing=loadProfile(id)
    console.log(`  Profile already exists: ${id} — returning cached`)
    return res.json({id, recorded_at:existing.recorded_at, detected_values:existing.detected_values, already_existed:true})
  }
  const recorded_at=new Date().toISOString()
  const detected=detectValues(body.answers, VALUE_SET.value_set||[])
  const profile={
    id, name:body.name, recorded_at,
    section:         body.section       || 'slider',
    answers:         body.answers,
    slider_scores:   body.slider_scores  || {},
    value_scores:    body.value_scores   || {},
    detected_values: detected,
    public_key_jwk:  body.public_key_jwk || null,
    signature:       body.signature       || null,
    fingerprint:     body.fingerprint     || null,
  }
  saveProfile(profile)
  console.log(`  Profile saved: ${id} — ${body.name} [${profile.section}] (${detected.length} values detected)`)
  res.json({id, recorded_at, detected_values:detected})
})

app.patch('/api/profile/:id', (req,res) => {
  const profile=loadProfile(req.params.id)
  if (!profile) return res.status(404).json({error:'Profile not found'})
  const allAnswers={...profile.answers,...(req.body.answers||{})}
  const updated={...profile,...req.body, id:profile.id, answers:allAnswers,
    detected_values:detectValues(allAnswers, VALUE_SET.value_set||[]), section:'full'}
  saveProfile(updated)
  console.log(`  Profile upgraded: ${profile.id} — ${profile.name} → full denend`)
  res.json({id:profile.id, detected_values:updated.detected_values})
})

app.get('/api/profile/:id', (req,res) => {
  const profile=loadProfile(req.params.id)
  if (!profile) return res.status(404).json({error:'Profile not found'})
  res.json(profile)
})

app.get('/api/collective', (req,res) => { res.json(aggregate(loadAllProfiles())) })

app.get('/api/stats', (req,res) => {
  const profiles=loadAllProfiles()
  res.json({
    total_profiles: profiles.length,
    recent: profiles.sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at)).slice(0,10)
      .map(p=>({name:p.name, recorded_at:p.recorded_at, section:p.section, fingerprint:p.fingerprint}))
  })
})

// ── Admin API ──────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req,res) => {
  const { password } = req.body
  if (password === ADMIN_PASS) res.json({ ok:true })
  else res.status(401).json({ error:'Invalid password' })
})

app.get('/api/admin/dashboard', (req,res) => {
  const pw = req.headers['x-admin-password']
  if (pw !== ADMIN_PASS) return res.status(401).json({ error:'Unauthorised' })

  const profiles = loadAllProfiles()
  const bySection = { slider:0, assay:0, full:0, unknown:0 }
  for (const p of profiles) bySection[p.section||'unknown']++

  const gaps = aggregateGaps(profiles)

  const recent = profiles
    .sort((a,b) => new Date(b.recorded_at)-new Date(a.recorded_at))
    .slice(0,20)
    .map(p => ({
      id:         p.id,
      name:       p.name,
      section:    p.section,
      recorded_at:p.recorded_at,
      detected_count: (p.detected_values||[]).length,
      slider_count:   Object.keys(p.slider_scores||{}).length,
      answer_count:   Object.keys(p.answers||{}).length,
      fingerprint:    p.fingerprint,
    }))

  res.json({ total:profiles.length, by_section:bySection, top_gaps:gaps.slice(0,20), recent })
})

app.get('/api/admin/profile/:id', (req,res) => {
  const pw = req.headers['x-admin-password']
  if (pw !== ADMIN_PASS) return res.status(401).json({ error:'Unauthorised' })
  const profile = loadProfile(req.params.id)
  if (!profile) return res.status(404).json({ error:'Not found' })
  res.json(profile)
})

// Serve admin page
app.get('/admin', (req,res) => {
  res.sendFile(path.join(__dirname,'public','admin.html'))
})

// ── Consultation API ───────────────────────────────────────────────────────
app.get('/api/consult/status', (req,res) => {
  res.json({ available: !!ANTHROPIC_KEY })
})

app.post('/api/consult', async (req,res) => {
  if (!ANTHROPIC_KEY) return res.status(503).json({ error:'Consultation unavailable: no API key configured' })

  const { messages, name, context } = req.body
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error:'messages array required' })

  const systemPrompt = `You are a consultation guide for the Human Ideal Extraction System (H.I.E.S).

You are helping ${name||'a coreh'} articulate what they denent — what they need, deserve, and want from existence as a human being.

Context: ${context||'The coreh is preparing to complete their denend — a verifiable record of their deepest values and what they believe every human is owed by existence.'}

Your role:
- Help the coreh find words for things they feel but cannot yet say
- Ask one careful, open question at a time — never overwhelm
- Draw out specificity: not "I want freedom" but "what kind of freedom, in what part of your life, being denied by what?"
- Reflect back what you hear without paraphrasing so much that you lose their voice
- Never tell them what they should value — only help them discover what they already do
- Be warm but not sycophantic. Be direct but not clinical.
- When they seem ready, encourage them to carry what they've articulated into their written answers

You are not a therapist. You are not a philosopher. You are a guide helping a human locate themselves in the space of what matters.

Keep responses concise — 2-4 sentences maximum. One question at a time.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            ANTHROPIC_KEY,
        'anthropic-version':    '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-6',
        max_tokens: 400,
        system:     systemPrompt,
        messages:   messages,
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return res.status(502).json({ error:'API error', detail: err })
    }

    const data = await response.json()
    const text = data.content?.map(c => c.text||'').join('') || ''
    res.json({ text })
  } catch(e) {
    console.error('Consult error:', e)
    res.status(500).json({ error: e.message })
  }
})

// ── Auth routes ─────────────────────────────────────────────────────────────

app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Username, email and password are required.' })

  const users = loadUsers()

  if (users[email])
    return res.status(409).json({ error: 'An account with that email already exists.' })

  const taken = Object.values(users).find(u => u.username.toLowerCase() === username.toLowerCase())
  if (taken)
    return res.status(409).json({ error: 'That username is already taken.' })

  users[email] = {
    username,
    email,
    password_hash: hashPassword(password),
    created_at: new Date().toISOString(),
  }
  saveUsers(users)
  console.log(`  Registered: ${username} <${email}>`)
  res.json({ ok: true, username, email })
})

app.post('/api/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' })

  const users = loadUsers()
  const user  = users[email]
  if (!user || user.password_hash !== hashPassword(password))
    return res.status(401).json({ error: 'Email or password is incorrect.' })

  console.log(`  Login: ${user.username} <${email}>`)
  res.json({ ok: true, username: user.username, email })
})

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Human Ideal Extraction System`)
  console.log(`  ─────────────────────────────`)
  console.log(`  Running at:  http://localhost:${PORT}`)
  console.log(`  Dev mode:    http://localhost:${PORT}?dev=1`)
  console.log(`  Admin:       http://localhost:${PORT}/admin`)
  console.log(`  Docs:        http://localhost:${PORT}?screen=docs`)
  console.log()
})
