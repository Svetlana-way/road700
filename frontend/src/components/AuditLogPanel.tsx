import type { ReactNode } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

type AuditLogItem = {
  id: number;
  created_at: string;
  user_id: number | null;
  user_name: string | null;
  entity_type: string;
  entity_id: string;
  action_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

type AuditUserOption = {
  id: number;
  full_name: string;
};

type AuditLogPanelProps = {
  userRole: "admin" | "employee" | null | undefined;
  auditSearchQuery: string;
  auditEntityTypeFilter: string;
  auditActionTypeFilter: string;
  auditUserIdFilter: string;
  auditDateFrom: string;
  auditDateTo: string;
  auditEntityTypes: string[];
  auditActionTypes: string[];
  users: AuditUserOption[];
  auditLogLoading: boolean;
  auditLogItems: AuditLogItem[];
  auditLogTotal: number;
  onAuditSearchQueryChange: (value: string) => void;
  onAuditEntityTypeFilterChange: (value: string) => void;
  onAuditActionTypeFilterChange: (value: string) => void;
  onAuditUserIdFilterChange: (value: string) => void;
  onAuditDateFromChange: (value: string) => void;
  onAuditDateToChange: (value: string) => void;
  onRefresh: () => void;
  onReset: () => void;
  formatAuditEntityLabel: (value: string | null | undefined) => string;
  formatHistoryActionLabel: (value: string) => string;
  formatDateTime: (value: string) => string;
  renderEntryDetails: (entry: AuditLogItem) => ReactNode;
};

export function AuditLogPanel({
  userRole,
  auditSearchQuery,
  auditEntityTypeFilter,
  auditActionTypeFilter,
  auditUserIdFilter,
  auditDateFrom,
  auditDateTo,
  auditEntityTypes,
  auditActionTypes,
  users,
  auditLogLoading,
  auditLogItems,
  auditLogTotal,
  onAuditSearchQueryChange,
  onAuditEntityTypeFilterChange,
  onAuditActionTypeFilterChange,
  onAuditUserIdFilterChange,
  onAuditDateFromChange,
  onAuditDateToChange,
  onRefresh,
  onReset,
  formatAuditEntityLabel,
  formatHistoryActionLabel,
  formatDateTime,
  renderEntryDetails,
}: AuditLogPanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Журнал действий</Typography>
          <Typography className="muted-copy">
            История изменений по ремонтам, документам, технике, импорту и пользовательским операциям.
          </Typography>
        </Box>
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={3}>
            <TextField
              label="Поиск по сущности, ID или действию"
              value={auditSearchQuery}
              onChange={(event) => onAuditSearchQueryChange(event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              label="Сущность"
              value={auditEntityTypeFilter}
              onChange={(event) => onAuditEntityTypeFilterChange(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Все</MenuItem>
              {auditEntityTypes.map((value) => (
                <MenuItem key={`audit-entity-${value}`} value={value}>
                  {formatAuditEntityLabel(value)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              label="Действие"
              value={auditActionTypeFilter}
              onChange={(event) => onAuditActionTypeFilterChange(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Все</MenuItem>
              {auditActionTypes.map((value) => (
                <MenuItem key={`audit-action-${value}`} value={value}>
                  {formatHistoryActionLabel(value)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {userRole === "admin" ? (
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Пользователь"
                value={auditUserIdFilter}
                onChange={(event) => onAuditUserIdFilterChange(event.target.value)}
                fullWidth
              >
                <MenuItem value="">Все</MenuItem>
                {users.map((item) => (
                  <MenuItem key={`audit-user-${item.id}`} value={String(item.id)}>
                    {item.full_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          ) : null}
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="От"
              type="date"
              value={auditDateFrom}
              onChange={(event) => onAuditDateFromChange(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="До"
              type="date"
              value={auditDateTo}
              onChange={(event) => onAuditDateToChange(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
        </Grid>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" disabled={auditLogLoading} onClick={onRefresh}>
            {auditLogLoading ? "Загрузка..." : "Обновить журнал"}
          </Button>
          <Button variant="text" disabled={auditLogLoading} onClick={onReset}>
            Сбросить фильтр
          </Button>
        </Stack>
        <Typography className="muted-copy">Показано {auditLogItems.length} из {auditLogTotal}</Typography>

        {auditLogLoading ? (
          <Stack spacing={1} alignItems="center" className="repair-placeholder">
            <CircularProgress size={24} />
            <Typography className="muted-copy">Загрузка журнала действий...</Typography>
          </Stack>
        ) : auditLogItems.length > 0 ? (
          <Stack spacing={1}>
            {auditLogItems.map((entry) => (
              <Paper className="repair-line" key={`audit-log-${entry.id}`} elevation={0}>
                <Stack spacing={1}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Box>
                      <Typography>
                        {entry.user_name || "Система"} · {formatHistoryActionLabel(entry.action_type)}
                      </Typography>
                      <Typography className="muted-copy">
                        {formatAuditEntityLabel(entry.entity_type)} #{entry.entity_id}
                      </Typography>
                    </Box>
                    <Typography className="muted-copy">{formatDateTime(entry.created_at)}</Typography>
                  </Stack>
                  {renderEntryDetails(entry)}
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography className="muted-copy">По текущему фильтру событий нет.</Typography>
        )}
      </Stack>
    </Paper>
  );
}
