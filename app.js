/**
 * app.js — Human Ideal Extraction System
 *
 * Two-section denend:
 *   Section A: Slider  — all values × 4 sliders (State0 + State_star)
 *   Section B: Assay   — 7 long-answer questions
 *
 * Either section alone earns an Authorship Certificate.
 *
 * URL params:
 *   ?dev=1   skip intro, jump to slider
 *   ?screen=X  jump to screen
 */

const S = {
  screen:'cover', name:'', email:'',
  factIndex:0, visionIndex:0, procCategory:0,
  sliderIndex:0, sliderScores:{}, sliderDone:false, sliderProfileId:null, sliderSaved:false,
  currentQuestion:0, answers:{}, assayDone:false, profileSaved:false,
  keypair:null, publicKeyJwk:null, signature:null, fingerprint:null, profileId:null,
  data:null, values:null, currentDoc:null, docsCache:{}, selectedValue:null,
  consultMessages:[], consultAvailable:null,
  passphrase:'', passphraseSet:false,
}

const params   = new URLSearchParams(window.location.search)
const DEV_MODE = params.get('dev') === '1'

const PROC_LABELS = {
  epistemic:'What We All Know Nobody Currently Knows',
  deontic:'What Every Coreh Is Owed By Existence',
  existential:'What Is Actually True About Being Here Right Now',
  urgent:'Why None Of This Can Wait',
  armh:'The Law That Governs Every Arm Of Humanity',
}
const PROC_DESCS = {
  epistemic:'These are the gaps at the centre of everything. Gaps that exist not from lack of intelligence, but from lack of a system capable of gathering what everyone knows but no one has combined.',
  deontic:'These are the obligations that precede every law, every system, every institution. They exist whether or not anything honours them. This project is built to make honouring them possible.',
  existential:'These are the facts of how things currently stand — not as accusation, not as despair, but as the honest ground we are working from.',
  urgent:'These are the facts about timing. What is coming changes everything about what is possible and what is not. The window is real. It is not permanent.',
  armh:'These are the rules that no arm of humanity may suspend — not for good intentions, not for short-term gain, not for any argument that sounds compelling in the moment.',
}
const DOC_META = {
  value_set:         {title:'Value Set',             subtitle:'202 human values across 12 domains',              icon:'◈'},
  doctrine:          {title:'Doctrine',               subtitle:'The foundational axioms of the project',          icon:'§'},
  arms:              {title:'Arms of Humanity',       subtitle:'Every entity through which humans organise',      icon:'⊕'},
  project_struct:    {title:'Project Structure',      subtitle:'Files, architecture, what remains to build',      icon:'⌗'},
  coreh_essay:       {title:'The Coreh Is The Point', subtitle:'Why the individual human is the whole reason',    icon:'◉'},
  existential_rights:{title:'Existential Rights',     subtitle:'What every coreh is owed by the fact of being here', icon:'✦'},
}

async function init() {
  try {
    const [dr,vr] = await Promise.all([fetch('/api/data'),fetch('/api/values')])
    S.data   = await dr.json()
    S.values = await vr.json()
  } catch(e) {
    document.getElementById('app').innerHTML =
      '<div class="screen"><p class="body-text" style="color:var(--red)">Failed to connect to server. Is <code>node server.js</code> running?</p></div>'
    return
  }
  DEV_MODE ? (S.name='Dev', goTo('slider')) : goTo(params.get('screen')||'cover')
}

function goTo(screen) {
  S.screen = screen
  window.scrollTo({top:0,behavior:'instant'})
  renderApp()
  updateProgress()
}

function updateProgress() {
  const order = ['cover','intro_asi','intro_denent','session_map','login',
    'state0','ideal_state','the_gap','mission','proclamations',
    'slider','slider_cert','questions','review','certificate','collective']
  const idx = order.indexOf(S.screen)
  document.getElementById('progress-bar').style.width = (idx<0?0:Math.round(idx/(order.length-1)*100))+'%'
}

function renderApp() {
  const app = document.getElementById('app')
  const map = {cover,intro_asi,intro_denent,session_map,login,
    state0,ideal_state,the_gap,mission,proclamations,
    slider,slider_cert,consult,questions,review,certificate,collective,docs,audit,bootstrap,profile_view}
  const fn = map[S.screen]
  if (!fn) {app.innerHTML=`<div class="screen"><p>Unknown screen: ${S.screen}</p></div>`;return}
  app.innerHTML = navHTML() + fn()
  attachEvents()
}

function navHTML() {
  if (S.screen==='cover') return ''
  const sc = S.screen

  // Context buttons for the fixed bottom bar
  let ctxLeft = '', ctxMid = '', ctxRight = ''

  if (sc === 'slider') {
    const values = getValueList()
    const idx    = S.sliderIndex || 0
    const isLast = idx === values.length - 1
    ctxLeft  = idx > 0
      ? `<button class="bnav-ctx bnav-ctx-back" onclick="sliderBack()">← Back</button>`
      : `<div></div>`
    ctxMid   = `<button class="bnav-ctx bnav-ctx-skip" onclick="S.currentQuestion=0;goTo('consult')">Skip to written</button>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next${isLast?' bnav-ctx-complete':''}"
      onclick="${isLast?"goTo('slider_cert')":'sliderNext()'}">
      ${isLast ? 'Complete ✓' : 'Next →'}
    </button>`

  } else if (sc === 'questions') {
    const qs    = S.data?.questions || []
    const idx   = S.currentQuestion || 0
    const q     = qs[idx]
    const isLast = idx === qs.length - 1
    const hasSaved = q && S.answers[q.key]
    const backAction = idx > 0
      ? `S.currentQuestion--;goTo('questions')`
      : S.sliderDone ? `goTo('slider_cert')` : `goTo('proclamations')`
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="${backAction}">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" id="bnav-next-btn"
      onclick="submitAnswer()" ${hasSaved?'':'disabled'}>
      ${isLast ? 'Review →' : 'Next →'}
    </button>`

  } else if (sc === 'intro_asi') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('cover')">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" onclick="goTo('intro_denent')">Continue →</button>`

  } else if (sc === 'intro_denent') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('intro_asi')">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" onclick="goTo('session_map')">Continue →</button>`

  } else if (sc === 'session_map') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('intro_denent')">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" onclick="goTo('login')">Continue →</button>`

  } else if (sc === 'login') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('session_map')">← Back</button>`
    ctxMid   = `<button class="bnav-ctx bnav-ctx-skip" onclick="skipLogin()">Skip (testing)</button>`
    ctxRight = `<div></div>`

  } else if (sc === 'state0') {
    const facts  = S.data?.state0?.facts || []
    const idx    = S.factIndex || 0
    const isLast = idx === facts.length - 1
    ctxLeft  = idx > 0
      ? `<button class="bnav-ctx bnav-ctx-back" onclick="S.factIndex--;goTo('state0')">← Back</button>`
      : `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('login')">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = isLast
      ? `<button class="bnav-ctx bnav-ctx-next bnav-ctx-complete" onclick="S.visionIndex=0;goTo('ideal_state')">Continue →</button>`
      : `<button class="bnav-ctx bnav-ctx-next" onclick="S.factIndex++;goTo('state0')">Next →</button>`

  } else if (sc === 'ideal_state') {
    const visions = S.data?.ideal_state?.visions || []
    const idx     = S.visionIndex || 0
    const isLast  = idx === visions.length - 1
    ctxLeft  = idx > 0
      ? `<button class="bnav-ctx bnav-ctx-back" onclick="S.visionIndex--;goTo('ideal_state')">← Back</button>`
      : `<button class="bnav-ctx bnav-ctx-back" onclick="S.factIndex=${(S.data?.state0?.facts||[]).length-1};goTo('state0')">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = isLast
      ? `<button class="bnav-ctx bnav-ctx-next bnav-ctx-complete" onclick="goTo('the_gap')">Continue →</button>`
      : `<button class="bnav-ctx bnav-ctx-next" onclick="S.visionIndex++;goTo('ideal_state')">Next →</button>`

  } else if (sc === 'the_gap') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="S.visionIndex=${(S.data?.ideal_state?.visions||[]).length-1};goTo('ideal_state')">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" onclick="goTo('mission')">Continue →</button>`

  } else if (sc === 'mission') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('the_gap')">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" onclick="S.procCategory=0;goTo('proclamations')">Continue →</button>`

  } else if (sc === 'proclamations') {
    const cats = Object.keys(S.data?.proclamations || {})
    const idx  = S.procCategory || 0
    const isLast = idx === cats.length - 1
    ctxLeft  = idx > 0
      ? `<button class="bnav-ctx bnav-ctx-back" onclick="S.procCategory--;goTo('proclamations')">← Back</button>`
      : `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('mission')">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = isLast
      ? `<button class="bnav-ctx bnav-ctx-next bnav-ctx-complete" onclick="S.sliderIndex=0;goTo('slider')">${S.name?S.name+', ':''}begin →</button>`
      : `<button class="bnav-ctx bnav-ctx-next" onclick="S.procCategory++;goTo('proclamations')">Next →</button>`

  } else if (sc === 'slider_cert') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('slider')">← Slider</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" onclick="goTo('consult')">Written questions →</button>`

  } else if (sc === 'consult') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="S.sliderDone?goTo('slider_cert'):goTo('proclamations')">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" onclick="S.currentQuestion=0;goTo('questions')">Begin questions →</button>`

  } else if (sc === 'review') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="S.currentQuestion=(S.data?.questions||[]).length-1;goTo('questions')">← Edit answers</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next bnav-ctx-complete" onclick="goTo('certificate')">Confirm & seal →</button>`

  } else if (sc === 'certificate') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('review')">← Review</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" onclick="goTo('collective')">View collective →</button>`

  } else if (sc === 'collective') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('cover')">← Home</button>`
    ctxMid   = `<div></div>`
    ctxRight = (S.profileSaved||S.sliderSaved)
      ? `<button class="bnav-ctx bnav-ctx-next" onclick="goTo('profile_view')">My record →</button>`
      : `<button class="bnav-ctx bnav-ctx-next" onclick="goTo('slider')">Begin denend →</button>`

  } else if (sc === 'profile_view') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="history.back()">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" onclick="goTo('collective')">Collective →</button>`

  } else if (sc === 'docs') {
    ctxLeft  = S.currentDoc
      ? `<button class="bnav-ctx bnav-ctx-back" onclick="S.currentDoc=null;goTo('docs')">← All docs</button>`
      : `<button class="bnav-ctx bnav-ctx-back" onclick="goTo('cover')">← Home</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<div></div>`

  } else if (sc === 'bootstrap') {
    ctxLeft  = `<button class="bnav-ctx bnav-ctx-back" onclick="history.back()">← Back</button>`
    ctxMid   = `<div></div>`
    ctxRight = `<button class="bnav-ctx bnav-ctx-next" onclick="goTo('slider')">Begin denend →</button>`
  }

  const isNavScreen = ['slider','questions','intro_asi','intro_denent','session_map','login',
    'proclamations','state0','ideal_state','the_gap','mission',
    'slider_cert','consult','review','certificate','collective','profile_view','docs','bootstrap'].includes(sc)
  const navLinks = [
    ['cover',       '⌂', 'Home'],
    ['slider',      '◈', 'Slider'],
    ['questions',   '✎', 'Assay'],
    ['profile_view','◉', 'My Record'],
    ['collective',  '⊕', 'Collective'],
    ['bootstrap',   '▸', 'Bootstrap'],
    ['docs',        '§', 'Docs'],
    ...(DEV_MODE ? [['audit','✦','Audit']] : []),
  ]

  return `<nav class="nav">
    <div class="nav-left">
      <div class="nav-logo" onclick="goTo('cover')"><div class="logo-placeholder">H</div></div>
      <span class="nav-mark" onclick="goTo('cover')">H.I.E.S</span>
    </div>
    <div class="nav-links">
      ${S.name?`<span class="nav-link text-gold" style="cursor:default">${S.name}</span>`:''}
    </div>
  </nav>
  <div style="height:53px"></div>

  <div class="bottom-nav" id="bottom-nav">
    <div class="bnav-left">
      <button class="bnav-menu-btn" onclick="toggleNavDropdown(event)" aria-label="Menu">
        <span class="bnav-hamburger">≡</span>
        <span class="bnav-menu-label">Menu</span>
      </button>
    </div>

    ${isNavScreen ? `
    <div class="bnav-ctx-row">
      ${ctxLeft}
      ${ctxMid}
      ${ctxRight}
    </div>` : `<div class="bnav-screen-label">${sc.replace(/_/g,' ')}</div>`}

    <div class="bnav-dropdown" id="bnav-dropdown">
      ${navLinks.map(([screen,icon,label])=>`
        <button class="bnav-drop-item${sc===screen?' bnav-drop-active':''}"
          onclick="closeNavDropdown();goTo('${screen}')">
          <span class="bnav-drop-icon">${icon}</span>${label}
        </button>`).join('')}
    </div>
  </div>`
}

