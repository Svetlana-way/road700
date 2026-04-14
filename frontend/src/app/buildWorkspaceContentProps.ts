import { type ComponentProps } from "react";
import { WorkspaceContentPanels } from "../components/WorkspaceContentPanels";
import {
  buildAdminWorkspaceProps,
  type BuildAdminWorkspacePropsParams,
} from "../features/admin/buildAdminWorkspaceProps";
import {
  buildOperationsWorkspaceProps,
  type BuildOperationsWorkspacePropsParams,
} from "../features/operations/buildOperationsWorkspaceProps";
import {
  buildDocumentsWorkspaceProps,
  type BuildDocumentsWorkspacePropsParams,
} from "../features/documents/buildDocumentsWorkspaceProps";
import {
  buildRepairWorkspaceProps,
  type BuildRepairWorkspacePropsParams,
} from "../features/repair/buildRepairWorkspaceProps";

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
