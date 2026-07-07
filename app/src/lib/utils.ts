import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(ts: number) {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Email domain helpers (client-safe) ──────────────────────────────
// These are used by both server code (db.ts, actions.ts) and client
// components (create-org-form, settings-page), so they must not import
// any server-only modules like cloudflare:workers or drizzle.

// Public email providers where auto-join makes no sense (anyone can register).
// Used to hide the auto-join checkbox in the create-org form and to block
// setting autoJoinDomain in the createOrgAction.
export const COMMON_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.jp', 'yahoo.fr',
  'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me',
  'aol.com',
  'mail.com',
  'zoho.com',
  'yandex.com', 'yandex.ru',
  'tutanota.com', 'tuta.com',
  'fastmail.com',
  'hey.com',
  'pm.me',
  'qq.com',
  '163.com',
  '126.com',
  'gmx.com', 'gmx.net',
  'web.de',
  'mail.ru',
])

export function getEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at === -1) return null
  const domain = email.slice(at + 1).trim().toLowerCase()
  return domain || null
}