function toggleNavDropdown(e) {
  e.stopPropagation()
  const dd = document.getElementById('bnav-dropdown')
  if (dd) dd.classList.toggle('open')
}
function closeNavDropdown() {
  const dd = document.getElementById('bnav-dropdown')
  if (dd) dd.classList.remove('open')
}

// ── Cover ─────────────────────────────────────────────────────────────────
function cover() {
  return `<div class="screen cover">
    <div class="cover-logo-area"><div class="cover-logo-placeholder">H.I.E.S</div></div>
    <h1 class="cover-title">The record<br><em>you were never asked<br>to make.</em></h1>
    <p class="cover-subtitle">Before ASI arrives, every human deserves to have their deepest values recorded, counted, and carried forward into what comes next. This is step zero.</p>
    <div class="cover-meta"><span>v 1.0</span><span>·</span><span>Step 0 of 9</span><span>·</span><span>30–50 min</span></div>
    <div class="cover-divider"></div>
    <div class="btn-group">
      <button class="btn btn-primary btn-large" onclick="goTo('intro_asi')">Begin →</button>
      <button class="btn btn-ghost" onclick="goTo('collective')">View collective</button>
      <button class="btn btn-ghost" onclick="goTo('docs')">Read the docs</button>
    </div>
  </div>`
}

// ── Journey ───────────────────────────────────────────────────────────────
function intro_asi() {
  return `<div class="screen">
    <div class="section-label">Before anything else</div>
    <h2 class="section-heading">ASI<br><em>Artificial Superintelligence</em></h2>
    <p class="body-text">Not a smarter search engine. Not a better chatbot.</p>
    <p class="body-text">ASI refers to a system that surpasses human cognitive ability across <strong>every domain simultaneously</strong>. Most serious researchers believe we are within a decade of this.</p>
    <div class="info-box">When ASI arrives, it will be aligned to <strong>some</strong> set of values. This program exists because the people whose values should shape that alignment have never been formally asked what those values are.</div>
  </div>`
}

function intro_denent() {
  return `<div class="screen">
    <div class="section-label">A term coined for this system</div>
    <h2 class="section-heading"><em>Denent</em> &nbsp;<span style="font-size:.5em;color:var(--text-dim);font-style:normal;letter-spacing:.1em">[ deh-NENT ]</span></h2>
    <p class="body-text">No existing word is precise enough. Two decompositions — both correct, both operative simultaneously.</p>
    <div class="decomp-block">
      <div class="decomp-label">Decomposition A — the being</div>
      <div class="decomp-row"><span class="decomp-part">DE-</span><span class="decomp-meaning">from <strong>"deserve"</strong> — what is owed to you by the sheer fact of your existence</span></div>
      <div class="decomp-row"><span class="decomp-part">-N-</span><span class="decomp-meaning">from <strong>"need"</strong> — what your being requires in order to remain whole</span></div>
      <div class="decomp-row"><span class="decomp-part">-ENT</span><span class="decomp-meaning">from <strong>"entity"</strong> — the kind of thing you are: human, conscious, mortal, finite</span></div>
    </div>
    <div class="decomp-block">
      <div class="decomp-label">Decomposition B — the reach</div>
      <div class="decomp-row"><span class="decomp-part">DE-</span><span class="decomp-meaning">from <strong>"deserve"</strong> — the claim grounded in your nature</span></div>
      <div class="decomp-row"><span class="decomp-part">-N-</span><span class="decomp-meaning">from <strong>"need"</strong> — the structural requirement of your being</span></div>
      <div class="decomp-row"><span class="decomp-part">-NT</span><span class="decomp-meaning">from <strong>"want"</strong> — what you reach toward freely, from within yourself</span></div>
    </div>
    <p class="body-text mt-24">A coreh denents meaning the way a fire denents oxygen — not as preference, but as a structural condition of what it is.</p>
  </div>`
}

function session_map() {
  return `<div class="screen">
    <div class="section-label">What happens here</div>
    <h2 class="section-heading">Two sections.<br><em>Either one earns a certificate.</em></h2>
    <div class="two-section-cards">
      <div class="section-card">
        <div class="section-card-label">Section A</div>
        <div class="section-card-title">Slider Denend</div>
        <div class="section-card-body">Rate each of the 202 human values across two dimensions and two states. Fast, intuitive, no writing required.</div>
        <div class="section-card-time">15–25 min &nbsp;·&nbsp; earns certificate</div>
      </div>
      <div class="section-card">
        <div class="section-card-label">Section B</div>
        <div class="section-card-title">Assay Denend</div>
        <div class="section-card-body">Seven open-ended questions about what you denent from existence. Written answers. Deep engagement required.</div>
        <div class="section-card-time">20–30 min &nbsp;·&nbsp; earns certificate</div>
      </div>
    </div>
    <p class="body-text mt-24">Completing both sections produces a <strong>Full Denend</strong> — the most complete record the system can hold for you.</p>
    <div class="info-box">
      <strong>Vocabulary:</strong><br><br>
      <span class="mono">coreh</span> — you; the core of all arms of humanity — the most important armh<br>
      <span class="mono">denend</span> — the record you are about to make<br>
      <span class="mono">armh</span> — any arm of humanity: coreh, family, state, corporation, movement
    </div>
  </div>`
}

function login() {
  return `<div class="screen">
    <div class="section-label">Before you begin</div>
    <h2 class="section-heading">Create your account.<br><em>Or sign back in.</em></h2>
    <p class="body-text">Your denend is tied to your account. It is how your record stays yours.</p>

    <div class="login-tabs">
      <button class="login-tab active" id="tab-register" onclick="switchLoginTab('register')">New here</button>
      <button class="login-tab" id="tab-signin" onclick="switchLoginTab('signin')">I have an account</button>
    </div>

    <div id="login-panel-register">
      <div class="login-field">
        <label class="login-label">Username</label>
        <input type="text" id="reg-username" class="login-input" placeholder="What you want to be called" maxlength="60" autocomplete="username">
      </div>
      <div class="login-field">
        <label class="login-label">Email</label>
        <input type="email" id="reg-email" class="login-input" placeholder="your@email.com" maxlength="200" autocomplete="email">
      </div>
      <div class="login-field">
        <label class="login-label">Password</label>
        <input type="password" id="reg-password" class="login-input" placeholder="At least 8 characters" maxlength="200" autocomplete="new-password">
      </div>
      <div id="reg-error" class="login-error" style="display:none"></div>
      <div class="btn-group mt-24">
        <button class="btn btn-primary" onclick="submitRegister()">Create account →</button>
      </div>
    </div>

    <div id="login-panel-signin" style="display:none">
      <div class="login-field">
        <label class="login-label">Email</label>
        <input type="email" id="si-email" class="login-input" placeholder="your@email.com" maxlength="200" autocomplete="email">
      </div>
      <div class="login-field">
        <label class="login-label">Password</label>
        <input type="password" id="si-password" class="login-input" placeholder="Your password" maxlength="200" autocomplete="current-password">
      </div>
      <div id="si-error" class="login-error" style="display:none"></div>
      <div class="btn-group mt-24">
        <button class="btn btn-primary" onclick="submitSignIn()">Sign in →</button>
      </div>
    </div>
  </div>`
}

function switchLoginTab(tab) {
  document.getElementById('tab-register').classList.toggle('active', tab === 'register')
  document.getElementById('tab-signin').classList.toggle('active', tab === 'signin')
  document.getElementById('login-panel-register').style.display = tab === 'register' ? '' : 'none'
  document.getElementById('login-panel-signin').style.display   = tab === 'signin'   ? '' : 'none'
}

function skipLogin() {
  S.name  = 'Tester'
  S.email = 'test@local'
  S.factIndex = 0
  goTo('state0')
}

async function submitRegister() {
  const username = document.getElementById('reg-username')?.value.trim()
  const email    = document.getElementById('reg-email')?.value.trim()
  const password = document.getElementById('reg-password')?.value
  const errEl    = document.getElementById('reg-error')

  if (!username || !email || !password) { showLoginError(errEl, 'All three fields are required.'); return }
  if (password.length < 8)              { showLoginError(errEl, 'Password must be at least 8 characters.'); return }

  try {
    const res  = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username, email, password}) })
    const data = await res.json()
    if (!res.ok) { showLoginError(errEl, data.error); return }
    S.name  = username
    S.email = email
    S.factIndex = 0
    goTo('state0')
  } catch(e) {
    showLoginError(errEl, 'Connection error. Is the server running?')
  }
}

async function submitSignIn() {
  const email    = document.getElementById('si-email')?.value.trim()
  const password = document.getElementById('si-password')?.value
  const errEl    = document.getElementById('si-error')

  if (!email || !password) { showLoginError(errEl, 'Email and password are required.'); return }

  try {
    const res  = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password}) })
    const data = await res.json()
    if (!res.ok) { showLoginError(errEl, data.error); return }
    S.name  = data.username
    S.email = email
    S.factIndex = 0
    goTo('state0')
  } catch(e) {
    showLoginError(errEl, 'Connection error. Is the server running?')
  }
}

function showLoginError(el, msg) {
  if (!el) return
  el.textContent = msg
  el.style.display = 'block'
}

function state0() {
  const facts=S.data?.state0?.facts||[], idx=S.factIndex, fact=facts[idx], isLast=idx===facts.length-1
  if(!fact){goTo('ideal_state');return''}
  return `<div class="screen">
    <div class="section-label">State 0 &nbsp; ${idx+1} / ${facts.length}</div>
    <h2 class="section-heading" style="font-size:clamp(22px,4vw,32px);margin-bottom:40px">The world as it is.</h2>
    <div class="fact-card">
      <div class="fact-heading">${fact.heading}</div>
      <ul class="fact-lines">${fact.lines.map(l=>`<li class="${l.startsWith('    ')?'indent':''}">${l.trim()}</li>`).join('')}</ul>
    </div>
    ${isLast?`<div class="fact-card" style="border-left-color:var(--red);margin-top:32px">
      <div class="fact-heading" style="color:var(--red)">Conclusion</div>
      <ul class="fact-lines">${(S.data?.state0?.conclusion||[]).map(l=>`<li>${l}</li>`).join('')}</ul>
    </div>`:''}
  </div>`
}

function ideal_state() {
  const visions=S.data?.ideal_state?.visions||[], idx=S.visionIndex, v=visions[idx], isLast=idx===visions.length-1
  if(!v){goTo('the_gap');return''}
  return `<div class="screen">
    <div class="section-label">Ideal State &nbsp; ${idx+1} / ${visions.length}</div>
    <h2 class="section-heading" style="font-size:clamp(22px,4vw,32px);margin-bottom:40px">The world as it <em>could</em> be.</h2>
    <div class="fact-card" style="border-left-color:var(--gold)">
      <div class="fact-heading">${v.heading}</div>
      <ul class="fact-lines">${v.lines.map(l=>`<li>${l}</li>`).join('')}</ul>
    </div>
  </div>`
}

