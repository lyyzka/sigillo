// Secrets table with editable keys/values like Doppler.
// Values hidden by default (password inputs). Eye icon to reveal.
// Editing a key or value, filling a missing key, or drafting a new secret
// marks the table dirty. A single "Save N secrets" flow handles all of it.
// Import from .env via a dialog with a textarea, and export current secrets
// back to .env via download or copy.

"use client";

import { EyeIcon, EyeOffIcon, TrashIcon, UploadIcon, PlusIcon, KeyIcon, CheckIcon, DownloadIcon, CopyIcon, ArrowDownToLineIcon } from "lucide-react";
import { EmptyState } from "sigillo-app/src/components/ui/empty-state";
import { useState, useCallback } from "react";
import { z } from "zod";
import { parseFormData } from "spiceflow";
import { cn } from "sigillo-app/src/lib/utils";
import { Button } from "sigillo-app/src/components/ui/button";
import { Frame } from "sigillo-app/src/components/ui/frame";
import { Input, Textarea } from "sigillo-app/src/components/ui/input";
import { NativeSelect } from "sigillo-app/src/components/ui/native-select";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "sigillo-app/src/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "sigillo-app/src/components/ui/table";
import { parseEnv } from "sigillo-app/src/lib/parse-env";
import { TimeAgo } from "sigillo-app/src/components/ui/time-ago";
import {
  deleteSecretAction,
  saveSecretsAction,
  syncMissingSecretsAction,
} from "../actions.ts";
import { useLoaderData } from "spiceflow/react";


// Secret values use the .text-security-disc CSS class from globals.css
// instead of inline style objects (eliminates duplication with event-log-table).

