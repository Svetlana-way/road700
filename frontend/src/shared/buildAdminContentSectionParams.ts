import type { BuildAdminWorkspacePropsParams } from "./buildAdminWorkspaceProps";
import { buildAdminGovernanceSectionParams } from "./buildAdminGovernanceSectionParams";
import { buildAdminPeopleServicesSectionParams } from "./buildAdminPeopleServicesSectionParams";
import { buildAdminShellSectionParams } from "./buildAdminShellSectionParams";
import { buildAdminTechSectionParams } from "./buildAdminTechSectionParams";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

export function buildAdminContentSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): BuildAdminWorkspacePropsParams {
  return {
    ...buildAdminShellSectionParams(context),
    ...buildAdminPeopleServicesSectionParams(context),
    ...buildAdminGovernanceSectionParams(context),
    ...buildAdminTechSectionParams(context),
  };
}