function the_gap() {
  return `<div class="screen">
    <div class="section-label">The gap</div>
    <h2 class="section-heading">Between State 0 and Ideal State,<br><em>one thing is missing.</em></h2>
    <p class="body-text">Call it <strong class="mono">E</strong> — the Human Ideal Extraction System.</p>
    <div class="steps-list" style="margin-bottom:40px">
      ${[['1.','INTERROGATE','Ask each coreh: what do you ask of existence?'],
         ['2.','STORE','Record the denend permanently and verifiably.'],
         ['3.','AGGREGATE','Combine all denends into a collective profile (C).'],
         ['4.','ACCOUNT','Show each coreh the gap between their ideal and their actual life.'],
         ['5.','COORDINATE','Feed C into ASI alignment, policy, and resource decisions.'],
        ].map(([n,a,note])=>`<div class="step-row">
          <span class="step-n mono-sm">${n}</span>
          <div class="step-content"><div class="step-action">${a}</div><div class="step-note">${note}</div></div>
        </div>`).join('')}
    </div>
    <div class="info-box" style="border-left-color:var(--red)">
      <strong>Current status:</strong> &nbsp;<span class="mono">E = does not exist.</span><br>
      <strong>Required status:</strong> &nbsp;<span class="mono">E = fully implemented, running at global scale.</span><br><br>
      Build E before ASI arrives — or accept the default.<br><em>The default is whoever else left a record.</em>
    </div>
  </div>`
}

function mission() {
  const steps=S.data?.mission?.steps||[]
  return `<div class="screen">
    <div class="section-label">The bootstrap sequence</div>
    <h2 class="section-heading">The steps. In order.<br><em>None can be skipped.</em></h2>
    <ul class="steps-list mt-32">
      ${steps.map(s=>`<li class="step-row">
        <span class="step-n mono-sm ${s.n===0?'current':''}">Step ${s.n}</span>
        <div class="step-content">
          <div class="step-action ${s.n===0?'current':''}">${s.action}</div>
          <div class="step-note">${s.note}${s.n===0?' &nbsp;◄ you are here':''}</div>
        </div>
      </li>`).join('')}
    </ul>
  </div>`
}

function proclamations() {
  const procs=S.data?.proclamations||{}, cats=Object.keys(procs), idx=S.procCategory, key=cats[idx], items=procs[key]||[], isLast=idx===cats.length-1
  if(!key){goTo('slider');return''}
  return `<div class="screen">
    <div class="section-label">The proclamations &nbsp; ${idx+1} / ${cats.length}</div>
    <h2 class="section-heading" style="font-size:clamp(20px,3.5vw,30px);margin-bottom:8px">${PROC_LABELS[key]||key}</h2>
    <p class="body-text" style="font-style:italic;font-size:15px;margin-bottom:40px">${PROC_DESCS[key]||''}</p>
    <ul class="proclamation-list">
      ${items.map((s,i)=>`<li class="proclamation-item"><span class="proclamation-num">${i+1}.</span><span class="proclamation-text">${s}</span></li>`).join('')}
    </ul>
  </div>`
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION A — SLIDER DENEND
// ══════════════════════════════════════════════════════════════════════════

function getValueList() {
  const list=[]
  for(const d of (S.values?.domains||[]))
    for(const v of d.values) list.push({term:v.term,definition:v.definition,domain:d.label})
  return list
}

function slider() {
  const values = (getValueList())
  const total  = values.length
  const idx    = Math.min(S.sliderIndex || 0, total - 1)
  const v      = values[idx] || {}
  const term   = v.term   || ''
  const def    = v.definition || ''
  const domain = v.domain || ''

  // Get saved scores for this value
  const saved  = S.sliderScores[term] || {}
  const S0y = saved.S0_you_other  ?? 50
  const S0o = saved.S0_other_you  ?? 50
  const Ssy = saved.Ss_you_other  ?? 50
  const Sso = saved.Ss_other_you  ?? 50

  const sliderQ = S.data?.slider_questions?.[term] || {}
  const q_S0_yo = sliderQ?.State0?.Q_corehU_coreh   || 'How much of this do you currently extend to others?'
  const q_S0_oy = sliderQ?.State0?.Q_coreh_corehU   || 'How much of this do others currently extend to you?'
  const q_Ss_yo = sliderQ?.State_star?.Q_corehU_coreh || 'In the ideal, how much of this would you extend?'
  const q_Ss_oy = sliderQ?.State_star?.Q_coreh_corehU || 'In the ideal, how much would others extend to you?'

  const pct = Math.round((idx / Math.max(total - 1, 1)) * 100)
  const isLast = idx === total - 1

  return `<div class="slider-layout">

    <div class="slider-header">
      <div class="slider-progress-meta">
        <span class="label-micro">${domain}</span>
        <span class="label-micro">${idx + 1} / ${total}</span>
      </div>
      <div class="slider-progress-bar">
        <div class="slider-progress-fill" style="width:${pct}%"></div>
      </div>
    </div>

    <div class="slider-value-row">
      <div class="value-focus-term">${term}</div>
      <div class="value-focus-def">${def}</div>
    </div>

    <div class="slider-blocks-grid">
      <div class="slider-block">
        <div class="slider-block-label">State 0 — As things are</div>
        <div class="slider-question-group">
          <div class="slider-direction">
            <span class="slider-dir-you">You</span>
            <span class="slider-dir-arrow">→</span>
            <span class="slider-dir-other">Others</span>
          </div>
          <div class="slider-q">${q_S0_yo}</div>
          <div class="slider-row">
            <span class="slider-label-l">0</span>
            <input type="range" class="slider-input" min="0" max="100" value="${S0y}"
              id="sl-S0y" oninput="document.getElementById('sv-S0y').textContent=this.value;saveSliderVal('${term}','S0_you_other',+this.value)">
            <span class="slider-label-r">100</span>
            <span class="slider-val" id="sv-S0y">${S0y}</span>
          </div>
        </div>
        <div class="slider-question-group">
          <div class="slider-direction">
            <span class="slider-dir-other">Others</span>
            <span class="slider-dir-arrow">→</span>
            <span class="slider-dir-you">You</span>
          </div>
          <div class="slider-q">${q_S0_oy}</div>
          <div class="slider-row">
            <span class="slider-label-l">0</span>
            <input type="range" class="slider-input" min="0" max="100" value="${S0o}"
              id="sl-S0o" oninput="document.getElementById('sv-S0o').textContent=this.value;saveSliderVal('${term}','S0_other_you',+this.value)">
            <span class="slider-label-r">100</span>
            <span class="slider-val" id="sv-S0o">${S0o}</span>
          </div>
        </div>
      </div>

      <div class="slider-block slider-block-star">
        <div class="slider-block-label">State ★ — As things should be</div>
        <div class="slider-question-group">
          <div class="slider-direction">
            <span class="slider-dir-you">You</span>
            <span class="slider-dir-arrow">→</span>
            <span class="slider-dir-other">Others</span>
          </div>
          <div class="slider-q">${q_Ss_yo}</div>
          <div class="slider-row">
            <span class="slider-label-l">0</span>
            <input type="range" class="slider-input" min="0" max="100" value="${Ssy}"
              id="sl-Ssy" oninput="document.getElementById('sv-Ssy').textContent=this.value;saveSliderVal('${term}','Ss_you_other',+this.value)">
            <span class="slider-label-r">100</span>
            <span class="slider-val" id="sv-Ssy">${Ssy}</span>
          </div>
        </div>
        <div class="slider-question-group">
          <div class="slider-direction">
            <span class="slider-dir-other">Others</span>
            <span class="slider-dir-arrow">→</span>
            <span class="slider-dir-you">You</span>
          </div>
          <div class="slider-q">${q_Ss_oy}</div>
          <div class="slider-row">
            <span class="slider-label-l">0</span>
            <input type="range" class="slider-input" min="0" max="100" value="${Sso}"
              id="sl-Sso" oninput="document.getElementById('sv-Sso').textContent=this.value;saveSliderVal('${term}','Ss_other_you',+this.value)">
            <span class="slider-label-r">100</span>
            <span class="slider-val" id="sv-Sso">${Sso}</span>
          </div>
        </div>
      </div>
    </div>

  </div>`
}

function sliderNext() {
  const total = (getValueList()).length
  if (S.sliderIndex < total - 1) { S.sliderIndex++; goTo('slider') }
  else goTo('slider_cert')
}

function sliderBack() {
  if (S.sliderIndex > 0) { S.sliderIndex--; goTo('slider') }
}

function saveSliderVal(term, field, val) {
  if (!S.sliderScores[term]) S.sliderScores[term] = {S0_you_other:50,S0_other_you:50,Ss_you_other:50,Ss_other_you:50}
  S.sliderScores[term][field] = val
}


// saveSlider removed — replaced by saveSliderVal + inline oninput handlers

function slider_cert() {
  const done=Object.keys(S.sliderScores).length, total=getValueList().length
  const gaps=Object.keys(S.sliderScores).map(term=>{
    const sc=S.sliderScores[term]
    return{term,gap:Math.round(((sc.Ss_you_other-sc.S0_you_other)+(sc.Ss_other_you-sc.S0_other_you))/2)}
  }).sort((a,b)=>b.gap-a.gap).slice(0,5)
  return `<div class="screen">
    <div class="section-label">Section A complete</div>
    <h2 class="section-heading">Slider denend<br><em>recorded.</em></h2>
    <p class="body-text">You rated <strong>${done}</strong> of <strong>${total}</strong> values. Your certificate is ready.</p>
    ${gaps.length?`<div class="info-box" style="margin-bottom:32px">
      <strong>Your top gaps</strong> — where the ideal most exceeds the current:<br><br>
      ${gaps.map((g,i)=>`<span class="mono">${i+1}. ${g.term}</span> &nbsp;gap: +${g.gap}<br>`).join('')}
    </div>`:''}
    <div id="cert-status-slider" class="body-text" style="color:var(--text-dim)">Generating your credential...</div>
    <div id="cert-content-slider" style="display:none">
      <div class="certificate-box">
        <div class="certificate-title">Authorship Certificate — Section A</div>
        <div class="certificate-name" id="cert-name-s"></div>
        <div class="certificate-id" id="cert-id-s"></div>
        <div class="divider-thin" style="margin:20px 0"></div>
        <div class="certificate-fp" id="cert-fp-s"></div>
      </div>
      <div class="key-warning">
        <strong>Your private key will be encrypted with your passphrase.</strong>
        The passphrase is never stored — only you know it.
        If you lose it, the encrypted key file becomes unreadable.
      </div>
      <div class="passphrase-row" id="pp-row-s">
        <input type="password" id="pp-input-s" class="passphrase-input"
          placeholder="Set a passphrase (or leave blank for no encryption)"
          maxlength="200">
        <div class="passphrase-hint">Used to encrypt your private key file. Cross-platform. Irreversible.</div>
      </div>
      <div class="btn-group mt-24">
        <button class="btn btn-primary" onclick="downloadCertPDF('slider')">Download cert (.pdf)</button>
        <button class="btn" onclick="downloadPrivateKeyEncrypted('s')">Download private key (.jwk)</button>
        <button class="btn btn-ghost btn-mono" onclick="downloadSliderProfile()">Download denend (.json)</button>
        <button class="btn btn-ghost" onclick="goTo('profile_view')">View my full record →</button>
      </div>
      <div class="divider-thin"></div>
      <p class="body-text" id="save-status-slider"></p>
      <div class="btn-group mt-8">
        <button class="btn btn-primary" onclick="goTo('consult')">Continue to written questions →</button>
        <button class="btn btn-ghost" onclick="goTo('collective')">View collective</button>
      </div>
    </div>
  </div>`
}

async function initSliderCert() {
  if (S.sliderSaved && S.sliderProfileId) { showSliderCertUI(); return }

  function sliderCertStatus(msg, isErr) {
    const el = document.getElementById('cert-status-slider')
    if (!el) return
    if (isErr) { el.style.color='var(--red)'; el.style.fontFamily='var(--font-mono)'; el.style.fontSize='13px' }
    el.textContent = msg
  }

  try {
    if (!window.crypto || !window.crypto.subtle) {
      sliderCertStatus('Error: WebCrypto requires localhost or HTTPS. Use http://localhost:3000', true); return
    }

    sliderCertStatus('Generating key pair...')
    if (!S.keypair) {
      S.keypair = await window.crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign','verify'])
      S.publicKeyJwk = await window.crypto.subtle.exportKey('jwk', S.keypair.publicKey)
    }

    S.sliderProfileId = 'h_' + Array.from(window.crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2,'0')).join('')

    sliderCertStatus('Signing...')
    const profile = { id:S.sliderProfileId, name:S.name||'Anonymous', section:'slider', slider_scores:S.sliderScores }
    const sortedProfile = {}
    Object.keys(profile).sort().forEach(k => { sortedProfile[k] = profile[k] })
    const sigBytes = await window.crypto.subtle.sign(
      { name:'ECDSA', hash:'SHA-256' }, S.keypair.privateKey,
      new TextEncoder().encode(JSON.stringify(sortedProfile))
    )
    const sigArr = new Uint8Array(sigBytes)
    let sigBin = ''; for (let i=0;i<sigArr.length;i++) sigBin += String.fromCharCode(sigArr[i])
    S.signature = btoa(sigBin)

    const fpBytes = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(S.publicKeyJwk)))
    S.fingerprint = Array.from(new Uint8Array(fpBytes)).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase().match(/.{2}/g).join(':')

    sliderCertStatus('Saving...')
    const saveRes = await fetch('/api/profile', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id:S.sliderProfileId, name:S.name||'Anonymous', section:'slider',
        answers:{}, slider_scores:S.sliderScores, public_key_jwk:S.publicKeyJwk,
        signature:S.signature, fingerprint:S.fingerprint })
    })
    if (!saveRes.ok) {
      const err = await saveRes.json().catch(()=>({}))
      throw new Error(err.error || `Server error ${saveRes.status}`)
    }
    S.sliderSaved = true
    showSliderCertUI()
  } catch(e) {
    console.error('initSliderCert failed:', e)
    sliderCertStatus('Error: ' + e.message, true)
  }
}

