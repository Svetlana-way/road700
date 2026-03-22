import { useRef, useState } from "react";
import type { AdminTab, RepairTab, TechAdminTab, WorkspaceTab } from "../shared/appRoute";
import type { RepairDetail } from "../shared/repairDetailTypes";
import type { HistoryFilter, QualityDetailTab } from "../shared/workspaceViewTypes";
import type {
  DashboardDataQuality,
  DashboardDataQualityDetails,
  DashboardSummary,
  DocumentItem,
  ReviewQueueCategory,
  ReviewQueueItem,
  User,
  Vehicle,
} from "../shared/workspaceBootstrapTypes";
import type { DocumentVehicleFormState } from "../shared/workspaceFormTypes";

type UseAppRootStateParams = {
  createEmptyDocumentVehicleForm: () => DocumentVehicleFormState;
};

export function useAppRootState({ createEmptyDocumentVehicleForm }: UseAppRootStateParams) {
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("documents");
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>("services");
  const [activeTechAdminTab, setActiveTechAdminTab] = useState<TechAdminTab>("learning");
  const [activeRepairTab, setActiveRepairTab] = useState<RepairTab>("overview");
  const [activeQualityTab, setActiveQualityTab] = useState<QualityDetailTab>("documents");
  const [showQualityDialog, setShowQualityDialog] = useState(false);
  const [showTechAdminTab, setShowTechAdminTab] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dataQuality, setDataQuality] = useState<DashboardDataQuality | null>(null);
  const [dataQualityDetails, setDataQualityDetails] = useState<DashboardDataQualityDetails | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [reviewQueueCounts, setReviewQueueCounts] = useState<Record<ReviewQueueCategory, number>>({
    all: 0,
    suspicious: 0,
    ocr_error: 0,
    partial_recognition: 0,
    employee_confirmation: 0,
    manual_review: 0,
  });
  const [selectedReviewCategory, setSelectedReviewCategory] = useState<ReviewQueueCategory>("all");
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<RepairDetail | null>(null);
  const [documentVehicleForm, setDocumentVehicleForm] = useState<DocumentVehicleFormState>(createEmptyDocumentVehicleForm);
  const attachedFileInputRef = useRef<HTMLInputElement | null>(null);
  const [checkComments, setCheckComments] = useState<Record<number, string>>({});
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [showRepairOverviewDetails, setShowRepairOverviewDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const isEditingRepairRef = useRef(false);
  const syncRepairDraftFromRepairRef = useRef<(repair: RepairDetail) => void>(() => {});
  const resetRepairDocumentsWorkflowStateRef = useRef<() => void>(() => {});

  return {
    user,
    setUser,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    activeAdminTab,
    setActiveAdminTab,
    activeTechAdminTab,
    setActiveTechAdminTab,
    activeRepairTab,
    setActiveRepairTab,
    activeQualityTab,
    setActiveQualityTab,
    showQualityDialog,
    setShowQualityDialog,
    showTechAdminTab,
    setShowTechAdminTab,
    summary,
    setSummary,
    dataQuality,
    setDataQuality,
    dataQualityDetails,
    setDataQualityDetails,
    vehicles,
    setVehicles,
    documents,
    setDocuments,
    reviewQueue,
    setReviewQueue,
    reviewQueueCounts,
    setReviewQueueCounts,
    selectedReviewCategory,
    setSelectedReviewCategory,
    selectedDocumentId,
    setSelectedDocumentId,
    selectedRepair,
    setSelectedRepair,
    documentVehicleForm,
    setDocumentVehicleForm,
    attachedFileInputRef,
    checkComments,
    setCheckComments,
    historyFilter,
    setHistoryFilter,
    historySearch,
    setHistorySearch,
    showRepairOverviewDetails,
    setShowRepairOverviewDetails,
    errorMessage,
    setErrorMessage,
    successMessage,
    setSuccessMessage,
    isEditingRepairRef,
    syncRepairDraftFromRepairRef,
    resetRepairDocumentsWorkflowStateRef,
  };
}
