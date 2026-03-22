import {
  formatDateTime,
  formatFileSize,
  formatReviewBucketLabel,
  formatReviewRuleTypeLabel,
  formatStatus,
} from "./displayFormatters";
import type { BuildAdminWorkspacePropsParams } from "./buildAdminWorkspaceProps";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

type AdminGovernanceSectionParams = Pick<
  BuildAdminWorkspacePropsParams,
  | "formatStatus"
  | "backupActionLoading"
  | "backupsLoading"
  | "backups"
  | "backupRestoreDialogOpen"
  | "backupRestoreTarget"
  | "backupRestoreConfirmValue"
  | "handleCreateBackup"
  | "loadBackups"
  | "handleDownloadBackup"
  | "openBackupRestoreDialog"
  | "closeBackupRestoreDialog"
  | "setBackupRestoreConfirmValue"
  | "handleRestoreBackup"
  | "formatDateTime"
  | "formatFileSize"
  | "showReviewRuleEditor"
  | "reviewRuleForm"
  | "reviewRuleSaving"
  | "reviewRules"
  | "reviewRuleTypes"
  | "showReviewRuleListDialog"
  | "openReviewRulesAdmin"
  | "setShowReviewRuleEditor"
  | "updateReviewRuleFormField"
  | "handleSaveReviewRule"
  | "resetReviewRuleEditor"
  | "setShowReviewRuleListDialog"
  | "editReviewRule"
  | "formatReviewRuleTypeLabel"
  | "formatReviewBucketLabel"
>;

export function buildAdminGovernanceSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): AdminGovernanceSectionParams {
  const { backupsAdmin, reviewRulesAdmin, navigation } = context;

  return {
    formatStatus,
    backupActionLoading: backupsAdmin.backupActionLoading,
    backupsLoading: backupsAdmin.backupsLoading,
    backups: backupsAdmin.backups,
    backupRestoreDialogOpen: backupsAdmin.backupRestoreDialogOpen,
    backupRestoreTarget: backupsAdmin.backupRestoreTarget,
    backupRestoreConfirmValue: backupsAdmin.backupRestoreConfirmValue,
    handleCreateBackup: backupsAdmin.handleCreateBackup,
    loadBackups: backupsAdmin.loadBackups,
    handleDownloadBackup: backupsAdmin.handleDownloadBackup,
    openBackupRestoreDialog: backupsAdmin.openBackupRestoreDialog,
    closeBackupRestoreDialog: backupsAdmin.closeBackupRestoreDialog,
    setBackupRestoreConfirmValue: backupsAdmin.setBackupRestoreConfirmValue,
    handleRestoreBackup: backupsAdmin.handleRestoreBackup,
    formatDateTime,
    formatFileSize,
    showReviewRuleEditor: reviewRulesAdmin.showReviewRuleEditor,
    reviewRuleForm: reviewRulesAdmin.reviewRuleForm,
    reviewRuleSaving: reviewRulesAdmin.reviewRuleSaving,
    reviewRules: reviewRulesAdmin.reviewRules,
    reviewRuleTypes: reviewRulesAdmin.reviewRuleTypes,
    showReviewRuleListDialog: reviewRulesAdmin.showReviewRuleListDialog,
    openReviewRulesAdmin: navigation.openReviewRulesAdmin,
    setShowReviewRuleEditor: reviewRulesAdmin.setShowReviewRuleEditor,
    updateReviewRuleFormField: reviewRulesAdmin.updateReviewRuleFormField,
    handleSaveReviewRule: reviewRulesAdmin.handleSaveReviewRule,
    resetReviewRuleEditor: reviewRulesAdmin.resetReviewRuleEditor,
    setShowReviewRuleListDialog: reviewRulesAdmin.setShowReviewRuleListDialog,
    editReviewRule: reviewRulesAdmin.editReviewRule,
    formatReviewRuleTypeLabel,
    formatReviewBucketLabel,
  };
}
