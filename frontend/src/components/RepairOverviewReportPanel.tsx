import { Alert, Box, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import type { DocumentReport, RepairCheck, RepairDetail } from "../contracts/domain/repair";
import type { CheckSeverity } from "../shared/workspaceViewTypes";
import type { DocumentStatus } from "../contracts/domain/workspace";
import type { ReviewRequiredFieldComparisonItem } from "../shared/workspaceFormTypes";

type RepairOverviewReportPanelProps = {
  selectedRepair: Pick<
    RepairDetail,
    | "id"
    | "order_number"
    | "repair_date"
    | "mileage"
    | "work_total"
    | "parts_total"
    | "vat_total"
    | "grand_total"
    | "expected_total"
    | "status"
    | "works"
    | "parts"
    | "vehicle"
    | "service"
    | "executive_report"
  >;
  selectedRepairDocument: {
    id?: number;
    status: string;
    ocr_confidence: number | null;
  } | null;
  selectedDocumentReport: Pick<
    DocumentReport,
    | "report_document_filename"
    | "source_document_filename"
    | "is_primary_document"
    | "report_document_id"
    | "report_status"
    | "report_status_comment"
    | "workflow_status"
    | "workflow_comment"
    | "executive_report"
  > | null;
  selectedDocumentReportLoading: boolean;
  selectedRepairAwaitingOcr: boolean;
  selectedRepairUnresolvedChecksCount: number;
  selectedRepairHasBlockingFindings: boolean;
  reviewRequiredFieldComparisons: ReviewRequiredFieldComparisonItem[];
  selectedRepairComparisonAttentionCount: number;
  selectedRepairDocumentWorksCount: number;
  selectedRepairDocumentPartsCount: number;
  overviewRepairDocumentManualReviewReasons: string[];
  selectedRepairReportSections: Array<{
    key: string;
    title: string;
    checks: RepairCheck[];
  }>;
  showRepairOverviewDetails: boolean;
  onToggleShowDetails: () => void;
  onOpenLinkedRepair: (repairId: number) => void;
  isPlaceholderVehicle: (externalId: string | null | undefined) => boolean;
  formatVehicle: (vehicle: { id: number; plate_number: string | null; brand: string | null; model: string | null }) => string;
  formatRepairStatus: (status: string) => string;
  executiveRiskColor: (level: "low" | "medium" | "high") => "success" | "warning" | "error";
  formatExecutiveRiskLabel: (level: "low" | "medium" | "high") => string;
  statusColor: (status: DocumentStatus) => "default" | "success" | "error" | "warning";
  formatDocumentStatusLabel: (status: string) => string;
  formatCompactNumber: (value: number | null | undefined) => string | null;
  formatMoney: (value: number | null | undefined) => string | null;
  formatConfidence: (value: number | null) => string;
  formatManualReviewReasons: (reasons: string[]) => string;
  buildCheckPayloadDetails: (check: RepairCheck) => string[];
  getCheckLinkedRepairId: (check: RepairCheck) => number | null;
  checkSeverityColor: (severity: CheckSeverity) => "default" | "success" | "error" | "warning";
  formatStatus: (value: string) => string;
};

export function RepairOverviewReportPanel({
  selectedRepair,
  selectedRepairDocument,
  selectedDocumentReport,
  selectedDocumentReportLoading,
  selectedRepairAwaitingOcr,
  selectedRepairUnresolvedChecksCount,
  selectedRepairHasBlockingFindings,
  reviewRequiredFieldComparisons,
  selectedRepairComparisonAttentionCount,
  selectedRepairDocumentWorksCount,
  selectedRepairDocumentPartsCount,
  overviewRepairDocumentManualReviewReasons,
  selectedRepairReportSections,
  showRepairOverviewDetails,
  onToggleShowDetails,
  onOpenLinkedRepair,
  isPlaceholderVehicle,
  formatVehicle,
  formatRepairStatus,
  executiveRiskColor,
  formatExecutiveRiskLabel,
  statusColor,
  formatDocumentStatusLabel,
  formatCompactNumber,
  formatMoney,
  formatConfidence,
  formatManualReviewReasons,
  buildCheckPayloadDetails,
  getCheckLinkedRepairId,
  checkSeverityColor,
  formatStatus,
}: RepairOverviewReportPanelProps) {
  const executiveReport = selectedDocumentReport?.executive_report ?? selectedRepair.executive_report;
  const reportRefreshing =
    selectedDocumentReportLoading &&
    (selectedRepairDocument?.id ?? null) !== null &&
    selectedDocumentReport?.report_document_id !== (selectedRepairDocument?.id ?? null);
  const executiveFindingsCount = executiveReport.findings.length;
  const executiveHasBlockingFindings = executiveReport.findings.some((item) => item.severity === "high");
  const effectiveAttentionCount = Math.max(
    selectedRepairUnresolvedChecksCount,
    executiveFindingsCount,
    selectedRepairComparisonAttentionCount,
  );
  const effectiveHasBlockingFindings = selectedRepairHasBlockingFindings || executiveHasBlockingFindings;
  const vehicleMatched =
    !isPlaceholderVehicle(selectedRepair.vehicle.external_id) &&
    Boolean(selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || selectedRepair.vehicle.id);
  const serviceMatched = Boolean(selectedRepair.service?.name);
  const reportAlertSeverity = selectedRepairAwaitingOcr
    ? "info"
    : reportRefreshing
      ? "info"
    : effectiveAttentionCount === 0
      ? "success"
      : effectiveHasBlockingFindings
        ? "warning"
        : "info";
  const reportAlertText = selectedRepairAwaitingOcr
    ? "Документ ещё находится в очереди OCR или перепроверки. Итоговый отчёт будет обновлён автоматически."
    : reportRefreshing
      ? "Обновляем итоговый отчёт по выбранному документу."
    : effectiveAttentionCount === 0
      ? "По заказ-наряду открытых несоответствий не найдено."
      : "В отчёте есть несоответствия. Ниже они сгруппированы по типам проверки.";
  const conciseReportTitle = selectedRepairAwaitingOcr
    ? "Документ обрабатывается"
    : reportRefreshing
      ? "Отчёт обновляется"
      : executiveReport.headline;
  const overviewAttentionItems = reviewRequiredFieldComparisons.filter(
    (item) => item.status === "missing" || item.status === "mismatch",
  );
  const moneyDelta =
    selectedRepair.expected_total !== null ? selectedRepair.grand_total - selectedRepair.expected_total : null;
  const moneyDeltaRatio =
    selectedRepair.expected_total !== null && selectedRepair.expected_total > 0
      ? (moneyDelta! / selectedRepair.expected_total) * 100
      : null;
  const conciseExecutiveSummary = selectedRepairAwaitingOcr
    ? `Заказ-наряд ${selectedRepair.order_number || "без номера"} загружен. Документ еще проходит OCR, итог проверки появится автоматически после распознавания.`
    : reportRefreshing
      ? "Пересчитываем отчёт и несоответствия для выбранного документа."
      : executiveReport.summary;
  const conciseFacts =
    !reportRefreshing && executiveReport.highlights.length > 0
      ? executiveReport.highlights
      : [
          `Машина: ${vehicleMatched ? formatVehicle(selectedRepair.vehicle) : "не найдена в базе"}`,
          `Сервис: ${serviceMatched ? selectedRepair.service?.name : "не найден в справочнике"}`,
          `Проверка по базе, справочникам и истории: ${
            selectedRepairAwaitingOcr
              ? "ожидает завершения OCR"
              : effectiveAttentionCount === 0
                ? "замечаний нет"
              : `найдено ${effectiveAttentionCount} несоответствий`
          }`,
          `Структура заказ-наряда: работ ${selectedRepair.works.length}, запчастей ${selectedRepair.parts.length}`,
        ];
  const conciseFindings = selectedRepairAwaitingOcr || reportRefreshing ? [] : executiveReport.findings.slice(0, 4);
  const specialistDocumentName = selectedDocumentReport?.report_document_filename || "выбранный документ";
  const specialistSourceDocumentName = selectedDocumentReport?.source_document_filename || "не определён";
  const specialistUsesAlternateDocument =
    selectedDocumentReport !== null &&
    selectedDocumentReport.report_document_filename !== null &&
    selectedDocumentReport.source_document_filename !== null &&
    selectedDocumentReport.report_document_filename !== selectedDocumentReport.source_document_filename;
  const specialistReportStatusColor =
    selectedRepairAwaitingOcr || reportRefreshing
      ? "default"
      : effectiveHasBlockingFindings
        ? "warning"
        : effectiveAttentionCount > 0
          ? "default"
          : "success";
  const specialistWorkflowColor =
    selectedRepair.status === "confirmed"
      ? "success"
      : selectedRepair.status === "suspicious" || selectedRepair.status === "ocr_error"
        ? "warning"
        : "default";

  return (
    <Paper className="repair-summary" elevation={0}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Box>
            <Typography variant="h6">Итоговый отчёт по заказ-наряду</Typography>
            <Typography className="muted-copy">
              Сначала показываем простой итог. Полная расшифровка открывается по кнопке.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={formatRepairStatus(selectedRepair.status)} />
            <Chip
              size="small"
              color={executiveRiskColor(executiveReport.overall_risk)}
              label={formatExecutiveRiskLabel(executiveReport.overall_risk)}
            />
            {selectedRepairDocument ? (
              <Chip
                size="small"
                variant="outlined"
                color={statusColor(selectedRepairDocument.status as DocumentStatus)}
                label={`Документ: ${formatDocumentStatusLabel(selectedRepairDocument.status)}`}
              />
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              color={effectiveAttentionCount > 0 ? "warning" : "success"}
              label={
                effectiveAttentionCount > 0
                  ? `Несоответствий: ${effectiveAttentionCount}`
                  : "Несоответствий нет"
              }
            />
          </Stack>
        </Stack>

        <Paper className="repair-line" elevation={0}>
          <Stack spacing={1.25}>
            <Typography variant="subtitle1">Короткий вывод для руководителя</Typography>
            <Typography>{conciseExecutiveSummary}</Typography>
            <Typography className="muted-copy">{conciseReportTitle}</Typography>
            <Stack spacing={0.5}>
              {conciseFacts.map((line) => (
                <Typography className="muted-copy" key={line}>
                  {line}
                </Typography>
              ))}
            </Stack>
            {selectedRepairAwaitingOcr ? (
              <Stack spacing={0.5}>
                <Typography className="metric-label">Что требует внимания</Typography>
                <Typography className="muted-copy">Документ ещё проходит OCR или перепроверку.</Typography>
              </Stack>
            ) : conciseFindings.length > 0 ? (
              <Stack spacing={0.75}>
                <Typography className="metric-label">Что требует внимания</Typography>
                {conciseFindings.map((item, index) => (
                  <Paper
                    className="repair-line"
                    elevation={0}
                    key={`concise-finding-${index}`}
                    sx={{
                      borderLeft: 4,
                      borderLeftColor: (theme) => {
                        if (item.severity === "high") {
                          return theme.palette.error.main;
                        }
                        if (item.severity === "medium") {
                          return theme.palette.warning.main;
                        }
                        return theme.palette.success.main;
                      },
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Typography>{item.title}</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip size="small" variant="outlined" label={item.category} />
                          <Chip
                            size="small"
                            color={executiveRiskColor(item.severity)}
                            label={formatExecutiveRiskLabel(item.severity)}
                          />
                        </Stack>
                      </Stack>
                      <Typography className="muted-copy">{item.summary}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : null}
            <Box>
              <Button size="small" onClick={onToggleShowDetails}>
                {showRepairOverviewDetails ? "Скрыть подробности" : "Подробнее"}
              </Button>
            </Box>
          </Stack>
        </Paper>

        {showRepairOverviewDetails ? (
          <>
            <Alert severity={reportAlertSeverity}>{reportAlertText}</Alert>

            {executiveReport.full_report_sections.length > 0 ? (
              <Paper className="repair-line" elevation={0}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1">Развёрнутый отчёт для руководителя</Typography>
                  {executiveReport.full_report_sections.map((section) => (
                    <Stack spacing={0.75} key={`executive-full-section-${section.key}`}>
                      <Typography className="metric-label">{section.title}</Typography>
                      {section.items.map((line, index) => (
                        <Typography className="muted-copy" key={`executive-full-section-line-${section.key}-${index}`}>
                          {line}
                        </Typography>
                      ))}
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            ) : null}

            <Paper className="repair-line" elevation={0}>
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                >
                  <Box>
                    <Typography variant="subtitle1">{executiveReport.headline}</Typography>
                    <Typography className="muted-copy">{executiveReport.summary}</Typography>
                  </Box>
                  <Chip
                    size="small"
                    color={executiveRiskColor(executiveReport.overall_risk)}
                    label={formatExecutiveRiskLabel(executiveReport.overall_risk)}
                  />
                </Stack>
                {executiveReport.risk_matrix.length > 0 ? (
                  <Stack spacing={1}>
                    <Typography className="metric-label">Сводная оценка рисков</Typography>
                    {executiveReport.risk_matrix.map((item) => (
                      <Paper className="repair-line" elevation={0} key={`executive-risk-${item.zone}`}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Box>
                            <Typography>{item.zone}</Typography>
                            <Typography className="muted-copy">{item.comment}</Typography>
                          </Box>
                          <Chip
                            size="small"
                            color={executiveRiskColor(item.level)}
                            label={formatExecutiveRiskLabel(item.level)}
                          />
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : null}
                {executiveReport.findings.length > 0 ? (
                  <Stack spacing={1}>
                    <Typography className="metric-label">Подозрительные моменты и риски</Typography>
                    {executiveReport.findings.map((item, index) => (
                      <Paper className="repair-line" elevation={0} key={`executive-finding-${index}`}>
                        <Stack spacing={0.75}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                          >
                            <Typography>{item.title}</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Chip size="small" variant="outlined" label={item.category} />
                              <Chip
                                size="small"
                                color={executiveRiskColor(item.severity)}
                                label={formatExecutiveRiskLabel(item.severity)}
                              />
                            </Stack>
                          </Stack>
                          <Typography className="muted-copy">{item.summary}</Typography>
                          {item.rationale ? <Typography className="muted-copy">{item.rationale}</Typography> : null}
                          {item.evidence.length > 0 ? (
                            <Stack spacing={0.5}>
                              {item.evidence.map((line, evidenceIndex) => (
                                <Typography className="muted-copy" key={`executive-evidence-${index}-${evidenceIndex}`}>
                                  {line}
                                </Typography>
                              ))}
                            </Stack>
                          ) : null}
                          {item.recommendation ? (
                            <Typography className="muted-copy">Рекомендация: {item.recommendation}</Typography>
                          ) : null}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : null}
                {executiveReport.recommendations.length > 0 ? (
                  <Stack spacing={0.5}>
                    <Typography className="metric-label">Что рекомендовано сделать</Typography>
                    {executiveReport.recommendations.map((item, index) => (
                      <Typography className="muted-copy" key={`executive-recommendation-${index}`}>
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper className="repair-line" elevation={0}>
                  <Stack spacing={1}>
                    <Typography className="metric-label">Карточка заказ-наряда</Typography>
                    <Grid container spacing={1.25}>
                      <Grid item xs={12} sm={6}>
                        <Typography className="metric-label">Номер</Typography>
                        <Typography>{selectedRepair.order_number || "Не указан"}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography className="metric-label">Дата ремонта</Typography>
                        <Typography>{selectedRepair.repair_date || "—"}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography className="metric-label">Техника</Typography>
                        <Typography>{formatVehicle(selectedRepair.vehicle)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography className="metric-label">Сервис</Typography>
                        <Typography>{selectedRepair.service?.name || "Не назначен"}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography className="metric-label">Пробег</Typography>
                        <Typography>{selectedRepair.mileage > 0 ? formatCompactNumber(selectedRepair.mileage) : "—"}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography className="metric-label">OCR</Typography>
                        <Typography>
                          {selectedRepairDocument
                            ? `${formatDocumentStatusLabel(selectedRepairDocument.status)} · ${formatConfidence(selectedRepairDocument.ocr_confidence)}`
                            : "Документ не выбран"}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper className="repair-line" elevation={0}>
                  <Stack spacing={1}>
                    <Typography className="metric-label">Суммы</Typography>
                    <Grid container spacing={1.25}>
                      <Grid item xs={6}>
                        <Typography className="metric-label">Работы</Typography>
                        <Typography>{formatMoney(selectedRepair.work_total) || "—"}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography className="metric-label">Запчасти</Typography>
                        <Typography>{formatMoney(selectedRepair.parts_total) || "—"}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography className="metric-label">НДС</Typography>
                        <Typography>{formatMoney(selectedRepair.vat_total) || "—"}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography className="metric-label">Итого</Typography>
                        <Typography>{formatMoney(selectedRepair.grand_total) || "—"}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography className="metric-label">Работ</Typography>
                        <Typography>{formatCompactNumber(selectedRepair.works.length)}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography className="metric-label">Запчастей</Typography>
                        <Typography>{formatCompactNumber(selectedRepair.parts.length)}</Typography>
                      </Grid>
                      {selectedRepair.expected_total !== null ? (
                        <>
                          <Grid item xs={6}>
                            <Typography className="metric-label">Ожидаемая сумма</Typography>
                            <Typography>{formatMoney(selectedRepair.expected_total) || "—"}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography className="metric-label">Отклонение</Typography>
                            <Typography>
                              {moneyDelta !== null ? formatMoney(moneyDelta) : "—"}
                              {moneyDeltaRatio !== null
                                ? ` · ${moneyDelta! >= 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU", {
                                    maximumFractionDigits: 1,
                                  }).format(moneyDeltaRatio)}%`
                                : ""}
                            </Typography>
                          </Grid>
                        </>
                      ) : null}
                    </Grid>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>

            <Paper className="repair-line" elevation={0}>
              <Stack spacing={1.25}>
                <Box>
                  <Typography variant="subtitle1">Подробный отчёт для специалиста</Typography>
                  <Typography className="muted-copy">
                    Детализация проверки и OCR-сверки по выбранному документу перед подтверждением.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={specialistWorkflowColor}
                    label={`Workflow: ${selectedDocumentReport?.workflow_status || "не определён"}`}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    color={specialistReportStatusColor}
                    label={`Отчёт: ${selectedDocumentReport?.report_status || "не сформирован"}`}
                  />
                  {selectedRepairDocument ? (
                    <Chip
                      size="small"
                      variant="outlined"
                      color={statusColor(selectedRepairDocument.status as DocumentStatus)}
                      label={`Документ: ${formatDocumentStatusLabel(selectedRepairDocument.status)}`}
                    />
                  ) : null}
                  {selectedRepairDocument ? (
                    <Chip size="small" variant="outlined" label={`OCR ${formatConfidence(selectedRepairDocument.ocr_confidence)}`} />
                  ) : null}
                </Stack>
                <Stack spacing={0.5}>
                  <Typography className="muted-copy">Документ отчёта: {specialistDocumentName}.</Typography>
                  {specialistUsesAlternateDocument ? (
                    <Typography className="muted-copy">
                      Основной документ ремонта: {specialistSourceDocumentName}. Проверка ниже относится именно к выбранному документу.
                    </Typography>
                  ) : selectedDocumentReport?.is_primary_document ? (
                    <Typography className="muted-copy">Проверка строится по основному документу ремонта.</Typography>
                  ) : null}
                  {selectedDocumentReport?.workflow_comment ? (
                    <Typography className="muted-copy">Workflow: {selectedDocumentReport.workflow_comment}</Typography>
                  ) : null}
                  {selectedDocumentReport?.report_status_comment ? (
                    <Typography className="muted-copy">Статус отчёта: {selectedDocumentReport.report_status_comment}</Typography>
                  ) : null}
                </Stack>
              </Stack>
            </Paper>

            {selectedRepairDocument ? (
              <Paper className="repair-line" elevation={0}>
                <Stack spacing={1}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Typography className="metric-label">Сверка OCR и карточки ремонта</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" variant="outlined" label={`OCR ${formatConfidence(selectedRepairDocument.ocr_confidence)}`} />
                      <Chip
                        size="small"
                        color={selectedRepairComparisonAttentionCount > 0 ? "warning" : "success"}
                        label={
                          selectedRepairComparisonAttentionCount > 0
                            ? `Требует сверки: ${selectedRepairComparisonAttentionCount}`
                            : "Ключевые поля сверены"
                        }
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Строк: работ ${selectedRepairDocumentWorksCount}, запчастей ${selectedRepairDocumentPartsCount}`}
                      />
                    </Stack>
                  </Stack>
                  {overviewAttentionItems.length > 0 ? (
                    <Stack spacing={0.75}>
                      {overviewAttentionItems.map((item) => (
                        <Typography className="muted-copy" key={`overview-attention-${item.key}`}>
                          {item.label}: в ремонте {item.currentDisplay} · OCR {item.ocrDisplay}
                        </Typography>
                      ))}
                    </Stack>
                  ) : (
                    <Typography className="muted-copy">Ключевые поля OCR совпадают с подтверждёнными данными.</Typography>
                  )}
                  {overviewRepairDocumentManualReviewReasons.length > 0 ? (
                    <Typography className="muted-copy">
                      Ручная проверка OCR: {formatManualReviewReasons(overviewRepairDocumentManualReviewReasons)}.
                    </Typography>
                  ) : null}
                </Stack>
              </Paper>
            ) : null}

            {selectedRepairReportSections.length > 0 ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Замечания и проверки для специалиста</Typography>
                {selectedRepairReportSections.map((section) => (
                  <Stack spacing={1} key={`report-section-${section.key}`}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1">{section.title}</Typography>
                      <Chip size="small" variant="outlined" label={formatCompactNumber(section.checks.length)} />
                    </Stack>
                    {section.checks.map((check) => {
                      const payloadDetails = buildCheckPayloadDetails(check);
                      const linkedRepairId = getCheckLinkedRepairId(check);
                      return (
                        <Paper className="repair-line" elevation={0} key={`report-check-${check.id}`}>
                          <Stack spacing={0.75}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              justifyContent="space-between"
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                            >
                              <Typography>{check.title}</Typography>
                              <Chip size="small" color={checkSeverityColor(check.severity)} label={formatStatus(check.severity)} />
                            </Stack>
                            {check.details ? <Typography className="muted-copy">{check.details}</Typography> : null}
                            {payloadDetails.length > 0 ? (
                              <Stack spacing={0.5}>
                                {payloadDetails.slice(0, 3).map((line, index) => (
                                  <Typography className="muted-copy" key={`report-check-payload-${check.id}-${index}`}>
                                    {line}
                                  </Typography>
                                ))}
                              </Stack>
                            ) : null}
                            {linkedRepairId !== null ? (
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button size="small" variant="text" onClick={() => onOpenLinkedRepair(linkedRepairId)}>
                                  Открыть предыдущий ремонт
                                </Button>
                              </Stack>
                            ) : null}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                ))}
              </Stack>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}
