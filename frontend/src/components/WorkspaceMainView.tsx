import { lazy, Suspense, type ComponentProps } from "react";
import { Box, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { WorkspaceChromePanels } from "./WorkspaceChromePanels";
const DataQualityOverviewPanel = lazy(() =>
  import("./DataQualityOverviewPanel").then((module) => ({ default: module.DataQualityOverviewPanel })),
);
const ImportConflictDialog = lazy(() =>
  import("./ImportConflictDialog").then((module) => ({ default: module.ImportConflictDialog })),
);
const WorkspaceContentPanels = lazy(() =>
  import("./WorkspaceContentPanels").then((module) => ({ default: module.WorkspaceContentPanels })),
);

type WorkspaceChromePanelsProps = ComponentProps<typeof WorkspaceChromePanels>;
type DataQualityOverviewPanelProps = ComponentProps<(typeof import("./DataQualityOverviewPanel"))["DataQualityOverviewPanel"]>;
type ImportConflictDialogProps = ComponentProps<(typeof import("./ImportConflictDialog"))["ImportConflictDialog"]>;
type WorkspaceContentPanelsProps = ComponentProps<(typeof import("./WorkspaceContentPanels"))["WorkspaceContentPanels"]>;

type WorkspaceMainViewProps = {
  chromeProps: WorkspaceChromePanelsProps;
  dataQualityProps: DataQualityOverviewPanelProps;
  importConflictDialogProps: ImportConflictDialogProps;
  contentProps: WorkspaceContentPanelsProps;
};

function MainViewFallback({ label }: { label: string }) {
  return (
    <Paper className="loading-panel" elevation={0}>
      <Stack spacing={1.5} alignItems="center">
        <CircularProgress size={24} />
        <Typography>{label}</Typography>
      </Stack>
    </Paper>
  );
}

export function WorkspaceMainView({
  chromeProps,
  dataQualityProps,
  importConflictDialogProps,
  contentProps,
}: WorkspaceMainViewProps) {
  return (
    <Box className="app-shell">
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <WorkspaceChromePanels {...chromeProps} />
          <Suspense fallback={<MainViewFallback label="Загрузка качества данных..." />}>
            <DataQualityOverviewPanel {...dataQualityProps} />
          </Suspense>
          <Suspense fallback={null}>
            <ImportConflictDialog {...importConflictDialogProps} />
          </Suspense>
          <Suspense fallback={<MainViewFallback label="Загрузка рабочего пространства..." />}>
            <WorkspaceContentPanels {...contentProps} />
          </Suspense>
        </Stack>
      </Container>
    </Box>
  );
}
