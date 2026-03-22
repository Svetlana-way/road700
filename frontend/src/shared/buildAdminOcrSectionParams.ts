import {
  formatOcrFieldLabel,
  formatOcrLearningStatusLabel,
  formatOcrProfileName,
  formatOcrSignalTypeLabel,
  formatSourceTypeLabel,
  formatValueParserLabel,
} from "./displayFormatters";
import type { BuildAdminWorkspacePropsParams } from "./buildAdminWorkspaceProps";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

export type AdminOcrSectionParams = Pick<
  BuildAdminWorkspacePropsParams,
  | "ocrLearningStatusFilter"
  | "ocrLearningTargetFieldFilter"
  | "ocrLearningProfileScopeFilter"
  | "ocrLearningStatuses"
  | "ocrLearningTargetFields"
  | "ocrLearningProfileScopes"
  | "ocrLearningLoading"
  | "ocrLearningSummaries"
  | "ocrLearningSignals"
  | "showOcrLearningListDialog"
  | "ocrLearningDraftId"
  | "ocrLearningUpdateId"
  | "setOcrLearningStatusFilter"
  | "setOcrLearningTargetFieldFilter"
  | "setOcrLearningProfileScopeFilter"
  | "token"
  | "loadOcrLearningSignals"
  | "setShowOcrLearningListDialog"
  | "handleLoadOcrLearningDraft"
  | "handleUpdateOcrLearningSignal"
  | "formatOcrLearningStatusLabel"
  | "formatOcrProfileName"
  | "formatOcrFieldLabel"
  | "formatOcrSignalTypeLabel"
  | "ocrProfileMatcherProfileFilter"
  | "ocrProfileMatcherProfiles"
  | "ocrProfileMatchers"
  | "ocrProfileMatcherForm"
  | "ocrProfileMatcherSaving"
  | "setOcrProfileMatcherProfileFilter"
  | "loadOcrProfileMatchers"
  | "updateOcrProfileMatcherFormField"
  | "handleSaveOcrProfileMatcher"
  | "resetOcrProfileMatcherEditor"
  | "editOcrProfileMatcher"
  | "formatSourceTypeLabel"
  | "ocrRuleProfileFilter"
  | "ocrRuleProfiles"
  | "ocrRuleTargetFields"
  | "ocrRules"
  | "ocrRuleForm"
  | "ocrRuleSaving"
  | "setOcrRuleProfileFilter"
  | "loadOcrRules"
  | "updateOcrRuleFormField"
  | "handleSaveOcrRule"
  | "resetOcrRuleEditor"
  | "editOcrRule"
  | "formatValueParserLabel"
>;

export function buildAdminOcrSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): AdminOcrSectionParams {
  const { authSession, ocrAdmin } = context;

  return {
    ocrLearningStatusFilter: ocrAdmin.ocrLearningStatusFilter,
    ocrLearningTargetFieldFilter: ocrAdmin.ocrLearningTargetFieldFilter,
    ocrLearningProfileScopeFilter: ocrAdmin.ocrLearningProfileScopeFilter,
    ocrLearningStatuses: ocrAdmin.ocrLearningStatuses,
    ocrLearningTargetFields: ocrAdmin.ocrLearningTargetFields,
    ocrLearningProfileScopes: ocrAdmin.ocrLearningProfileScopes,
    ocrLearningLoading: ocrAdmin.ocrLearningLoading,
    ocrLearningSummaries: ocrAdmin.ocrLearningSummaries,
    ocrLearningSignals: ocrAdmin.ocrLearningSignals,
    showOcrLearningListDialog: ocrAdmin.showOcrLearningListDialog,
    ocrLearningDraftId: ocrAdmin.ocrLearningDraftId,
    ocrLearningUpdateId: ocrAdmin.ocrLearningUpdateId,
    setOcrLearningStatusFilter: ocrAdmin.setOcrLearningStatusFilter,
    setOcrLearningTargetFieldFilter: ocrAdmin.setOcrLearningTargetFieldFilter,
    setOcrLearningProfileScopeFilter: ocrAdmin.setOcrLearningProfileScopeFilter,
    token: authSession.token,
    loadOcrLearningSignals: ocrAdmin.loadOcrLearningSignals,
    setShowOcrLearningListDialog: ocrAdmin.setShowOcrLearningListDialog,
    handleLoadOcrLearningDraft: ocrAdmin.handleLoadOcrLearningDraft,
    handleUpdateOcrLearningSignal: ocrAdmin.handleUpdateOcrLearningSignal,
    formatOcrLearningStatusLabel,
    formatOcrProfileName,
    formatOcrFieldLabel,
    formatOcrSignalTypeLabel,
    ocrProfileMatcherProfileFilter: ocrAdmin.ocrProfileMatcherProfileFilter,
    ocrProfileMatcherProfiles: ocrAdmin.ocrProfileMatcherProfiles,
    ocrProfileMatchers: ocrAdmin.ocrProfileMatchers,
    ocrProfileMatcherForm: ocrAdmin.ocrProfileMatcherForm,
    ocrProfileMatcherSaving: ocrAdmin.ocrProfileMatcherSaving,
    setOcrProfileMatcherProfileFilter: ocrAdmin.setOcrProfileMatcherProfileFilter,
    loadOcrProfileMatchers: ocrAdmin.loadOcrProfileMatchers,
    updateOcrProfileMatcherFormField: ocrAdmin.updateOcrProfileMatcherFormField,
    handleSaveOcrProfileMatcher: ocrAdmin.handleSaveOcrProfileMatcher,
    resetOcrProfileMatcherEditor: ocrAdmin.resetOcrProfileMatcherEditor,
    editOcrProfileMatcher: ocrAdmin.editOcrProfileMatcher,
    formatSourceTypeLabel,
    ocrRuleProfileFilter: ocrAdmin.ocrRuleProfileFilter,
    ocrRuleProfiles: ocrAdmin.ocrRuleProfiles,
    ocrRuleTargetFields: ocrAdmin.ocrRuleTargetFields,
    ocrRules: ocrAdmin.ocrRules,
    ocrRuleForm: ocrAdmin.ocrRuleForm,
    ocrRuleSaving: ocrAdmin.ocrRuleSaving,
    setOcrRuleProfileFilter: ocrAdmin.setOcrRuleProfileFilter,
    loadOcrRules: ocrAdmin.loadOcrRules,
    updateOcrRuleFormField: ocrAdmin.updateOcrRuleFormField,
    handleSaveOcrRule: ocrAdmin.handleSaveOcrRule,
    resetOcrRuleEditor: ocrAdmin.resetOcrRuleEditor,
    editOcrRule: ocrAdmin.editOcrRule,
    formatValueParserLabel,
  };
}
