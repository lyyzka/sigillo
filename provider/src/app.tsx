// Spiceflow entry for the middleman OAuth provider.
// BetterAuth runs in the worker (not the DO) — the DO is a thin SQL proxy.
// Serves BetterAuth API, redirects login straight to Google, well-known
// endpoints, and health check.
// Also serves as the Cloudflare Worker entry via the default export.

import './globals.css'

import { Spiceflow } from 'spiceflow'
import { Head } from 'spiceflow/react'
import { getAuth } from './db.ts'
import { ConsentButtons } from './components/consent-buttons.tsx'
import { SigilloLogo } from 'sigillo-app/src/components/logo.tsx'


// Renders OAuth/OIDC errors that BetterAuth redirects to the root in production.
// BetterAuth's built-in /api/auth/error endpoint redirects to /?error=...&error_description=...
// in production mode (no customizeDefaultErrorPage set), so the root route and /error
// route both need to handle these query params and show a human-readable error page.
function ErrorScreen({ error, errorDescription }: { error: string; errorDescription: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      <section className="w-full max-w-sm">
        <div className="flex flex-col gap-1.5">
          <SigilloLogo className="h-[36px] w-auto" />
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
            Something went wrong
          </h1>
        </div>

        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error.replace(/_/g, ' ')}
          </p>
          {errorDescription && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errorDescription}
            </p>
          )}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Try signing in again. If this keeps happening, contact the administrator
          of the app that redirected you here.
        </p>

        <div className="mt-6 flex gap-3">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Go back
          </a>
        </div>
      </section>
    </main>
  )
}

function ConsentScreen({
  redirectDomain,
  switchAccountUrl,
}: {
  redirectDomain: string | null
  switchAccountUrl: string
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      <section className="w-full max-w-sm">
        <div className="flex flex-col gap-1.5">
          <SigilloLogo className="h-[36px] w-auto" />
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
            Sign in to continue
          </h1>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {redirectDomain ? (
            <>
              <span className="font-medium text-foreground">{redirectDomain}</span> wants to use your Sigillo account.
            </>
          ) : (
            'An app wants to use your Sigillo account.'
          )}
        </p>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Only continue if you trust this domain.
        </p>

        <div className="mt-6">
          <ConsentButtons />
        </div>

        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          Wrong account?{' '}
          <a
            href={switchAccountUrl}
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Sign in with a different Google account
          </a>
        </p>
      </section>
    </main>
  )
}

function getRedirectDomain(redirectUri: string | null) {
  if (!redirectUri) return null
  try {
    return new URL(redirectUri).hostname
  } catch {
    return null
  }
}

// Starts the Google sign-in redirect. Uses returnHeaders so we get both the
// redirect URL and the Set-Cookie headers (state cookie for CSRF). A bare
// Response.redirect() drops those cookies → state_mismatch on the callback.
async function startGoogleSignIn(request: Request, callbackUrl: URL) {
  const auth = getAuth()
  const { headers: responseHeaders, response } = await auth.api.signInSocial({
    body: { provider: 'google', callbackURL: callbackUrl.href },
    headers: request.headers,
    returnHeaders: true,
  })
  if (!response?.url) {
    return new Response('Failed to initiate Google sign-in', { status: 500 })
  }
  const redirect = new Response(null, { status: 302, headers: { Location: response.url } })
  // Forward all Set-Cookie headers from BetterAuth (state cookie for CSRF).
  // getSetCookie() returns each cookie separately — append preserves multiples.
  for (const cookie of responseHeaders.getSetCookie()) {
    redirect.headers.append('Set-Cookie', cookie)
  }
  return redirect
}

