import { type ReactNode } from "react";
import { Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";

type CheckSeverity = "normal" | "warning" | "suspicious" | "error";
type DocumentKind = "order" | "repeat_scan" | "attachment" | "confirmation";
type HistoryFilter = "all" | "repair" | "documents" | "uploads" | "primary" | "comparison";
type RepairTab = "overview" | "works" | "parts" | "documents" | "checks" | "history";

type RepairDetail = {
  works: Array<{
    id: number;
    work_code: string | null;
    work_name: string;
    quantity: number;
    standard_hours: number | null;
    actual_hours: number | null;
    price: number;
    line_total: number;
    status: string;
    reference_payload: Record<string, unknown> | null;
  }>;
  parts: Array<{
    id: number;
    article: string | null;
    part_name: string;
    quantity: number;
    unit_name: string | null;
    line_total: number;
  }>;
  checks: Array<{
    id: number;
    check_type: string;
    severity: CheckSeverity;
    title: string;
    details: string | null;
    calculation_payload: Record<string, unknown> | null;
    is_resolved: boolean;
    created_at: string;
  }>;
  document_history: Array<{
    id: number;
    action_type: string;
    created_at: string;
    user_name: string | null;
    document_id: number | null;
    document_filename: string | null;
    document_kind: DocumentKind | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
  }>;
  history: Array<{
    id: number;
    action_type: string;
    created_at: string;
    user_name: string | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
  }>;
};

type RepairReadOnlySectionsProps = {
  activeRepairTab: RepairTab;
  selectedRepair: RepairDetail;
  filteredDocumentHistory: RepairDetail["document_history"];
  filteredRepairHistory: RepairDetail["history"];
  historySearch: string;
  historyFilter: HistoryFilter;
  historyFilters: Array<{ key: HistoryFilter; label: string }>;
  checkComments: Record<number, string>;
  checkActionLoadingId: number | null;
  onHistorySearchChange: (value: string) => void;
  onHistoryFilterChange: (value: HistoryFilter) => void;
  onCheckCommentChange: (checkId: number, value: string) => void;
  onCheckResolution: (checkId: number, isResolved: boolean) => void;
  onOpenLinkedRepair: (repairId: number) => void;
  formatMoney: (value: number | null | undefined) => string | null;
  formatHours: (value: number | null | undefined) => string | null;
  formatStatus: (value: string) => string;
  formatWorkLaborNormMeta: (item: RepairDetail["works"][number]) => string | null;
  buildCheckPayloadDetails: (check: RepairDetail["checks"][number]) => string[];
  getCheckLinkedRepairId: (check: RepairDetail["checks"][number]) => number | null;
  checkSeverityColor: (severity: CheckSeverity) => "default" | "success" | "error" | "warning";
  readCheckResolutionMeta: (check: RepairDetail["checks"][number]) => {
    user_name?: string | null;
    resolved_at?: string | null;
    comment?: string | null;
  } | null;
  formatDateTime: (value: string) => string;
  formatHistoryActionLabel: (actionType: string) => string;
  formatDocumentKind: (value: DocumentKind) => string;
  buildDocumentHistoryDetails: (entry: RepairDetail["document_history"][number]) => string[];
  buildRepairHistoryDetails: (entry: RepairDetail["history"][number]) => string[];
  renderHistoryDetails: (entryKey: string, lines: string[]) => ReactNode;
};

export function RepairReadOnlySections({
  activeRepairTab,
  selectedRepair,
  filteredDocumentHistory,
  filteredRepairHistory,
  historySearch,
  historyFilter,
  historyFilters,
  checkComments,
  checkActionLoadingId,
  onHistorySearchChange,
  onHistoryFilterChange,
  onCheckCommentChange,
  onCheckResolution,
  onOpenLinkedRepair,
  formatMoney,
  formatHours,
  formatStatus,
  formatWorkLaborNormMeta,
  buildCheckPayloadDetails,
  getCheckLinkedRepairId,
  checkSeverityColor,
  readCheckResolutionMeta,
  formatDateTime,
  formatHistoryActionLabel,
  formatDocumentKind,
  buildDocumentHistoryDetails,
  buildRepairHistoryDetails,
  renderHistoryDetails,
}: RepairReadOnlySectionsProps) {
  return (
    <>
      {activeRepairTab === "works" ? (
        <Stack spacing={1}>
          <Typography variant="h6">Работы</Typography>
          {selectedRepair.works.length > 0 ? (
            selectedRepair.works.map((item) => (
              <Paper className="repair-line" key={item.id} elevation={0}>
                <Stack spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography>{item.work_name}</Typography>
                      <Typography className="muted-copy">
                        {item.work_code ? `${item.work_code} · ` : ""}
                        Кол-во {item.quantity}
                        {formatHours(item.standard_hours) ? ` · норма ${formatHours(item.standard_hours)}` : ""}
                        {formatHours(item.actual_hours) ? ` · факт ${formatHours(item.actual_hours)}` : ""}
                      </Typography>
                    </Box>
                    <Typography>{formatMoney(item.line_total) || "—"}</Typography>
                  </Stack>
                  {formatWorkLaborNormMeta(item) ? <Typography className="muted-copy">{formatWorkLaborNormMeta(item)}</Typography> : null}
                </Stack>
              </Paper>
            ))
          ) : (
            <Typography className="muted-copy">Строки работ не распознаны.</Typography>
          )}
        </Stack>
      ) : null}

      {activeRepairTab === "parts" ? (
        <Stack spacing={1}>
          <Typography variant="h6">Запчасти</Typography>
          {selectedRepair.parts.length > 0 ? (
            selectedRepair.parts.map((item) => (
              <Paper className="repair-line" key={item.id} elevation={0}>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography>{item.part_name}</Typography>
                    <Typography className="muted-copy">
                      {item.article ? `${item.article} · ` : ""}
                      {item.quantity} {item.unit_name || "шт"}
                    </Typography>
                  </Box>
                  <Typography>{formatMoney(item.line_total) || "—"}</Typography>
                </Stack>
              </Paper>
            ))
          ) : (
            <Typography className="muted-copy">Строки запчастей не распознаны.</Typography>
          )}
        </Stack>
      ) : null}

      {activeRepairTab === "checks" ? (
        <Stack spacing={1}>
          <Typography variant="h6">Проверки</Typography>
          {selectedRepair.checks.length > 0 ? (
            selectedRepair.checks.map((check) => {
              const payloadDetails = buildCheckPayloadDetails(check);
              const linkedRepairId = getCheckLinkedRepairId(check);
              const resolutionMeta = readCheckResolutionMeta(check);

              return (
                <Paper className="repair-line" key={check.id} elevation={0}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                      <Typography>{check.title}</Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip size="small" color={checkSeverityColor(check.severity)} label={formatStatus(check.severity)} />
                        <Chip size="small" color={check.is_resolved ? "success" : "default"} label={check.is_resolved ? "решено" : "открыто"} />
                      </Stack>
                    </Stack>
                    {check.details ? <Typography className="muted-copy">{check.details}</Typography> : null}
                    {payloadDetails.length > 0 ? (
                      <Stack spacing={0.5}>
                        {payloadDetails.map((line, index) => (
                          <Typography className="muted-copy" key={`check-payload-${check.id}-${index}`}>
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
                    {resolutionMeta?.user_name ? (
                      <Typography className="muted-copy">
                        Последнее действие: {resolutionMeta.user_name}
                        {resolutionMeta.resolved_at ? ` · ${formatDateTime(String(resolutionMeta.resolved_at))}` : ""}
                        {resolutionMeta.comment ? ` · ${String(resolutionMeta.comment)}` : ""}
                      </Typography>
                    ) : null}
                    <TextField
                      label="Комментарий по проверке"
                      value={checkComments[check.id] || ""}
                      onChange={(event) => onCheckCommentChange(check.id, event.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={checkActionLoadingId === check.id || check.is_resolved}
                        onClick={() => onCheckResolution(check.id, true)}
                      >
                        {checkActionLoadingId === check.id ? "Сохранение..." : "Закрыть проверку"}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={checkActionLoadingId === check.id || !check.is_resolved}
                        onClick={() => onCheckResolution(check.id, false)}
                      >
                        Вернуть в работу
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })
          ) : (
            <Typography className="muted-copy">Подозрительные проверки не найдены.</Typography>
          )}
        </Stack>
      ) : null}

      {activeRepairTab === "history" ? (
        <Stack spacing={1}>
          <Typography variant="h6">Журнал событий</Typography>
          <TextField label="Поиск по истории" value={historySearch} onChange={(event) => onHistorySearchChange(event.target.value)} fullWidth />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {historyFilters.map((filter) => (
              <Chip
                key={filter.key}
                label={filter.label}
                color={historyFilter === filter.key ? "primary" : "default"}
                variant={historyFilter === filter.key ? "filled" : "outlined"}
                onClick={() => onHistoryFilterChange(filter.key)}
              />
            ))}
          </Stack>
          <Typography className="muted-copy">Найдено событий: {filteredDocumentHistory.length + filteredRepairHistory.length}</Typography>
        </Stack>
      ) : null}

      {activeRepairTab === "history" ? (
        <Stack spacing={1}>
          <Typography variant="h6">История по документам</Typography>
          {filteredDocumentHistory.length > 0 ? (
            filteredDocumentHistory.map((entry) => (
              <Paper className="repair-line" key={`document-history-${entry.id}`} elevation={0}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                    <Typography>
                      {entry.user_name || "Система"} · {formatHistoryActionLabel(entry.action_type)}
                    </Typography>
                    <Typography className="muted-copy">{formatDateTime(entry.created_at)}</Typography>
                  </Stack>
                  <Typography className="muted-copy">
                    {entry.document_filename || "Документ"}
                    {entry.document_kind ? ` · ${formatDocumentKind(entry.document_kind)}` : ""}
                  </Typography>
                  {renderHistoryDetails(`document-${entry.id}`, buildDocumentHistoryDetails(entry))}
                </Stack>
              </Paper>
            ))
          ) : (
            <Typography className="muted-copy">По текущему фильтру событий по документам нет.</Typography>
          )}
        </Stack>
      ) : null}

      {activeRepairTab === "history" ? (
        <Stack spacing={1}>
          <Typography variant="h6">История изменений</Typography>
          {filteredRepairHistory.length > 0 ? (
            filteredRepairHistory.map((entry) => (
              <Paper className="repair-line" key={entry.id} elevation={0}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                    <Typography>
                      {entry.user_name || "Система"} · {formatHistoryActionLabel(entry.action_type)}
                    </Typography>
                    <Typography className="muted-copy">{formatDateTime(entry.created_at)}</Typography>
                  </Stack>
                  {renderHistoryDetails(`repair-${entry.id}`, buildRepairHistoryDetails(entry))}
                </Stack>
              </Paper>
            ))
          ) : (
            <Typography className="muted-copy">По текущему фильтру событий по ремонту нет.</Typography>
          )}
        </Stack>
      ) : null}
    </>
  );
}
