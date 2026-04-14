import { adminTabDescriptions, techAdminTabDescriptions } from "../../shared/appUiConfig";
import type { WorkspaceContentSectionBuilderContext } from "../../app/workspaceContentSectionBuilderContext";
import type { BuildAdminWorkspacePropsParams } from "./buildAdminWorkspaceProps";

type AdminShellSectionParams = Pick<
  BuildAdminWorkspacePropsParams,
  | "activeWorkspaceTab"
  | "activeAdminTab"
  | "activeTechAdminTab"
  | "userRole"
  | "adminTabDescriptions"
  | "handleAdminTabChange"
  | "openTechAdmin"
  | "techAdminTabDescriptions"
  | "systemStatus"
  | "handleTechAdminTabChange"
  | "closeTechAdmin"
>;

export function buildAdminShellSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): AdminShellSectionParams {
  const { rootState, ocrAdmin, navigation } = context;

  return {
    activeWorkspaceTab: rootState.activeWorkspaceTab,
    activeAdminTab: rootState.activeAdminTab,
    activeTechAdminTab: rootState.activeTechAdminTab,
    userRole: rootState.user?.role,
    adminTabDescriptions,
    handleAdminTabChange: navigation.handleAdminTabChange,
    openTechAdmin: navigation.openTechAdmin,
    techAdminTabDescriptions,
    systemStatus: ocrAdmin.systemStatus,
    handleTechAdminTabChange: navigation.handleTechAdminTabChange,
    closeTechAdmin: navigation.closeTechAdmin,
  };
}
