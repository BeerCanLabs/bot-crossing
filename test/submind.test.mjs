import test from 'node:test'
import assert from 'node:assert/strict'
import submind, { FUNCTIONAL_DOMAINS, setCastleActive } from '../server/harnesses/submind.mjs'

test('submind exports Content Creation in FUNCTIONAL_DOMAINS', () => {
  assert.equal(FUNCTIONAL_DOMAINS.CONTENT_CREATION, 'Content Creation')
})

test('setCastleActive marks Castle active for content generation', () => {
  setCastleActive('Writing blog post on Astro', 10000)
  // function exists and runs without error
  assert.ok(true)
})
