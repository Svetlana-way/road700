import { type ComponentProps } from "react";
import { Grid, Stack } from "@mui/material";
import { RepairWorkspacePanel } from "./RepairWorkspacePanel";
import { WorkspaceAdminPanels } from "./WorkspaceAdminPanels";
import { WorkspaceDocumentsPanel } from "./WorkspaceDocumentsPanel";
import { WorkspaceOperationsPanels } from "./WorkspaceOperationsPanels";

type WorkspaceTab = "documents" | "repair" | "admin" | "tech_admin" | "fleet" | "search" | "audit";

type WorkspaceDocumentsPanelProps = ComponentProps<typeof WorkspaceDocumentsPanel>;
type WorkspaceAdminPanelsProps = ComponentProps<typeof WorkspaceAdminPanels>;
type RepairWorkspacePanelProps = ComponentProps<typeof RepairWorkspacePanel>;
type WorkspaceOperationsPanelsProps = ComponentProps<typeof WorkspaceOperationsPanels>;

type WorkspaceContentPanelsProps = {
  activeWorkspaceTab: WorkspaceTab;
  documentsProps: WorkspaceDocumentsPanelProps;
  adminProps: WorkspaceAdminPanelsProps;
  repairProps: RepairWorkspacePanelProps;
  operationsProps: WorkspaceOperationsPanelsProps;
};

export function WorkspaceContentPanels({
  activeWorkspaceTab,
  documentsProps,
  adminProps,
  repairProps,
  operationsProps,
}: WorkspaceContentPanelsProps) {
  return (
    <Grid container spacing={3}>
      <WorkspaceDocumentsPanel {...documentsProps} />

      <Grid item xs={12} md={activeWorkspaceTab === "documents" ? 5 : 12}>
        <Stack spacing={3}>
          <WorkspaceAdminPanels {...adminProps} />
          {activeWorkspaceTab === "repair" ? <RepairWorkspacePanel {...repairProps} /> : null}
          <WorkspaceOperationsPanels {...operationsProps} />
        </Stack>
      </Grid>
    </Grid>
  );
}
