import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import type {
  DashboardDataQuality,
  DashboardDataQualityDetails,
  DocumentStatus,
  UserRole,
} from "../shared/workspaceBootstrapTypes";

type QualityDetailTab = "documents" | "services" | "works" | "parts" | "conflicts";
type DashboardVisualTone = "blue" | "amber" | "red" | "green";

type DashboardVisualBar = {
  label: string;
  value: number;
  hint?: string;
  tone: DashboardVisualTone;
};

type DataQualityOverviewPanelProps = {
  dataQuality: DashboardDataQuality | null;
  qualityCards: Array<{ key: keyof DashboardDataQuality; label: string }>;
  repairVisualBars: DashboardVisualBar[];
  repairVisualMax: number;
  qualityVisualBars: DashboardVisualBar[];
  qualityVisualMax: number;
  attentionVisualBars: DashboardVisualBar[];
  attentionVisualMax: number;
  topAttentionServices: DashboardDataQualityDetails["services"];
  dataQualityDetails: DashboardDataQualityDetails | null;
  showQualityDialog: boolean;
  activeQualityTab: QualityDetailTab;
  userRole?: UserRole;
  onOpenQualityDialog: () => void;
  onCloseQualityDialog: () => void;
  onQualityTabChange: (value: QualityDetailTab) => void;
  onOpenQualityRepair: (documentId: number | null, repairId: number | null) => void;
  onOpenQualityService: (name: string) => void;
  onOpenImportConflict: (conflictId: number) => void;
  buildDashboardVisualBarWidth: (value: number, maxValue: number) => string;
  formatConfidence: (value: number | null) => string;
  formatMoney: (value: number | null | undefined) => string | null;
  formatQualityVehicle: (vehicle: { plate_number: string | null; brand: string | null; model: string | null }) => string;
  statusColor: (status: DocumentStatus) => "default" | "success" | "error" | "warning";
  formatDocumentStatusLabel: (status: string) => string;
  formatRepairStatus: (status: string) => string;
  formatDateTime: (value: string) => string;
};

function VisualBarList({
  items,
  maxValue,
  buildWidth,
}: {
  items: DashboardVisualBar[];
  maxValue: number;
  buildWidth: (value: number, maxValue: number) => string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1}>
      {items.map((item) => (
        <Box key={item.label} className="dashboard-bar-row">
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Typography>{item.label}</Typography>
            <Typography className="dashboard-bar-value">{item.value}</Typography>
          </Stack>
          <Box className="dashboard-bar-track">
            <Box className={`dashboard-bar-fill tone-${item.tone}`} sx={{ width: buildWidth(item.value, maxValue) }} />
          </Box>
          {item.hint ? <Typography className="muted-copy">{item.hint}</Typography> : null}
        </Box>
      ))}
    </Stack>
  );
}

