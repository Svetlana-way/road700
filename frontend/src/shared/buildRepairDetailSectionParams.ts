import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import { buildRepairDocumentsSectionParams } from "./buildRepairDocumentsSectionParams";
import { buildRepairHistoryChecksSectionParams } from "./buildRepairHistoryChecksSectionParams";
import { buildRepairOverviewSectionParams } from "./buildRepairOverviewSectionParams";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

export function buildRepairDetailSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): Pick<
  BuildRepairWorkspacePropsParams,
  | keyof ReturnType<typeof buildRepairOverviewSectionParams>
  | keyof ReturnType<typeof buildRepairDocumentsSectionParams>
  | keyof ReturnType<typeof buildRepairHistoryChecksSectionParams>
> {
  return {
    ...buildRepairOverviewSectionParams(context),
    ...buildRepairDocumentsSectionParams(context),
    ...buildRepairHistoryChecksSectionParams(context),
  };
}
