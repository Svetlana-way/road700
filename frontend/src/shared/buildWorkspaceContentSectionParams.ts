import { buildAdminContentSectionParams } from "./buildAdminContentSectionParams";
import { buildDocumentsContentSectionParams } from "./buildDocumentsContentSectionParams";
import { buildOperationsContentSectionParams } from "./buildOperationsContentSectionParams";
import { buildRepairContentSectionParams } from "./buildRepairContentSectionParams";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

export function buildWorkspaceContentSectionParams(context: WorkspaceContentSectionBuilderContext) {
  return {
    documents: buildDocumentsContentSectionParams(context),
    admin: buildAdminContentSectionParams(context),
    operations: buildOperationsContentSectionParams(context),
    repair: buildRepairContentSectionParams(context),
  };
}
