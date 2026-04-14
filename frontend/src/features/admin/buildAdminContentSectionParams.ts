import type { WorkspaceContentSectionBuilderContext } from "../../app/workspaceContentSectionBuilderContext";
import { buildAdminGovernanceSectionParams } from "./buildAdminGovernanceSectionParams";
import { buildAdminPeopleServicesSectionParams } from "./buildAdminPeopleServicesSectionParams";
import { buildAdminShellSectionParams } from "./buildAdminShellSectionParams";
import { buildAdminTechSectionParams } from "./buildAdminTechSectionParams";
import type { BuildAdminWorkspacePropsParams } from "./buildAdminWorkspaceProps";

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
