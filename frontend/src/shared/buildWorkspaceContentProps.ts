import { type ComponentProps } from "react";
import { WorkspaceContentPanels } from "../components/WorkspaceContentPanels";
import {
  buildAdminWorkspaceProps,
  type BuildAdminWorkspacePropsParams,
} from "./buildAdminWorkspaceProps";
import {
  buildDocumentsWorkspaceProps,
  type BuildDocumentsWorkspacePropsParams,
} from "./buildDocumentsWorkspaceProps";
import {
  buildOperationsWorkspaceProps,
  type BuildOperationsWorkspacePropsParams,
} from "./buildOperationsWorkspaceProps";
import {
  buildRepairWorkspaceProps,
  type BuildRepairWorkspacePropsParams,
} from "./buildRepairWorkspaceProps";
import type { WorkspaceTab } from "./appRoute";

type WorkspaceContentPanelsProps = ComponentProps<typeof WorkspaceContentPanels>;
type BuildWorkspaceContentPropsParams = {
  activeWorkspaceTab: WorkspaceTab;
} & BuildAdminWorkspacePropsParams & BuildDocumentsWorkspacePropsParams & BuildOperationsWorkspacePropsParams & BuildRepairWorkspacePropsParams;

export function buildWorkspaceContentProps(params: BuildWorkspaceContentPropsParams): WorkspaceContentPanelsProps {
  return {
    activeWorkspaceTab: params.activeWorkspaceTab,
    documentsProps: buildDocumentsWorkspaceProps(params),
    adminProps: buildAdminWorkspaceProps(params),
    repairProps: buildRepairWorkspaceProps(params),
    operationsProps: buildOperationsWorkspaceProps(params),
  };
}
