import { adminTabDescriptions, techAdminTabDescriptions } from "./appUiConfig";
import type { BuildAdminWorkspacePropsParams } from "./buildAdminWorkspaceProps";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

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
