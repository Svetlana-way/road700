import { Box, Grid, Paper, Stack, Typography } from "@mui/material";
import { DocumentVehicleCreatePanel } from "./DocumentVehicleCreatePanel";
import { ReviewActionsPanel } from "./ReviewActionsPanel";
import { ReviewDocumentPreviewPanel } from "./ReviewDocumentPreviewPanel";
import { ReviewExtractedDataPanel } from "./ReviewExtractedDataPanel";
import { ReviewRequiredFieldsPanel } from "./ReviewRequiredFieldsPanel";
import { ReviewServicePanel } from "./ReviewServicePanel";
import { ReviewVehicleLinkPanel } from "./ReviewVehicleLinkPanel";

type UserRole = "admin" | "employee";
type VehicleType = "truck" | "trailer";
type DocumentKind = "order" | "repeat_scan" | "attachment" | "confirmation";
type DocumentStatus =
  | "uploaded"
  | "recognized"
  | "partially_recognized"
  | "needs_review"
  | "confirmed"
  | "ocr_error"
  | "archived";
type ServiceStatus = "preliminary" | "confirmed" | "archived";
type ReviewComparisonStatus = "match" | "missing" | "mismatch" | "ocr_missing" | "empty";

type ReviewRepairFieldsDraft = {
  order_number: string;
  repair_date: string;
  mileage: string;
  work_total: string;
  parts_total: string;
  vat_total: string;
  grand_total: string;
  reason: string;
  employee_comment: string;
};

type ReviewRequiredFieldComparisonItem = {
  key: string;
  label: string;
  currentDisplay: string;
  ocrDisplay: string;
  confidenceValue: number | null;
  status: ReviewComparisonStatus;
};

type ReviewExtractedFieldSnapshot = {
  key: string;
  label: string;
  value: string;
  confidenceValue: number | null;
};

type ReviewServiceForm = {
  name: string;
  city: string;
  contact: string;
  status: ServiceStatus;
  comment: string;
};

type DocumentVehicleFormState = {
  vehicle_type: VehicleType;
  plate_number: string;
  vin: string;
  brand: string;
  model: string;
  year: string;
  comment: string;
};

