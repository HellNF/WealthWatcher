// Controllo responsive: Chrome headless separato (profilo temporaneo), sessione via cookie,
// per ogni pagina × viewport misura overflow orizzontale ed elementi che escono dallo schermo.
//
// Uso (dev server acceso su :3000, Node 24):
//   WW_EMAIL=<email in whitelist> node scripts/responsive-check.mjs <cartella-screenshot> [pagina1,pagina2]
//   WW_THEME=light  → tema chiaro;  WW_SHOTS=all → screenshot a tutte le larghezze (default: solo 390px)
// Sola lettura: naviga e misura, non invia moduli.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'http://localhost:3000'
const OUT = process.argv[2]
const ONLY = process.argv[3] ? process.argv[3].split(',') : null
const PAGES = [
  ['dashboard', '/dashboard'], ['reports', '/dashboard/reports?month=2026-06'], ['statistiche', '/dashboard/statistiche'],
  ['scadenziario', '/dashboard/scadenziario'], ['mercati', '/dashboard/mercati'], ['tasse', '/dashboard/tasse?vista=avanzata'],
  ['mutui', '/dashboard/mutui'], ['obiettivi', '/dashboard/obiettivi'], ['budgets', '/dashboard/budgets?month=2026-06'],
  ['account', '/dashboard/accounts/1'], ['import', '/dashboard/accounts/1/import'], ['portfolio', '/dashboard/portfolios/1'],
  ['institution', '/dashboard/institutions/1'], ['settings', '/dashboard/settings'], ['profilo', '/dashboard/profilo'],
].filter(([n]) => !ONLY || ONLY.includes(n))
const VIEWPORTS = [[390, 844, 2, true], [768, 1024, 2, true], [1024, 768, 1, false], [1440, 900, 1, false]]

// login
const jar = new Map()
const take = (res) => { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
let r = await fetch(`${BASE}/api/auth/csrf`); take(r)
const { csrfToken } = await r.json()
r = await fetch(`${BASE}/api/auth/callback/credentials`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader() }, body: new URLSearchParams({ csrfToken, email: process.env.WW_EMAIL }) }); take(r)

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ww-resp-'))}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let target
for (let i = 0; i < 40; i++) { try { target = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json(); break } catch { await new Promise(r => setTimeout(r, 250)) } }
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
for (const [name, value] of jar) await send('Network.setCookie', { name, value, url: BASE })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: process.env.WW_THEME ?? 'dark' }] })

const CHECK = `(() => {
  const vw = document.documentElement.clientWidth
  const off = []
  for (const el of document.querySelectorAll('main *, header *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right > vw + 1 || r.left < -1) {
      // ignora ciò che sta dentro un contenitore che scorre in orizzontale di proposito
      let p = el.parentElement, scroller = false
      while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { scroller = true; break } p = p.parentElement }
      if (!scroller) off.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 60) + ' [' + Math.round(r.left) + '→' + Math.round(r.right) + ']')
    }
  }
  return JSON.stringify({ vw, sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, off: off.slice(0, 5), h1: document.querySelector('h1')?.textContent?.slice(0, 40) })
})()`

const report = []
for (const [w, h, dpr, mobile] of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile })
  for (const [name, path] of PAGES) {
    await send('Page.navigate', { url: BASE + path })
    await new Promise(r => setTimeout(r, 2600))
    const res = JSON.parse((await send('Runtime.evaluate', { expression: CHECK, returnByValue: true })).result.value)
    const bad = res.sw > res.vw + 1 || res.off.length > 0
    report.push(`${bad ? 'KO' : 'ok'} ${String(w).padStart(4)} ${name.padEnd(12)} sw=${res.sw} h=${res.h}${res.off.length ? ' off: ' + res.off.join(' | ') : ''}${res.h1 ? '' : ' (no h1!)'}`)
    if (w === 390 || process.env.WW_SHOTS === 'all') {
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60, captureBeyondViewport: false })
      writeFileSync(join(OUT, `${name}-${w}.jpg`), Buffer.from(shot.data, 'base64'))
    }
  }
}
console.log(report.join('\n'))
ws.close(); chrome.kill()
