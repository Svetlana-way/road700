import { buildAdminContentSectionParams } from "../features/admin/buildAdminContentSectionParams";
import { buildDocumentsContentSectionParams } from "../features/documents/buildDocumentsContentSectionParams";
import { buildOperationsContentSectionParams } from "../features/operations/buildOperationsContentSectionParams";
import { buildRepairContentSectionParams } from "../features/repair/buildRepairContentSectionParams";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

export function buildWorkspaceContentSectionParams(context: WorkspaceContentSectionBuilderContext) {
  return {
    documents: buildDocumentsContentSectionParams(context),
    admin: buildAdminContentSectionParams(context),
    operations: buildOperationsContentSectionParams(context),
    repair: buildRepairContentSectionParams(context),
  };
}
