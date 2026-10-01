import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const landingSource = await readFile(new URL('./LandingPage.jsx', import.meta.url), 'utf8')
const landingStyles = await readFile(new URL('./LandingPage.css', import.meta.url), 'utf8')
const appSource = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')
const loginSource = await readFile(new URL('./LoginPage.jsx', import.meta.url), 'utf8')
const registerSource = await readFile(new URL('./RegisterPage.jsx', import.meta.url), 'utf8')
const protectedSource = await readFile(new URL('../components/ProtectedRoute.jsx', import.meta.url), 'utf8')

test('public root route renders LandingPage while authenticated routes remain protected', () => {
  assert.match(appSource, /path="\/" element={<LandingPage \/>}/)
  assert.match(appSource, /<ProtectedRoute>/)
  assert.match(protectedSource, /<Navigate to="\/login"/)
})

test('landing hero exposes brand and registration and login calls to action', () => {
  assert.match(landingSource, /AI StudyMate/)
  assert.match(landingSource, /to="\/register"/)
  assert.match(landingSource, /to="\/login"/)
  assert.match(landingSource, /Get Started/)
})

test('landing contains anchor navigation and the requested feature stories', () => {
  for (const anchor of ['#features', '#how-it-works', '#study-tools']) assert.match(landingSource, new RegExp(anchor))
  for (const content of ['From lecture file', 'Your material stays at the center', 'What is overfitting', 'Grounded', 'Focused', 'Active']) assert.match(landingSource, new RegExp(content))
})

test('landing uses local presentation only with no authenticated API calls or fake user statistics', () => {
  assert.doesNotMatch(landingSource, /api\.|fetch\(|axios|useEffect\([^)]*dashboard/)
  assert.doesNotMatch(landingSource, /Welcome back,|recent_lectures|document_chunks|total_flashcard_reviews/)
})

test('landing includes observer reveals and reduced motion support', () => {
  assert.match(landingSource, /IntersectionObserver/)
  assert.match(landingStyles, /prefers-reduced-motion: reduce/)
  assert.match(landingStyles, /\[data-reveal\]\.is-visible/)
})

test('authentication behavior remains wired and forgot password stays truthful', () => {
  assert.match(loginSource, /await login\(email, password\)/)
  assert.match(loginSource, /Password reset is not available in this practice version yet\./)
  assert.match(registerSource, /await register\(name, email, password\)/)
  assert.match(registerSource, /navigate\('\/dashboard'\)/)
})
