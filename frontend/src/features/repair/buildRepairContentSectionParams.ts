import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import { buildRepairDetailSectionParams } from "../../shared/buildRepairDetailSectionParams";
import { buildRepairReviewSectionParams } from "../../shared/buildRepairReviewSectionParams";
import { buildRepairShellSectionParams } from "../../shared/buildRepairShellSectionParams";
import type { WorkspaceContentSectionBuilderContext } from "../../shared/workspaceContentSectionBuilderContext";

export function buildRepairContentSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): BuildRepairWorkspacePropsParams {
  return {
    ...buildRepairShellSectionParams(context),
    ...buildRepairReviewSectionParams(context),
    ...buildRepairDetailSectionParams(context),
  };
}
