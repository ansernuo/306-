import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { handleVisits } from '../worker/visits.js'

function database() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../drizzle/0000_visitor_stats.sql', import.meta.url), 'utf8'))
  return {
    prepare(sql) { return { sql, args: [], bind(...args) { this.args = args; return this } } },
    async batch(queries) {
      sqlite.exec('BEGIN')
      try {
        const results = queries.map(({ sql, args }) => /^SELECT/.test(sql) ? { results: sqlite.prepare(sql).all(...args) } : { results: [], meta: sqlite.prepare(sql).run(...args) })
        sqlite.exec('COMMIT')
        return results
      } catch (error) { sqlite.exec('ROLLBACK'); throw error }
    },
  }
}
const first = 'aabbccdd-1234-4321-8123-aabbccddeeff'
const second = 'bbccddee-1234-4321-8123-aabbccddeeff'
const request = (visitorId, origin) => new Request('https://example.test/api/visits', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ visitorId }) })

test('statistics aggregate different browsers and deduplicate refreshes using real SQLite constraints', async () => {
  const db = database(), now = new Date('2026-10-28T08:00:00Z')
  assert.deepEqual(await (await handleVisits(request(first), db, now)).json(), { todayVisitors: 1, totalVisitors: 1 })
  assert.deepEqual(await (await handleVisits(request(first), db, now)).json(), { todayVisitors: 1, totalVisitors: 1 })
  assert.deepEqual(await (await handleVisits(request(second), db, now)).json(), { todayVisitors: 2, totalVisitors: 2 })
  assert.deepEqual(await (await handleVisits(new Request('https://example.test/api/visits'), db, now)).json(), { todayVisitors: 2, totalVisitors: 2 })
})

test('the daily count changes at Shanghai midnight without increasing cumulative visitors', async () => {
  const db = database()
  await handleVisits(request(first), db, new Date('2026-10-28T15:59:00Z'))
  await handleVisits(request(second), db, new Date('2026-10-28T15:59:00Z'))
  assert.deepEqual(await (await handleVisits(request(first), db, new Date('2026-10-28T16:00:00Z'))).json(), { todayVisitors: 1, totalVisitors: 2 })
})

test('invalid requests cannot create visitors, and storage failure does not return invented counts', async () => {
  const db = database()
  assert.equal((await handleVisits(request('bad'), db)).status, 400)
  assert.equal((await handleVisits(request(first, 'https://other.example'), db)).status, 403)
  assert.equal((await handleVisits(request(first), null)).status, 503)
  const allowed = await handleVisits(request(first, 'https://rray1228.github.io'), db)
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://rray1228.github.io')
  assert.deepEqual(await allowed.json(), { todayVisitors: 1, totalVisitors: 1 })
})
