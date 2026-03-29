import { useEffect, useState } from "react";
import { apiRequest, downloadApiFile } from "../shared/api";
import type { AdminTab, WorkspaceTab } from "../shared/appRoute";

type BackupItem = {
  backup_id: string;
  filename: string;
  created_at: string;
  backup_type: string;
  source: string;
  status: string;
  size_bytes: number;
  storage_files_total: number;
  tables_total: number;
  included_sections: Array<"database" | "storage_files">;
  excluded_sections: Array<"backup_archives">;
  restore_effects: Array<"replace_database" | "replace_storage_files" | "keep_backup_archives" | "relogin_required">;
};

type BackupListResponse = {
  items: BackupItem[];
  total: number;
};

type BackupCreateResponse = {
  message: string;
  backup: BackupItem;
};

type BackupRestoreResponse = {
  message: string;
  backup: BackupItem;
  requires_reauthentication: boolean;
  post_restore_action: "relogin";
};

type UseBackupsAdminParams = {
  token: string;
  userRole: "admin" | "employee" | null | undefined;
  activeWorkspaceTab: WorkspaceTab;
  activeAdminTab: AdminTab;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  invalidateSession: () => void;
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

  async function loadBackups() {
    if (!token) {
      return;
    }
    setBackupsLoading(true);
    try {
      const payload = await apiRequest<BackupListResponse>("/backups", { method: "GET" }, token);
      setBackups(payload.items);
    } finally {
      setBackupsLoading(false);
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
      setSuccessMessage(payload.message);
      closeBackupRestoreDialog();
      if (payload.requires_reauthentication && payload.post_restore_action === "relogin") {
        resetBackupsState();
        invalidateSession();
        return;
      }
      await loadBackups();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось восстановить резервную копию");
    } finally {
      setBackupActionLoading(false);
    }
  }

  function resetBackupsState() {
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
