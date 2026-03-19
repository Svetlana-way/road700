import { Box, Button, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";

type AdminTab = "services" | "control" | "labor_norms" | "imports" | "employees" | "backups";

type AdminWorkspacePanelProps = {
  activeAdminTab: AdminTab;
  description: string;
  onAdminTabChange: (value: AdminTab) => void;
  onOpenTechAdmin: () => void;
};

export function AdminWorkspacePanel({
  activeAdminTab,
  description,
  onAdminTabChange,
  onOpenTechAdmin,
}: AdminWorkspacePanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Box>
            <Typography variant="h5">Администрирование</Typography>
            <Typography className="muted-copy">
              Основные справочники и правила системы разнесены по отдельным вкладкам.
            </Typography>
          </Box>
          <Button variant="outlined" onClick={onOpenTechAdmin}>
            Открыть тех. админку
          </Button>
        </Stack>
        <Tabs
          value={activeAdminTab}
          onChange={(_event, value: AdminTab) => onAdminTabChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab label="Сотрудники" value="employees" />
          <Tab label="Сервисы" value="services" />
          <Tab label="Резервные копии" value="backups" />
          <Tab label="Контроль" value="control" />
          <Tab label="Нормо-часы" value="labor_norms" />
          <Tab label="Импорт истории" value="imports" />
        </Tabs>
        <Typography className="muted-copy">{description}</Typography>
      </Stack>
    </Paper>
  );
}
