import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const source = (relativePath) => readFile(path.resolve(import.meta.dirname, relativePath), 'utf8')

test('A: forgot-password action never claims an email was sent', async () => {
  const login = await source('../pages/LoginPage.jsx')
  assert.equal(login.includes('Password reset link has been sent'), false)
  assert.equal(login.includes("alert("), false)
})

test('B: forgot-password action truthfully identifies the practice-version limitation', async () => {
  const login = await source('../pages/LoginPage.jsx')
  assert.match(login, /Password reset is not available in this practice version yet\./)
  assert.match(login, /role="status"/)
})

test('C: navbar contains no fake search control', async () => {
  const navbar = await source('Navbar.jsx')
  assert.equal(navbar.includes('navbar-search'), false)
  assert.equal(navbar.includes('Search lectures, topics, or notes'), false)
})

test('D: notification bell is removed', async () => {
  const navbar = await source('Navbar.jsx')
  assert.equal(navbar.includes('Notifications'), false)
  assert.doesNotMatch(navbar, /\bBell\b/)
})

test('E: unread notification dot is removed from markup and CSS', async () => {
  const [navbar, styles] = await Promise.all([source('Navbar.jsx'), source('../App.css')])
  assert.equal(navbar.includes('navbar-notification-dot'), false)
  assert.equal(styles.includes('.navbar-notification-dot'), false)
})

test('F: profile menu uses a real keyboard-operable button and keeps its module action', async () => {
  const navbar = await source('Navbar.jsx')
  assert.match(navbar, /<button\s+type="button"\s+className="navbar-user"/)
  assert.match(navbar, /aria-expanded=\{dropdownOpen\}/)
  assert.match(navbar, /navigate\('\/modules'\)/)
})

test('G: logout still clears the session and returns to login', async () => {
  const navbar = await source('Navbar.jsx')
  assert.match(navbar, /logout\(\)/)
  assert.match(navbar, /navigate\('\/login'\)/)
  assert.match(navbar, /onClick=\{handleLogout\}/)
})

test('H: all protected study navigation routes remain registered', async () => {
  const app = await source('../App.jsx')
  for (const route of ['/dashboard', '/modules', '/lectures', '/chat', '/quiz', '/summaries', '/flashcards']) {
    assert.match(app, new RegExp(`path="${route}"`))
  }
  assert.match(app, /<ProtectedRoute>/)
})

test('I: removed controls leave no mock search or notification behavior', async () => {
  const [navbar, styles] = await Promise.all([source('Navbar.jsx'), source('../App.css')])
  for (const removed of ['navbar-search', 'navbar-search-input', 'navbar-search-icon', 'navbar-btn', 'navbar-notification-dot']) {
    assert.equal(navbar.includes(removed), false)
    assert.equal(styles.includes(`.${removed}`), false)
  }
})
