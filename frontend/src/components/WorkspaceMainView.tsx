import { type ComponentProps } from "react";
import { Box, Container, Stack } from "@mui/material";
import { DataQualityOverviewPanel } from "./DataQualityOverviewPanel";
import { ImportConflictDialog } from "./ImportConflictDialog";
import { WorkspaceChromePanels } from "./WorkspaceChromePanels";
import { WorkspaceContentPanels } from "./WorkspaceContentPanels";

type WorkspaceChromePanelsProps = ComponentProps<typeof WorkspaceChromePanels>;
type DataQualityOverviewPanelProps = ComponentProps<typeof DataQualityOverviewPanel>;
type ImportConflictDialogProps = ComponentProps<typeof ImportConflictDialog>;
type WorkspaceContentPanelsProps = ComponentProps<typeof WorkspaceContentPanels>;

type WorkspaceMainViewProps = {
  chromeProps: WorkspaceChromePanelsProps;
  dataQualityProps: DataQualityOverviewPanelProps;
  importConflictDialogProps: ImportConflictDialogProps;
  contentProps: WorkspaceContentPanelsProps;
};

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
          <DataQualityOverviewPanel {...dataQualityProps} />
          <ImportConflictDialog {...importConflictDialogProps} />
          <WorkspaceContentPanels {...contentProps} />
        </Stack>
      </Container>
    </Box>
  );
}
