import { useEffect, useRef, useState } from "react";
import { apiRequest, downloadApiFile } from "../shared/api";
import type { AdminTab, WorkspaceTab } from "../shared/appRoute";
import type {
  BackupCreateResponse,
  BackupItem,
  BackupListResponse,
  BackupRestoreResponse,
} from "../shared/backupAdminTypes";

type UseBackupsAdminParams = {
  token: string;
  userRole: "admin" | "employee" | null | undefined;
  activeWorkspaceTab: WorkspaceTab;
  activeAdminTab: AdminTab;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  invalidateSession: (options?: { message?: string; reload?: boolean }) => void;
};

export function useBackupsAdmin({
  token,
  userRole,
  activeWorkspaceTab,
  activeAdminTab,
  setErrorMessage,
  setSuccessMessage,
  invalidateSession,
}: UseBackupsAdminParams) {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  const [backupRestoreDialogOpen, setBackupRestoreDialogOpen] = useState(false);
  const [backupRestoreTarget, setBackupRestoreTarget] = useState<BackupItem | null>(null);
  const [backupRestoreConfirmValue, setBackupRestoreConfirmValue] = useState("");
  const backupsRequestIdRef = useRef(0);

  async function loadBackups() {
    if (!token || userRole !== "admin") {
      return;
    }
    const requestId = backupsRequestIdRef.current + 1;
    backupsRequestIdRef.current = requestId;
    setBackupsLoading(true);
    try {
      const payload = await apiRequest<BackupListResponse>("/backups", { method: "GET" }, token);
      if (backupsRequestIdRef.current !== requestId) {
        return;
      }
      setBackups(payload.items);
    } finally {
      if (backupsRequestIdRef.current === requestId) {
        setBackupsLoading(false);
      }
    }
  }

  function openBackupRestoreDialog(item: BackupItem) {
    setBackupRestoreTarget(item);
    setBackupRestoreConfirmValue("");
    setBackupRestoreDialogOpen(true);
  }

  function closeBackupRestoreDialog() {
    setBackupRestoreDialogOpen(false);
    setBackupRestoreTarget(null);
    setBackupRestoreConfirmValue("");
  }

  async function handleCreateBackup() {
    if (!token || userRole !== "admin") {
      return;
    }
    setBackupActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = await apiRequest<BackupCreateResponse>("/backups", { method: "POST" }, token);
      setSuccessMessage(payload.message);
      await loadBackups();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать резервную копию");
    } finally {
      setBackupActionLoading(false);
    }
  }

  async function handleDownloadBackup(item: BackupItem) {
    if (!token || userRole !== "admin") {
      return;
    }
    setBackupActionLoading(true);
    setErrorMessage("");
    try {
      await downloadApiFile(`/backups/${item.backup_id}/download`, token, item.filename);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось скачать резервную копию");
    } finally {
      setBackupActionLoading(false);
    }
  }

  async function handleRestoreBackup() {
    if (!token || userRole !== "admin" || !backupRestoreTarget) {
      return;
    }
    setBackupActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = await apiRequest<BackupRestoreResponse>(
        `/backups/${backupRestoreTarget.backup_id}/restore`,
        {
          method: "POST",
          body: JSON.stringify({ confirm_backup_id: backupRestoreConfirmValue }),
        },
        token,
      );
      closeBackupRestoreDialog();
      if (payload.requires_reauthentication && payload.post_restore_action === "relogin") {
        resetBackupsState();
        invalidateSession({ message: payload.message, reload: true });
        return;
      }
      setSuccessMessage(payload.message);
      await loadBackups();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось восстановить резервную копию");
    } finally {
      setBackupActionLoading(false);
    }
  }

  function resetBackupsState() {
    backupsRequestIdRef.current += 1;
    setBackups([]);
    setBackupsLoading(false);
    setBackupActionLoading(false);
    setBackupRestoreDialogOpen(false);
    setBackupRestoreTarget(null);
    setBackupRestoreConfirmValue("");
  }

  useEffect(() => {
    if (!token || userRole !== "admin" || activeWorkspaceTab !== "admin" || activeAdminTab !== "backups") {
      return;
    }
    void loadBackups().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить резервные копии");
    });
  }, [activeAdminTab, activeWorkspaceTab, setErrorMessage, token, userRole]);

  useEffect(() => {
    if (!backupRestoreDialogOpen || !backupRestoreTarget) {
      return;
    }

    const nextTarget = backups.find((item) => item.backup_id === backupRestoreTarget.backup_id) ?? null;
    if (nextTarget === null) {
      closeBackupRestoreDialog();
      return;
    }
    if (nextTarget !== backupRestoreTarget) {
      setBackupRestoreTarget(nextTarget);
    }
  }, [backupRestoreDialogOpen, backupRestoreTarget, backups]);

  return {
    backups,
    backupsLoading,
    backupActionLoading,
    backupRestoreDialogOpen,
    backupRestoreTarget,
    backupRestoreConfirmValue,
    setBackupRestoreConfirmValue,
    loadBackups,
    openBackupRestoreDialog,
    closeBackupRestoreDialog,
    handleCreateBackup,
    handleDownloadBackup,
    handleRestoreBackup,
    resetBackupsState,
  };
}
