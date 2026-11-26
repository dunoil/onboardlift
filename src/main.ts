import flagsmith from '@flagsmith/flagsmith'
import './style.css'

const FLAG_NAME = 'onboarding_variant'
const VISITOR_KEY = 'onboardlift_visitor_id'
const SIGNED_UP_KEY = 'onboardlift_signed_up'
const FIRST_ACTION_KEY = 'onboardlift_first_action'
const ENV_KEY: string | undefined = (() => {
  // Read through a runtime lookup, not a direct import.meta.env member access.
  // A direct access is replaced with undefined at build time when no .env
  // file is present, and the bundler then folds away the whole Flagsmith
  // code path, including the treatment version. This wrapper keeps the
  // experiment code in the bundle even when the key is configured later.
  try {
    const env = import.meta.env as unknown as Record<string, string | undefined>
    return env['VITE_FLAGSMITH_ENVIRONMENT_KEY']
  } catch {
    return undefined
  }
})()

type Variant = 'control' | 'treatment'

interface Task {
  id: string
  title: string
  note: string
  done: boolean
}

const SAMPLE_TASKS: Task[] = [
  { id: 'sample-1', title: 'Write your launch tweet', note: 'Sample task, one line is enough to start', done: false },
  { id: 'sample-2', title: 'List your first three customers', note: 'Sample task, people you already know count', done: false },
  { id: 'sample-3', title: 'Set a ship date for v0.1', note: 'Sample task, pick a date this week', done: false },
]

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_KEY, id)
  }
  return id
}

const visitorId = getVisitorId()
let variant: Variant = 'control'
let flagsReady = false
let signedUp = localStorage.getItem(SIGNED_UP_KEY) === '1'
let firstActionFired = localStorage.getItem(FIRST_ACTION_KEY) === '1'
let tasks: Task[] = []
let userName = localStorage.getItem('onboardlift_name') || ''

const app = document.querySelector<HTMLDivElement>('#app')!

function trackFirstAction(): void {
  if (firstActionFired) return
  firstActionFired = true
  localStorage.setItem(FIRST_ACTION_KEY, '1')
  if (flagsReady) {
    flagsmith.trackEvent('first_action_clicked')
  }
}

function onSignupSubmit(event: SubmitEvent): void {
  event.preventDefault()
  const form = event.target as HTMLFormElement
  const data = new FormData(form)
  userName = String(data.get('name') || '')
  localStorage.setItem('onboardlift_name', userName)
  signedUp = true
  localStorage.setItem(SIGNED_UP_KEY, '1')
  if (flagsReady) {
    flagsmith.trackEvent('signup_completed')
  }
  tasks = variant === 'treatment' ? SAMPLE_TASKS.map((t) => ({ ...t })) : []
  render()
}

function shell(inner: string): string {
  return `
    <header class="topbar">
      <a class="logo" href="#" id="logo-link">Onboard<span>Lift</span></a>
      <nav>
        <a href="#" id="nav-features">Features</a>
        <a href="#" id="nav-pricing">Pricing</a>
      </nav>
    </header>
    <main>${inner}</main>
    <footer>
      <span>OnboardLift, a demo app for the Toggle Wars hackathon. No real account is created.</span>
      <span>Visitor <code>${visitorId.slice(0, 8)}</code> sees version <span class="variant-pill">${variant === 'treatment' ? 'B, short signup' : 'A, long signup'}</span></span>
    </footer>
  `
}

function landingHtml(): string {
  return `
    <section class="hero">
      <h1>Your first week as a founder, in one list.</h1>
      <p>OnboardLift turns the messy first days of a new product into a short list of tasks you can actually finish.</p>
      <button class="cta" id="cta-start" type="button">Start free</button>
    </section>
    <section class="features" id="features">
      <div class="feature">
        <h3>Start in under a minute</h3>
        <p>No setup wizard, no onboarding call. Sign up and see your work right away.</p>
      </div>
      <div class="feature">
        <h3>Small tasks, real momentum</h3>
        <p>Every task is sized to finish in one sitting, so the list keeps moving.</p>
      </div>
      <div class="feature">
        <h3>Built for one person</h3>
        <p>No team plan, no admin panel. Just you, your list, and your launch date.</p>
      </div>
    </section>
  `
}

