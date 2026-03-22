import { matchesTextSearch } from "../shared/fleetDocumentHelpers";
import type { RepairDocumentHistoryEntry, RepairHistoryEntry } from "../shared/repairDetailTypes";
import type { HistoryFilter } from "../shared/workspaceViewTypes";
import type { DocumentKind } from "../shared/workspaceBootstrapTypes";

type RepairHistorySource = {
  history: RepairHistoryEntry[];
  document_history: RepairDocumentHistoryEntry[];
};

type UseRepairHistoryFiltersParams = {
  selectedRepair: RepairHistorySource | null;
  historyFilter: HistoryFilter;
  historySearch: string;
  formatDocumentKind: (kind: DocumentKind) => string;
};

export function useRepairHistoryFilters({
  selectedRepair,
  historyFilter,
  historySearch,
  formatDocumentKind,
}: UseRepairHistoryFiltersParams) {
  const filteredRepairHistory = selectedRepair
    ? selectedRepair.history.filter((entry) => {
        if (historyFilter === "documents" || historyFilter === "uploads") {
          return false;
        }
        if (historyFilter === "primary" && entry.action_type !== "primary_document_changed") {
          return false;
        }
        if (historyFilter === "comparison" && entry.action_type !== "document_comparison_reviewed") {
          return false;
        }
        return matchesTextSearch(
          [
            entry.user_name,
            entry.action_type,
            JSON.stringify(entry.old_value),
            JSON.stringify(entry.new_value),
          ],
          historySearch,
        );
      })
    : [];

  const filteredDocumentHistory = selectedRepair
    ? selectedRepair.document_history.filter((entry) => {
        if (historyFilter === "repair") {
          return false;
        }
        if (
          historyFilter === "uploads" &&
          entry.action_type !== "document_uploaded" &&
          entry.action_type !== "document_attached"
        ) {
          return false;
        }
        if (
          historyFilter === "primary" &&
          entry.action_type !== "set_primary" &&
          entry.action_type !== "primary_document_changed"
        ) {
          return false;
        }
        if (historyFilter === "comparison" && !entry.action_type.startsWith("comparison_")) {
          return false;
        }
        return matchesTextSearch(
          [
            entry.user_name,
            entry.action_type,
            entry.document_filename,
            entry.document_kind ? formatDocumentKind(entry.document_kind) : null,
            JSON.stringify(entry.old_value),
            JSON.stringify(entry.new_value),
          ],
          historySearch,
        );
      })
    : [];

  return {
    filteredRepairHistory,
    filteredDocumentHistory,
  };
}
