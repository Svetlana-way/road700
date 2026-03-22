import {
  formatCatalogCodeLabel,
  formatDateValue,
  formatHours,
  formatMoney,
} from "./displayFormatters";
import type { BuildAdminWorkspacePropsParams } from "./buildAdminWorkspaceProps";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

export type AdminLaborNormsSectionParams = Pick<
  BuildAdminWorkspacePropsParams,
  | "formatMoney"
  | "formatHours"
  | "formatDateValue"
  | "showLaborNormCatalogEditor"
  | "showLaborNormImport"
  | "showLaborNormEntryEditor"
  | "editingLaborNormCatalogId"
  | "laborNormCatalogForm"
  | "laborNormCatalogSaving"
  | "laborNormCatalogs"
  | "laborNormQuery"
  | "laborNormScope"
  | "laborNormScopes"
  | "laborNormCategory"
  | "laborNormCategories"
  | "laborNormLoading"
  | "laborNormImportScope"
  | "laborNormImportBrandFamily"
  | "laborNormImportCatalogName"
  | "laborNormFile"
  | "laborNormImportLoading"
  | "laborNormEntryForm"
  | "laborNormEntrySaving"
  | "laborNormTotal"
  | "laborNormSourceFiles"
  | "showLaborNormListDialog"
  | "laborNorms"
  | "openLaborNormsAdmin"
  | "setShowLaborNormCatalogEditor"
  | "setShowLaborNormImport"
  | "setShowLaborNormEntryEditor"
  | "updateLaborNormCatalogFormField"
  | "handleSaveLaborNormCatalog"
  | "resetLaborNormCatalogEditor"
  | "editLaborNormCatalog"
  | "selectCatalogScope"
  | "setLaborNormQuery"
  | "setLaborNormScope"
  | "setLaborNormCategory"
  | "handleLaborNormSearch"
  | "resetLaborNormFilters"
  | "setLaborNormImportBrandFamily"
  | "setLaborNormImportCatalogName"
  | "setLaborNormFile"
  | "handleLaborNormImport"
  | "updateLaborNormEntryFormField"
  | "handleSaveLaborNormEntry"
  | "resetLaborNormEntryEditor"
  | "setShowLaborNormListDialog"
  | "editLaborNormItem"
  | "handleArchiveLaborNormItem"
  | "formatCatalogCodeLabel"
>;

export function buildAdminLaborNormsSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): AdminLaborNormsSectionParams {
  const { laborNormsAdmin, navigation } = context;

  return {
    formatMoney,
    formatHours,
    formatDateValue,
    showLaborNormCatalogEditor: laborNormsAdmin.showLaborNormCatalogEditor,
    showLaborNormImport: laborNormsAdmin.showLaborNormImport,
    showLaborNormEntryEditor: laborNormsAdmin.showLaborNormEntryEditor,
    editingLaborNormCatalogId: laborNormsAdmin.editingLaborNormCatalogId,
    laborNormCatalogForm: laborNormsAdmin.laborNormCatalogForm,
    laborNormCatalogSaving: laborNormsAdmin.laborNormCatalogSaving,
    laborNormCatalogs: laborNormsAdmin.laborNormCatalogs,
    laborNormQuery: laborNormsAdmin.laborNormQuery,
    laborNormScope: laborNormsAdmin.laborNormScope,
    laborNormScopes: laborNormsAdmin.laborNormScopes,
    laborNormCategory: laborNormsAdmin.laborNormCategory,
    laborNormCategories: laborNormsAdmin.laborNormCategories,
    laborNormLoading: laborNormsAdmin.laborNormLoading,
    laborNormImportScope: laborNormsAdmin.laborNormImportScope,
    laborNormImportBrandFamily: laborNormsAdmin.laborNormImportBrandFamily,
    laborNormImportCatalogName: laborNormsAdmin.laborNormImportCatalogName,
    laborNormFile: laborNormsAdmin.laborNormFile,
    laborNormImportLoading: laborNormsAdmin.laborNormImportLoading,
    laborNormEntryForm: laborNormsAdmin.laborNormEntryForm,
    laborNormEntrySaving: laborNormsAdmin.laborNormEntrySaving,
    laborNormTotal: laborNormsAdmin.laborNormTotal,
    laborNormSourceFiles: laborNormsAdmin.laborNormSourceFiles,
    showLaborNormListDialog: laborNormsAdmin.showLaborNormListDialog,
    laborNorms: laborNormsAdmin.laborNorms,
    openLaborNormsAdmin: navigation.openLaborNormsAdmin,
    setShowLaborNormCatalogEditor: laborNormsAdmin.setShowLaborNormCatalogEditor,
    setShowLaborNormImport: laborNormsAdmin.setShowLaborNormImport,
    setShowLaborNormEntryEditor: laborNormsAdmin.setShowLaborNormEntryEditor,
    updateLaborNormCatalogFormField: laborNormsAdmin.updateLaborNormCatalogFormField,
    handleSaveLaborNormCatalog: laborNormsAdmin.handleSaveLaborNormCatalog,
    resetLaborNormCatalogEditor: laborNormsAdmin.resetLaborNormCatalogEditor,
    editLaborNormCatalog: laborNormsAdmin.editLaborNormCatalog,
    selectCatalogScope: laborNormsAdmin.selectCatalogScope,
    setLaborNormQuery: laborNormsAdmin.setLaborNormQuery,
    setLaborNormScope: laborNormsAdmin.setLaborNormScope,
    setLaborNormCategory: laborNormsAdmin.setLaborNormCategory,
    handleLaborNormSearch: laborNormsAdmin.handleLaborNormSearch,
    resetLaborNormFilters: laborNormsAdmin.resetLaborNormFilters,
    setLaborNormImportBrandFamily: laborNormsAdmin.setLaborNormImportBrandFamily,
    setLaborNormImportCatalogName: laborNormsAdmin.setLaborNormImportCatalogName,
    setLaborNormFile: laborNormsAdmin.setLaborNormFile,
    handleLaborNormImport: laborNormsAdmin.handleLaborNormImport,
    updateLaborNormEntryFormField: laborNormsAdmin.updateLaborNormEntryFormField,
    handleSaveLaborNormEntry: laborNormsAdmin.handleSaveLaborNormEntry,
    resetLaborNormEntryEditor: laborNormsAdmin.resetLaborNormEntryEditor,
    setShowLaborNormListDialog: laborNormsAdmin.setShowLaborNormListDialog,
    editLaborNormItem: laborNormsAdmin.editLaborNormItem,
    handleArchiveLaborNormItem: laborNormsAdmin.handleArchiveLaborNormItem,
    formatCatalogCodeLabel,
  };
}
