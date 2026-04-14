import type { WorkspaceContentSectionBuilderContext } from "../../app/workspaceContentSectionBuilderContext";
import type { BuildAdminWorkspacePropsParams } from "./buildAdminWorkspaceProps";
import {
  buildAdminHistoricalImportsSectionParams,
  type AdminHistoricalImportsSectionParams,
} from "./buildAdminHistoricalImportsSectionParams";
import {
  buildAdminLaborNormsSectionParams,
  type AdminLaborNormsSectionParams,
} from "./buildAdminLaborNormsSectionParams";
import { buildAdminOcrSectionParams, type AdminOcrSectionParams } from "./buildAdminOcrSectionParams";

type AdminTechSectionParams = AdminOcrSectionParams & AdminHistoricalImportsSectionParams & AdminLaborNormsSectionParams;

export function buildAdminTechSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): Pick<BuildAdminWorkspacePropsParams, keyof AdminTechSectionParams> {
  return {
    ...buildAdminOcrSectionParams(context),
    ...buildAdminHistoricalImportsSectionParams(context),
    ...buildAdminLaborNormsSectionParams(context),
  };
}