function showSliderCertUI() {
  setEl('cert-status-slider','Certificate ready.')
  setEl('cert-name-s',S.name)
  setEl('cert-id-s',S.sliderProfileId)
  setEl('cert-fp-s','Key fingerprint:\n'+S.fingerprint)
  setEl('save-status-slider',`✓ Slider denend saved. ${Object.keys(S.sliderScores).length} values recorded.`)
  const c=document.getElementById('cert-content-slider')
  if(c) c.style.display='block'
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION B — ASSAY DENEND
// ══════════════════════════════════════════════════════════════════════════

function questions() {
  const qs=S.data?.questions||[], idx=S.currentQuestion, q=qs[idx], total=qs.length
  if(!q){goTo('review');return''}
  const saved=S.answers[q.key]||''
  return `<div class="screen">
    <div class="question-progress">
      <span>${idx+1} of ${total}</span>
      <div class="question-progress-bar"><div class="question-progress-fill" style="width:${Math.round(idx/total*100)}%"></div></div>
    </div>
    <div class="question-short">${q.short}</div>
    <div class="question-prompt">${q.prompt}</div>
    <div class="question-why">
      <button class="question-why-toggle" onclick="toggleWhy()">▸ Why this question</button>
      <div class="question-why-text" id="why-text">${q.why}</div>
    </div>
    <textarea id="answer-field" placeholder="Take your time. Say what is true." maxlength="10000" oninput="onAnswerInput()">${escHtml(saved)}</textarea>
    <div class="char-count" id="char-count">${saved.length} / 10000</div>
    <div class="info-box" style="display:none;font-style:italic;font-size:14px" id="ack-box">${q.acknowledgement}</div>
  </div>`
}

function onAnswerInput() {
  const ta=document.getElementById('answer-field')
  const btn=document.getElementById('bnav-next-btn')
  const cc=document.getElementById('char-count')
  const ack=document.getElementById('ack-box')
  if(cc) cc.textContent=`${ta.value.length} / 10000`
  if(btn) btn.disabled=ta.value.length===0
  if(ta.value.length>60&&ack) ack.style.display='block'
}

function submitAnswer() {
  const q=(S.data?.questions||[])[S.currentQuestion]
  if(!q) { goTo('review'); return }
  const val=document.getElementById('answer-field')?.value.trim()||''
  if(val) S.answers[q.key]=val
  if(S.currentQuestion<(S.data?.questions||[]).length-1){S.currentQuestion++;goTo('questions')}
  else goTo('review')
}

function toggleWhy() {
  const el=document.getElementById('why-text'),btn=document.querySelector('.question-why-toggle')
  if(!el)return
  el.classList.toggle('open')
  btn.textContent=el.classList.contains('open')?'▾ Why this question':'▸ Why this question'
}

function review() {
  const qs=S.data?.questions||[]
  return `<div class="screen">
    <div class="section-label">Review</div>
    <h2 class="section-heading">Your answers.<br><em>Read them back.</em></h2>
    <p class="body-text">Read before we seal the record. Click any answer to edit.</p>
    <div class="divider-thin"></div>
    ${qs.map((q,i)=>`<div class="review-item">
      <div class="review-q">${i+1}.&nbsp; ${q.short}</div>
      <div class="review-a">${escHtml(S.answers[q.key]||'—')}</div>
      <button class="btn btn-ghost btn-mono mt-16" style="font-size:11px;padding:8px 16px" onclick="S.currentQuestion=${i};goTo('questions')">Edit ↗</button>
    </div>`).join('')}
    <div class="divider-thin"></div>
    <div class="btn-group mt-32">
      <button class="btn btn-primary btn-large" onclick="goTo('certificate')">Confirm and seal →</button>
    </div>
  </div>`
}

function certificate() {
  const label=S.sliderDone?'Full Denend':'Section B — Assay'
  return `<div class="screen">
    <div class="section-label">Your record</div>
    <h2 class="section-heading">Sealing<br><em>your denend.</em></h2>
    <p class="body-text" id="cert-status">Generating your ECDSA P-256 credential...</p>
    <div id="cert-content" style="display:none">
      <div class="certificate-box">
        <div class="certificate-title">Authorship Certificate — ${label}</div>
        <div class="certificate-name" id="cert-name"></div>
        <div class="certificate-id" id="cert-id"></div>
        <div class="divider-thin" style="margin:20px 0"></div>
        <div class="certificate-fp" id="cert-fp"></div>
      </div>
      <div class="key-warning">
        <strong>Your private key is the only proof of authorship.</strong>
        Set a passphrase below — it encrypts the key file so only you can use it.
      </div>
      <div class="passphrase-row" id="pp-row-f">
        <input type="password" id="pp-input-f" class="passphrase-input"
          placeholder="Set a passphrase (or leave blank for no encryption)"
          maxlength="200">
        <div class="passphrase-hint">Used to encrypt your private key file. Cross-platform. Irreversible.</div>
      </div>
      <div class="btn-group mt-24">
        <button class="btn btn-primary" onclick="downloadCertPDF('full')">Download cert (.pdf)</button>
        <button class="btn" onclick="downloadPrivateKeyEncrypted('f')">Download private key (.jwk)</button>
        <button class="btn btn-ghost btn-mono" onclick="downloadProfile()">Download denend (.json)</button>
        <button class="btn btn-ghost" onclick="goTo('profile_view')">View my full record →</button>
      </div>
      <div class="divider-thin"></div>
      <p class="body-text" id="save-status"></p>
      <div class="btn-group mt-8">
        <button class="btn btn-primary" onclick="goTo('collective')">View the collective →</button>
      </div>
    </div>
  </div>`
}

async function initCertificate() {
  if (S.profileSaved && S.profileId) { showCertUI(); return }

  function certStatus(msg, isErr) {
    const el = document.getElementById('cert-status')
    if (!el) return
    if (isErr) {
      el.style.color = 'var(--red)'
      el.style.fontFamily = 'var(--font-mono)'
      el.style.fontSize = '13px'
      el.style.borderLeft = '3px solid var(--red)'
      el.style.paddingLeft = '12px'
    }
    el.textContent = msg
  }

  try {
    // 1 — check secure context
    if (!window.crypto || !window.crypto.subtle) {
      certStatus('Error: WebCrypto not available. Access the app via http://localhost:3000 — not via IP address or http on a remote host.', true)
      return
    }

    // 2 — generate key pair
    certStatus('Generating ECDSA P-256 key pair...')
    if (!S.keypair) {
      S.keypair = await window.crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
      )
      S.publicKeyJwk = await window.crypto.subtle.exportKey('jwk', S.keypair.publicKey)
    }

    // 3 — build profile id
    S.profileId = S.sliderProfileId || (
      'h_' + Array.from(window.crypto.getRandomValues(new Uint8Array(12)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
    )

    // 4 — sign (use JSON.stringify without replacer to capture full nested data)
    certStatus('Signing your record...')
    const profile = {
      id:             S.profileId,
      name:           S.name || 'Anonymous',
      section:        S.sliderDone ? 'full' : 'assay',
      answers:        S.answers,
      slider_scores:  S.sliderScores,
      public_key_jwk: S.publicKeyJwk
    }
    // Sort only top-level keys, let nested data serialize fully
    const sortedProfile = {}
    Object.keys(profile).sort().forEach(k => { sortedProfile[k] = profile[k] })
    const sigBytes = await window.crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      S.keypair.privateKey,
      new TextEncoder().encode(JSON.stringify(sortedProfile))
    )
    // Safe btoa — avoid spread stack limit on large arrays
    const sigArr = new Uint8Array(sigBytes)
    let sigBin = ''
    for (let i = 0; i < sigArr.length; i++) sigBin += String.fromCharCode(sigArr[i])
    S.signature = btoa(sigBin)

    // 5 — fingerprint
    const fpBytes = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(S.publicKeyJwk)))
    S.fingerprint = Array.from(new Uint8Array(fpBytes))
      .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
      .match(/.{2}/g).join(':')

    // 6 — save to server
    certStatus('Saving to server...')
    const method  = S.sliderSaved ? 'PATCH' : 'POST'
    const url     = S.sliderSaved ? `/api/profile/${S.profileId}` : '/api/profile'
    const payload = {
      id: S.profileId, name: S.name || 'Anonymous',
      section: S.sliderDone ? 'full' : 'assay',
      answers: S.answers, slider_scores: S.sliderScores,
      public_key_jwk: S.publicKeyJwk, signature: S.signature, fingerprint: S.fingerprint
    }
    const saveRes  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const saveData = await saveRes.json()
    if (!saveRes.ok) throw new Error(saveData.error || `Server error ${saveRes.status}`)

    S.profileSaved = true
    S.assayDone    = true
    setEl('save-status', `✓ Denend saved. ${saveData.detected_values?.length || 0} values detected.`)
    showCertUI()

  } catch (e) {
    console.error('initCertificate failed:', e)
    certStatus('Error: ' + e.message, true)
  }
}

function showCertUI() {
  setEl('cert-status','Your denend has been sealed and saved.')
  setEl('cert-name',S.name); setEl('cert-id',S.profileId)
  setEl('cert-fp','Key fingerprint:\n'+S.fingerprint)
  const c=document.getElementById('cert-content'); if(c) c.style.display='block'
}

// ── PDF Certificate ────────────────────────────────────────────────────────

