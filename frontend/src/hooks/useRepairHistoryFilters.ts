import { matchesTextSearch } from "../entities/vehicle/helpers";
import type { RepairDocumentHistoryEntry, RepairHistoryEntry } from "../contracts/domain/repair";
import type { HistoryFilter } from "../shared/workspaceViewTypes";
import type { DocumentKind } from "../contracts/domain/workspace";

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

function historyEntryChangedSourceDocument(
  entry: Pick<RepairHistoryEntry | RepairDocumentHistoryEntry, "old_value" | "new_value">,
) {
  return entry.old_value?.source_document_id !== entry.new_value?.source_document_id;
}

function documentHistoryEntryAssignedPrimaryOnUpload(entry: Pick<RepairDocumentHistoryEntry, "action_type" | "new_value">) {
  return (
    (entry.action_type === "document_uploaded" || entry.action_type === "document_attached") &&
    entry.new_value?.is_primary === true
  );
}

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
        if (
          historyFilter === "primary" &&
          entry.action_type !== "primary_document_changed" &&
          !(entry.action_type === "document_comparison_reviewed" && historyEntryChangedSourceDocument(entry))
        ) {
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
          entry.action_type !== "primary_document_changed" &&
          entry.action_type !== "comparison_make_document_primary" &&
          !documentHistoryEntryAssignedPrimaryOnUpload(entry)
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
