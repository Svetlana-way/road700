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

type WorkspaceContentPanelsProps = ComponentProps<typeof WorkspaceContentPanels>;
type BuildWorkspaceContentPropsParams = {
  admin: BuildAdminWorkspacePropsParams;
  documents: BuildDocumentsWorkspacePropsParams;
  operations: BuildOperationsWorkspacePropsParams;
  repair: BuildRepairWorkspacePropsParams;
};

export function buildWorkspaceContentProps(params: BuildWorkspaceContentPropsParams): WorkspaceContentPanelsProps {
  return {
    activeWorkspaceTab: params.documents.activeWorkspaceTab,
    documentsProps: buildDocumentsWorkspaceProps(params.documents),
    adminProps: buildAdminWorkspaceProps(params.admin),
    repairProps: buildRepairWorkspaceProps(params.repair),
    operationsProps: buildOperationsWorkspaceProps(params.operations),
  };
}