function signupHtml(): string {
  const notice = !ENV_KEY
    ? `<div class="notice">Demo mode: no Flagsmith environment key is configured, so this page shows the control version. Set VITE_FLAGSMITH_ENVIRONMENT_KEY to see live variants.</div>`
    : ''
  if (variant === 'treatment') {
    return `
      ${notice}
      <div class="card">
        <h1>Create your account</h1>
        <p class="sub">Three fields, then you are in. Free forever for solo founders.</p>
        <form id="signup-form">
          <label for="name">Your name</label>
          <input id="name" name="name" type="text" required autocomplete="name" placeholder="Novia Idawati" />
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" />
          <label for="password">Password</label>
          <input id="password" name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters" />
          <button class="primary" type="submit">Create my account</button>
        </form>
        <p class="fineprint">By signing up you agree to the demo terms. Nothing is stored on a server.</p>
      </div>
    `
  }
  return `
    ${notice}
    <div class="card">
      <h1>Create your account</h1>
      <p class="sub">Tell us a little about your startup so we can set up your workspace.</p>
      <form id="signup-form">
        <label for="name">Your name</label>
        <input id="name" name="name" type="text" required autocomplete="name" placeholder="Novia Idawati" />
        <label for="email">Work email</label>
        <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@company.com" />
        <label for="company">Company</label>
        <input id="company" name="company" type="text" required autocomplete="organization" placeholder="Fable 5.2 Design Studio" />
        <label for="team-size">Team size</label>
        <select id="team-size" name="team_size" required>
          <option value="" selected>Choose one</option>
          <option value="1">Just me</option>
          <option value="2-5">2 to 5 people</option>
          <option value="6-20">6 to 20 people</option>
          <option value="21+">21 or more</option>
        </select>
        <label for="role">Your role</label>
        <select id="role" name="role" required>
          <option value="" selected>Choose one</option>
          <option value="founder">Founder</option>
          <option value="developer">Developer</option>
          <option value="designer">Designer</option>
          <option value="other">Other</option>
        </select>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters" />
        <button class="primary" type="submit">Create my account</button>
      </form>
      <p class="fineprint">By signing up you agree to the demo terms. Nothing is stored on a server.</p>
    </div>
  `
}

function dashboardHtml(): string {
  const greeting = userName ? `Welcome back, ${escapeHtml(userName)}.` : 'Welcome to OnboardLift.'
  const taskItems = tasks
    .map(
      (t) => `
      <li class="task${t.done ? ' done' : ''}">
        <input type="checkbox" data-task="${t.id}" ${t.done ? 'checked' : ''} aria-label="Mark ${escapeHtml(t.title)} done" />
        <div>
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-note">${escapeHtml(t.note)}</div>
        </div>
      </li>`,
    )
    .join('')
  const body =
    tasks.length === 0
      ? `
      <div class="empty">
        <h2>No tasks yet</h2>
        <p>Your list is empty. Create your first task to get the week moving.</p>
        <button class="cta" id="btn-first-task" type="button">Create your first task</button>
      </div>`
      : `<ul class="task-list">${taskItems}</ul>`
  return `
    <div class="dash-head">
      <div>
        <h1>Your tasks</h1>
        <p>${greeting} ${tasks.length === 0 ? 'Start with one small task.' : 'Your sample tasks are already here, tick one off to start.'}</p>
      </div>
      <button class="cta secondary" id="btn-reset" type="button">Start over</button>
    </div>
    ${body}
    <form class="add-row" id="add-task-form">
      <input id="new-task" name="new_task" type="text" required placeholder="Add a task, for example: Email three beta users" aria-label="New task" />
      <button type="submit">Add task</button>
    </form>
  `
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
}

