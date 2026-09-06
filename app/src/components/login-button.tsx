// Client component for the login page sign-in button.
// Uses the type-safe BetterAuth client to trigger the genericOAuth flow.

"use client"

import { useState } from "react"
import { Button } from "sigillo-app/src/components/ui/button"
import { authClient } from "../auth-client.ts"

export function LoginButton({ callbackURL = "/dash" }: { callbackURL?: string }) {
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    setLoading(true)
    await authClient.signIn.social({
      provider: "sigillo",
      callbackURL,
    })
  }

  return (
    <Button
      onClick={handleSignIn}
      loading={loading}
      size="lg"
    >
      {loading ? "正在跳转…" : "使用 LingxiLoop 账号登录"}
    </Button>
  )
}
