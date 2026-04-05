import { useBackupsAdmin } from "./useBackupsAdmin";
import { useEmployeesAdmin } from "./useEmployeesAdmin";
import { useFleetWorkspace } from "./useFleetWorkspace";
import { useHistoricalImportsAdmin } from "./useHistoricalImportsAdmin";
import { useLaborNormsAdmin } from "./useLaborNormsAdmin";
import { useOcrAdmin } from "./useOcrAdmin";
import { useReviewRulesAdmin } from "./useReviewRulesAdmin";
import { useServicesAdmin } from "./useServicesAdmin";
import { useWorkspaceOperations } from "./useWorkspaceOperations";
import type { AdminTab, TechAdminTab, WorkspaceTab } from "../shared/appRoute";
import type { UserRole } from "../shared/workspaceBootstrapTypes";

type UseWorkspaceSupportModulesParams = {
  token: string | null;
  userRole: UserRole | null | undefined;
  activeWorkspaceTab: WorkspaceTab;
  activeAdminTab: AdminTab;
  activeTechAdminTab: TechAdminTab;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  refreshWorkspace: (scope?: "full" | "documents" | "metrics") => Promise<void>;
  openTechAdmin: (tab?: TechAdminTab) => void;
  openReviewRulesAdmin: () => void;
  openLaborNormsAdmin: () => void;
  invalidateSession: (options?: { message?: string; reload?: boolean }) => void;
  vehiclesFullListLimit: number;
};

export function useWorkspaceSupportModules({
  token,
  userRole,
  activeWorkspaceTab,
  activeAdminTab,
  activeTechAdminTab,
  setErrorMessage,
  setSuccessMessage,
  refreshWorkspace,
  openTechAdmin,
  openReviewRulesAdmin,
  openLaborNormsAdmin,
  invalidateSession,
  vehiclesFullListLimit,
}: UseWorkspaceSupportModulesParams) {
  const authToken = token || "";

  const employeesAdmin = useEmployeesAdmin({
    token: authToken,
    userRole,
    activeWorkspaceTab,
    activeAdminTab,
    setErrorMessage,
    setSuccessMessage,
  });

  const servicesAdmin = useServicesAdmin({
    token: authToken,
    userRole,
    activeWorkspaceTab,
    activeAdminTab,
    setErrorMessage,
    setSuccessMessage,
  });

  const reviewRulesAdmin = useReviewRulesAdmin({
    token,
    userRole,
    activeWorkspaceTab,
    activeAdminTab,
    setErrorMessage,
    setSuccessMessage,
    openReviewRulesAdmin,
  });

  const laborNormsAdmin = useLaborNormsAdmin({
    token,
    userRole,
    activeWorkspaceTab,
    activeAdminTab,
    setErrorMessage,
    setSuccessMessage,
    openLaborNormsAdmin,
  });

  const ocrAdmin = useOcrAdmin({
    token,
    userRole,
    activeWorkspaceTab,
    activeTechAdminTab,
    setErrorMessage,
    setSuccessMessage,
    openTechAdmin,
  });

  const historicalImportsAdmin = useHistoricalImportsAdmin({
    token: authToken,
    userRole,
    activeWorkspaceTab,
    activeAdminTab,
    setErrorMessage,
    setSuccessMessage,
    refreshWorkspace,
  });

  const workspaceOperations = useWorkspaceOperations({
    activeWorkspaceTab,
    token: authToken,
    userRole,
    auditUsers: employeesAdmin.allUsersList,
    onError: setErrorMessage,
  });

  const backupsAdmin = useBackupsAdmin({
    token: authToken,
    userRole,
    activeWorkspaceTab,
    activeAdminTab,
    setErrorMessage,
    setSuccessMessage,
    invalidateSession,
  });

  const fleetWorkspace = useFleetWorkspace({
    token: authToken,
    userRole,
    activeWorkspaceTab,
    vehiclesFullListLimit,
    setErrorMessage,
    setSuccessMessage,
  });

  return {
    employeesAdmin,
    servicesAdmin,
    reviewRulesAdmin,
    laborNormsAdmin,
    ocrAdmin,
    historicalImportsAdmin,
    workspaceOperations,
    backupsAdmin,
    fleetWorkspace,
  };
}
