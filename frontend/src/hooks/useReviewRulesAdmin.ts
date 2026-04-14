import { useEffect, useRef, useState } from "react";
import type { AdminTab, WorkspaceTab } from "../shared/appRoute";
import { buildReviewRulePayload } from "../shared/adminPayloadBuilders";
import { apiRequest } from "../shared/apiCore";
import { createEmptyReviewRuleForm, createReviewRuleFormFromItem } from "../shared/formStateFactories";
import type { ReviewRuleItem, ReviewRuleResponse, UserRole } from "../contracts/domain/workspace";
import type { ReviewRuleFormState } from "../shared/workspaceFormTypes";

type UseReviewRulesAdminParams = {
  token: string | null;
  userRole: UserRole | null | undefined;
  activeWorkspaceTab: WorkspaceTab;
  activeAdminTab: AdminTab;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  openReviewRulesAdmin: () => void;
};

export function useReviewRulesAdmin({
  token,
  userRole,
  activeWorkspaceTab,
  activeAdminTab,
  setErrorMessage,
  setSuccessMessage,
  openReviewRulesAdmin,
}: UseReviewRulesAdminParams) {
  const [showReviewRuleEditor, setShowReviewRuleEditor] = useState(false);
  const [showReviewRuleListDialog, setShowReviewRuleListDialog] = useState(false);
  const [reviewRules, setReviewRules] = useState<ReviewRuleItem[]>([]);
  const [reviewRuleTypes, setReviewRuleTypes] = useState<string[]>([]);
  const [reviewRuleSaving, setReviewRuleSaving] = useState(false);
  const [reviewRuleForm, setReviewRuleForm] = useState<ReviewRuleFormState>(createEmptyReviewRuleForm);
  const reviewRulesRequestIdRef = useRef(0);
  const reviewRulesInitializedRef = useRef(false);

  function applyBootstrapReviewRules(payload: ReviewRuleResponse | null) {
    reviewRulesRequestIdRef.current += 1;
    if (payload !== null) {
      reviewRulesInitializedRef.current = true;
    }
    setReviewRules(payload?.items || []);
    setReviewRuleTypes(payload?.rule_types || []);
  }

  async function loadReviewRules() {
    if (!token || userRole !== "admin") {
      return;
    }
    const requestId = reviewRulesRequestIdRef.current + 1;
    reviewRulesRequestIdRef.current = requestId;
    const payload = await apiRequest<ReviewRuleResponse>("/review/rules", { method: "GET" }, token);
    if (reviewRulesRequestIdRef.current !== requestId) {
      return;
    }
    reviewRulesInitializedRef.current = true;
    setReviewRules(payload.items);
    setReviewRuleTypes(payload.rule_types);
  }

  function updateReviewRuleFormField(field: keyof ReviewRuleFormState, value: string) {
    setReviewRuleForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function editReviewRule(item: ReviewRuleItem) {
    openReviewRulesAdmin();
    setShowReviewRuleEditor(true);
    setReviewRuleForm(createReviewRuleFormFromItem(item));
  }

  function resetReviewRuleEditor() {
    setReviewRuleForm(createEmptyReviewRuleForm());
  }

  async function handleSaveReviewRule() {
    if (!token || userRole !== "admin") {
      return;
    }
    if (!reviewRuleForm.rule_type.trim() || !reviewRuleForm.code.trim() || !reviewRuleForm.title.trim()) {
      setErrorMessage("Для правила обязательны тип, код и название");
      return;
    }

    setReviewRuleSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = buildReviewRulePayload(reviewRuleForm);

      if (reviewRuleForm.id) {
        await apiRequest<ReviewRuleItem>(
          `/review/rules/${reviewRuleForm.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              title: payload.title,
              weight: payload.weight,
              bucket_override: payload.bucket_override,
              is_active: payload.is_active,
              sort_order: payload.sort_order,
              notes: payload.notes,
            }),
          },
          token,
        );
        setSuccessMessage("Правило очереди проверки обновлено");
      } else {
        await apiRequest<ReviewRuleItem>(
          "/review/rules",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Правило очереди проверки создано");
      }

      await loadReviewRules();
      resetReviewRuleEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить правило проверки");
    } finally {
      setReviewRuleSaving(false);
    }
  }

  function resetReviewRulesState() {
    reviewRulesRequestIdRef.current += 1;
    reviewRulesInitializedRef.current = false;
    setShowReviewRuleEditor(false);
    setShowReviewRuleListDialog(false);
    setReviewRules([]);
    setReviewRuleTypes([]);
    setReviewRuleSaving(false);
    setReviewRuleForm(createEmptyReviewRuleForm());
  }

  useEffect(() => {
    if (!token || userRole !== "admin" || activeWorkspaceTab !== "admin" || activeAdminTab !== "control") {
      return;
    }
    if (reviewRulesInitializedRef.current) {
      return;
    }
    void loadReviewRules().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить правила проверки");
    });
  }, [activeAdminTab, activeWorkspaceTab, setErrorMessage, token, userRole]);

  useEffect(() => {
    if (!showReviewRuleEditor || reviewRuleForm.id === null) {
      return;
    }
    if (reviewRules.some((item) => item.id === reviewRuleForm.id)) {
      return;
    }
    setShowReviewRuleEditor(false);
    resetReviewRuleEditor();
  }, [reviewRuleForm.id, reviewRules, showReviewRuleEditor]);

  return {
    showReviewRuleEditor,
    setShowReviewRuleEditor,
    showReviewRuleListDialog,
    setShowReviewRuleListDialog,
    reviewRules,
    reviewRuleTypes,
    reviewRuleSaving,
    reviewRuleForm,
    applyBootstrapReviewRules,
    loadReviewRules,
    updateReviewRuleFormField,
    editReviewRule,
    resetReviewRuleEditor,
    handleSaveReviewRule,
    resetReviewRulesState,
  };
}
