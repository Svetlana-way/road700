import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import { buildRepairDetailSectionParams } from "./buildRepairDetailSectionParams";
import { buildRepairReviewSectionParams } from "./buildRepairReviewSectionParams";
import { buildRepairShellSectionParams } from "./buildRepairShellSectionParams";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

export function buildRepairContentSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): BuildRepairWorkspacePropsParams {
  return {
    ...buildRepairShellSectionParams(context),
    ...buildRepairReviewSectionParams(context),
    ...buildRepairDetailSectionParams(context),
  };
}