type ReviewDecisionPanelProps = {
  userRole: UserRole | undefined;
  selectedRepairStatus: string;
  selectedReviewItem: {
    priority_bucket: "review" | "critical" | "suspicious";
    issue_titles: string[];
  } | null;
  selectedRepair: {
    service: {
      name: string;
    } | null;
  } | null;
  selectedRepairDocument: {
    id: number;
    original_filename: string;
    source_type: string;
    kind: DocumentKind;
    status: string;
    created_at: string;
    ocr_confidence: number | null;
    versions: Array<unknown>;
  } | null;
  reviewDocumentPreviewLoading: boolean;
  reviewDocumentPreviewKind: "image" | "pdf" | null;
  reviewDocumentPreviewUrl: string | null;
  documentOpenLoadingId: number | null;
  canLinkVehicleFromSelectedDocument: boolean;
  selectedRepairDocumentExtractedFields: Record<string, unknown> | null;
  reviewVehicleSearch: string;
  reviewVehicleSearchLoading: boolean;
  reviewVehicleLinkingId: number | null;
  reviewVehicleSearchResults: Array<{
    id: number;
    vehicle_type: VehicleType;
    vin: string | null;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  }>;
  selectedRepairDocumentOcrServiceName: string;
  reviewServiceName: string;
  services: Array<{
    id: number;
    name: string;
  }>;
  reviewServiceAssigning: boolean;
  reviewServiceSaving: boolean;
  reviewFieldSaving: boolean;
  showReviewServiceEditor: boolean;
  reviewServiceForm: ReviewServiceForm;
  canConfirmSelectedReview: boolean;
  reviewReadyFieldsCount: number;
  reviewRequiredFieldComparisons: ReviewRequiredFieldComparisonItem[];
  showReviewFieldEditor: boolean;
  reviewFieldDraft: ReviewRepairFieldsDraft | null;
  reviewMissingRequiredFields: string[];
  selectedRepairDocumentFieldSnapshots: ReviewExtractedFieldSnapshot[];
  selectedRepairDocumentPayload: Record<string, unknown> | null;
  selectedRepairDocumentWorks: Array<Record<string, unknown>>;
  selectedRepairDocumentParts: Array<Record<string, unknown>>;
  reviewActionComment: string;
  reviewActionLoading: boolean;
  canCreateVehicleFromSelectedDocument: boolean;
  isEditingRepair: boolean;
  documentVehicleForm: DocumentVehicleFormState;
  documentVehicleSaving: boolean;
  onOpenDocumentFile: (documentId: number) => void;
  onSearchVehicleChange: (value: string) => void;
  onSearchVehicles: () => void;
  onLinkVehicle: (vehicleId: number) => void;
  onServiceNameChange: (value: string) => void;
  onToggleServiceCreate: () => void;
  onClearService: () => void;
  onServiceFormChange: <K extends keyof ReviewServiceForm>(field: K, value: ReviewServiceForm[K]) => void;
  onAssignService: () => void;
  onCreateService: () => void;
  onToggleFieldEditor: () => void;
  onFillFieldsFromOcr: () => void;
  onReviewFieldDraftChange: <K extends keyof ReviewRepairFieldsDraft>(field: K, value: ReviewRepairFieldsDraft[K]) => void;
  onSaveReviewFields: () => void;
  onReviewActionCommentChange: (value: string) => void;
  onConfirm: () => void;
  onSendToReview: () => void;
  onDocumentVehicleFormChange: <K extends keyof DocumentVehicleFormState>(
    field: K,
    value: DocumentVehicleFormState[K],
  ) => void;
  onCreateVehicle: () => void;
  getReviewComparisonColor: (status: ReviewComparisonStatus) => "default" | "success" | "warning" | "error";
  getReviewComparisonLabel: (status: ReviewComparisonStatus) => string;
  getConfidenceColor: (value: number | null) => "default" | "success" | "warning" | "error";
  formatConfidenceLabel: (value: number | null) => string;
  formatMoney: (value: number | null | undefined) => string | null;
  formatCompactNumber: (value: number | null | undefined) => string | null;
  formatHours: (value: number | null | undefined) => string | null;
  formatManualReviewReasons: (reasons: string[]) => string;
  formatOcrProfileMeta: (payload: Record<string, unknown> | null | undefined) => string | null;
  formatLaborNormApplicability: (payload: Record<string, unknown> | null | undefined) => string | null;
  readStringValue: (item: Record<string, unknown>, ...keys: string[]) => string | null;
  readNumberValue: (item: Record<string, unknown>, ...keys: string[]) => number | null;
  formatOcrLineUnit: (value: string | null | undefined) => string | null;
  formatDocumentKind: (kind: DocumentKind) => string;
  statusColor: (status: DocumentStatus) => "default" | "success" | "error" | "warning";
  formatDocumentStatusLabel: (status: string) => string;
  formatDateTime: (value: string) => string;
  formatSourceTypeLabel: (value: string) => string;
  formatConfidence: (value: number | null) => string;
  formatVehicle: (vehicle: {
    id: number;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  }) => string;
  formatVehicleTypeLabel: (value: VehicleType) => string;
};

