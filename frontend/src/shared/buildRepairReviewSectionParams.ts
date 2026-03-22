import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import { buildRepairReviewActionSectionParams } from "./buildRepairReviewActionSectionParams";
import { buildRepairReviewFormatterSectionParams } from "./buildRepairReviewFormatterSectionParams";
import { buildRepairReviewStateSectionParams } from "./buildRepairReviewStateSectionParams";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

export function buildRepairReviewSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): Pick<
  BuildRepairWorkspacePropsParams,
  | keyof ReturnType<typeof buildRepairReviewStateSectionParams>
  | keyof ReturnType<typeof buildRepairReviewActionSectionParams>
  | keyof ReturnType<typeof buildRepairReviewFormatterSectionParams>
> {
  return {
    ...buildRepairReviewStateSectionParams(context),
    ...buildRepairReviewActionSectionParams(context),
    ...buildRepairReviewFormatterSectionParams(),
  };
}
