import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";

type UserRole = "admin" | "employee";
type DocumentKind = "order" | "repeat_scan" | "attachment" | "confirmation";
type DocumentStatus =
  | "uploaded"
  | "recognized"
  | "partially_recognized"
  | "needs_review"
  | "confirmed"
  | "ocr_error"
  | "archived";
type VehicleType = "truck" | "trailer";
type ReviewPriorityBucket = "review" | "critical" | "suspicious";
type ReviewQueueCategory =
  | "all"
  | "suspicious"
  | "ocr_error"
  | "partial_recognition"
  | "employee_confirmation"
  | "manual_review";

type ReviewQueueItem = {
  category: ReviewQueueCategory;
  priority_score: number;
  priority_bucket: ReviewPriorityBucket;
  issue_count: number;
  issue_titles: string[];
  manual_review_reasons: string[];
  extracted_order_number: string | null;
  extracted_grand_total: number | null;
  document: {
    id: number;
    original_filename: string;
    source_type: string;
    kind: DocumentKind;
    status: DocumentStatus;
    created_at: string;
    updated_at: string;
    ocr_confidence: number | null;
    review_queue_priority: number;
  };
  repair: {
    id: number;
    order_number: string | null;
    repair_date: string;
    mileage: number;
    status: string;
    is_partially_recognized: boolean;
    unresolved_checks_total: number;
    suspicious_checks_total: number;
  };
  vehicle: {
    id: number;
    external_id: string | null;
    vehicle_type: VehicleType;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
};

type ReviewQueueFilter = {
  key: ReviewQueueCategory;
  label: string;
};

type ReviewQueuePanelProps = {
  reviewQueueFilters: ReviewQueueFilter[];
  reviewQueueCounts: Record<ReviewQueueCategory, number>;
  selectedReviewCategory: ReviewQueueCategory;
  reviewQueue: ReviewQueueItem[];
  userRole: UserRole | null | undefined;
  reprocessLoading: boolean;
  selectedDocumentId: number | null;
  onSelectCategory: (category: ReviewQueueCategory) => void;
  onOpenReviewQueueItem: (item: ReviewQueueItem) => void;
  onReprocessDocumentById: (documentId: number, repairId: number) => void;
  formatDocumentKind: (kind: DocumentKind) => string;
  reviewPriorityColor: (bucket: ReviewPriorityBucket) => ChipProps["color"];
  formatReviewPriority: (bucket: ReviewPriorityBucket) => string;
  statusColor: (status: DocumentStatus) => ChipProps["color"];
  formatDocumentStatusLabel: (status: string | null | undefined) => string;
  formatVehicle: (vehicle: ReviewQueueItem["vehicle"]) => string;
  formatConfidence: (value: number | null) => string;
  formatMoney: (value?: number | null) => string | null;
};

export function ReviewQueuePanel({
  reviewQueueFilters,
  reviewQueueCounts,
  selectedReviewCategory,
  reviewQueue,
  userRole,
  reprocessLoading,
  selectedDocumentId,
  onSelectCategory,
  onOpenReviewQueueItem,
  onReprocessDocumentById,
  formatDocumentKind,
  reviewPriorityColor,
  formatReviewPriority,
  statusColor,
  formatDocumentStatusLabel,
  formatVehicle,
  formatConfidence,
  formatMoney,
}: ReviewQueuePanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Очередь проверки</Typography>
          <Typography className="muted-copy">
            Сначала показываются подозрительные и проблемные заказ-наряды по доступной технике.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {reviewQueueFilters.map((filter) => (
            <Chip
              key={filter.key}
              label={`${filter.label} · ${reviewQueueCounts[filter.key] || 0}`}
              color={selectedReviewCategory === filter.key ? "primary" : "default"}
              variant={selectedReviewCategory === filter.key ? "filled" : "outlined"}
              onClick={() => {
                onSelectCategory(filter.key);
              }}
            />
          ))}
        </Stack>
        <Typography className="muted-copy">
          Показано {reviewQueue.length} из {reviewQueueCounts[selectedReviewCategory] || 0} по выбранному фильтру.
        </Typography>
        <Stack spacing={1.5}>
          {reviewQueue.map((item) => (
            <Paper className="document-row" key={`review-${item.document.id}`} elevation={0}>
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                >
                  <Typography variant="subtitle1">{item.document.original_filename}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" variant="outlined" label={formatDocumentKind(item.document.kind)} />
                    <Chip
                      size="small"
                      color={reviewPriorityColor(item.priority_bucket)}
                      label={formatReviewPriority(item.priority_bucket)}
                    />
                    <Chip
                      size="small"
                      color={statusColor(item.document.status)}
                      label={formatDocumentStatusLabel(item.document.status)}
                    />
                  </Stack>
                </Stack>
                <Typography className="muted-copy">{formatVehicle(item.vehicle)}</Typography>
                <Typography className="muted-copy">
                  Ремонт #{item.repair.id}
                  {item.repair.order_number ? ` · ${item.repair.order_number}` : ""}
                  {" · "}
                  {item.repair.repair_date}
                  {" · "}
                  пробег {item.repair.mileage}
                </Typography>
                <Typography className="muted-copy">
                  Приоритет {item.priority_score} · OCR {formatConfidence(item.document.ocr_confidence)} · нерешённых проверок {item.repair.unresolved_checks_total}
                </Typography>
                {item.extracted_order_number ? (
                  <Typography className="muted-copy">
                    OCR: заказ-наряд {item.extracted_order_number}
                    {item.extracted_grand_total !== null ? ` · итог ${formatMoney(item.extracted_grand_total)}` : ""}
                  </Typography>
                ) : null}
                {item.issue_titles.length > 0 ? (
                  <Typography className="muted-copy">
                    Требует внимания: {item.issue_titles.slice(0, 3).join(", ")}
                    {item.issue_titles.length > 3 ? ` и ещё ${item.issue_titles.length - 3}` : ""}
                  </Typography>
                ) : null}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      onOpenReviewQueueItem(item);
                    }}
                  >
                    Открыть ремонт
                  </Button>
                  {userRole === "admin" ? (
                    <Button
                      size="small"
                      variant="text"
                      disabled={reprocessLoading}
                      onClick={() => {
                        onReprocessDocumentById(item.document.id, item.repair.id);
                      }}
                    >
                      {reprocessLoading && selectedDocumentId === item.document.id ? "Повтор..." : "Повторить OCR"}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </Paper>
          ))}
          {reviewQueue.length === 0 ? (
            <Typography className="muted-copy">По выбранному фильтру элементов нет.</Typography>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