function downloadCertPDF(section) {
  const isSlider=section==='slider'
  const pid=isSlider?S.sliderProfileId:S.profileId
  const label=isSlider?'Section A — Slider Denend':(S.sliderDone?'Full Denend':'Section B — Assay Denend')
  const scored=isSlider?Object.keys(S.sliderScores).length:Object.keys(S.answers).length
  const date=new Date().toISOString().split('T')[0]
  const certHtml=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${S.name} — Authorship Certificate</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}@page{size:A4;margin:0}body{font-family:'Cormorant Garamond',Georgia,serif;background:#fff;color:#1a1a1a;width:210mm;min-height:297mm;padding:24mm 20mm;display:flex;flex-direction:column;-webkit-print-color-adjust:exact;print-color-adjust:exact}.border-top{border-top:2px solid #1a1a1a;padding-top:16px;margin-bottom:40px}.sys-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#888;margin-bottom:8px}.sys-name{font-size:13px;font-family:'JetBrains Mono',monospace;color:#444}.cert-title{font-size:11px;font-family:'JetBrains Mono',monospace;letter-spacing:.3em;text-transform:uppercase;color:#888;margin-bottom:20px;text-align:center}.cert-name{font-size:52px;font-weight:300;text-align:center;line-height:1.1;margin-bottom:12px}.cert-sub{font-size:16px;font-weight:300;text-align:center;color:#555;margin-bottom:48px;font-style:italic}.section-block{background:#f9f9f9;border:1px solid #eee;border-left:3px solid #b8944a;padding:20px 24px;margin:32px 0 40px;border-bottom:1px solid #ccc;padding-bottom:32px}.section-block h3{font-size:14px;font-weight:500;margin-bottom:8px}.section-block p{font-size:13px;color:#666;font-weight:300;line-height:1.6}.meta-row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee;font-size:14px}.meta-label{font-family:'JetBrains Mono',monospace;font-size:11px;color:#999;letter-spacing:.1em}.meta-val{color:#333}.fp{font-family:'JetBrains Mono',monospace;font-size:10px;color:#999;word-break:break-all;line-height:1.6;margin-top:20px}.footer{margin-top:auto;padding-top:40px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:10px;color:#bbb;letter-spacing:.1em}@media print{body{padding:18mm 16mm}}</style></head><body>
<div class="border-top"><div class="sys-label">Human Ideal Extraction System</div><div class="sys-name">H.I.E.S &nbsp;·&nbsp; Step 0 of 9 &nbsp;·&nbsp; v1.0</div></div>
<div style="flex:1">
<div class="cert-title">Authorship Certificate &nbsp;·&nbsp; ${label}</div>
<div class="cert-name">${S.name}</div>
<div class="cert-sub">has made a denend and is counted.</div>
<div class="section-block"><h3>What this certifies</h3><p>That the named individual participated in the Human Ideal Extraction System and made a permanent, verifiable record of what they denent from existence. This record belongs to them and will count equally in the aggregate with every other denend, regardless of who they are or where they came from.</p></div>
<div class="meta-row"><span class="meta-label">Profile ID</span><span class="meta-val" style="font-family:monospace;font-size:12px">${pid}</span></div>
<div class="meta-row"><span class="meta-label">Name on record</span><span class="meta-val">${S.name}</span></div>
<div class="meta-row"><span class="meta-label">Section completed</span><span class="meta-val">${label}</span></div>
<div class="meta-row"><span class="meta-label">Data points</span><span class="meta-val">${scored} recorded</span></div>
<div class="meta-row"><span class="meta-label">Date</span><span class="meta-val">${date}</span></div>
<div class="meta-row" style="border-bottom:none"><span class="meta-label">Algorithm</span><span class="meta-val" style="font-family:monospace;font-size:12px">ECDSA-P256-SHA256</span></div>
<div class="fp">Key fingerprint:<br>${S.fingerprint||'(key not yet generated)'}</div>
</div>
<div class="footer"><span>H.I.E.S — humanideal.org</span><span>${date}</span><span>Step 0 of 9</span></div>
<script>window.onload=()=>window.print()<\/script></body></html>`
  const w=window.open('','_blank'); w.document.write(certHtml); w.document.close()
}

// ── Downloads ──────────────────────────────────────────────────────────────


// ── Passphrase-protected key download ─────────────────────────────────────
// Uses PBKDF2 (100,000 iterations, SHA-256) to derive AES-256-GCM wrapping key.
// OS entropy (getRandomValues) provides the salt — cross-platform, irreducible security.

async function downloadPrivateKeyEncrypted(suffix) {
  if (!S.keypair) return
  const inputEl  = document.getElementById('pp-input-' + suffix)
  const passphrase = (inputEl ? inputEl.value : '') || ''
  const privJwk  = await window.crypto.subtle.exportKey('jwk', S.keypair.privateKey)
  const name     = S.name.replace(/[^a-zA-Z0-9]/g,'_')

  if (!passphrase) {
    // No passphrase — plain JWK download with warning
    dlBlob(JSON.stringify({
      note: 'UNENCRYPTED — no passphrase was set',
      algorithm: 'ECDSA-P256',
      key: privJwk,
    }, null, 2), name + '_PRIVATE_KEY_unencrypted.jwk', 'application/json')
    return
  }

  try {
    const enc    = new TextEncoder()
    // OS entropy salt — this is what the project spec calls "OS entropy + passphrase XOR"
    // In Web Crypto the OS entropy is always the PRNG foundation; we combine it with
    // passphrase via PBKDF2 so the derived key depends on BOTH sources.
    const salt   = window.crypto.getRandomValues(new Uint8Array(32))
    const iv     = window.crypto.getRandomValues(new Uint8Array(12))

    const keyMat = await window.crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
    )
    const aesKey = await window.crypto.subtle.deriveKey(
      { name:'PBKDF2', salt, iterations:100000, hash:'SHA-256' },
      keyMat,
      { name:'AES-GCM', length:256 },
      false, ['encrypt']
    )
    const privBytes  = enc.encode(JSON.stringify(privJwk))
    const ciphertext = await window.crypto.subtle.encrypt({ name:'AES-GCM', iv }, aesKey, privBytes)

    const pkg = {
      format:    'HIES-ECDSA-P256-AES256GCM-PBKDF2',
      algorithm: 'PBKDF2-SHA256-100000-AES-256-GCM',
      note:      'Decrypt with your passphrase. Salt and IV are included. Key derivation: PBKDF2(passphrase, salt, 100000, SHA-256) -> AES-256-GCM.',
      salt:      btoa(String.fromCharCode(...salt)),
      iv:        btoa(String.fromCharCode(...iv)),
      ciphertext:btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    }
    dlBlob(JSON.stringify(pkg, null, 2), name + '_PRIVATE_KEY.jwk', 'application/json')
  } catch(e) {
    alert('Encryption failed: ' + e.message + '\nDownloading unencrypted key instead.')
    dlBlob(JSON.stringify(privJwk, null, 2), name + '_PRIVATE_KEY_unencrypted.jwk', 'application/json')
  }
}

async function downloadPrivateKey() {
  if(!S.keypair)return
  const priv=await window.crypto.subtle.exportKey('jwk',S.keypair.privateKey)
  dlBlob(JSON.stringify(priv,null,2),`${S.name.replace(/[^a-zA-Z0-9]/g,'_')}_PRIVATE_KEY.jwk`,'application/json')
}
function downloadSliderProfile() {
  dlBlob(JSON.stringify({id:S.sliderProfileId,name:S.name,section:'slider',slider_scores:S.sliderScores,fingerprint:S.fingerprint},null,2),`${S.name.replace(/[^a-zA-Z0-9]/g,'_')}_slider_denend.json`,'application/json')
}
function downloadProfile() {
  dlBlob(JSON.stringify({id:S.profileId,name:S.name,section:S.sliderDone?'full':'assay',answers:S.answers,slider_scores:S.sliderScores,fingerprint:S.fingerprint,signature:S.signature,public_key_jwk:S.publicKeyJwk},null,2),`${S.name.replace(/[^a-zA-Z0-9]/g,'_')}_denend.json`,'application/json')
}
function dlBlob(content,filename,type) {
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=filename; a.click(); URL.revokeObjectURL(a.href)
}

// ── Collective ─────────────────────────────────────────────────────────────

function collective() {
  return `<div class="screen">
    <div class="section-label">The collective ideal</div>
    <h2 class="section-heading">Every voice.<br><em>One aggregate.</em></h2>
    <p class="body-text">Values detected across all denends, tiered by prevalence. Every tier is preserved.</p>
    <div id="collective-loading" class="body-text" style="color:var(--text-dim);margin-top:40px">Loading...</div>
    <div id="collective-data" style="display:none"></div>
    <div class="btn-group mt-48">
      ${(S.profileSaved||S.sliderSaved)?`<button class="btn btn-ghost" onclick="goTo(S.assayDone?'certificate':'slider_cert')">← Your record</button>`:''}
      <button class="btn btn-ghost" onclick="goTo('cover')">← Home</button>
    </div>
  </div>`
}

async function loadCollective() {
  try {
    const data=await fetch('/api/collective').then(r=>r.json())
    const loading=document.getElementById('collective-loading'), content=document.getElementById('collective-data')
    if(!loading||!content)return
    loading.style.display='none'; content.style.display='block'
    const tiers=[['strong','Near-universal','> 90%'],['broad','Broad majority','60–90%'],['contested','Contested','40–60%'],['outliers','Minority views','< 40%']]
    content.innerHTML=`<div class="collective-stat"><div class="collective-n">${data.total_contributors}</div><div class="collective-n-label">Contributors so far</div></div><div class="divider"></div>`+
      (data.total_contributors===0
        ?`<p class="body-text" style="text-align:center;font-style:italic;color:var(--text-dim)">No denends yet. Complete the session to be the first.</p>`
        :tiers.map(([key,label,desc])=>{
          const vals=Object.entries(data[key]||[])
          if(!vals.length)return''
          return`<div class="tier-section ${key}"><div class="tier-label ${key}">${label} <span style="font-weight:300;opacity:0.6">&nbsp;·&nbsp; ${desc}</span></div><div class="tier-values">${vals.sort((a,b)=>b[1]-a[1]).map(([v,pct])=>`<span class="value-chip" style="cursor:pointer" onclick="openValueFromCollective('${v}')">${v}<span class="pct">${Math.round(pct*100)}%</span></span>`).join('')}</div></div>`
        }).join(''))
  } catch(e) {
    const el=document.getElementById('collective-loading'); if(el) el.textContent='Could not load collective data.'
  }
}

function openValueFromCollective(term) {
  const d=findValueDomain(term); if(d) openValuePanel({term,...d})
}

// ── Docs ───────────────────────────────────────────────────────────────────

function docs() {
  if(S.currentDoc==='value_set')return renderValueSetDoc()
  if(S.currentDoc)return renderMarkdownDoc(S.currentDoc)
  return renderDocsIndex()
}

function renderDocsIndex() {
  return `<div class="screen">
    <div class="section-label">Project documents</div>
    <h2 class="section-heading">The foundation<br><em>of the system.</em></h2>
    <div class="docs-grid">
      ${Object.entries(DOC_META).map(([key,m])=>`<div class="doc-card" onclick="openDoc('${key}')">
        <div class="doc-card-icon">${m.icon}</div>
        <div class="doc-card-body"><div class="doc-card-title">${m.title}</div><div class="doc-card-subtitle">${m.subtitle}</div></div>
        <div class="doc-card-arrow">→</div>
      </div>`).join('')}
    </div>
    <div class="btn-group mt-48"><button class="btn btn-ghost" onclick="goTo('cover')">← Home</button></div>
  </div>`
}

async function openDoc(key) {
  S.currentDoc = key
  const cached = S.docsCache[key]
  const isError = cached && (cached.startsWith('# File not found') || cached.startsWith('# Load error'))
  if (!cached || isError) {
    try {
      const res  = await fetch(`/api/docs/${key}`)
      const data = await res.json()
      if (!res.ok || !data.content) {
        S.docsCache[key] = '# File not found\n\nPlace `' + key + '.md` in the webapp root folder and restart the server.\n\nServer says: ' + (data.error || res.status)
      } else {
        S.docsCache[key] = data.content
      }
    } catch(e) {
      S.docsCache[key] = '# Load error\n\n' + e.message
    }
  }
  goTo('docs')
}

function renderMarkdownDoc(key) {
  const meta=DOC_META[key]||{title:key,icon:'·'}
  return `<div class="screen">
    <div class="section-label" style="cursor:pointer" onclick="S.currentDoc=null;goTo('docs')">← Docs</div>
    <h2 class="section-heading" style="margin-bottom:8px">${meta.icon} &nbsp;${meta.title}</h2>
    <p class="body-text" style="font-size:14px;margin-bottom:40px">${meta.subtitle}</p>
    <div class="divider-thin"></div>
    <div class="markdown-body">${renderMarkdown(S.docsCache[key]||'Loading...')}</div>
    <div class="btn-group mt-48"><button class="btn btn-ghost" onclick="S.currentDoc=null;goTo('docs')">← All docs</button></div>
  </div>`
}

function renderValueSetDoc() {
  const domains=S.values?.domains||[]
  return `<div class="screen">
    <div class="section-label" style="cursor:pointer" onclick="S.currentDoc=null;goTo('docs')">← Docs</div>
    <h2 class="section-heading" style="margin-bottom:8px">◈ &nbsp;Value Set</h2>
    <p class="body-text" style="font-size:14px;margin-bottom:8px">${S.values?.value_set?.length||0} values across ${domains.length} domains. Click any value to see its definition.</p>
    <div class="divider-thin"></div>
    ${domains.map(d=>`<div class="vs-domain">
      <div class="vs-domain-header"><span class="vs-domain-label">${d.label}</span><span class="vs-domain-desc">${d.description}</span></div>
      <div class="vs-values-grid">${d.values.map(v=>`<button class="vs-value-chip" onclick='openValuePanel(${JSON.stringify({term:v.term,definition:v.definition,domain:d.label})})'>${v.term}</button>`).join('')}</div>
    </div>`).join('')}
    <div class="btn-group mt-48"><button class="btn btn-ghost" onclick="S.currentDoc=null;goTo('docs')">← All docs</button></div>
  </div>
  <div id="value-panel" class="value-panel" onclick="closeValuePanel(event)">
    <div class="value-panel-inner">
      <button class="value-panel-close" onclick="closeValuePanel()">✕</button>
      <div id="value-panel-content"></div>
    </div>
  </div>`
}

function openValuePanel(v) {
  S.selectedValue=v
  const panel=document.getElementById('value-panel'), content=document.getElementById('value-panel-content')
  if(!panel||!content)return
  content.innerHTML=`<div class="vp-domain">${v.domain||''}</div><div class="vp-term">${v.term}</div><div class="vp-definition">${v.definition}</div><div class="divider-thin" style="margin:24px 0"></div><div class="vp-scoring-label">Three-number scoring framework</div><div class="vp-scoring-grid"><div class="vp-score-item"><div class="vp-score-name">given</div><div class="vp-score-desc">How much of this value do others currently extend to you? (0–100)</div></div><div class="vp-score-item"><div class="vp-score-name">given by</div><div class="vp-score-desc">How much of this value do you currently extend to others? (0–100)</div></div><div class="vp-score-item"><div class="vp-score-name">ought</div><div class="vp-score-desc">What should both numbers be in the ideal? (0–100)</div></div></div><div class="vp-gap-note">Gap = ought − actual. A positive gap is something the collective ideal can be held accountable for closing.</div>`
  panel.classList.add('open'); document.body.style.overflow='hidden'
}
function closeValuePanel(e) {
  if(e&&e.target!==document.getElementById('value-panel'))return
  const panel=document.getElementById('value-panel'); if(panel) panel.classList.remove('open'); document.body.style.overflow=''
}
function findValueDomain(term) {
  for(const d of (S.values?.domains||[])){const v=d.values.find(v=>v.term===term);if(v)return{definition:v.definition,domain:d.label}}; return null
}

// ── Markdown ───────────────────────────────────────────────────────────────

function renderMarkdown(md) {
  // Phase 1: escape HTML
  let h = escHtml(md)

  // Phase 2: protect fenced code blocks with placeholders BEFORE any other processing
  const codeBlocks = []
  h = h.replace(/```[\s\S]*?```/g, function(m) {
    const inner = m.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '')
    const idx   = codeBlocks.length
    codeBlocks.push('<pre class="md-code"><code>' + inner + '</code></pre>')
    return '\x00CODEBLOCK_' + idx + '\x00'
  })

  // Phase 3: protect inline code
  const inlines = []
  h = h.replace(/`([^`\r\n]+)`/g, function(_, code) {
    const idx = inlines.length
    inlines.push('<code class="md-inline-code">' + code + '</code>')
    return '\x00INLINE_' + idx + '\x00'
  })

  // Phase 4: block elements
  h = h.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
  h = h.replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>')
  h = h.replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>')
  h = h.replace(/^---+$/gm,     '<hr class="md-hr">')
  h = h.replace(/^&gt; (.+)$/gm,'<blockquote class="md-blockquote">$1</blockquote>')

  // Phase 5: inline emphasis
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  h = h.replace(/\*([^*\n]+)\*/g,   '<em>$1</em>')

  // Phase 6: unordered lists
  h = h.replace(/((?:^- .+\n?)+)/gm, function(block) {
    const items = block.trim().split('\n').map(function(l){ return '<li>' + l.replace(/^- /, '') + '</li>' }).join('')
    return '<ul class="md-ul">' + items + '</ul>'
  })

  // Phase 7: tables — separator rows (|---|) are skipped, first row is <th>
  h = h.replace(/((?:^\|.+\|\n?)+)/gm, function(block) {
    const rows = block.trim().split('\n').filter(function(r){ return !r.match(/^\|[\s|:-]+\|$/) })
    if (!rows.length) return ''
    const htmlRows = rows.map(function(r, i) {
      const cells = r.split('|').slice(1,-1).map(function(c){ return c.trim() })
      const tag   = i === 0 ? 'th' : 'td'
      return '<tr>' + cells.map(function(c){ return '<' + tag + ' class="md-td">' + c + '</' + tag + '>' }).join('') + '</tr>'
    }).join('')
    return '<table class="md-table">' + htmlRows + '</table>'
  })

  // Phase 8: paragraphs via line-by-line processing
  const blockStart = /^(<h[1-6]|<ul|<pre|<table|<hr|<blockquote|\x00CODEBLOCK)/
  const parts  = h.split('\n')
  const out    = []
  let   para   = []
  function flushPara() {
    if (para.length) { out.push('<p class="md-p">' + para.join(' ') + '</p>'); para = [] }
  }
  for (let i = 0; i < parts.length; i++) {
    const line = parts[i]
    if (line.trim() === '') {
      flushPara()
    } else if (blockStart.test(line.trim())) {
      flushPara()
      out.push(line)
    } else {
      para.push(line)
    }
  }
  flushPara()
  h = out.join('\n')

  // Phase 9: restore placeholders
  h = h.replace(/\x00CODEBLOCK_(\d+)\x00/g, function(_, i) { return codeBlocks[parseInt(i)] })
  h = h.replace(/\x00INLINE_(\d+)\x00/g,    function(_, i) { return inlines[parseInt(i)] })

  return h
}


// ══════════════════════════════════════════════════════════════════════════
// CONSULTATION SCREEN
// ══════════════════════════════════════════════════════════════════════════

function consult() {
  return `<div class="screen">
    <div class="section-label">Optional — before your written answers</div>
    <h2 class="section-heading">Consultation.<br><em>Find the words first.</em></h2>
    <p class="body-text">
      Sometimes what we denent is felt before it is named.
      This consultation is a space to think out loud — with an AI guide that understands
      what this process is trying to extract.
    </p>
    <p class="body-text">
      Your consultation is not saved. It does not become part of your denend.
      Its only purpose is to help you arrive at your written answers with more clarity.
    </p>

    <div id="consult-status-msg" class="info-box" style="margin:24px 0">Checking availability...</div>

    <div id="consult-chat" style="display:none">
      <div class="chat-history" id="chat-history"></div>
      <div class="chat-input-row">
        <textarea id="chat-input" class="chat-input" rows="2"
          placeholder="Say what is on your mind..."
          onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();sendConsult()}"
        ></textarea>
        <button class="chat-send-btn" id="chat-send" onclick="sendConsult()">Send</button>
      </div>
      <div class="chat-hint">Ctrl+Enter to send</div>
    </div>

    <div class="btn-group mt-32">
      <button class="btn btn-primary" onclick="S.currentQuestion=0;goTo('questions')">
        Continue to written questions →
      </button>
      <button class="btn btn-ghost" onclick="S.sliderDone?goTo('slider_cert'):goTo('proclamations')">← Back</button>
    </div>
  </div>`
}

async function initConsult() {
  const statusEl = document.getElementById('consult-status-msg')
  const chatEl   = document.getElementById('consult-chat')
  if (!statusEl || !chatEl) return

  if (S.consultAvailable === null) {
    try {
      const res        = await fetch('/api/consult/status')
      const data       = await res.json()
      S.consultAvailable = data.available
    } catch(e) {
      S.consultAvailable = false
    }
  }

  if (!S.consultAvailable) {
    statusEl.innerHTML = `<strong>Consultation unavailable.</strong><br><br>
      To enable it, add your Anthropic API key as an environment variable before starting the server:<br>
      <code style="font-family:var(--font-m);font-size:12px;color:var(--gold)">set ANTHROPIC_API_KEY=your_key_here</code><br>
      then restart with <code style="font-family:var(--font-m);font-size:12px;color:var(--gold)">node server.js</code><br><br>
      You can proceed to the written questions without it.`
    return
  }

  statusEl.style.display = 'none'
  chatEl.style.display   = 'block'

  // Seed the conversation if empty
  if (S.consultMessages.length === 0) {
    addChatBubble('assistant',
      `Hello, ${S.name||''}. Before you answer the questions, I want to help you locate yourself.\n\nWhat is the thing in your life right now that feels most misaligned — where the gap between how things are and how they should be is sharpest?`
    )
  } else {
    // Re-render existing messages
    const hist = document.getElementById('chat-history')
    if (hist) hist.innerHTML = ''
    for (const m of S.consultMessages) {
      if (m.role !== 'system') addChatBubble(m.role, m.content)
    }
  }
}

function addChatBubble(role, text) {
  const hist = document.getElementById('chat-history')
  if (!hist) return
  const bubble = document.createElement('div')
  bubble.className = `chat-bubble chat-bubble-\${role}`
  bubble.textContent = text
  hist.appendChild(bubble)
  hist.scrollTop = hist.scrollHeight
}

async function sendConsult() {
  const input  = document.getElementById('chat-input')
  const sendBtn= document.getElementById('chat-send')
  const text   = input?.value.trim()
  if (!text) return

  // Add user message
  S.consultMessages.push({ role:'user', content: text })
  addChatBubble('user', text)
  input.value = ''
  if (sendBtn) sendBtn.disabled = true

  // Typing indicator
  const hist = document.getElementById('chat-history')
  const typing = document.createElement('div')
  typing.className = 'chat-bubble chat-bubble-assistant chat-typing'
  typing.textContent = '...'
  if (hist) { hist.appendChild(typing); hist.scrollTop = hist.scrollHeight }

  try {
    const res  = await fetch('/api/consult', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        messages: S.consultMessages,
        name:     S.name,
        context:  S.sliderDone
          ? `The coreh has completed the slider section covering ${Object.keys(S.sliderScores).length} values.`
          : 'The coreh is about to begin the written questions section of their denend.',
      })
    })
    const data = await res.json()
    if (typing.parentNode) typing.parentNode.removeChild(typing)

    if (data.text) {
      S.consultMessages.push({ role:'assistant', content: data.text })
      addChatBubble('assistant', data.text)
    } else {
      addChatBubble('assistant', 'Something went wrong. Try again.')
    }
  } catch(e) {
    if (typing.parentNode) typing.parentNode.removeChild(typing)
    addChatBubble('assistant', 'Connection error. Please try again.')
  } finally {
    if (sendBtn) sendBtn.disabled = false
    if (input)   input.focus()
  }
}



