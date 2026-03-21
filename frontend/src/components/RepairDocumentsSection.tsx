import { type Ref } from "react";
import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type {
  DocumentComparisonResponse,
  DocumentKind,
  DocumentStatus,
  UserRole,
} from "../shared/workspaceBootstrapTypes";

type RepairDocumentItem = {
  id: number;
  original_filename: string;
  source_type: string;
  kind: DocumentKind;
  mime_type: string | null;
  status: string;
  is_primary: boolean;
  ocr_confidence: number | null;
  review_queue_priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  latest_import_job?: {
    id: number;
    status: string;
    error_message?: string | null;
    attempts: number;
    started_at?: string | null;
    finished_at?: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  versions: Array<{
    id: number;
    version_number: number;
    created_at: string;
    change_summary: string | null;
    parsed_payload: Record<string, unknown> | null;
    field_confidence_map: Record<string, unknown> | null;
  }>;
};

type RepairDetailLike = {
  id: number;
  status: string;
  documents: RepairDocumentItem[];
};

type RepairDocumentsSectionProps = {
  userRole?: UserRole;
  selectedRepair: RepairDetailLike;
  documentKindOptions: Array<{ value: DocumentKind; label: string }>;
  attachedDocumentKind: DocumentKind;
  attachedDocumentNotes: string;
  attachedDocumentFile: File | null;
  attachedFileInputRef: Ref<HTMLInputElement>;
  attachDocumentLoading: boolean;
  documentOpenLoadingId: number | null;
  reprocessLoading: boolean;
  selectedDocumentId: number | null;
  documentComparisonLoadingId: number | null;
  primaryDocumentLoadingId: number | null;
  documentArchiveLoadingId: number | null;
  documentComparison: DocumentComparisonResponse | null;
  documentComparisonComment: string;
  documentComparisonReviewLoading: boolean;
  onAttachedDocumentKindChange: (value: DocumentKind) => void;
  onAttachedDocumentNotesChange: (value: string) => void;
  onAttachedDocumentFileChange: (file: File | null) => void;
  onOpenAttachedFilePicker: () => void;
  onAttachDocument: () => void;
  onOpenDocumentFile: (documentId: number) => void;
  onReprocessDocumentById: (documentId: number, repairId: number) => void;
  onCompareWithPrimary: (documentId: number) => void;
  onSetPrimaryDocument: (documentId: number) => void;
  onArchiveDocument: (documentId: number, repairId: number) => void;
  onCloseDocumentComparison: () => void;
  onDocumentComparisonCommentChange: (value: string) => void;
  onReviewDocumentComparison: (action: "keep_current_primary" | "make_document_primary" | "mark_reviewed") => void;
  formatDocumentKind: (value: DocumentKind) => string;
  importJobStatusColor: (status: string | null | undefined) => "default" | "success" | "error" | "warning";
  formatStatus: (value: string) => string;
  statusColor: (status: DocumentStatus) => "default" | "success" | "error" | "warning";
  formatDocumentStatusLabel: (status: string) => string;
  formatDateTime: (value: string) => string;
  formatSourceTypeLabel: (value: string | null | undefined) => string;
  formatConfidence: (value: number | null) => string;
  formatManualReviewReasons: (reasons: string[]) => string;
  formatOcrProfileMeta: (payload: Record<string, unknown> | null | undefined) => string | null;
  formatLaborNormApplicability: (payload: Record<string, unknown> | null | undefined) => string | null;
};

export function RepairDocumentsSection({
  userRole,
  selectedRepair,
  documentKindOptions,
  attachedDocumentKind,
  attachedDocumentNotes,
  attachedDocumentFile,
  attachedFileInputRef,
  attachDocumentLoading,
  documentOpenLoadingId,
  reprocessLoading,
  selectedDocumentId,
  documentComparisonLoadingId,
  primaryDocumentLoadingId,
  documentArchiveLoadingId,
  documentComparison,
  documentComparisonComment,
  documentComparisonReviewLoading,
  onAttachedDocumentKindChange,
  onAttachedDocumentNotesChange,
  onAttachedDocumentFileChange,
  onOpenAttachedFilePicker,
  onAttachDocument,
  onOpenDocumentFile,
  onReprocessDocumentById,
  onCompareWithPrimary,
  onSetPrimaryDocument,
  onArchiveDocument,
  onCloseDocumentComparison,
  onDocumentComparisonCommentChange,
  onReviewDocumentComparison,
  formatDocumentKind,
  importJobStatusColor,
  formatStatus,
  statusColor,
  formatDocumentStatusLabel,
  formatDateTime,
  formatSourceTypeLabel,
  formatConfidence,
  formatManualReviewReasons,
  formatOcrProfileMeta,
  formatLaborNormApplicability,
}: RepairDocumentsSectionProps) {
  return (
    <>
      <Stack spacing={1}>
        <Typography variant="h6">Документы ремонта</Typography>
        {selectedRepair.status !== "archived" ? (
          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1.5}>
              <Typography className="muted-copy">
                Добавьте повторный скан, корректирующий файл или дополнительный документ в текущий ремонт.
              </Typography>
              <TextField
                select
                label="Вид документа"
                value={attachedDocumentKind}
                onChange={(event) => onAttachedDocumentKindChange(event.target.value as DocumentKind)}
                fullWidth
              >
                {documentKindOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Примечание к новому документу"
                value={attachedDocumentNotes}
                onChange={(event) => onAttachedDocumentNotesChange(event.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
              >
                <input
                  ref={attachedFileInputRef}
                  hidden
                  type="file"
                  accept=".pdf,image/*"
                  onClick={(event) => {
                    event.currentTarget.value = "";
                  }}
                  onChange={(event) => onAttachedDocumentFileChange(event.target.files?.[0] ?? null)}
                />
                <Button variant="outlined" onClick={onOpenAttachedFilePicker}>
                  Выбрать файл
                </Button>
                <Typography className="muted-copy">
                  {attachedDocumentFile ? attachedDocumentFile.name : "Файл не выбран"}
                </Typography>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="contained" disabled={attachDocumentLoading || !attachedDocumentFile} onClick={onAttachDocument}>
                  {attachDocumentLoading ? "Загрузка..." : "Добавить документ"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ) : (
          <Alert severity="info">Архивный ремонт доступен только для просмотра и экспорта.</Alert>
        )}
        {selectedRepair.documents.length > 0 ? (
          selectedRepair.documents.map((document) => (
            <Paper className="repair-line" key={document.id} elevation={0}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                  <Typography>{document.original_filename}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {document.is_primary ? <Chip size="small" label="основной" /> : null}
                    <Chip size="small" variant="outlined" label={formatDocumentKind(document.kind)} />
                    {document.latest_import_job ? (
                      <Chip
                        size="small"
                        color={importJobStatusColor(document.latest_import_job.status)}
                        label={`OCR: ${formatStatus(document.latest_import_job.status)}`}
                      />
                    ) : null}
                    <Chip
                      size="small"
                      color={statusColor(document.status as DocumentStatus)}
                      label={formatDocumentStatusLabel(document.status)}
                    />
                  </Stack>
                </Stack>
                <Typography className="muted-copy">
                  {formatDateTime(document.created_at)} · {formatSourceTypeLabel(document.source_type)} · OCR {formatConfidence(document.ocr_confidence)}
                </Typography>
                {document.latest_import_job ? (
                  <Typography className="muted-copy">
                    OCR-задача: {formatStatus(document.latest_import_job.status)}
                    {document.latest_import_job.attempts > 0 ? ` · попытка ${document.latest_import_job.attempts}` : ""}
                  </Typography>
                ) : null}
                {document.notes ? <Typography className="muted-copy">{document.notes}</Typography> : null}
                {document.latest_import_job?.error_message ? (
                  <Alert severity="warning">Ошибка OCR: {document.latest_import_job.error_message}</Alert>
                ) : null}
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={documentOpenLoadingId === document.id}
                    onClick={() => onOpenDocumentFile(document.id)}
                  >
                    {documentOpenLoadingId === document.id ? "Открытие..." : "Открыть файл"}
                  </Button>
                  {userRole === "admin" ? (
                    <Button
                      size="small"
                      variant="text"
                      disabled={reprocessLoading || document.status === "archived" || selectedRepair.status === "archived"}
                      onClick={() => onReprocessDocumentById(document.id, selectedRepair.id)}
                    >
                      {reprocessLoading && selectedDocumentId === document.id ? "Повтор..." : "Повторить OCR"}
                    </Button>
                  ) : null}
                  {userRole === "admin" &&
                  (document.kind === "order" || document.kind === "repeat_scan") &&
                  !document.is_primary &&
                  document.status !== "archived" &&
                  selectedRepair.status !== "archived" ? (
                    <>
                      <Button
                        size="small"
                        variant="text"
                        disabled={documentComparisonLoadingId === document.id}
                        onClick={() => onCompareWithPrimary(document.id)}
                      >
                        {documentComparisonLoadingId === document.id ? "Сравнение..." : "Сравнить с основным"}
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        disabled={primaryDocumentLoadingId === document.id}
                        onClick={() => onSetPrimaryDocument(document.id)}
                      >
                        {primaryDocumentLoadingId === document.id ? "Смена..." : "Сделать основным"}
                      </Button>
                    </>
                  ) : null}
                  {userRole === "admin" && document.status !== "archived" && selectedRepair.status !== "archived" ? (
                    <Button
                      size="small"
                      variant="text"
                      disabled={documentArchiveLoadingId === document.id}
                      onClick={() => onArchiveDocument(document.id, selectedRepair.id)}
                    >
                      {documentArchiveLoadingId === document.id ? "Архивация..." : "В архив"}
                    </Button>
                  ) : null}
                </Stack>
                <Stack spacing={1}>
                  <Typography className="metric-label">Версии обработки: {document.versions.length}</Typography>
                  {document.versions.map((version) => (
                    <Box key={version.id}>
                      <Typography className="muted-copy">
                        v{version.version_number} · {formatDateTime(version.created_at)}
                        {version.change_summary ? ` · ${version.change_summary}` : ""}
                      </Typography>
                      {version.parsed_payload?.processor ? (
                        <Typography className="muted-copy">Процессор: {String(version.parsed_payload.processor)}</Typography>
                      ) : null}
                      {version.parsed_payload?.manual_review_reasons &&
                      Array.isArray(version.parsed_payload.manual_review_reasons) &&
                      version.parsed_payload.manual_review_reasons.length > 0 ? (
                        <Typography className="muted-copy">
                          Ручная проверка: {formatManualReviewReasons(version.parsed_payload.manual_review_reasons as string[])}
                        </Typography>
                      ) : null}
                      {formatOcrProfileMeta(version.parsed_payload) ? (
                        <Typography className="muted-copy">{formatOcrProfileMeta(version.parsed_payload)}</Typography>
                      ) : null}
                      {formatLaborNormApplicability(version.parsed_payload) ? (
                        <Typography className="muted-copy">{formatLaborNormApplicability(version.parsed_payload)}</Typography>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          ))
        ) : (
          <Typography className="muted-copy">Документы к ремонту пока не привязаны.</Typography>
        )}
      </Stack>

      {documentComparison ? (
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="h6">Сравнение документов</Typography>
            <Button size="small" variant="text" onClick={onCloseDocumentComparison}>
              Закрыть
            </Button>
          </Stack>
          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1.25}>
              <Typography>
                {documentComparison.left_document.original_filename} против {documentComparison.right_document.original_filename}
              </Typography>
              <Typography className="muted-copy">
                Работы: {documentComparison.works_count_left} / {documentComparison.works_count_right}
                {" · "}
                Запчасти: {documentComparison.parts_count_left} / {documentComparison.parts_count_right}
              </Typography>
              {documentComparison.compared_fields.map((field) => (
                <Box key={field.field_name}>
                  <Typography className="metric-label">{field.label}</Typography>
                  <Typography className="muted-copy">
                    {field.left_value || "—"} / {field.right_value || "—"}
                    {field.is_different ? " · отличается" : " · совпадает"}
                  </Typography>
                </Box>
              ))}
              <TextField
                label="Комментарий по сверке"
                value={documentComparisonComment}
                onChange={(event) => onDocumentComparisonCommentChange(event.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  disabled={documentComparisonReviewLoading}
                  onClick={() => onReviewDocumentComparison("keep_current_primary")}
                >
                  {documentComparisonReviewLoading ? "Сохранение..." : "Оставить текущий основной"}
                </Button>
                <Button
                  variant="contained"
                  disabled={documentComparisonReviewLoading}
                  onClick={() => onReviewDocumentComparison("make_document_primary")}
                >
                  Сделать сравниваемый основным
                </Button>
                <Button
                  variant="text"
                  disabled={documentComparisonReviewLoading}
                  onClick={() => onReviewDocumentComparison("mark_reviewed")}
                >
                  Отметить как проверенное
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      ) : null}
    </>
  );
}
