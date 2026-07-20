// Unit tests for the self-host command's pure pieces: wrangler TOML
// round-trip, bundle parsing, and the token template deep link.
// The full deploy path is exercised manually/e2e against a real Cloudflare
// account (network + credentials required), not here.

import { gzipSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { parseWranglerToml, serializeWranglerToml, TOKEN_TEMPLATE_URL } from '../src/selfhost/cloudflare.js'
import { parseBundle, type SelfhostBundle } from '../src/selfhost/deploy.js'

describe('parseWranglerToml', () => {
  const sample = [
    'oauth_token = "tok_abc123"',
    'expiration_time = "2026-01-01T00:00:00.000Z"',
    'refresh_token = "rt_xyz789"',
    'scopes = [ "account:read", "workers:write", "offline_access" ]',
    '',
  ].join('\n')

  test('extracts tokens and scopes', () => {
    expect(parseWranglerToml(sample)).toMatchInlineSnapshot(`
      {
        "expiration_time": "2026-01-01T00:00:00.000Z",
        "oauth_token": "tok_abc123",
        "refresh_token": "rt_xyz789",
        "scopes": [
          "account:read",
          "workers:write",
          "offline_access",
        ],
      }
    `)
  })

  test('round-trips through serialize', () => {
    const parsed = parseWranglerToml(sample)!
    expect(parseWranglerToml(serializeWranglerToml(parsed))).toEqual(parsed)
  })

  test('handles multiline scopes arrays', () => {
    const multiline = sample.replace(
      /scopes = .*/,
      'scopes = [\n  "account:read",\n  "d1:write"\n]',
    )
    expect(parseWranglerToml(multiline)?.scopes).toEqual(['account:read', 'd1:write'])
  })

  test('returns null when tokens are missing', () => {
    expect(parseWranglerToml('api_token = "x"')).toBeNull()
  })
})

describe('parseBundle', () => {
  const bundle: SelfhostBundle = {
    formatVersion: 1,
    version: '0.13.0',
    createdAt: '2026-01-01T00:00:00.000Z',
    providerUrl: 'https://auth.sigillo.dev',
    compatibilityDate: '2026-04-16',
    compatibilityFlags: ['nodejs_compat'],
    mainModule: 'index.js',
    modules: { 'index.js': Buffer.from('export default {}').toString('base64') },
    assets: {
      '/index.html': {
        base64: Buffer.from('<html/>').toString('base64'),
        hash: 'a'.repeat(32),
        size: 7,
        contentType: 'text/html',
      },
    },
    migrations: { '0001_initial.sql': 'CREATE TABLE t(id);' },
  }

  test('round-trips a gzipped bundle', () => {
    const parsed = parseBundle(gzipSync(Buffer.from(JSON.stringify(bundle))))
    expect(parsed).toEqual(bundle)
  })

  test('rejects unknown format versions', () => {
    const bad = gzipSync(Buffer.from(JSON.stringify({ ...bundle, formatVersion: 99 })))
    expect(() => parseBundle(bad)).toThrowErrorMatchingInlineSnapshot(
      `[Error: Unsupported bundle format 99 — update the sigillo CLI]`,
    )
  })
})

describe('TOKEN_TEMPLATE_URL', () => {
  test('encodes the exact permission groups', () => {
    const url = new URL(TOKEN_TEMPLATE_URL)
    expect(url.hostname).toBe('dash.cloudflare.com')
    const keys = JSON.parse(url.searchParams.get('permissionGroupKeys')!)
    expect(keys).toMatchInlineSnapshot(`
      [
        {
          "key": "account_settings",
          "type": "read",
        },
        {
          "key": "user_details",
          "type": "read",
        },
        {
          "key": "memberships",
          "type": "read",
        },
        {
          "key": "workers_scripts",
          "type": "edit",
        },
        {
          "key": "d1",
          "type": "edit",
        },
        {
          "key": "workers_routes",
          "type": "edit",
        },
        {
          "key": "zone",
          "type": "read",
        },
      ]
    `)
  })
})
