import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { BackupItem } from "../contracts/api/backup";

const BACKUP_SECTION_LABELS: Record<BackupItem["included_sections"][number] | BackupItem["excluded_sections"][number], string> = {
  database: "база данных",
  storage_files: "рабочие файлы из storage",
  backup_archives: "каталог резервных копий",
};

const BACKUP_RESTORE_EFFECT_LABELS: Record<BackupItem["restore_effects"][number], string> = {
  replace_database: "текущая база данных будет перезаписана",
  replace_storage_files: "рабочие файлы storage будут перезаписаны",
  keep_backup_archives: "каталог резервных копий сохранится",
  relogin_required: "после восстановления потребуется повторный вход",
};

function formatBackupSectionList(values: Array<BackupItem["included_sections"][number] | BackupItem["excluded_sections"][number]>) {
  return values.map((value) => BACKUP_SECTION_LABELS[value]).join(", ");
}

function formatBackupRestoreEffectList(values: BackupItem["restore_effects"]) {
  return values.map((value) => BACKUP_RESTORE_EFFECT_LABELS[value]).join("; ");
}

type BackupsAdminPanelProps = {
  backupActionLoading: boolean;
  backupsLoading: boolean;
  backups: BackupItem[];
  backupRestoreDialogOpen: boolean;
  backupRestoreTarget: BackupItem | null;
  backupRestoreConfirmValue: string;
  onCreateBackup: () => void;
  onRefresh: () => void;
  onDownloadBackup: (item: BackupItem) => void;
  onOpenRestoreDialog: (item: BackupItem) => void;
  onCloseRestoreDialog: () => void;
  onBackupRestoreConfirmValueChange: (value: string) => void;
  onRestoreBackup: () => void;
  formatStatus: (value: string) => string;
  formatDateTime: (value: string) => string;
  formatFileSize: (value: number) => string;
};

export function BackupsAdminPanel({
  backupActionLoading,
  backupsLoading,
  backups,
  backupRestoreDialogOpen,
  backupRestoreTarget,
  backupRestoreConfirmValue,
  onCreateBackup,
  onRefresh,
  onDownloadBackup,
  onOpenRestoreDialog,
  onCloseRestoreDialog,
  onBackupRestoreConfirmValueChange,
  onRestoreBackup,
  formatStatus,
  formatDateTime,
  formatFileSize,
}: BackupsAdminPanelProps) {
  const contractPreview = backupRestoreTarget ?? backups[0] ?? null;

  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Резервные копии</Typography>
          <Typography className="muted-copy">
            Полный backup включает базу данных и рабочие файлы `storage`, кроме каталога резервных копий. Восстановление перезаписывает текущую базу и рабочие файлы, но не удаляет сами архивы backup.
          </Typography>
        </Box>
        {contractPreview ? (
          <Alert severity="info">
            Включено: {formatBackupSectionList(contractPreview.included_sections)}. Не входит: {formatBackupSectionList(contractPreview.excluded_sections)}. При
            восстановлении: {formatBackupRestoreEffectList(contractPreview.restore_effects)}.
          </Alert>
        ) : null}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="contained" disabled={backupActionLoading} onClick={onCreateBackup}>
            {backupActionLoading ? "Выполнение..." : "Создать резервную копию"}
          </Button>
          <Button variant="outlined" disabled={backupsLoading || backupActionLoading} onClick={onRefresh}>
            {backupsLoading ? "Обновление..." : "Обновить список"}
          </Button>
        </Stack>
        {backupsLoading ? (
          <Stack spacing={1} alignItems="center">
            <CircularProgress size={24} />
            <Typography className="muted-copy">Загрузка резервных копий...</Typography>
          </Stack>
        ) : backups.length > 0 ? (
          <Stack spacing={1}>
            {backups.map((item) => (
              <Paper className="repair-line" key={item.backup_id} elevation={0}>
                <Stack spacing={1}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Box>
                      <Typography>{item.filename}</Typography>
                      <Typography className="muted-copy">Код: {item.backup_id}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" variant="outlined" label={formatStatus(item.backup_type)} />
                      <Chip size="small" variant="outlined" label={formatStatus(item.source)} />
                      <Chip
                        size="small"
                        color={item.status === "ready" ? "success" : "warning"}
                        label={formatStatus(item.status)}
                      />
                    </Stack>
                  </Stack>
                  <Typography className="muted-copy">
                    {formatDateTime(item.created_at)} · {formatFileSize(item.size_bytes)} · таблиц {item.tables_total} · файлов {item.storage_files_total}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={backupActionLoading || item.status !== "ready"}
                      onClick={() => onDownloadBackup(item)}
                    >
                      Скачать
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      color="warning"
                      disabled={backupActionLoading || item.status !== "ready"}
                      onClick={() => onOpenRestoreDialog(item)}
                    >
                      Восстановить
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">Резервные копии пока не создавались.</Alert>
        )}
        <Dialog open={backupRestoreDialogOpen} onClose={onCloseRestoreDialog} fullWidth maxWidth="sm">
          <DialogTitle>Подтверждение восстановления</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.5}>
              <Alert severity="warning">
                Восстановление перезапишет текущую базу и рабочие файлы `storage`, но не затронет каталог резервных копий. После восстановления потребуется
                повторный вход.
              </Alert>
              <Typography>
                Для подтверждения введите код копии: <strong>{backupRestoreTarget?.backup_id || "—"}</strong>
              </Typography>
              <TextField
                fullWidth
                label="Код резервной копии"
                value={backupRestoreConfirmValue}
                onChange={(event) => onBackupRestoreConfirmValueChange(event.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCloseRestoreDialog} disabled={backupActionLoading}>
              Отмена
            </Button>
            <Button
              color="warning"
              variant="contained"
              disabled={backupActionLoading || backupRestoreConfirmValue.trim() !== (backupRestoreTarget?.backup_id || "")}
              onClick={onRestoreBackup}
            >
              {backupActionLoading ? "Восстановление..." : "Восстановить"}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  );
}