export function DataQualityOverviewPanel({
  dataQuality,
  qualityCards,
  repairVisualBars,
  repairVisualMax,
  qualityVisualBars,
  qualityVisualMax,
  attentionVisualBars,
  attentionVisualMax,
  topAttentionServices,
  dataQualityDetails,
  showQualityDialog,
  activeQualityTab,
  userRole,
  onOpenQualityDialog,
  onCloseQualityDialog,
  onQualityTabChange,
  onOpenQualityRepair,
  onOpenQualityService,
  onOpenImportConflict,
  buildDashboardVisualBarWidth,
  formatConfidence,
  formatMoney,
  formatQualityVehicle,
  statusColor,
  formatDocumentStatusLabel,
  formatRepairStatus,
  formatDateTime,
}: DataQualityOverviewPanelProps) {
  const totalAttentionItems =
    (dataQualityDetails?.counts.documents || 0) +
    (dataQualityDetails?.counts.services || 0) +
    (dataQualityDetails?.counts.works || 0) +
    (dataQualityDetails?.counts.parts || 0) +
    (dataQualityDetails?.counts.conflicts || 0);

  return (
    <>
      <Paper className="workspace-panel" elevation={0}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5">Качество данных</Typography>
            <Typography className="muted-copy">
              Контроль OCR, очереди проверки, предварительных справочников и конфликтов импорта.
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} lg={3}>
              <Paper className="metric-card" elevation={0}>
                <Typography className="metric-label">Средняя уверенность OCR</Typography>
                <Typography variant="h3">{dataQuality ? formatConfidence(dataQuality.average_ocr_confidence) : "—"}</Typography>
              </Paper>
            </Grid>
            {qualityCards.map((card) => (
              <Grid item xs={12} sm={6} lg={3} key={card.key}>
                <Paper className="metric-card" elevation={0}>
                  <Typography className="metric-label">{card.label}</Typography>
                  <Typography variant="h3">{dataQuality ? dataQuality[card.key] : "—"}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Paper>

      <Paper className="workspace-panel" elevation={0}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5">Визуальные дашборды</Typography>
            <Typography className="muted-copy">
              Наглядная картина по ремонтам, качеству OCR и точкам накопления ручной работы.
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} lg={4}>
              <Paper className="dashboard-visual-card" elevation={0}>
                <Stack spacing={1.25}>
                  <Box>
                    <Typography className="metric-label">Ремонтный контур</Typography>
                    <Typography variant="h6">Статусы и поток документов</Typography>
                  </Box>
                  {repairVisualBars.length > 0 ? (
                    <VisualBarList items={repairVisualBars} maxValue={repairVisualMax} buildWidth={buildDashboardVisualBarWidth} />
                  ) : (
                    <Typography className="muted-copy">Данных для визуализации пока нет.</Typography>
                  )}
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Paper className="dashboard-visual-card" elevation={0}>
                <Stack spacing={1.25}>
                  <Box>
                    <Typography className="metric-label">OCR и контроль</Typography>
                    <Typography variant="h6">Качество распознавания</Typography>
                  </Box>
                  {qualityVisualBars.length > 0 ? (
                    <VisualBarList items={qualityVisualBars} maxValue={qualityVisualMax} buildWidth={buildDashboardVisualBarWidth} />
                  ) : (
                    <Typography className="muted-copy">Критичных сигналов OCR сейчас нет.</Typography>
                  )}
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Paper className="dashboard-visual-card" elevation={0}>
                <Stack spacing={1.25}>
                  <Box>
                    <Typography className="metric-label">Точки внимания</Typography>
                    <Typography variant="h6">Где копится разбор</Typography>
                  </Box>
                  {attentionVisualBars.length > 0 ? (
                    <VisualBarList items={attentionVisualBars} maxValue={attentionVisualMax} buildWidth={buildDashboardVisualBarWidth} />
                  ) : (
                    <Typography className="muted-copy">Нечего выносить в приоритетный разбор.</Typography>
                  )}
                  {topAttentionServices.length > 0 ? (
                    <Stack spacing={0.75}>
                      <Divider />
                      <Typography className="metric-label">Сервисы с накоплением ремонтов</Typography>
                      {topAttentionServices.map((item) => (
                        <Stack
                          key={`dashboard-service-${item.service_id}`}
                          direction="row"
                          justifyContent="space-between"
                          spacing={1}
                          alignItems="center"
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography>{item.name}</Typography>
                            <Typography className="muted-copy">
                              {item.city || "Город не указан"}
                              {item.last_repair_date ? ` · последний ремонт ${item.last_repair_date}` : ""}
                            </Typography>
                          </Box>
                          <Chip size="small" variant="outlined" label={`${item.repairs_total} ремонтов`} />
                        </Stack>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      <Paper className="workspace-panel" elevation={0}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5">Что требует внимания</Typography>
            <Typography className="muted-copy">
              Полный рабочий список скрыт с главной страницы и открывается по отдельной кнопке.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
            <Button
              variant="contained"
              color="warning"
              size="large"
              onClick={onOpenQualityDialog}
              sx={{
                minWidth: { xs: "100%", sm: 180 },
                whiteSpace: "nowrap",
                fontWeight: 800,
                textTransform: "none",
              }}
            >
              Внимание !!!
            </Button>
            <Typography className="muted-copy">Всего записей для разбора: {totalAttentionItems}</Typography>
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={showQualityDialog} onClose={onCloseQualityDialog} fullWidth maxWidth="lg">
        <DialogTitle>Внимание !!!</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography className="muted-copy">
              Детализация по проблемным документам, предварительным справочникам и конфликтам импорта.
            </Typography>
            <Tabs
              value={activeQualityTab}
              onChange={(_event, value: QualityDetailTab) => onQualityTabChange(value)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
            >
              <Tab label={`Документы · ${dataQualityDetails?.counts.documents || 0}`} value="documents" />
              <Tab label={`Сервисы · ${dataQualityDetails?.counts.services || 0}`} value="services" />
              <Tab label={`Работы · ${dataQualityDetails?.counts.works || 0}`} value="works" />
              <Tab label={`Материалы · ${dataQualityDetails?.counts.parts || 0}`} value="parts" />
              <Tab label={`Конфликты · ${dataQualityDetails?.counts.conflicts || 0}`} value="conflicts" />
            </Tabs>

            {activeQualityTab === "documents" ? (
              <Stack spacing={1.5}>
                {dataQualityDetails?.documents.length ? (
                  dataQualityDetails.documents.map((item) => (
                    <Paper className="repair-line" key={`quality-document-${item.document_id}`} elevation={0}>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography variant="subtitle1">{item.original_filename}</Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              size="small"
                              color={statusColor(item.document_status as DocumentStatus)}
                              label={formatDocumentStatusLabel(item.document_status)}
                            />
                            <Chip size="small" variant="outlined" label={`OCR ${formatConfidence(item.ocr_confidence)}`} />
                          </Stack>
                        </Stack>
                        <Typography className="muted-copy">
                          {formatQualityVehicle(item)}
                          {item.repair_date ? ` · ${item.repair_date}` : ""}
                          {item.repair_status ? ` · ${formatRepairStatus(item.repair_status)}` : ""}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!item.repair_id}
                            onClick={() => onOpenQualityRepair(item.document_id, item.repair_id)}
                          >
                            Открыть ремонт
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))
                ) : (
                  <Typography className="muted-copy">Сейчас проблемных документов в выборке нет.</Typography>
                )}
              </Stack>
            ) : null}

            {activeQualityTab === "services" ? (
              <Stack spacing={1.5}>
                {dataQualityDetails?.services.length ? (
                  dataQualityDetails.services.map((item) => (
                    <Paper className="repair-line" key={`quality-service-${item.service_id}`} elevation={0}>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography variant="subtitle1">{item.name}</Typography>
                          <Chip size="small" color="warning" label="Предварительный" />
                        </Stack>
                        <Typography className="muted-copy">
                          {[item.city, `ремонтов ${item.repairs_total}`, item.last_repair_date ? `последний ${item.last_repair_date}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </Typography>
                        {userRole === "admin" ? (
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button size="small" variant="outlined" onClick={() => onOpenQualityService(item.name)}>
                              Открыть в админке
                            </Button>
                          </Stack>
                        ) : null}
                      </Stack>
                    </Paper>
                  ))
                ) : (
                  <Typography className="muted-copy">Неподтверждённых сервисов в выборке нет.</Typography>
                )}
              </Stack>
            ) : null}

            {activeQualityTab === "works" ? (
              <Stack spacing={1.5}>
                {dataQualityDetails?.works.length ? (
                  dataQualityDetails.works.map((item) => (
                    <Paper className="repair-line" key={`quality-work-${item.work_id}`} elevation={0}>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography variant="subtitle1">{item.work_name}</Typography>
                          <Chip size="small" color="warning" label={formatMoney(item.line_total)} />
                        </Stack>
                        <Typography className="muted-copy">
                          {formatQualityVehicle(item)} · {item.repair_date} · ремонт #{item.repair_id}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!item.repair_id}
                            onClick={() => onOpenQualityRepair(item.document_id, item.repair_id)}
                          >
                            Открыть ремонт
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))
                ) : (
                  <Typography className="muted-copy">Неподтверждённых работ в выборке нет.</Typography>
                )}
              </Stack>
            ) : null}

            {activeQualityTab === "parts" ? (
              <Stack spacing={1.5}>
                {dataQualityDetails?.parts.length ? (
                  dataQualityDetails.parts.map((item) => (
                    <Paper className="repair-line" key={`quality-part-${item.part_id}`} elevation={0}>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography variant="subtitle1">{item.part_name}</Typography>
                          <Chip size="small" color="warning" label={formatMoney(item.line_total)} />
                        </Stack>
                        <Typography className="muted-copy">
                          {formatQualityVehicle(item)} · {item.repair_date} · ремонт #{item.repair_id}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!item.repair_id}
                            onClick={() => onOpenQualityRepair(item.document_id, item.repair_id)}
                          >
                            Открыть ремонт
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))
                ) : (
                  <Typography className="muted-copy">Неподтверждённых материалов в выборке нет.</Typography>
                )}
              </Stack>
            ) : null}

            {activeQualityTab === "conflicts" ? (
              <Stack spacing={1.5}>
                {dataQualityDetails?.conflicts.length ? (
                  dataQualityDetails.conflicts.map((item) => (
                    <Paper className="repair-line" key={`quality-conflict-${item.conflict_id}`} elevation={0}>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography variant="subtitle1">{item.entity_type}</Typography>
                          <Chip size="small" color="warning" label="Ожидает решения" />
                        </Stack>
                        <Typography className="muted-copy">
                          {[item.conflict_key, item.source_filename, formatQualityVehicle(item), item.created_at ? formatDateTime(item.created_at) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          {userRole === "admin" ? (
                            <Button size="small" variant="contained" onClick={() => onOpenImportConflict(item.conflict_id)}>
                              Разобрать конфликт
                            </Button>
                          ) : null}
                          {item.document_id && item.repair_id ? (
                            <Button size="small" variant="outlined" onClick={() => onOpenQualityRepair(item.document_id, item.repair_id)}>
                              Открыть ремонт
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    </Paper>
                  ))
                ) : (
                  <Typography className="muted-copy">Конфликтов импорта в выборке нет.</Typography>
                )}
              </Stack>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseQualityDialog}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
