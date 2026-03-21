import { lazy, Suspense, type ComponentProps } from "react";
import { CircularProgress, Grid, Paper, Stack, Typography } from "@mui/material";
const WorkspaceDocumentsPanel = lazy(() =>
  import("./WorkspaceDocumentsPanel").then((module) => ({ default: module.WorkspaceDocumentsPanel })),
);
const RepairWorkspacePanel = lazy(() =>
  import("./RepairWorkspacePanel").then((module) => ({ default: module.RepairWorkspacePanel })),
);
const WorkspaceAdminPanels = lazy(() =>
  import("./WorkspaceAdminPanels").then((module) => ({ default: module.WorkspaceAdminPanels })),
);
const WorkspaceOperationsPanels = lazy(() =>
  import("./WorkspaceOperationsPanels").then((module) => ({ default: module.WorkspaceOperationsPanels })),
);

type WorkspaceTab = "documents" | "repair" | "admin" | "tech_admin" | "fleet" | "search" | "audit";

type WorkspaceDocumentsPanelProps = ComponentProps<(typeof import("./WorkspaceDocumentsPanel"))["WorkspaceDocumentsPanel"]>;
type WorkspaceAdminPanelsProps = ComponentProps<(typeof import("./WorkspaceAdminPanels"))["WorkspaceAdminPanels"]>;
type RepairWorkspacePanelProps = ComponentProps<(typeof import("./RepairWorkspacePanel"))["RepairWorkspacePanel"]>;
type WorkspaceOperationsPanelsProps = ComponentProps<(typeof import("./WorkspaceOperationsPanels"))["WorkspaceOperationsPanels"]>;

type WorkspaceContentPanelsProps = {
  activeWorkspaceTab: WorkspaceTab;
  documentsProps: WorkspaceDocumentsPanelProps;
  adminProps: WorkspaceAdminPanelsProps;
  repairProps: RepairWorkspacePanelProps;
  operationsProps: WorkspaceOperationsPanelsProps;
};

function WorkspaceSectionFallback({ label }: { label: string }) {
  return (
    <Paper className="loading-panel" elevation={0}>
      <Stack spacing={1.5} alignItems="center">
        <CircularProgress size={24} />
        <Typography>{label}</Typography>
      </Stack>
    </Paper>
  );
}

export function WorkspaceContentPanels({
  activeWorkspaceTab,
  documentsProps,
  adminProps,
  repairProps,
  operationsProps,
}: WorkspaceContentPanelsProps) {
  return (
    <Grid container spacing={3}>
      <Suspense fallback={<WorkspaceSectionFallback label="Загрузка документов..." />}>
        <WorkspaceDocumentsPanel {...documentsProps} />
      </Suspense>

      <Grid item xs={12} md={activeWorkspaceTab === "documents" ? 5 : 12}>
        <Stack spacing={3}>
          <Suspense fallback={<WorkspaceSectionFallback label="Загрузка панели управления..." />}>
            <WorkspaceAdminPanels {...adminProps} />
          </Suspense>
          {activeWorkspaceTab === "repair" ? (
            <Suspense fallback={<WorkspaceSectionFallback label="Загрузка карточки ремонта..." />}>
              <RepairWorkspacePanel {...repairProps} />
            </Suspense>
          ) : null}
          <Suspense fallback={<WorkspaceSectionFallback label="Загрузка рабочего раздела..." />}>
            <WorkspaceOperationsPanels {...operationsProps} />
          </Suspense>
        </Stack>
      </Grid>
    </Grid>
  );
}