export const app = new Spiceflow()

  // ── BetterAuth middleware ──────────────────────────────────────
  // BetterAuth runs in the worker, not the DO. Only SQL crosses the
  // DO boundary via sqlite-proxy.
  .use(async ({ request }, next) => {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/auth')) {
      const auth = getAuth()
      const res = await auth.handler(request)
      if (res.ok || res.status !== 404) return res
    }
    return next()
  })

  // ── Root layout ───────────────────────────────────────────────
  .layout('/*', async ({ children }) => {
    return (
      <html lang="en">
        <Head>
          <Head.Meta charSet="UTF-8" />
          <Head.Meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <Head.Title>Sigillo Auth</Head.Title>
          <Head.Link rel="icon" type="image/png" href="/favicon.png" />
        </Head>
        <body className="min-h-screen bg-background font-sans text-foreground antialiased">
          {children}
        </body>
      </html>
    )
  })

  // ── Login redirect ─────────────────────────────────────────────
  // BetterAuth oauthProvider redirects here when user is not logged in.
  // Instead of showing a button, redirect straight to Google via the
  // type-safe BetterAuth API — now runs directly in the worker.
  //
  // Important: after Google redirects back here, this route must detect the
  // freshly created provider session and resume the original OAuth authorize
  // request. Otherwise it would immediately start another Google sign-in and
  // loop forever between /sign-in and accounts.google.com.
  //
  // ?switch=1 forces a new Google sign-in even with an active provider
  // session (used by the "different account" link on the consent screen).
  // Google shows the account picker because prompt=select_account is set on
  // the social provider. The param is stripped from the callback URL so the
  // post-Google redirect takes the normal session shortcut instead of
  // looping back to Google.
  .get('/sign-in', async ({ request }) => {
    const currentUrl = new URL(request.url)
    const switchAccount = currentUrl.searchParams.get('switch') === '1'
    currentUrl.searchParams.delete('switch')
    const auth = getAuth()
    const session = await auth.api.getSession({ headers: request.headers })
    if (session && !switchAccount) {
      const authorizeUrl = new URL('/api/auth/oauth2/authorize', currentUrl.origin)
      authorizeUrl.search = currentUrl.search
      return Response.redirect(authorizeUrl.toString(), 302)
    }

    return startGoogleSignIn(request, currentUrl)
  })

  // ── Account selection (prompt=select_account) ──────────────────
  // oauthProvider redirects here when a client sends prompt=select_account,
  // because selectAccount.page points at this route. Two steps:
  //
  //   1. no ?selected  → restart Google sign-in so the account picker shows.
  //      The Google callback comes back here with ?selected=1.
  //   2. ?selected=1   → call /oauth2/continue with selected: true. That
  //      strips prompt=select_account from the stored authorize query and
  //      resumes the flow. Redirecting straight back to /oauth2/authorize
  //      instead would hit prompt=select_account again and loop forever.
  //
  // The signed authorize params ride along in the query string and are
  // handed back to BetterAuth as oauth_query; only `selected` is stripped,
  // so the signature still verifies.
  .get('/select-account', async ({ request }) => {
    const url = new URL(request.url)
    const oauthQuery = new URLSearchParams(url.search)
    const selected = oauthQuery.get('selected') === '1'
    oauthQuery.delete('selected')

    if (selected) {
      const auth = getAuth()
      const result = await auth.api.oauth2Continue({
        body: { selected: true, oauth_query: oauthQuery.toString() },
        headers: request.headers,
      })
      return Response.redirect(result.url, 302)
    }

    const callbackUrl = new URL('/select-account', url.origin)
    callbackUrl.search = oauthQuery.toString()
    callbackUrl.searchParams.set('selected', '1')
    return startGoogleSignIn(request, callbackUrl)
  })

  .page('/consent', async ({ request }) => {
    const url = new URL(request.url)
    const redirectDomain = getRedirectDomain(url.searchParams.get('redirect_uri'))

    if (redirectDomain === 'sigillo.dev') {
      const auth = getAuth()
      const result = await auth.api.oauth2Consent({
        body: {
          accept: true,
          oauth_query: url.search.slice(1),
        },
        headers: request.headers,
      })

      return Response.redirect(result.url, 302)
    }

    // The consent URL carries the original authorize params, so /sign-in can
    // restart the flow with them and resume authorize after Google returns.
    const switchParams = new URLSearchParams(url.search)
    switchParams.set('switch', '1')
    return (
      <ConsentScreen
        redirectDomain={redirectDomain}
        switchAccountUrl={`/sign-in?${switchParams}`}
      />
    )
  })

  // Preview route to see consent UI without initiating an auth flow
  .page('/consent-preview', async () => {
    return <ConsentScreen redirectDomain="my-app.example.com" switchAccountUrl="/sign-in?switch=1" />
  })

  // ── Well-known endpoints ─────────────────────────────────────
  // BetterAuth oauthProvider requires these to be exposed as separate
  // routes — they are NOT served by auth.handler() automatically.
  // Issuer path is /api/auth, so:
  //   OIDC:    [issuer-path]/.well-known/openid-configuration
  //   OAuth AS: /.well-known/oauth-authorization-server[issuer-path]
  .get('/api/auth/.well-known/openid-configuration', async () => {
    const auth = getAuth()
    return Response.json(await auth.api.getOpenIdConfig({ headers: new Headers() }))
  })
  .get('/.well-known/oauth-authorization-server/api/auth', async () => {
    const auth = getAuth()
    return Response.json(await auth.api.getOAuthServerConfig({ headers: new Headers() }))
  })
  // Also serve at root for clients that ignore the issuer path
  .get('/.well-known/openid-configuration', async () => {
    const auth = getAuth()
    return Response.json(await auth.api.getOpenIdConfig({ headers: new Headers() }))
  })

  // ── Error page ─────────────────────────────────────────────────
  // BetterAuth's built-in /api/auth/error endpoint redirects to
  // /?error=...&error_description=... in production (no customizeDefaultErrorPage).
  // Catch those redirects and render a proper error page.
  .page('/error', async ({ request }) => {
    const url = new URL(request.url)
    const error = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')
    if (!error) return Response.redirect(new URL('/', url.origin).toString(), 302)
    return <ErrorScreen error={error} errorDescription={errorDescription} />
  })

  // ── Health check ──────────────────────────────────────────────
  .get('/health', () => {
    return { ok: true, service: 'sigillo-provider' }
  })
  .get('/', ({ request }) => {
    const url = new URL(request.url)
    const error = url.searchParams.get('error')
    if (error) {
      // BetterAuth's /api/auth/error redirects here in production.
      // Forward to the /error page so the user sees a proper error message.
      const errorUrl = new URL('/error', url.origin)
      errorUrl.search = url.search
      return Response.redirect(errorUrl.toString(), 302)
    }
    return { ok: true, service: 'sigillo-provider' }
  })

export type App = typeof app

export default {
  fetch: (request: Request) => app.handle(request),
} satisfies ExportedHandler<Env>