// ══════════════════════════════════════════════════════════════════════════
// CONTENT AUDIT PAGE
// ══════════════════════════════════════════════════════════════════════════

function audit() {
  return `<div class="screen">
    <div class="section-label">Content Review</div>
    <h2 class="section-heading">Audit Mode.<br><em>Read. Edit. Export.</em></h2>
    <p class="body-text">
      Every piece of writing in this project — proclamations, questions, doctrine —
      is shown below. Edit any field. Export to a file you can refine offline.
      Re-import to apply changes.
    </p>

    <div class="audit-tabs" id="audit-tabs">
      <button class="audit-tab active" onclick="switchAuditTab(event,'proclamations')">Proclamations</button>
      <button class="audit-tab" onclick="switchAuditTab(event,'assay')">Assay Questions</button>
      <button class="audit-tab" onclick="switchAuditTab(event,'slider')">Slider Questions</button>
      <button class="audit-tab" onclick="switchAuditTab(event,'import')">Import</button>
    </div>

    <div id="audit-proclamations" class="audit-panel">
      <div id="audit-proc-content"><div class="loading-msg">Loading...</div></div>
    </div>

    <div id="audit-assay" class="audit-panel" style="display:none">
      <div id="audit-assay-content"><div class="loading-msg">Loading...</div></div>
    </div>

    <div id="audit-slider" class="audit-panel" style="display:none">
      <div class="audit-search-row">
        <input type="text" id="audit-slider-search" class="audit-search"
          placeholder="Search values..." oninput="filterAuditSlider()">
      </div>
      <div id="audit-slider-content"><div class="loading-msg">Loading...</div></div>
    </div>

    <div id="audit-import" class="audit-panel" style="display:none">
      <p class="body-text">Paste a previously exported audit JSON below and click Apply.</p>
      <textarea id="audit-import-input" class="audit-textarea audit-textarea-tall"
        placeholder="Paste exported JSON here..."></textarea>
      <button class="btn btn-primary mt-16" onclick="applyAuditImport()">Apply Import</button>
      <div id="audit-import-status" style="margin-top:12px;font-family:var(--font-mono);font-size:12px;color:var(--gold)"></div>
    </div>

    <div class="audit-actions">
      <button class="btn btn-primary" onclick="exportAudit()">Export all edits (.json)</button>
      <button class="btn btn-ghost" onclick="goTo('cover')">← Exit audit</button>
    </div>
  </div>`
}