function render(): void {
  const view = signedUp ? dashboardHtml() : window.location.hash === '#signup' ? signupHtml() : landingHtml()
  app.innerHTML = shell(view)
  bindCommon()
  const cta = document.querySelector<HTMLButtonElement>('#cta-start')
  if (cta) {
    cta.addEventListener('click', () => {
      window.location.hash = '#signup'
      render()
    })
  }
  const form = document.querySelector<HTMLFormElement>('#signup-form')
  if (form) {
    form.addEventListener('submit', onSignupSubmit)
  }
  const firstTaskBtn = document.querySelector<HTMLButtonElement>('#btn-first-task')
  if (firstTaskBtn) {
    firstTaskBtn.addEventListener('click', () => {
      const input = document.querySelector<HTMLInputElement>('#new-task')
      if (input) input.focus()
      trackFirstAction()
    })
  }
  const addForm = document.querySelector<HTMLFormElement>('#add-task-form')
  if (addForm) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault()
      const input = document.querySelector<HTMLInputElement>('#new-task')
      const title = input?.value.trim()
      if (!title) return
      tasks.push({ id: `task-${Date.now()}`, title, note: 'Added by you', done: false })
      trackFirstAction()
      render()
    })
  }
  document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-task]').forEach((box) => {
    box.addEventListener('change', () => {
      const task = tasks.find((t) => t.id === box.dataset.task)
      if (task) {
        task.done = box.checked
        if (box.checked) trackFirstAction()
        render()
      }
    })
  })
  const resetBtn = document.querySelector<HTMLButtonElement>('#btn-reset')
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      signedUp = false
      tasks = []
      localStorage.removeItem(SIGNED_UP_KEY)
      localStorage.removeItem('onboardlift_name')
      window.location.hash = ''
      render()
    })
  }
}

function bindCommon(): void {
  const logo = document.querySelector('#logo-link')
  logo?.addEventListener('click', (event) => {
    event.preventDefault()
    window.location.hash = ''
    render()
  })
  const features = document.querySelector('#nav-features')
  features?.addEventListener('click', (event) => {
    event.preventDefault()
    window.location.hash = ''
    render()
    document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' })
  })
  const pricing = document.querySelector('#nav-pricing')
  pricing?.addEventListener('click', (event) => {
    event.preventDefault()
    window.location.hash = ''
    render()
  })
}

function resolveVariant(): void {
  if (!flagsReady) {
    variant = 'control'
    return
  }
  try {
    const flag = flagsmith.getExperimentFlag(FLAG_NAME)
    const value = flag?.value ?? flagsmith.getValue(FLAG_NAME, { fallback: 'control' })
    variant = value === 'treatment' ? 'treatment' : 'control'
  } catch {
    variant = 'control'
  }
  if (signedUp && variant === 'treatment' && tasks.length === 0) {
    tasks = SAMPLE_TASKS.map((t) => ({ ...t }))
  }
}

async function initFlagsmith(): Promise<void> {
  if (!ENV_KEY) {
    flagsReady = false
    render()
    return
  }
  try {
    await flagsmith.init({
      environmentID: ENV_KEY,
      identity: visitorId,
      enableEvents: true,
      onChange: () => {
        flagsReady = true
        resolveVariant()
        render()
      },
      onError: (error: Error) => {
        console.error('Flagsmith error', error)
        flagsReady = false
        render()
      },
    })
    flagsReady = true
    resolveVariant()
  } catch (error) {
    console.error('Flagsmith init failed', error)
    flagsReady = false
  }
  render()
}

window.addEventListener('pagehide', () => {
  if (flagsReady) {
    try {
      flagsmith.flushEvents()
    } catch {
      // Flush is best effort on page exit.
    }
  }
})

window.addEventListener('hashchange', render)

render()
void initFlagsmith()