function SecretValueCell({
  value,
  editedValue,
  onValueChange,
  visible,
  onToggle,
  isDirty,
}: {
  value: string;
  editedValue: string | undefined;
  onValueChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  isDirty?: boolean;
}) {
  const displayValue = editedValue ?? value;

  return (
    <div className="flex w-full min-w-0 items-center gap-1.5">
      <Input
        type="text"
        inputSize="sm"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        value={visible ? displayValue : "••••••••••••"}
        onChange={(e) => {
          if (visible) {
            onValueChange(e.target.value);
          }
        }}
        readOnly={!visible}
        onFocus={(e) => {
          if (!visible) {
            e.target.blur()
            onToggle()
          }
        }}
        className={cn(
          "min-w-0 max-w-full flex-1 mono-sm",
          visible ? "bg-muted/50" : "text-security-disc border-transparent bg-muted/50 cursor-pointer select-none",
          isDirty && "border-amber-400/50 focus:ring-amber-500",
        )}
      />
      <button
        onClick={onToggle}
        className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
        title={visible ? "隐藏值" : "显示值"}
      >
        {visible ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
    </div>
  );
}

type Environment = { id: string; name: string; slug: string };

export function SecretsTable({
  allVisible,
}: {
  allVisible: boolean;
}) {
  const { secrets, selectedEnvId: environmentId, environments, allSecretNames } = useLoaderData('/dash/projects/:projectId/envs/:envSlug');
  const [newSecrets, setNewSecrets] = useState<Array<{ id: string; name: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string } | null>(null);

  // Per-row visibility overrides (only used when allVisible is false)
  const [rowVisible, setRowVisible] = useState<Record<string, boolean>>({});

  // Track edits per secret id
  const [edits, setEdits] = useState<Record<string, { name?: string; value?: string }>>({});
  // Track values typed into missing-key rows (keyed by secret name)
  const [missingEdits, setMissingEdits] = useState<Record<string, string>>({});

  if (!environmentId) return null;

  const setEdit = useCallback((id: string, field: "name" | "value", val: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: val },
    }));
  }, []);

  // Keys that exist in other envs but not in this one
  // Use edited names so renaming a secret to a missing key hides the red row
  const effectiveNames = new Set(
    [
      ...secrets.map((s) => edits[s.id]?.name ?? s.name),
      ...newSecrets.map((secret) => secret.name),
    ].filter(Boolean)
  );
  const missingKeys = allSecretNames.filter((name) => !effectiveNames.has(name));

  const dirtySecrets = secrets.filter((s) => {
    const e = edits[s.id];
    if (!e) return false;
    if (e.name !== undefined && e.name !== s.name) return true;
    if (e.value !== undefined) return true;
    return false;
  });

  // Missing keys that have a value typed in
  const dirtyMissingKeys = missingKeys.filter((name) => missingEdits[name]?.trim());

  const dirtyNewSecrets = newSecrets.filter((secret) => secret.name.trim() && secret.value.trim());

  const pendingEdits = [
    ...dirtySecrets.map((secret) => {
      const edit = edits[secret.id]!;
      return {
        originalName: secret.name,
        name: edit.name !== undefined ? edit.name : secret.name,
        value: edit.value !== undefined ? edit.value : secret.value,
      };
    }),
    ...dirtyMissingKeys.map((name) => ({
      name,
      value: missingEdits[name]!,
    })),
    ...dirtyNewSecrets.map((secret) => ({
      name: secret.name,
      value: secret.value,
    })),
  ];

  const totalDirtyCount = pendingEdits.length;

  const currentEnvEntries: Array<[string, string]> = [
    ...secrets.map((secret): [string, string] => [
      edits[secret.id]?.name ?? secret.name,
      edits[secret.id]?.value ?? secret.value,
    ]),
    ...dirtyMissingKeys.map((name): [string, string] => [name, missingEdits[name]!]),
    ...dirtyNewSecrets.map((secret): [string, string] => [secret.name, secret.value]),
  ];
  const envFileText = currentEnvEntries
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
    .join("\n") + "\n";

  const handleImportText = useCallback(async (text: string) => {
    const parsed = parseEnv(text);
    const edits = Object.entries(parsed).map(([name, value]) => ({ name, value }));
    if (edits.length === 0) return;
    setImporting(true);
    try {
      await saveSecretsAction({ edits, environmentIds: [environmentId] });
      setImportOpen(false);
    } catch (e: any) {
      alert(e?.message || "导入密钥失败");
    } finally {
      setImporting(false);
    }
  }, [environmentId]);

  const addNewSecret = useCallback(() => {
    setNewSecrets((prev) => [...prev, { id: crypto.randomUUID(), name: "", value: "" }]);
  }, []);

  const updateNewSecret = useCallback((id: string, field: "name" | "value", value: string) => {
    setNewSecrets((prev) => prev.map((secret) => (
      secret.id === id ? { ...secret, [field]: value } : secret
    )));
  }, []);

  const removeNewSecret = useCallback((id: string) => {
    setNewSecrets((prev) => prev.filter((secret) => secret.id !== id));
  }, []);

  const handleDownloadEnv = useCallback(() => {
    const blob = new Blob([envFileText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `.env.${environments.find((env) => env.id === environmentId)?.slug ?? "env"}`;
    link.click();
    URL.revokeObjectURL(url);
  }, [envFileText, environmentId, environments]);

  const handleCopyEnv = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(envFileText);
    } catch (error: any) {
      alert(error?.message || "复制 .env 内容失败");
    }
  }, [envFileText]);

  // Empty state (only show when no secrets AND no missing keys from other envs)
  if (secrets.length === 0 && missingKeys.length === 0 && newSecrets.length === 0) {
    return (
      <>
        <EmptyState
          icon={<KeyIcon className="size-6 text-muted-foreground" />}
          title="暂无密钥"
          description="手动添加密钥，或从 .env 文件导入以开始使用。"
        >
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={addNewSecret}>
              <PlusIcon className="size-4" />
              添加密钥
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              <UploadIcon className="size-4" />
              导入 .env
            </Button>
          </div>
        </EmptyState>
        <ImportEnvDialog open={importOpen} onOpenChange={setImportOpen} importing={importing} onImport={handleImportText} />
      </>
    );
  }

  return (
    <>
      <Frame className="w-full gap-3">
        <div className="overflow-x-auto">
        <Table>
          <colgroup>
            <col />
            <col />
            <col className="w-32" />
            <col className="w-16" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="whitespace-normal">键</TableHead>
              <TableHead className="whitespace-normal">值</TableHead>
              <TableHead>最后更新</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {secrets.map((secret) => {
              const isDirty = dirtySecrets.includes(secret);
              const isVisible = allVisible || (rowVisible[secret.id] ?? false);
              return (
                <TableRow key={secret.id} className={isDirty ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                  <TableCell className="min-w-0 overflow-hidden">
                    <Input
                      type="text"
                      inputSize="sm"
                      value={edits[secret.id]?.name ?? secret.name}
                      onChange={(e) => setEdit(secret.id, "name", e.target.value)}
                      className={cn(
                        "w-full min-w-0 border-transparent bg-transparent px-1.5 mono-sm font-medium focus:border-input hover:border-input",
                        isDirty && "text-amber-700 dark:text-amber-400 border-amber-400/50 focus:ring-amber-500",
                      )}
                    />
                  </TableCell>
                  <TableCell className="min-w-0 overflow-hidden">
                    <SecretValueCell
                      value={secret.value}
                      editedValue={edits[secret.id]?.value}
                      onValueChange={(v) => setEdit(secret.id, "value", v)}
                      visible={isVisible}
                      onToggle={() => setRowVisible((prev) => ({ ...prev, [secret.id]: !isVisible }))}
                      isDirty={isDirty}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <TimeAgo
                      ts={secret.updatedAt}
                      className="text-muted-foreground text-xs tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="p-0">
                    <button
                      onClick={() => setDeleteTarget({ name: secret.name })}
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                      title="删除密钥"
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Missing keys: exist in other envs but not this one */}
            {missingKeys.map((name) => {
              const hasValue = missingEdits[name]?.trim();
              return (
                <TableRow key={`missing-${name}`} className="bg-destructive/5 dark:bg-destructive/10">
                  <TableCell className="min-w-0 whitespace-normal">
                    <span className="block break-all px-1.5 mono-sm text-sm font-medium text-destructive">
                      {name}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-0 overflow-hidden">
                    <Input
                      type="text"
                      inputSize="sm"
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      placeholder="缺失——请添加值"
                      value={missingEdits[name] ?? ""}
                      onChange={(e) => setMissingEdits((prev) => ({ ...prev, [name]: e.target.value }))}
                       className={cn(
                         "w-full min-w-0 mono-sm border-destructive/40",
                         hasValue ? "bg-amber-50/50 dark:bg-amber-950/20" : "text-security-disc bg-transparent",
                       )}
                     />
                   </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-destructive text-xs">缺失</span>
                  </TableCell>
                  <TableCell />
                </TableRow>
              );
            })}
            {newSecrets.map((secret) => {
              const isComplete = secret.name.trim() && secret.value.trim();
              return (
                <TableRow
                  key={secret.id}
                  className={cn(
                    "bg-primary/5 dark:bg-primary/10",
                    isComplete && "bg-amber-50/50 dark:bg-amber-950/20",
                  )}
                >
                  <TableCell className="min-w-0 overflow-hidden">
                    <Input
                      type="text"
                      inputSize="sm"
                      autoFocus={newSecrets.length === 1}
                      value={secret.name}
                      onChange={(e) => updateNewSecret(secret.id, "name", e.target.value)}
                      placeholder="SECRET_KEY"
                      className="w-full min-w-0 border-transparent bg-transparent px-1.5 mono-sm font-medium focus:border-input hover:border-input"
                    />
                  </TableCell>
                  <TableCell className="min-w-0 overflow-hidden">
                    <Input
                      type="text"
                      inputSize="sm"
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      value={secret.value}
                      onChange={(e) => updateNewSecret(secret.id, "value", e.target.value)}
                      placeholder="密钥值"
                      className="w-full min-w-0 border-transparent bg-transparent px-1.5 mono-sm focus:border-input hover:border-input"
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-xs text-muted-foreground">新增</span>
                  </TableCell>
                  <TableCell className="p-0">
                    <button
                      onClick={() => removeNewSecret(secret.id)}
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                      title="移除草稿密钥"
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>

        {/* Bottom bar: add secret + import */}
        <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
          <Button onClick={addNewSecret} size="xs">
            <PlusIcon className="size-3" />
            添加密钥
          </Button>
          {missingKeys.length > 0 && (
            <Button
              onClick={() => setSyncOpen(true)}
              size="xs"
              variant="ghost"
            >
              <ArrowDownToLineIcon className="size-3" />
              同步 {missingKeys.length} 个缺失项
            </Button>
          )}
          <div className="flex-1" />
          <Button
            onClick={() => setImportOpen(true)}
            size="xs"
            variant="ghost"
          >
            <UploadIcon className="size-3" />
            导入 .env
          </Button>
          <Button
            onClick={handleDownloadEnv}
            size="xs"
            variant="ghost"
          >
            <DownloadIcon className="size-3" />
            下载 .env
          </Button>
          <Button
            onClick={() => void handleCopyEnv()}
            size="xs"
            variant="ghost"
          >
            <CopyIcon className="size-3" />
            复制为 .env
          </Button>
        </div>
      </Frame>

      <ImportEnvDialog open={importOpen} onOpenChange={setImportOpen} importing={importing} onImport={handleImportText} />

      <SyncMissingDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        missingKeys={missingKeys}
        environments={environments}
        currentEnvironmentId={environmentId}
      />

      {deleteTarget && (
        <DeleteFromEnvsDialog
          open
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          secretName={deleteTarget.name}
          environments={environments}
          currentEnvId={environmentId}
        />
      )}

      <SaveToEnvsDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        environments={environments}
        currentEnvId={environmentId}
        dirtyCount={totalDirtyCount}
        saving={saving}
        onSave={async (envIds) => {
          setSaving(true);
          try {
            if (pendingEdits.length > 0) {
              await saveSecretsAction({ edits: pendingEdits, environmentIds: envIds });
            }
            setEdits({});
            setMissingEdits({});
            setNewSecrets([]);
            setSaveOpen(false);
          } catch (e: any) {
            alert(e?.message || "保存密钥失败");
          } finally {
            setSaving(false);
          }
        }}
      />

      {/* Save bar */}
      {totalDirtyCount > 0 && (
        <div className="flex justify-end mt-3">
          <Button onClick={() => setSaveOpen(true)}>
            保存 {totalDirtyCount} 个密钥
          </Button>
        </div>
      )}
    </>
  );
}

const importEnvSchema = z.object({ envText: z.string().min(1, "请粘贴 .env 内容") });
const importEnvFields = importEnvSchema.keyof().enum;

function ImportEnvDialog({
  open,
  onOpenChange,
  importing,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importing: boolean;
  onImport: (text: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>导入 .env</DialogTitle>
          <DialogDescription>
            在下方粘贴 .env 文件内容；每行应使用 KEY=value 格式。
          </DialogDescription>
        </DialogHeader>
        <form
          className="px-6 pb-2"
          action={async (formData: FormData) => {
            const { envText } = parseFormData(importEnvSchema, formData);
            if (envText.trim()) await onImport(envText);
          }}
        >
          <Textarea
            name={importEnvFields.envText}
            required
            autoFocus
            placeholder={"DATABASE_URL=postgres://...\nAPI_KEY=sk-...\nSECRET_TOKEN=abc123"}
            rows={8}
            className="mono-sm"
          />
          <DialogFooter variant="bare" className="mt-4">
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button type="submit">
              导入
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

// Shared environment checkbox list used by save and delete dialogs.
// Current env is always checked and disabled, others are toggleable.
function useEnvSelection(environments: Environment[], currentEnvId: string) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const selectedIds = [
    currentEnvId,
    ...environments.filter((e) => e.id !== currentEnvId && checked[e.id]).map((e) => e.id),
  ];
  return { checked, toggle, selectedIds };
}

function EnvCheckboxList({
  environments,
  currentEnvId,
  checked,
  onToggle,
}: {
  environments: Environment[];
  currentEnvId: string;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="px-6 pb-2 flex flex-col gap-1.5">
      {environments.map((env) => {
        const isCurrent = env.id === currentEnvId;
        const isChecked = isCurrent || (checked[env.id] ?? false);
        return (
          <label
            key={env.id}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors",
              isChecked ? "bg-primary/5" : "hover:bg-muted/50",
              isCurrent && "opacity-80",
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center size-4 rounded border transition-colors",
                isChecked ? "bg-primary border-primary text-primary-foreground" : "border-input",
              )}
              aria-hidden
            >
              {isChecked && <CheckIcon className="size-3" />}
            </span>
            <input
              type="checkbox"
              checked={isChecked}
              disabled={isCurrent}
              onChange={() => onToggle(env.id)}
              className="sr-only"
            />
            <span className="text-sm font-medium">{env.name}</span>
            {isCurrent && <span className="text-xs text-muted-foreground ml-auto">当前</span>}
          </label>
        );
      })}
    </div>
  );
}

function DeleteFromEnvsDialog({
  open,
  onOpenChange,
  secretName,
  environments,
  currentEnvId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secretName: string;
  environments: Environment[];
  currentEnvId: string;
}) {
  const { checked, toggle, selectedIds } = useEnvSelection(environments, currentEnvId);
  const [deleting, setDeleting] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>删除“{secretName}”</DialogTitle>
          <DialogDescription>
            选择要从哪些环境中删除此密钥。
          </DialogDescription>
        </DialogHeader>
        <EnvCheckboxList environments={environments} currentEnvId={currentEnvId} checked={checked} onToggle={toggle} />
        <DialogFooter variant="bare" className="px-6 pb-4 pt-2">
          <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
          <Button
            variant="destructive"
            loading={deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                await deleteSecretAction({ name: secretName, environmentIds: selectedIds });
                onOpenChange(false);
              } catch (e: any) {
                alert(e?.message || "删除密钥失败");
              } finally {
                setDeleting(false);
              }
            }}
          >
            从 {selectedIds.length} 个环境中删除
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function SaveToEnvsDialog({
  open,
  onOpenChange,
  environments,
  currentEnvId,
  dirtyCount,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environments: Environment[];
  currentEnvId: string;
  dirtyCount: number;
  saving: boolean;
  onSave: (envIds: string[]) => Promise<void>;
}) {
  const { checked, toggle, selectedIds } = useEnvSelection(environments, currentEnvId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>保存 {dirtyCount} 个密钥</DialogTitle>
          <DialogDescription>
            选择要应用这些更改的环境。
            密钥按名称匹配，缺失的键会被创建。
          </DialogDescription>
        </DialogHeader>
        <EnvCheckboxList environments={environments} currentEnvId={currentEnvId} checked={checked} onToggle={toggle} />
        <DialogFooter variant="bare" className="px-6 pb-4 pt-2">
          <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
          <Button loading={saving} onClick={() => onSave(selectedIds)}>
            保存到 {selectedIds.length} 个环境
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

const syncSchema = z.object({ sourceEnvironmentId: z.string().min(1, "请选择环境") });
const syncFields = syncSchema.keyof().enum;

function SyncMissingDialog({
  open,
  onOpenChange,
  missingKeys,
  environments,
  currentEnvironmentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingKeys: string[];
  environments: Environment[];
  currentEnvironmentId: string;
}) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(open: boolean) {
    if (!open) setError(null);
    onOpenChange(open);
  }

  const otherEnvironments = environments.filter((e) => e.id !== currentEnvironmentId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>同步缺失密钥</DialogTitle>
          <DialogDescription>
            从另一个环境复制 {missingKeys.length} 个缺失密钥到当前环境。
          </DialogDescription>
        </DialogHeader>
        <form
          className="px-6 pb-2"
          action={async (formData: FormData) => {
            const { sourceEnvironmentId } = parseFormData(syncSchema, formData);
            setSyncing(true);
            setError(null);
            try {
              const result = await syncMissingSecretsAction({
                sourceEnvironmentId,
                targetEnvironmentId: currentEnvironmentId,
                names: missingKeys,
              });
              if (result.count === 0) {
                setError("该环境不包含任何缺失的密钥。");
              } else {
                handleOpenChange(false);
              }
            } catch (e: any) {
              setError(e?.message || "同步密钥失败");
            } finally {
              setSyncing(false);
            }
          }}
        >
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <div>
            <label htmlFor="sync-source-env" className="text-sm font-medium mb-1 block">
              来源环境
            </label>
            <NativeSelect id="sync-source-env" name={syncFields.sourceEnvironmentId} required autoFocus>
              <option value="">选择环境…</option>
              {otherEnvironments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground mt-2">
              仅复制这 {missingKeys.length} 个缺失键；已有密钥不会受影响。
            </p>
          </div>
          <DialogFooter variant="bare" className="mt-4">
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button type="submit" loading={syncing}>
              从环境同步
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