export function ReviewDecisionPanel({
  userRole,
  selectedRepairStatus,
  selectedReviewItem,
  selectedRepair,
  selectedRepairDocument,
  reviewDocumentPreviewLoading,
  reviewDocumentPreviewKind,
  reviewDocumentPreviewUrl,
  documentOpenLoadingId,
  canLinkVehicleFromSelectedDocument,
  selectedRepairDocumentExtractedFields,
  reviewVehicleSearch,
  reviewVehicleSearchLoading,
  reviewVehicleLinkingId,
  reviewVehicleSearchResults,
  selectedRepairDocumentOcrServiceName,
  reviewServiceName,
  services,
  reviewServiceAssigning,
  reviewServiceSaving,
  reviewFieldSaving,
  showReviewServiceEditor,
  reviewServiceForm,
  canConfirmSelectedReview,
  reviewReadyFieldsCount,
  reviewRequiredFieldComparisons,
  showReviewFieldEditor,
  reviewFieldDraft,
  reviewMissingRequiredFields,
  selectedRepairDocumentFieldSnapshots,
  selectedRepairDocumentPayload,
  selectedRepairDocumentWorks,
  selectedRepairDocumentParts,
  reviewActionComment,
  reviewActionLoading,
  canCreateVehicleFromSelectedDocument,
  isEditingRepair,
  documentVehicleForm,
  documentVehicleSaving,
  onOpenDocumentFile,
  onSearchVehicleChange,
  onSearchVehicles,
  onLinkVehicle,
  onServiceNameChange,
  onToggleServiceCreate,
  onClearService,
  onServiceFormChange,
  onAssignService,
  onCreateService,
  onToggleFieldEditor,
  onFillFieldsFromOcr,
  onReviewFieldDraftChange,
  onSaveReviewFields,
  onReviewActionCommentChange,
  onConfirm,
  onSendToReview,
  onDocumentVehicleFormChange,
  onCreateVehicle,
  getReviewComparisonColor,
  getReviewComparisonLabel,
  getConfidenceColor,
  formatConfidenceLabel,
  formatMoney,
  formatCompactNumber,
  formatHours,
  formatManualReviewReasons,
  formatOcrProfileMeta,
  formatLaborNormApplicability,
  readStringValue,
  readNumberValue,
  formatOcrLineUnit,
  formatDocumentKind,
  statusColor,
  formatDocumentStatusLabel,
  formatDateTime,
  formatSourceTypeLabel,
  formatConfidence,
  formatVehicle,
  formatVehicleTypeLabel,
}: ReviewDecisionPanelProps) {
  if (!selectedReviewItem || isEditingRepair) {
    return null;
  }

  return (
    <>
      <Paper className="repair-summary" elevation={0}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="h6">Решение по проверке</Typography>
            <Typography className="muted-copy">
              {userRole === "admin"
                ? selectedRepairStatus === "employee_confirmed"
                  ? "Сотрудник уже подготовил ремонт. Здесь выполняется финальное подтверждение администратора."
                  : "Администратор может сразу финально подтвердить ремонт или вернуть его в ручную проверку."
                : "Сотрудник подтверждает ремонт по своей технике. После этого запись остаётся предварительной и ждёт финального подтверждения администратора."}
            </Typography>
          </Box>
          <Typography className="muted-copy">
            Текущие причины: {selectedReviewItem.issue_titles.slice(0, 4).join(", ")}
            {selectedReviewItem.issue_titles.length > 4 ? ` и ещё ${selectedReviewItem.issue_titles.length - 4}` : ""}
          </Typography>
          {selectedRepairDocument ? (
            <Grid container spacing={2}>
              <Grid item xs={12} lg={6}>
                <ReviewDocumentPreviewPanel
                  document={selectedRepairDocument}
                  reviewDocumentPreviewLoading={reviewDocumentPreviewLoading}
                  reviewDocumentPreviewKind={reviewDocumentPreviewKind}
                  reviewDocumentPreviewUrl={reviewDocumentPreviewUrl}
                  documentOpenLoadingId={documentOpenLoadingId}
                  onOpenDocument={onOpenDocumentFile}
                  formatDocumentKind={formatDocumentKind}
                  statusColor={statusColor}
                  formatDocumentStatusLabel={formatDocumentStatusLabel}
                  formatDateTime={formatDateTime}
                  formatSourceTypeLabel={formatSourceTypeLabel}
                  formatConfidence={formatConfidence}
                />
              </Grid>
              <Grid item xs={12} lg={6}>
                <Stack spacing={1.5}>
                  {canLinkVehicleFromSelectedDocument ? (
                    <ReviewVehicleLinkPanel
                      plateNumber={
                        selectedRepairDocumentExtractedFields?.plate_number
                          ? String(selectedRepairDocumentExtractedFields.plate_number)
                          : null
                      }
                      vin={selectedRepairDocumentExtractedFields?.vin ? String(selectedRepairDocumentExtractedFields.vin) : null}
                      reviewVehicleSearch={reviewVehicleSearch}
                      reviewVehicleSearchLoading={reviewVehicleSearchLoading}
                      reviewVehicleLinkingId={reviewVehicleLinkingId}
                      reviewVehicleSearchResults={reviewVehicleSearchResults}
                      userRole={userRole}
                      onSearchChange={onSearchVehicleChange}
                      onSearch={onSearchVehicles}
                      onLinkVehicle={onLinkVehicle}
                      formatVehicle={formatVehicle}
                      formatVehicleTypeLabel={formatVehicleTypeLabel}
                    />
                  ) : null}

                  <ReviewServicePanel
                    currentServiceName={selectedRepair?.service?.name || null}
                    ocrServiceName={selectedRepairDocumentOcrServiceName}
                    reviewServiceName={reviewServiceName}
                    services={services}
                    reviewServiceAssigning={reviewServiceAssigning}
                    reviewServiceSaving={reviewServiceSaving}
                    reviewFieldSaving={reviewFieldSaving}
                    reviewVehicleLinking={reviewVehicleLinkingId !== null}
                    showReviewServiceEditor={showReviewServiceEditor}
                    reviewServiceForm={reviewServiceForm}
                    userRole={userRole}
                    onServiceNameChange={onServiceNameChange}
                    onAssign={onAssignService}
                    onToggleCreate={onToggleServiceCreate}
                    onClear={onClearService}
                    onFormChange={onServiceFormChange}
                    onCreate={onCreateService}
                  />

                  <ReviewRequiredFieldsPanel
                    canConfirmSelectedReview={canConfirmSelectedReview}
                    reviewReadyFieldsCount={reviewReadyFieldsCount}
                    reviewRequiredFieldComparisons={reviewRequiredFieldComparisons}
                    reviewFieldSaving={reviewFieldSaving}
                    showReviewFieldEditor={showReviewFieldEditor}
                    reviewFieldDraft={reviewFieldDraft}
                    reviewMissingRequiredFields={reviewMissingRequiredFields}
                    onToggleEditor={onToggleFieldEditor}
                    onFillFromOcr={onFillFieldsFromOcr}
                    onDraftChange={onReviewFieldDraftChange}
                    onSave={onSaveReviewFields}
                    getReviewComparisonColor={getReviewComparisonColor}
                    getReviewComparisonLabel={getReviewComparisonLabel}
                    getConfidenceColor={getConfidenceColor}
                    formatConfidenceLabel={formatConfidenceLabel}
                  />

                  <ReviewExtractedDataPanel
                    selectedRepairDocumentFieldSnapshots={selectedRepairDocumentFieldSnapshots}
                    selectedRepairDocumentExtractedFields={selectedRepairDocumentExtractedFields}
                    selectedRepairDocumentOcrServiceName={selectedRepairDocumentOcrServiceName}
                    selectedRepairDocumentPayload={selectedRepairDocumentPayload}
                    selectedRepairDocumentWorks={selectedRepairDocumentWorks}
                    selectedRepairDocumentParts={selectedRepairDocumentParts}
                    getConfidenceColor={getConfidenceColor}
                    formatConfidenceLabel={formatConfidenceLabel}
                    formatMoney={formatMoney}
                    formatCompactNumber={formatCompactNumber}
                    formatHours={formatHours}
                    formatManualReviewReasons={formatManualReviewReasons}
                    formatOcrProfileMeta={formatOcrProfileMeta}
                    formatLaborNormApplicability={formatLaborNormApplicability}
                    readStringValue={readStringValue}
                    readNumberValue={readNumberValue}
                    formatOcrLineUnit={formatOcrLineUnit}
                  />
                </Stack>
              </Grid>
            </Grid>
          ) : null}
          <ReviewActionsPanel
            userRole={userRole}
            reviewActionComment={reviewActionComment}
            reviewActionLoading={reviewActionLoading}
            reviewServiceAssigning={reviewServiceAssigning}
            reviewServiceSaving={reviewServiceSaving}
            reviewFieldSaving={reviewFieldSaving}
            reviewVehicleLinking={reviewVehicleLinkingId !== null}
            canConfirmSelectedReview={canConfirmSelectedReview}
            onCommentChange={onReviewActionCommentChange}
            onConfirm={onConfirm}
            onSendToReview={onSendToReview}
          />
        </Stack>
      </Paper>

      {canCreateVehicleFromSelectedDocument && !isEditingRepair ? (
        <DocumentVehicleCreatePanel
          documentVehicleForm={documentVehicleForm}
          documentVehicleSaving={documentVehicleSaving}
          ocrPlateNumber={
            selectedRepairDocumentExtractedFields?.plate_number
              ? String(selectedRepairDocumentExtractedFields.plate_number)
              : null
          }
          ocrVin={selectedRepairDocumentExtractedFields?.vin ? String(selectedRepairDocumentExtractedFields.vin) : null}
          onFormChange={onDocumentVehicleFormChange}
          onCreate={onCreateVehicle}
          formatVehicleTypeLabel={formatVehicleTypeLabel}
        />
      ) : null}
    </>
  );
}
