// Client component for the OAuth consent page.
// Uses the type-safe BetterAuth client with oauthProviderClient plugin
// which automatically sends oauth_query from the current URL.

"use client"

import { useState } from "react"
import { Button } from "sigillo-app/src/components/ui/button.tsx"
import { authClient } from "../auth-client.ts"

export function ConsentButtons() {
  const [loading, setLoading] = useState(false)

  async function handleConsent(accept: boolean) {
    setLoading(true)
    // oauthProviderClient plugin automatically includes oauth_query
    // from the signed query params in the current URL
    await authClient.oauth2.consent({ accept })
  }

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
      <Button
        className="sm:w-auto"
        size="lg"
        onClick={() => handleConsent(true)}
        loading={loading}
      >
        {loading ? "正在跳转…" : "允许访问"}
      </Button>
      <Button
        className="sm:w-auto"
        variant="ghost"
        size="lg"
        onClick={() => handleConsent(false)}
        disabled={loading}
      >
        拒绝
      </Button>
    </div>
  )
}
