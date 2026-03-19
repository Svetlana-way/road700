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
};

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
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Резервные копии</Typography>
          <Typography className="muted-copy">
            Полный backup включает базу данных и все файлы из `storage`. Для восстановления введите точный код копии.
          </Typography>
        </Box>
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
                Восстановление перезапишет текущую базу и файлы `storage`.
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
