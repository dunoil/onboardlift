/**
 * OnboardLift traffic simulator.
 *
 * Generates simulated visitor sessions through real Flagsmith SDK evaluation,
 * so the experiment dashboard fills with real exposures and events.
 * Each session gets its own stable identifier, exactly like a real visitor.
 * The variant is never hardcoded: it comes from getExperimentFlag.
 *
 * Behaviour model (documented, not real user data):
 *   control signup rate:    0.32 (long 6 field form, empty dashboard)
 *   treatment signup rate:  0.55 (short 3 field form, sample tasks visible)
 *   first action, given signup, control:   0.35 (nothing to act on yet)
 *   first action, given signup, treatment: 0.60 (sample tasks invite a click)
 *
 * Usage:
 *   FLAGSMITH_ENVIRONMENT_KEY=<key> node simulate.mjs --sessions 200 --batch 1
 *   or put the key in a .env file next to this script.
 * The key is the client side environment key only. Never use a server side key.
 */

import { Flagsmith } from '@flagsmith/nodejs'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FLAG_NAME = 'onboarding_variant'
const CONTROL_SIGNUP_RATE = 0.32
const TREATMENT_SIGNUP_RATE = 0.55
const CONTROL_FIRST_ACTION_RATE = 0.35
const TREATMENT_FIRST_ACTION_RATE = 0.6
const CONCURRENCY = 25

function loadEnvFile() {
  const dir = dirname(fileURLToPath(import.meta.url))
  const path = join(dir, '.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]
    }
  }
}

function parseArgs() {
  const args = { sessions: 200, batch: '1' }
  const raw = process.argv.slice(2)
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '--sessions' && raw[i + 1]) args.sessions = Number(raw[i + 1])
    if (raw[i] === '--batch' && raw[i + 1]) args.batch = raw[i + 1]
  }
  return args
}

loadEnvFile()
const { sessions, batch } = parseArgs()
const environmentKey = process.env.FLAGSMITH_ENVIRONMENT_KEY || process.env.VITE_FLAGSMITH_ENVIRONMENT_KEY

if (!environmentKey) {
  console.error('Missing environment key. Set FLAGSMITH_ENVIRONMENT_KEY or add it to .env (see .env.example).')
  process.exit(1)
}
if (!Number.isFinite(sessions) || sessions <= 0) {
  console.error('Pass a positive number of sessions, for example: node simulate.mjs --sessions 200 --batch 1')
  process.exit(1)
}

const flagsmith = new Flagsmith({ environmentKey, enableEvents: true })

const counts = {
  control: { exposed: 0, signup: 0, firstAction: 0 },
  treatment: { exposed: 0, signup: 0, firstAction: 0 },
  unknown: 0,
}

async function runSession(index) {
  const identifier = `sim-b${batch}-${index}-${randomUUID()}`
  let flag
  try {
    flag = await flagsmith.getExperimentFlag(FLAG_NAME, identifier)
  } catch (error) {
    console.error(`Session ${index}: getExperimentFlag failed`, error.message)
    return
  }
  const variant = flag?.variant === 'treatment' ? 'treatment' : flag?.variant === 'control' ? 'control' : null
  if (!variant) {
    counts.unknown += 1
    return
  }
  counts[variant].exposed += 1
  const signupRate = variant === 'treatment' ? TREATMENT_SIGNUP_RATE : CONTROL_SIGNUP_RATE
  if (Math.random() >= signupRate) return
  counts[variant].signup += 1
  flagsmith.trackEvent('signup_completed', { identifier })
  const firstActionRate = variant === 'treatment' ? TREATMENT_FIRST_ACTION_RATE : CONTROL_FIRST_ACTION_RATE
  if (Math.random() < firstActionRate) {
    counts[variant].firstAction += 1
    flagsmith.trackEvent('first_action_clicked', { identifier })
  }
}

async function main() {
  console.log(`OnboardLift simulator, batch ${batch}, ${sessions} sessions, flag ${FLAG_NAME}`)
  const startedAt = Date.now()
  for (let start = 0; start < sessions; start += CONCURRENCY) {
    const chunk = []
    for (let i = start; i < Math.min(start + CONCURRENCY, sessions); i += 1) {
      chunk.push(runSession(i))
    }
    await Promise.all(chunk)
  }
  await flagsmith.flushEvents()
  await flagsmith.close()
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  const rate = (n, d) => (d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`)
  console.log(`Done in ${seconds}s.`)
  console.log('Variant    Exposed  Signups  Signup rate  First actions  First action rate')
  for (const variant of ['control', 'treatment']) {
    const c = counts[variant]
    console.log(
      `${variant.padEnd(11)}${String(c.exposed).padEnd(9)}${String(c.signup).padEnd(9)}${rate(c.signup, c.exposed).padEnd(13)}${String(c.firstAction).padEnd(15)}${rate(c.firstAction, c.signup)}`,
    )
  }
  if (counts.unknown > 0) {
    console.log(`Sessions with no variant assigned: ${counts.unknown}`)
  }
}

main().catch((error) => {
  console.error('Simulator failed', error)
  process.exit(1)
})
