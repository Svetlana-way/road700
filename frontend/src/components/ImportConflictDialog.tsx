import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ImportConflictItem } from "../shared/importAdminTypes";

type ImportConflictDialogProps = {
  open: boolean;
  importConflictLoading: boolean;
  importConflictSaving: boolean;
  selectedImportConflict: ImportConflictItem | null;
  importConflictComment: string;
  onClose: () => void;
  onCommentChange: (value: string) => void;
  onIgnore: () => void;
  onResolve: () => void;
  formatStatus: (value: string) => string;
  formatDateTime: (value: string) => string;
  formatJsonPretty: (value: unknown) => string;
};

export function ImportConflictDialog({
  open,
  importConflictLoading,
  importConflictSaving,
  selectedImportConflict,
  importConflictComment,
  onClose,
  onCommentChange,
  onIgnore,
  onResolve,
  formatStatus,
  formatDateTime,
  formatJsonPretty,
}: ImportConflictDialogProps) {
  return (
    <Dialog open={open} onClose={() => (!importConflictSaving ? onClose() : undefined)} fullWidth maxWidth="md">
      <DialogTitle>Разбор конфликта импорта</DialogTitle>
      <DialogContent dividers>
        {importConflictLoading ? (
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={24} />
            <Typography className="muted-copy">Загрузка конфликта...</Typography>
          </Stack>
        ) : selectedImportConflict ? (
          <Stack spacing={2}>
            <Typography>
              {selectedImportConflict.entity_type} · {formatStatus(selectedImportConflict.status)}
            </Typography>
            <Typography className="muted-copy">
              {[selectedImportConflict.conflict_key, selectedImportConflict.source_filename, formatDateTime(selectedImportConflict.created_at)]
                .filter(Boolean)
                .join(" · ")}
            </Typography>
            <TextField
              label="Входящие данные"
              value={formatJsonPretty(selectedImportConflict.incoming_payload)}
              multiline
              minRows={6}
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Существующие данные"
              value={formatJsonPretty(selectedImportConflict.existing_payload)}
              multiline
              minRows={6}
              fullWidth
              InputProps={{ readOnly: true }}
            />
            {selectedImportConflict.resolution_payload ? (
              <TextField
                label="Текущее решение"
                value={formatJsonPretty(selectedImportConflict.resolution_payload)}
                multiline
                minRows={4}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            ) : null}
            <TextField
              label="Комментарий администратора"
              value={importConflictComment}
              onChange={(event) => onCommentChange(event.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        ) : (
          <Typography className="muted-copy">Конфликт не выбран.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={importConflictSaving}>
          Закрыть
        </Button>
        <Button variant="outlined" disabled={importConflictSaving || !selectedImportConflict} onClick={onIgnore}>
          {importConflictSaving ? "Сохранение..." : "Игнорировать"}
        </Button>
        <Button variant="contained" disabled={importConflictSaving || !selectedImportConflict} onClick={onResolve}>
          {importConflictSaving ? "Сохранение..." : "Отметить решённым"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
