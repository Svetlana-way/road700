import { useState } from "react";
import { buildOcrProfileMatcherPayload, buildOcrRulePayload } from "../shared/adminPayloadBuilders";
import { type TechAdminTab } from "../shared/appRoute";
import { apiRequest } from "../shared/api";
import {
  createEmptyOcrProfileMatcherForm,
  createEmptyOcrRuleForm,
  createOcrProfileMatcherFormFromItem,
  createOcrRuleFormFromItem,
} from "../shared/formStateFactories";
import {
  buildOcrLearningSignalsQueryString,
  buildOcrProfileMatchersQueryString,
  buildOcrRulesQueryString,
} from "../shared/queryBuilders";
import type {
  OcrLearningResponse,
  OcrLearningSignalItem,
  OcrProfileMatcherItem,
  OcrProfileMatcherResponse,
  OcrRuleItem,
  OcrRuleResponse,
  SystemStatus,
  UserRole,
} from "../shared/workspaceBootstrapTypes";
import type { OcrProfileMatcherFormState, OcrRuleFormState } from "../shared/workspaceFormTypes";

type OcrLearningDraftsResponse = {
  signal: OcrLearningSignalItem;
  ocr_rule_draft: {
    profile_scope: string;
    target_field: string;
    pattern: string;
    value_parser: string;
    confidence: number;
    priority: number;
    notes: string | null;
  };
  matcher_draft: {
    profile_scope: string;
    title: string;
    source_type: string | null;
    filename_pattern: string | null;
    text_pattern: string | null;
    service_name_pattern: string | null;
    priority: number;
    notes: string | null;
  };
};

type UseOcrAdminParams = {
  token: string | null;
  userRole: UserRole | null | undefined;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  openTechAdmin: (tab?: TechAdminTab) => void;
};