let AUDIT_DATA = null

async function initAudit() {
  if (!S.data) { document.getElementById('audit-proc-content').innerHTML = '<div class="loading-msg">Data not loaded. Return to cover and start again.</div>'; return }
  AUDIT_DATA = JSON.parse(JSON.stringify(S.data)) // deep clone
  renderAuditProclamations()
  renderAuditAssay()
  renderAuditSlider()
}

function switchAuditTab(evt, tab) {
  document.querySelectorAll('.audit-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.audit-panel').forEach(p => p.style.display = 'none')
  evt.target.classList.add('active')
  document.getElementById('audit-' + tab).style.display = 'block'
}

function renderAuditProclamations() {
  if (!AUDIT_DATA) return
  const container = document.getElementById('audit-proc-content')
  if (!container) return
  const cats = AUDIT_DATA.proclamations || {}
  container.innerHTML = ''
  for (const [cat, statements] of Object.entries(cats)) {
    const label = (AUDIT_DATA.proclamation_meta || {})[cat]?.label || cat
    const sec = document.createElement('div')
    sec.className = 'audit-section'
    const lbl = document.createElement('div')
    lbl.className = 'audit-section-label'
    lbl.textContent = label
    sec.appendChild(lbl)
    statements.forEach((stmt, i) => {
      const wrap = document.createElement('div')
      wrap.className = 'audit-field'
      const key = document.createElement('div')
      key.className = 'audit-field-key'
      key.textContent = 'Statement ' + (i + 1)
      const ta = document.createElement('textarea')
      ta.className = 'audit-textarea'
      ta.rows = Math.max(3, Math.ceil(stmt.length / 80))
      ta.value = stmt
      ta.addEventListener('input', function() {
        AUDIT_DATA.proclamations[cat][i] = this.value
      })
      wrap.appendChild(key)
      wrap.appendChild(ta)
      sec.appendChild(wrap)
    })
    container.appendChild(sec)
  }
}

function renderAuditAssay() {
  if (!AUDIT_DATA) return
  const container = document.getElementById('audit-assay-content')
  if (!container) return
  const qs = AUDIT_DATA.questions || []
  container.innerHTML = ''
  if (!qs.length) { container.innerHTML = '<div class="loading-msg">No assay questions found.</div>'; return }
  qs.forEach((q, i) => {
    const wrap = document.createElement('div')
    wrap.className = 'audit-field'
    const key = document.createElement('div')
    key.className = 'audit-field-key'
    key.textContent = 'Question ' + (i + 1)
    const ta = document.createElement('textarea')
    ta.className = 'audit-textarea'
    ta.rows = 3
    ta.value = q
    ta.addEventListener('input', function() { AUDIT_DATA.questions[i] = this.value })
    wrap.appendChild(key)
    wrap.appendChild(ta)
    container.appendChild(wrap)
  })
}

let _allSliderTerms = []
function renderAuditSlider(filter) {
  if (!AUDIT_DATA) return
  const container = document.getElementById('audit-slider-content')
  if (!container) return
  const sq = AUDIT_DATA.slider_questions || {}
  _allSliderTerms = Object.keys(sq)
  const terms = filter
    ? _allSliderTerms.filter(t => t.toLowerCase().includes(filter.toLowerCase()))
    : _allSliderTerms

  container.innerHTML = '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-dim);margin-bottom:16px">' + terms.length + ' values</div>'

  const fieldDefs = [
    ['State0 · you → others (current)', 'State0', 'Q_corehU_coreh'],
    ['State0 · others → you (current)', 'State0', 'Q_coreh_corehU'],
    ['State★ · you → others (ideal)',   'State_star', 'Q_corehU_coreh'],
    ['State★ · others → you (ideal)',   'State_star', 'Q_coreh_corehU'],
  ]

  for (const term of terms) {
    const sec = document.createElement('div')
    sec.className = 'audit-section'
    const lbl = document.createElement('div')
    lbl.className = 'audit-section-label'
    lbl.textContent = term
    sec.appendChild(lbl)

    for (const [label, state, key] of fieldDefs) {
      const val = sq[term]?.[state]?.[key] || ''
      const wrap = document.createElement('div')
      wrap.className = 'audit-field'
      const kl = document.createElement('div')
      kl.className = 'audit-field-key'
      kl.textContent = label
      const ta = document.createElement('textarea')
      ta.className = 'audit-textarea'
      ta.rows = 3
      ta.value = val
      ta.addEventListener('input', function() {
        if (!AUDIT_DATA.slider_questions[term]) AUDIT_DATA.slider_questions[term] = {}
        if (!AUDIT_DATA.slider_questions[term][state]) AUDIT_DATA.slider_questions[term][state] = {}
        AUDIT_DATA.slider_questions[term][state][key] = this.value
      })
      wrap.appendChild(kl)
      wrap.appendChild(ta)
      sec.appendChild(wrap)
    }
    container.appendChild(sec)
  }
}

function filterAuditSlider() {
  const q = document.getElementById('audit-slider-search')?.value || ''
  renderAuditSlider(q)
}

function exportAudit() {
  if (!AUDIT_DATA) return
  const ts = new Date().toISOString().slice(0,10)
  dlBlob(JSON.stringify(AUDIT_DATA, null, 2), 'hies_audit_' + ts + '.json', 'application/json')
}

async function applyAuditImport() {
  const raw = document.getElementById('audit-import-input')?.value?.trim()
  const status = document.getElementById('audit-import-status')
  if (!raw) { if(status) status.textContent = 'Nothing to import.'; return }
  try {
    const parsed = JSON.parse(raw)
    // Merge into live S.data
    if (parsed.proclamations)    S.data.proclamations    = parsed.proclamations
    if (parsed.questions)        S.data.questions        = parsed.questions
    if (parsed.slider_questions) S.data.slider_questions = parsed.slider_questions
    if (parsed.proclamation_meta)S.data.proclamation_meta= parsed.proclamation_meta
    AUDIT_DATA = JSON.parse(JSON.stringify(S.data))
    renderAuditProclamations()
    renderAuditAssay()
    renderAuditSlider()
    if(status) status.textContent = 'Import applied. Re-export to save your merged version.'
  } catch(e) {
    if(status) status.textContent = 'Parse error: ' + e.message
  }
}



// ══════════════════════════════════════════════════════════════════════════
// BOOTSTRAP SEQUENCE TRACKER
// ══════════════════════════════════════════════════════════════════════════

const BOOTSTRAP_STEPS = [
  {
    id: 1,
    title: 'Extract profiles from 1,000 people',
    desc: 'Proof of concept. Test the questions, improve them upon a flywheel — positive feedback kicks in. Every profile is a data point and a proof that the system works.',
    target: 1000,
    metric: 'profiles',
  },
  {
    id: 2,
    title: 'Iterate questions to statistical stability',
    desc: 'The flywheel: each cohort of answers reveals which questions produce the most signal. Questions are revised. The next cohort answers better questions. Repeat until the gaps stabilise.',
    target: null,
    metric: 'question iterations',
  },
  {
    id: 3,
    title: 'Publish the first collective ideal (C1)',
    desc: 'The first honest aggregate. What 1,000 people actually denent, combined, published, and made verifiable. The first version of what existence owes us.',
    target: null,
    metric: 'collective versions',
  },
  {
    id: 4,
    title: 'Build the armh alignment layer',
    desc: 'Take the collective ideal to institutions — governments, corporations, ASI developers — and ask them, formally and publicly, to account for their alignment or misalignment with it.',
    target: null,
    metric: 'armhs engaged',
  },
  {
    id: 5,
    title: 'Scale to 1,000,000 corehs',
    desc: 'The claim becomes undeniable at scale. One million denends is a mandate. It is the kind of number that cannot be dismissed as a sample.',
    target: 1000000,
    metric: 'profiles',
  },
  {
    id: 6,
    title: 'Convergence with ASI alignment',
    desc: 'The collective ideal becomes the reference for ASI alignment. The question "aligned to whose values?" has an answer that is verifiable, updated continuously, and owned by every coreh who contributed to it.',
    target: null,
    metric: 'alignment anchors',
  },
]

function bootstrap() {
  return `<div class="screen">
    <div class="section-label">Where we are</div>
    <h2 class="section-heading">Bootstrap Sequence.<br><em>The road from here to there.</em></h2>
    <p class="body-text">
      This project does not ask you to believe it will work. It asks you to be one of the people who make it work.
      Here is where we currently are in the sequence.
    </p>
    <div id="bootstrap-content"><div class="loading-msg">Loading live count...</div></div>
    <div class="btn-group mt-32">
      <button class="btn btn-ghost" onclick="history.back()">← Back</button>
    </div>
  </div>`
}

