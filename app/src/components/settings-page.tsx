// Settings page for org-level configuration.
// Contains auto-join domain toggle and "Danger Zone" org deletion.
// The confirm dialog shows the list of projects that will be deleted
// so the user knows exactly what they are losing.

'use client'

import { useState, useTransition } from 'react'
import { AlertTriangleIcon, UsersIcon } from 'lucide-react'
import { useLoaderData } from 'spiceflow/react'
import { Button } from 'sigillo-app/src/components/ui/button'
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'sigillo-app/src/components/ui/dialog'
import { deleteOrgAction, updateAutoJoinDomainAction } from '../actions.ts'
import { COMMON_EMAIL_DOMAINS, getEmailDomain } from '../lib/utils.ts'

function AutoJoinSection() {
  const { orgId, autoJoinDomain } = useLoaderData('/dash/projects/:projectId/settings')
  const { user } = useLoaderData('/dash/*')
  const [isPending, startTransition] = useTransition()
  const [currentDomain, setCurrentDomain] = useState(autoJoinDomain)

  const userDomain = getEmailDomain(user.email)
  const isPublicDomain = !userDomain || COMMON_EMAIL_DOMAINS.has(userDomain)

  // Hide the section entirely for users with public email domains
  // who also don't have auto-join already enabled (legacy data)
  if (isPublicDomain && !currentDomain) return null

  const isEnabled = !!currentDomain

  function handleToggle() {
    const newEnabled = !isEnabled
    startTransition(async () => {
      const result = await updateAutoJoinDomainAction({ orgId, enabled: newEnabled })
      setCurrentDomain(result.autoJoinDomain)
    })
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <UsersIcon className="size-5" />
          按邮箱域名自动加入
        </h2>
        <p className="text-muted-foreground text-sm mt-2">
          {isEnabled ? (
            <>已验证 <span className="font-mono text-foreground">@{currentDomain}</span> 邮箱的用户会自动加入此组织。</>
          ) : (
            '根据用户的邮箱域名自动将其加入此组织。'
          )}
        </p>
      </div>
      <div className="border-t border-border px-5 py-4 bg-muted/30 rounded-b-lg flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            {isEnabled ? '已启用自动加入' : '已停用自动加入'}
          </p>
          {!isEnabled && userDomain && !isPublicDomain && (
            <p className="text-xs text-muted-foreground">
              将使用你的邮箱域名：<span className="font-mono">@{userDomain}</span>
            </p>
          )}
          {isPublicDomain && isEnabled && (
            <p className="text-xs text-muted-foreground">
              你可以停用自动加入，但不能使用公共邮箱域名重新启用它。
            </p>
          )}
        </div>
        <Button
          variant={isEnabled ? 'outline' : 'default'}
          onClick={handleToggle}
          disabled={isPending || (!isEnabled && isPublicDomain)}
        >
          {isPending ? '正在保存…' : isEnabled ? '停用' : '启用'}
        </Button>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { orgId, orgName, projectNames } = useLoaderData('/dash/projects/:projectId/settings')
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteOrgAction({ orgId })
    })
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground text-sm mt-1">
          管理组织设置。
        </p>
      </div>

      <AutoJoinSection />

      <div className="rounded-lg border border-destructive/40">
        <div className="p-5">
          <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
            <AlertTriangleIcon className="size-5" />
            危险区域
          </h2>
          <p className="text-muted-foreground text-sm mt-2">
            删除此组织将永久生效。所有项目、环境、密钥、令牌及成员访问权限都会立即移除。
          </p>
        </div>
        <div className="border-t border-destructive/40 px-5 py-4 bg-destructive/5 rounded-b-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">删除组织</p>
            <p className="text-xs text-muted-foreground">
              此操作无法撤销。
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button
              variant="destructive"
              onClick={() => setOpen(true)}
            >
              删除组织
            </Button>
            <DialogPopup>
              <DialogHeader>
                <DialogTitle>删除 {orgName}？</DialogTitle>
                <DialogDescription>
                  这会永久删除该组织及其中的所有内容。
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 pb-4">
                {projectNames.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      将删除以下 {projectNames.length} 个项目：
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {projectNames.map((name) => (
                        <li key={name} className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-destructive shrink-0" />
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    此组织没有项目。
                  </p>
                )}
              </div>
              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline" />}
                >
                  取消
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {isPending ? '正在删除…' : '删除组织'}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