export function useOcrAdmin({
  token,
  userRole,
  setErrorMessage,
  setSuccessMessage,
  openTechAdmin,
}: UseOcrAdminParams) {
  const [ocrRules, setOcrRules] = useState<OcrRuleItem[]>([]);
  const [ocrRuleProfiles, setOcrRuleProfiles] = useState<string[]>([]);
  const [ocrRuleTargetFields, setOcrRuleTargetFields] = useState<string[]>([]);
  const [ocrRuleProfileFilter, setOcrRuleProfileFilter] = useState("");
  const [ocrRuleSaving, setOcrRuleSaving] = useState(false);
  const [ocrRuleForm, setOcrRuleForm] = useState<OcrRuleFormState>(createEmptyOcrRuleForm);
  const [ocrProfileMatchers, setOcrProfileMatchers] = useState<OcrProfileMatcherItem[]>([]);
  const [ocrProfileMatcherProfiles, setOcrProfileMatcherProfiles] = useState<string[]>([]);
  const [ocrProfileMatcherProfileFilter, setOcrProfileMatcherProfileFilter] = useState("");
  const [ocrProfileMatcherSaving, setOcrProfileMatcherSaving] = useState(false);
  const [ocrProfileMatcherForm, setOcrProfileMatcherForm] = useState<OcrProfileMatcherFormState>(
    createEmptyOcrProfileMatcherForm,
  );
  const [ocrLearningSignals, setOcrLearningSignals] = useState<OcrLearningSignalItem[]>([]);
  const [ocrLearningSummaries, setOcrLearningSummaries] = useState<OcrLearningResponse["summaries"]>([]);
  const [ocrLearningStatuses, setOcrLearningStatuses] = useState<string[]>([]);
  const [ocrLearningTargetFields, setOcrLearningTargetFields] = useState<string[]>([]);
  const [ocrLearningProfileScopes, setOcrLearningProfileScopes] = useState<string[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [ocrLearningStatusFilter, setOcrLearningStatusFilter] = useState("");
  const [ocrLearningTargetFieldFilter, setOcrLearningTargetFieldFilter] = useState("");
  const [ocrLearningProfileScopeFilter, setOcrLearningProfileScopeFilter] = useState("");
  const [showOcrLearningListDialog, setShowOcrLearningListDialog] = useState(false);
  const [ocrLearningLoading, setOcrLearningLoading] = useState(false);
  const [ocrLearningUpdateId, setOcrLearningUpdateId] = useState<number | null>(null);
  const [ocrLearningDraftId, setOcrLearningDraftId] = useState<number | null>(null);

  function applyBootstrapOcrAdmin(payload: {
    ocrRulesPayload: OcrRuleResponse | null;
    ocrProfileMatchersPayload: OcrProfileMatcherResponse | null;
    ocrLearningPayload: OcrLearningResponse | null;
    systemStatusPayload: SystemStatus | null;
  }) {
    setOcrRules(payload.ocrRulesPayload?.items || []);
    setOcrRuleProfiles(payload.ocrRulesPayload?.profile_scopes || []);
    setOcrRuleTargetFields(payload.ocrRulesPayload?.target_fields || []);
    setOcrProfileMatchers(payload.ocrProfileMatchersPayload?.items || []);
    setOcrProfileMatcherProfiles(payload.ocrProfileMatchersPayload?.profile_scopes || []);
    setOcrLearningSignals(payload.ocrLearningPayload?.items || []);
    setOcrLearningSummaries(payload.ocrLearningPayload?.summaries || []);
    setOcrLearningStatuses(payload.ocrLearningPayload?.statuses || []);
    setOcrLearningTargetFields(payload.ocrLearningPayload?.target_fields || []);
    setOcrLearningProfileScopes(payload.ocrLearningPayload?.profile_scopes || []);
    setSystemStatus(payload.systemStatusPayload);
  }

  async function loadOcrRules(profileScope: string = ocrRuleProfileFilter) {
    if (!token) {
      return;
    }
    const queryString = buildOcrRulesQueryString(profileScope);
    const payload = await apiRequest<OcrRuleResponse>(
      `/ocr-rules${queryString ? `?${queryString}` : ""}`,
      { method: "GET" },
      token,
    );
    setOcrRules(payload.items);
    setOcrRuleProfiles(payload.profile_scopes);
    setOcrRuleTargetFields(payload.target_fields);
  }

  async function loadOcrProfileMatchers(profileScope: string = ocrProfileMatcherProfileFilter) {
    if (!token) {
      return;
    }
    const queryString = buildOcrProfileMatchersQueryString(profileScope);
    const payload = await apiRequest<OcrProfileMatcherResponse>(
      `/ocr-profile-matchers${queryString ? `?${queryString}` : ""}`,
      { method: "GET" },
      token,
    );
    setOcrProfileMatchers(payload.items);
    setOcrProfileMatcherProfiles(payload.profile_scopes);
  }

  async function loadOcrLearningSignals(
    statusFilter: string = ocrLearningStatusFilter,
    targetFieldFilter: string = ocrLearningTargetFieldFilter,
    profileScopeFilter: string = ocrLearningProfileScopeFilter,
  ) {
    if (!token) {
      return;
    }
    setOcrLearningLoading(true);
    try {
      const payload = await apiRequest<OcrLearningResponse>(
        `/ocr-learning/signals?${buildOcrLearningSignalsQueryString(statusFilter, targetFieldFilter, profileScopeFilter)}`,
        { method: "GET" },
        token,
      );
      setOcrLearningSignals(payload.items);
      setOcrLearningSummaries(payload.summaries);
      setOcrLearningStatuses(payload.statuses);
      setOcrLearningTargetFields(payload.target_fields);
      setOcrLearningProfileScopes(payload.profile_scopes);
    } finally {
      setOcrLearningLoading(false);
    }
  }

  function updateOcrRuleFormField(field: keyof OcrRuleFormState, value: string) {
    setOcrRuleForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function editOcrRule(item: OcrRuleItem) {
    openTechAdmin("rules");
    setOcrRuleForm(createOcrRuleFormFromItem(item));
  }

  function resetOcrRuleEditor() {
    setOcrRuleForm(createEmptyOcrRuleForm());
  }

  async function handleSaveOcrRule() {
    if (!token || userRole !== "admin") {
      return;
    }
    if (!ocrRuleForm.profile_scope.trim() || !ocrRuleForm.target_field.trim() || !ocrRuleForm.pattern.trim()) {
      setErrorMessage("Для OCR-правила обязательны шаблон, поле и выражение поиска");
      return;
    }

    setOcrRuleSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = buildOcrRulePayload(ocrRuleForm);

      if (ocrRuleForm.id) {
        await apiRequest<OcrRuleItem>(
          `/ocr-rules/${ocrRuleForm.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("OCR-правило обновлено");
      } else {
        await apiRequest<OcrRuleItem>(
          "/ocr-rules",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("OCR-правило создано");
      }

      await loadOcrRules();
      resetOcrRuleEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить OCR-правило");
    } finally {
      setOcrRuleSaving(false);
    }
  }

  function updateOcrProfileMatcherFormField(field: keyof OcrProfileMatcherFormState, value: string) {
    setOcrProfileMatcherForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function editOcrProfileMatcher(item: OcrProfileMatcherItem) {
    openTechAdmin("matchers");
    setOcrProfileMatcherForm(createOcrProfileMatcherFormFromItem(item));
  }

  function resetOcrProfileMatcherEditor() {
    setOcrProfileMatcherForm(createEmptyOcrProfileMatcherForm());
  }

  async function handleSaveOcrProfileMatcher() {
    if (!token || userRole !== "admin") {
      return;
    }
    if (!ocrProfileMatcherForm.profile_scope.trim() || !ocrProfileMatcherForm.title.trim()) {
      setErrorMessage("Для правила выбора шаблона обязательны шаблон и название");
      return;
    }

    setOcrProfileMatcherSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = buildOcrProfileMatcherPayload(ocrProfileMatcherForm);

      if (ocrProfileMatcherForm.id) {
        await apiRequest<OcrProfileMatcherItem>(
          `/ocr-profile-matchers/${ocrProfileMatcherForm.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Правило выбора шаблона обновлено");
      } else {
        await apiRequest<OcrProfileMatcherItem>(
          "/ocr-profile-matchers",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Правило выбора шаблона создано");
      }

      await loadOcrProfileMatchers();
      resetOcrProfileMatcherEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить правило выбора шаблона");
    } finally {
      setOcrProfileMatcherSaving(false);
    }
  }

  async function handleUpdateOcrLearningSignal(signalId: number, nextStatus: string) {
    if (!token || userRole !== "admin") {
      return;
    }
    setOcrLearningUpdateId(signalId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<OcrLearningSignalItem>(
        `/ocr-learning/signals/${signalId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        },
        token,
      );
      setSuccessMessage("OCR-сигнал обновлён");
      await loadOcrLearningSignals();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить OCR-сигнал");
    } finally {
      setOcrLearningUpdateId(null);
    }
  }

  async function handleLoadOcrLearningDraft(signalId: number, target: "ocr_rule" | "matcher") {
    if (!token || userRole !== "admin") {
      return;
    }
    setOcrLearningDraftId(signalId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = await apiRequest<OcrLearningDraftsResponse>(
        `/ocr-learning/signals/${signalId}/drafts`,
        { method: "GET" },
        token,
      );

      if (target === "ocr_rule") {
        openTechAdmin("rules");
        setOcrRuleForm({
          id: null,
          profile_scope: payload.ocr_rule_draft.profile_scope,
          target_field: payload.ocr_rule_draft.target_field,
          pattern: payload.ocr_rule_draft.pattern,
          value_parser: payload.ocr_rule_draft.value_parser,
          confidence: String(payload.ocr_rule_draft.confidence),
          priority: String(payload.ocr_rule_draft.priority),
          is_active: "true",
          notes: payload.ocr_rule_draft.notes || "",
        });
        setOcrRuleProfileFilter(payload.ocr_rule_draft.profile_scope);
        setSuccessMessage("Черновик OCR-правила перенесён в форму редактирования");
      } else {
        openTechAdmin("matchers");
        setOcrProfileMatcherForm({
          id: null,
          profile_scope: payload.matcher_draft.profile_scope,
          title: payload.matcher_draft.title,
          source_type: payload.matcher_draft.source_type || "",
          filename_pattern: payload.matcher_draft.filename_pattern || "",
          text_pattern: payload.matcher_draft.text_pattern || "",
          service_name_pattern: payload.matcher_draft.service_name_pattern || "",
          priority: String(payload.matcher_draft.priority),
          is_active: "true",
          notes: payload.matcher_draft.notes || "",
        });
        setOcrProfileMatcherProfileFilter(payload.matcher_draft.profile_scope);
        setSuccessMessage("Черновик правила выбора перенесён в форму редактирования");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить черновик OCR");
    } finally {
      setOcrLearningDraftId(null);
    }
  }

  function resetOcrAdminState() {
    setOcrRules([]);
    setOcrRuleProfiles([]);
    setOcrRuleTargetFields([]);
    setOcrRuleProfileFilter("");
    setOcrRuleSaving(false);
    setOcrRuleForm(createEmptyOcrRuleForm());
    setOcrProfileMatchers([]);
    setOcrProfileMatcherProfiles([]);
    setOcrProfileMatcherProfileFilter("");
    setOcrProfileMatcherSaving(false);
    setOcrProfileMatcherForm(createEmptyOcrProfileMatcherForm());
    setOcrLearningSignals([]);
    setOcrLearningSummaries([]);
    setOcrLearningStatuses([]);
    setOcrLearningTargetFields([]);
    setOcrLearningProfileScopes([]);
    setSystemStatus(null);
    setOcrLearningStatusFilter("");
    setOcrLearningTargetFieldFilter("");
    setOcrLearningProfileScopeFilter("");
    setShowOcrLearningListDialog(false);
    setOcrLearningLoading(false);
    setOcrLearningUpdateId(null);
    setOcrLearningDraftId(null);
  }

  return {
    ocrRules,
    ocrRuleProfiles,
    ocrRuleTargetFields,
    ocrRuleProfileFilter,
    setOcrRuleProfileFilter,
    ocrRuleSaving,
    ocrRuleForm,
    ocrProfileMatchers,
    ocrProfileMatcherProfiles,
    ocrProfileMatcherProfileFilter,
    setOcrProfileMatcherProfileFilter,
    ocrProfileMatcherSaving,
    ocrProfileMatcherForm,
    ocrLearningSignals,
    ocrLearningSummaries,
    ocrLearningStatuses,
    ocrLearningTargetFields,
    ocrLearningProfileScopes,
    systemStatus,
    ocrLearningStatusFilter,
    setOcrLearningStatusFilter,
    ocrLearningTargetFieldFilter,
    setOcrLearningTargetFieldFilter,
    ocrLearningProfileScopeFilter,
    setOcrLearningProfileScopeFilter,
    showOcrLearningListDialog,
    setShowOcrLearningListDialog,
    ocrLearningLoading,
    ocrLearningUpdateId,
    ocrLearningDraftId,
    applyBootstrapOcrAdmin,
    loadOcrRules,
    loadOcrProfileMatchers,
    loadOcrLearningSignals,
    updateOcrRuleFormField,
    editOcrRule,
    resetOcrRuleEditor,
    handleSaveOcrRule,
    updateOcrProfileMatcherFormField,
    editOcrProfileMatcher,
    resetOcrProfileMatcherEditor,
    handleSaveOcrProfileMatcher,
    handleUpdateOcrLearningSignal,
    handleLoadOcrLearningDraft,
    resetOcrAdminState,
  };
}