async function initBootstrap() {
  const container = document.getElementById('bootstrap-content')
  if (!container) return

  let totalProfiles = 0
  try {
    const res  = await fetch('/api/stats')
    const data = await res.json()
    totalProfiles = data.total_profiles || 0
  } catch(e) {}

  const step1 = BOOTSTRAP_STEPS[0]
  const currentStep = totalProfiles >= 1000 ? 2 : 1

  let html = '<div class="bootstrap-list">'
  for (const step of BOOTSTRAP_STEPS) {
    const isActive  = step.id === currentStep
    const isDone    = step.id < currentStep
    const pct       = (step.target && step.id === 1)
      ? Math.min(100, Math.round(totalProfiles / step.target * 100))
      : null

    html += `<div class="bootstrap-step ${isDone ? 'step-done' : ''} ${isActive ? 'step-active' : ''}">`
    html += `<div class="step-num">${step.id}</div>`
    html += `<div class="step-body">`
    html += `<div class="step-title">${step.title}</div>`
    html += `<div class="step-desc">${step.desc}</div>`
    if (isActive && pct !== null) {
      html += `<div class="step-progress-wrap">`
      html += `<div class="step-progress-bar"><div class="step-progress-fill" style="width:${pct}%"></div></div>`
      html += `<div class="step-progress-label">${totalProfiles.toLocaleString()} / ${step.target.toLocaleString()} ${step.metric} — ${pct}%</div>`
      html += `</div>`
    } else if (isActive) {
      html += `<div class="step-progress-label" style="color:var(--gold);font-family:var(--font-mono);font-size:11px;margin-top:8px">← In progress</div>`
    } else if (isDone) {
      html += `<div class="step-progress-label" style="color:var(--green);font-family:var(--font-mono);font-size:11px;margin-top:8px">✓ Complete</div>`
    }
    html += `</div></div>`
  }
  html += '</div>'

  container.innerHTML = html
}


// ══════════════════════════════════════════════════════════════════════════
// PROFILE VIEW — full record with 4-grid colour display
// ══════════════════════════════════════════════════════════════════════════

function profile_view() {
  return `<div class="screen">
    <div class="section-label">Your record</div>
    <h2 class="section-heading">Your Denend.<br><em>Everything you have done here.</em></h2>
    <div id="profile-view-content"><div class="loading-msg">Building your record...</div></div>
    <div class="btn-group mt-32">
      <button class="btn btn-ghost" onclick="history.back()">← Back</button>
    </div>
  </div>`
}

function valueToColour(val) {
  // 0 = deep red, 100 = deep green
  const v = Math.max(0, Math.min(100, val))
  // red: hsl(0, 65%, 28%)  green: hsl(127, 45%, 28%)
  const hue = Math.round(v * 1.27)
  const sat = Math.round(65 - v * 0.20)
  const lit = Math.round(28 + v * 0.12)
  return 'hsl(' + hue + ',' + sat + '%,' + lit + '%)'
}

function buildValueGrid(scores, field, label) {
  const values = getValueList()
  const block = document.createElement('div')
  block.className = 'profile-grid-block'

  const title = document.createElement('div')
  title.className = 'profile-grid-title'
  title.textContent = label
  block.appendChild(title)

  const grid = document.createElement('div')
  grid.className = 'value-grid'

  for (const v of values) {
    const score = scores[v.term]?.[field] ?? null
    const sq = document.createElement('div')
    sq.className = 'value-square'
    sq.title = v.term + (score !== null ? ' — ' + score : ' — not rated')
    sq.style.background = score !== null ? valueToColour(score) : '#1c1c28'
    grid.appendChild(sq)
  }
  block.appendChild(grid)
  return block
}

async function initProfileView() {
  const container = document.getElementById('profile-view-content')
  if (!container) return
  if (!S.data) { container.innerHTML = '<div class="loading-msg">Data not loaded. Return to cover and start again.</div>'; return }

  const hasSlider = S.sliderDone || Object.keys(S.sliderScores).length > 0
  const hasAssay  = S.profileSaved || Object.keys(S.answers || {}).length > 0

  // ── Certificate block ───────────────────────────────────────────────
  const certBlock = document.createElement('div')
  certBlock.className = 'profile-cert-block'

  const section = S.sliderDone && S.profileSaved ? 'Full Denend'
                : S.sliderDone ? 'Slider Section'
                : S.profileSaved ? 'Assay Section'
                : 'No certificate yet'

  certBlock.innerHTML = `
    <div class="cert-header-row" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.2em;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px">Record</div>
        <div style="font-size:24px;font-weight:300;color:var(--text)">${esc(S.name || 'Anonymous')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.2em;color:var(--gold);text-transform:uppercase">${section}</div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);margin-top:4px">${new Date().toLocaleDateString()}</div>
      </div>
    </div>
    ${S.fingerprint ? `<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-dim);word-break:break-all;line-height:1.6;padding-top:16px;border-top:1px solid var(--border)">${S.fingerprint}</div>` : ''}
  `
  container.appendChild(certBlock)

  // ── Slider grids ────────────────────────────────────────────────────
  if (hasSlider) {
    const gridsLabel = document.createElement('div')
    gridsLabel.className = 'section-label'
    gridsLabel.style.marginTop = '40px'
    gridsLabel.textContent = 'Slider results — each square is one value'
    container.appendChild(gridsLabel)

    const sub = document.createElement('div')
    sub.style.cssText = 'font-family:var(--font-mono);font-size:10px;color:var(--text-dim);margin-bottom:20px;letter-spacing:.05em'
    sub.textContent = 'Colour: deep red = 0 (none)  →  deep green = 100 (full).  Grey = not rated.  Hover to see value name.'
    container.appendChild(sub)

    const gridsWrap = document.createElement('div')
    gridsWrap.className = 'profile-grids'
    gridsWrap.appendChild(buildValueGrid(S.sliderScores, 'S0_you_other', 'State 0 — You → Others (current)'))
    gridsWrap.appendChild(buildValueGrid(S.sliderScores, 'S0_other_you', 'State 0 — Others → You (current)'))
    gridsWrap.appendChild(buildValueGrid(S.sliderScores, 'Ss_you_other', 'State ★ — You → Others (ideal)'))
    gridsWrap.appendChild(buildValueGrid(S.sliderScores, 'Ss_other_you', 'State ★ — Others → You (ideal)'))
    container.appendChild(gridsWrap)

    // Top gaps
    const gaps = Object.entries(S.sliderScores)
      .map(([term, sc]) => ({
        term,
        gap: Math.round(((sc.Ss_you_other - sc.S0_you_other) + (sc.Ss_other_you - sc.S0_other_you)) / 2)
      }))
      .filter(g => g.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 10)

    if (gaps.length) {
      const gapLabel = document.createElement('div')
      gapLabel.className = 'section-label'
      gapLabel.style.marginTop = '32px'
      gapLabel.textContent = 'Your largest gaps — ideal vs current'
      container.appendChild(gapLabel)

      const gapList = document.createElement('div')
      gapList.style.display = 'flex'
      gapList.style.flexDirection = 'column'
      gapList.style.gap = '8px'
      gapList.style.marginBottom = '32px'

      const maxGap = gaps[0].gap
      for (const g of gaps) {
        const row = document.createElement('div')
        row.style.cssText = 'display:grid;grid-template-columns:160px 1fr 44px;gap:12px;align-items:center'
        row.innerHTML = `
          <span style="font-family:var(--font-mono);font-size:12px;color:var(--mid)">${esc(g.term)}</span>
          <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden">
            <div style="height:3px;background:var(--gold);width:${Math.round(g.gap/maxGap*100)}%;border-radius:2px"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--gold);text-align:right">+${g.gap}</span>`
        gapList.appendChild(row)
      }
      container.appendChild(gapList)
    }
  }

  // ── Assay answers ───────────────────────────────────────────────────
  const answers = S.answers || {}
  if (hasAssay && Object.keys(answers).length) {
    const aLabel = document.createElement('div')
    aLabel.className = 'section-label'
    aLabel.style.marginTop = '40px'
    aLabel.textContent = 'Written answers'
    container.appendChild(aLabel)

    const aBlock = document.createElement('div')
    aBlock.className = 'profile-answers-block'
    for (const [q, a] of Object.entries(answers)) {
      const qNum = (S.data?.questions||[]).findIndex(x => x.key === q)
      const qMeta = (S.data?.questions||[])[qNum] || {}
      const label = qMeta.short || q.replace(/_/g,' ')
      const uid = 'assay-' + q
      const item = document.createElement('div')
      item.className = 'profile-answer-item'
      item.innerHTML = `
        <button class="assay-reveal-btn" onclick="toggleAssayAnswer('${uid}')">
          <span class="assay-reveal-num">${qNum >= 0 ? qNum+1 : '·'}</span>
          <span class="assay-reveal-title">${esc(label)}</span>
          <span class="assay-reveal-key">${esc(q)}</span>
          <span class="assay-reveal-caret">▸</span>
        </button>
        <div class="assay-answer-body" id="${uid}" style="display:none">
          <div class="profile-answer-a">${esc(a)}</div>
        </div>`
      aBlock.appendChild(item)
    }
    container.appendChild(aBlock)
  }

  // ── Detected values ─────────────────────────────────────────────────
  const detected = S.detectedValues || []
  if (detected.length) {
    const dLabel = document.createElement('div')
    dLabel.className = 'section-label'
    dLabel.style.marginTop = '32px'
    dLabel.textContent = 'Values detected in your written answers'
    container.appendChild(dLabel)

    const cloud = document.createElement('div')
    cloud.className = 'profile-detected'
    for (const v of detected) {
      const tag = document.createElement('span')
      tag.className = 'detected-tag'
      tag.textContent = v
      cloud.appendChild(tag)
    }
    container.appendChild(cloud)
  }

  if (!hasSlider && !hasAssay) {
    container.innerHTML = `<div class="info-box" style="margin-top:24px">
      You have not completed any section yet. Complete the slider questions or the written questions to see your record here.
    </div>`
  }
}


function toggleAssayAnswer(uid) {
  const body = document.getElementById(uid)
  const btn  = body?.previousElementSibling
  if (!body) return
  const open = body.style.display === 'none'
  body.style.display = open ? 'block' : 'none'
  if (btn) {
    const caret = btn.querySelector('.assay-reveal-caret')
    if (caret) caret.textContent = open ? '▾' : '▸'
    btn.classList.toggle('assay-reveal-btn-open', open)
  }
}

// ── Utils ──────────────────────────────────────────────────────────────────

function escHtml(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
const esc = escHtml
function setEl(id,text){const el=document.getElementById(id);if(el)el.textContent=text}

// ── Events ─────────────────────────────────────────────────────────────────

function attachEvents() {
  // Close nav dropdown when clicking outside — remove old handler first
  if (document._dropdownClickHandler) {
    document.removeEventListener('click', document._dropdownClickHandler)
  }
  document._dropdownClickHandler = function(e) {
    const dd = document.getElementById('bnav-dropdown')
    if (dd && dd.classList.contains('open') && !dd.contains(e.target)) {
      dd.classList.remove('open')
    }
  }
  document.addEventListener('click', document._dropdownClickHandler)
  // Slider keyboard navigation — remove old handler first, always
  if (document._sliderKeyHandler) {
    document.removeEventListener('keydown', document._sliderKeyHandler)
    document._sliderKeyHandler = null
  }
  if (S.screen === 'slider') {
    document._sliderKeyHandler = function(e) {
      const onRange = e.target.tagName === 'INPUT' && e.target.type === 'range'
      const onText  = e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' && e.target.type !== 'range'

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // If focus is on a range input, left/right already adjusts value — up/down should navigate
        // If focus is anywhere else, up/down navigates too
        // Either way: prevent the browser moving focus to bottom nav buttons
        e.preventDefault()
        if (e.key === 'ArrowDown') sliderNext()
        else sliderBack()
        return
      }

      if (e.key === 'Enter' && !onText) {
        e.preventDefault()
        sliderNext()
      }
    }
    document.addEventListener('keydown', document._sliderKeyHandler)
  }

  if(S.screen==='certificate')  initCertificate()
  if(S.screen==='slider_cert')  initSliderCert()
  if(S.screen==='collective')   loadCollective()
  if(S.screen==='consult')      initConsult()
  if(S.screen==='audit')        initAudit()
  if(S.screen==='bootstrap')    initBootstrap()
  if(S.screen==='profile_view') initProfileView()
  if(S.screen==='docs'&&S.currentDoc&&!S.docsCache[S.currentDoc]) openDoc(S.currentDoc)
}

document.addEventListener('DOMContentLoaded', init)
