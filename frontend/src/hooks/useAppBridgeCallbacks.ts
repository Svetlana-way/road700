import { useRef } from "react";
import type { ReviewQueueCategory } from "../shared/workspaceBootstrapTypes";
import type { TechAdminTab } from "../shared/appRoute";

type LoadWorkspaceOptions = {
  silent?: boolean;
};

type LoadWorkspaceFn = (
  activeToken: string,
  reviewCategory?: ReviewQueueCategory,
  options?: LoadWorkspaceOptions,
) => Promise<void>;

type OpenRepairByIdsFn = (documentId: number | null, repairId: number) => Promise<void>;
type OpenTechAdminFn = (tab?: TechAdminTab) => void;

export function useAppBridgeCallbacks(token: string | null) {
  const openRepairByIdsRef = useRef<OpenRepairByIdsFn>(async () => {});
  const openTechAdminRef = useRef<OpenTechAdminFn>(() => {});
  const openReviewRulesAdminRef = useRef<() => void>(() => {});
  const openLaborNormsAdminRef = useRef<() => void>(() => {});
  const loadWorkspaceRef = useRef<LoadWorkspaceFn>(async () => {});

  const openRepairByIdsFromDocuments: OpenRepairByIdsFn = async (documentId, repairId) => {
    await openRepairByIdsRef.current(documentId, repairId);
  };

  const openTechAdmin: OpenTechAdminFn = (tab = "learning") => {
    openTechAdminRef.current(tab);
  };

  const openReviewRulesAdmin = () => {
    openReviewRulesAdminRef.current();
  };

  const openLaborNormsAdmin = () => {
    openLaborNormsAdminRef.current();
  };

  const refreshWorkspace = async () => {
    if (token) {
      await loadWorkspaceRef.current(token);
    }
  };

  return {
    openRepairByIdsRef,
    openTechAdminRef,
    openReviewRulesAdminRef,
    openLaborNormsAdminRef,
    loadWorkspaceRef,
    openRepairByIdsFromDocuments,
    openTechAdmin,
    openReviewRulesAdmin,
    openLaborNormsAdmin,
    refreshWorkspace,
  };
}
