// Client component for the device authorization flow (RFC 8628).
// User enters code → validate via authClient.device() → auto-approve.
// User must be authenticated before they can approve.

"use client"

import { useState } from "react"
import { Button } from "sigillo-app/src/components/ui/button"
import { Input } from "sigillo-app/src/components/ui/input"
import { authClient } from "../auth-client.ts"

export function DeviceFlow({ initialCode = '' }: { initialCode?: string }) {
  const [userCode, setUserCode] = useState(initialCode)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Strip dashes and uppercase for consistent formatting
      const formatted = userCode.trim().replace(/-/g, '').toUpperCase()
      const { data, error: err } = await authClient.device({
        query: { user_code: formatted },
      })
      if (err || !data) {
        setError('验证码无效或已过期，请重试。')
        setLoading(false)
        return
      }
      // Auto-approve after successful validation
      await authClient.device.approve({ userCode: formatted })
      setDone(true)
    } catch {
      setError('验证码无效或已过期，请重试。')
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold mb-2">设备已授权</h1>
          <p className="text-muted-foreground">
            你可以关闭此页面。你的 CLI 或智能体现已完成认证。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold mb-2">设备登录</h1>
        <p className="text-muted-foreground mb-6">输入 CLI 或智能体显示的验证码：</p>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <Input
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            placeholder="ABCD-EFGH"
            maxLength={12}
            className="h-12 text-center text-2xl mono-sm tracking-[0.25em] uppercase"
          />
          <Button
            type="submit"
            disabled={loading || !userCode.trim()}
            size="lg"
            loading={loading}
          >
            {loading ? '正在授权…' : '验证验证码'}
          </Button>
        </form>
      </div>
    </div>
  )
}
