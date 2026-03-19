import { Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";

type DocumentStatus =
  | "uploaded"
  | "recognized"
  | "partially_recognized"
  | "needs_review"
  | "confirmed"
  | "ocr_error"
  | "archived";
type DocumentKind = "order" | "repeat_scan" | "attachment" | "confirmation";

type ReviewDocumentPreviewPanelProps = {
  document: {
    id: number;
    kind: DocumentKind;
    status: string;
    original_filename: string;
    created_at: string;
    source_type: string;
    ocr_confidence: number | null;
    versions: Array<unknown>;
  };
  reviewDocumentPreviewLoading: boolean;
  reviewDocumentPreviewKind: "image" | "pdf" | null;
  reviewDocumentPreviewUrl: string | null;
  documentOpenLoadingId: number | null;
  onOpenDocument: (documentId: number) => void;
  formatDocumentKind: (kind: DocumentKind) => string;
  statusColor: (status: DocumentStatus) => "default" | "success" | "error" | "warning";
  formatDocumentStatusLabel: (status: string) => string;
  formatDateTime: (value: string) => string;
  formatSourceTypeLabel: (value: string) => string;
  formatConfidence: (value: number | null) => string;
};

export function ReviewDocumentPreviewPanel({
  document,
  reviewDocumentPreviewLoading,
  reviewDocumentPreviewKind,
  reviewDocumentPreviewUrl,
  documentOpenLoadingId,
  onOpenDocument,
  formatDocumentKind,
  statusColor,
  formatDocumentStatusLabel,
  formatDateTime,
  formatSourceTypeLabel,
  formatConfidence,
}: ReviewDocumentPreviewPanelProps) {
  return (
    <Paper className="repair-line repair-review-split" elevation={0}>
      <Stack spacing={1.25} sx={{ height: "100%" }}>
        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
          <Box>
            <Typography variant="subtitle1">Документ</Typography>
            <Typography className="muted-copy">{document.original_filename}</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
            <Chip size="small" variant="outlined" label={formatDocumentKind(document.kind)} />
            <Chip
              size="small"
              color={statusColor(document.status as DocumentStatus)}
              label={formatDocumentStatusLabel(document.status)}
            />
          </Stack>
        </Stack>
        <Typography className="muted-copy">
          {formatDateTime(document.created_at)} · {formatSourceTypeLabel(document.source_type)}
          {" · "}OCR {formatConfidence(document.ocr_confidence)}
        </Typography>
        <Box className="repair-review-preview">
          {reviewDocumentPreviewLoading ? (
            <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ minHeight: 320 }}>
              <CircularProgress size={24} />
              <Typography className="muted-copy">Загружаю превью документа...</Typography>
            </Stack>
          ) : reviewDocumentPreviewKind === "image" && reviewDocumentPreviewUrl ? (
            <Box
              component="img"
              src={reviewDocumentPreviewUrl}
              alt={document.original_filename}
              sx={{
                width: "100%",
                maxHeight: 520,
                objectFit: "contain",
                display: "block",
                borderRadius: 2,
              }}
            />
          ) : reviewDocumentPreviewKind === "pdf" && reviewDocumentPreviewUrl ? (
            <Box
              component="iframe"
              src={reviewDocumentPreviewUrl}
              title={document.original_filename}
              sx={{
                width: "100%",
                minHeight: { xs: 360, lg: 520 },
                border: 0,
                borderRadius: 2,
                backgroundColor: "#fff",
              }}
            />
          ) : (
            <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ minHeight: 320 }}>
              <Typography className="muted-copy">Для этого типа файла встроенное превью недоступно.</Typography>
            </Stack>
          )}
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            size="small"
            variant="outlined"
            disabled={documentOpenLoadingId === document.id}
            onClick={() => onOpenDocument(document.id)}
          >
            {documentOpenLoadingId === document.id ? "Открытие..." : "Открыть отдельно"}
          </Button>
          <Typography className="muted-copy">Версий OCR: {document.versions.length}</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
