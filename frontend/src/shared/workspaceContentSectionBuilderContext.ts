import {
  formatDateValue,
  formatDocumentKind,
  formatDocumentStatusLabel,
  formatJsonPretty,
  formatMoney,
  formatRepairStatus,
  formatStatus,
} from "./displayFormatters";
import { readComparisonReviewMeta } from "./repairReportHelpers";

type AppRootState = ReturnType<typeof import("../hooks/useAppRootState").useAppRootState>;
type AuthSessionState = ReturnType<typeof import("../hooks/useAuthSession").useAuthSession>;
type DocumentsWorkspaceState = ReturnType<typeof import("../hooks/useDocumentsWorkspace").useDocumentsWorkspace>;
type EmployeesAdminState = ReturnType<typeof import("../hooks/useEmployeesAdmin").useEmployeesAdmin>;
type ServicesAdminState = ReturnType<typeof import("../hooks/useServicesAdmin").useServicesAdmin>;
type ReviewRulesAdminState = ReturnType<typeof import("../hooks/useReviewRulesAdmin").useReviewRulesAdmin>;
type LaborNormsAdminState = ReturnType<typeof import("../hooks/useLaborNormsAdmin").useLaborNormsAdmin>;
type OcrAdminState = ReturnType<typeof import("../hooks/useOcrAdmin").useOcrAdmin>;
type HistoricalImportsAdminState =
  ReturnType<typeof import("../hooks/useHistoricalImportsAdmin").useHistoricalImportsAdmin>;
type WorkspaceOperationsState = ReturnType<typeof import("../hooks/useWorkspaceOperations").useWorkspaceOperations>;
type BackupsAdminState = ReturnType<typeof import("../hooks/useBackupsAdmin").useBackupsAdmin>;
type FleetWorkspaceState = ReturnType<typeof import("../hooks/useFleetWorkspace").useFleetWorkspace>;
type AppNavigationState = ReturnType<typeof import("../hooks/useAppNavigation").useAppNavigation>;
type RepairDerivedViewModelState =
  ReturnType<typeof import("../hooks/useRepairDerivedViewModel").useRepairDerivedViewModel>;
type RepairEditingWorkflowState =
  ReturnType<typeof import("../hooks/useRepairEditingWorkflow").useRepairEditingWorkflow>;
type RepairReviewWorkflowState =
  ReturnType<typeof import("../hooks/useRepairReviewWorkflow").useRepairReviewWorkflow>;
type RepairWorkspaceActionsState =
  ReturnType<typeof import("../hooks/useRepairWorkspaceActions").useRepairWorkspaceActions>;
type RepairDocumentsWorkflowState =
  ReturnType<typeof import("../hooks/useRepairDocumentsWorkflow").useRepairDocumentsWorkflow>;
type RepairHistoryFiltersState = ReturnType<typeof import("../hooks/useRepairHistoryFilters").useRepairHistoryFilters>;

export type WorkspaceContentSectionBuilderContext = {
  rootState: AppRootState;
  authSession: AuthSessionState;
  documentsWorkspace: DocumentsWorkspaceState;
  employeesAdmin: EmployeesAdminState;
  servicesAdmin: ServicesAdminState;
  reviewRulesAdmin: ReviewRulesAdminState;
  laborNormsAdmin: LaborNormsAdminState;
  ocrAdmin: OcrAdminState;
  historicalImportsAdmin: HistoricalImportsAdminState;
  operationsWorkspace: WorkspaceOperationsState;
  backupsAdmin: BackupsAdminState;
  fleetWorkspace: FleetWorkspaceState;
  navigation: AppNavigationState;
  repairLoading: boolean;
  repairDerivedViewModel: RepairDerivedViewModelState;
  repairEditingWorkflow: RepairEditingWorkflowState;
  repairReviewWorkflow: RepairReviewWorkflowState;
  repairWorkspaceActions: RepairWorkspaceActionsState;
  repairDocumentsWorkflow: RepairDocumentsWorkflowState;
  repairHistoryFilters: RepairHistoryFiltersState;
};

export const historyDetailFormatters = {
  formatStatus,
  formatRepairStatus,
  formatDocumentStatusLabel,
  formatDocumentKind,
  formatMoney,
  formatDateValue,
  formatJsonPretty,
  readComparisonReviewMeta,
};
