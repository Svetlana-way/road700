import { useEffect, useRef, useState } from "react";
import type { OcrLearningDraftsResponse } from "../contracts/api/admin";
import { buildOcrProfileMatcherPayload, buildOcrRulePayload } from "../shared/adminPayloadBuilders";
import { type TechAdminTab, type WorkspaceTab } from "../shared/appRoute";
import { apiRequest } from "../shared/apiCore";
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
} from "../features/admin/queryBuilders";
import type {
  OcrLearningResponse,
  OcrLearningSignalItem,
  OcrProfileMatcherItem,
  OcrProfileMatcherResponse,
  OcrRuleItem,
  OcrRuleResponse,
  SystemStatus,
  UserRole,
} from "../contracts/domain/workspace";
import type { OcrProfileMatcherFormState, OcrRuleFormState } from "../shared/workspaceFormTypes";

type UseOcrAdminParams = {
  token: string | null;
  userRole: UserRole | null | undefined;
  activeWorkspaceTab: WorkspaceTab;
  activeTechAdminTab: TechAdminTab;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  openTechAdmin: (tab?: TechAdminTab) => void;
};

export function useOcrAdmin({
  token,
  userRole,
  activeWorkspaceTab,
  activeTechAdminTab,
  setErrorMessage,
  setSuccessMessage,
  openTechAdmin,
}: UseOcrAdminParams) {
  const [ocrRules, setOcrRules] = useState<OcrRuleItem[]>([]);
  const [allOcrRules, setAllOcrRules] = useState<OcrRuleItem[]>([]);
  const [ocrRuleProfiles, setOcrRuleProfiles] = useState<string[]>([]);
  const [ocrRuleTargetFields, setOcrRuleTargetFields] = useState<string[]>([]);
  const [ocrRuleProfileFilter, setOcrRuleProfileFilter] = useState("");
  const [ocrRuleSaving, setOcrRuleSaving] = useState(false);
  const [ocrRuleForm, setOcrRuleForm] = useState<OcrRuleFormState>(createEmptyOcrRuleForm);
  const [ocrProfileMatchers, setOcrProfileMatchers] = useState<OcrProfileMatcherItem[]>([]);
  const [allOcrProfileMatchers, setAllOcrProfileMatchers] = useState<OcrProfileMatcherItem[]>([]);
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
  const ocrRulesRequestIdRef = useRef(0);
  const ocrProfileMatchersRequestIdRef = useRef(0);
  const ocrLearningRequestIdRef = useRef(0);
  const systemStatusRequestIdRef = useRef(0);
  const ocrRulesInitializedRef = useRef(false);
  const ocrProfileMatchersInitializedRef = useRef(false);
  const ocrLearningInitializedRef = useRef(false);
  const systemStatusInitializedRef = useRef(false);

  function applyBootstrapOcrAdmin(payload: {
    ocrRulesPayload: OcrRuleResponse | null;
    ocrProfileMatchersPayload: OcrProfileMatcherResponse | null;
    ocrLearningPayload: OcrLearningResponse | null;
    systemStatusPayload: SystemStatus | null;
  }) {
    if (payload.ocrRulesPayload !== null) {
      ocrRulesInitializedRef.current = true;
    }
    if (payload.ocrProfileMatchersPayload !== null) {
      ocrProfileMatchersInitializedRef.current = true;
    }
    if (payload.ocrLearningPayload !== null) {
      ocrLearningInitializedRef.current = true;
    }
    if (payload.systemStatusPayload !== null) {
      systemStatusInitializedRef.current = true;
    }
    setOcrRules(payload.ocrRulesPayload?.items || []);
    setAllOcrRules(payload.ocrRulesPayload?.items || []);
    setOcrRuleProfiles(payload.ocrRulesPayload?.profile_scopes || []);
    setOcrRuleTargetFields(payload.ocrRulesPayload?.target_fields || []);
    setOcrProfileMatchers(payload.ocrProfileMatchersPayload?.items || []);
    setAllOcrProfileMatchers(payload.ocrProfileMatchersPayload?.items || []);
    setOcrProfileMatcherProfiles(payload.ocrProfileMatchersPayload?.profile_scopes || []);
    setOcrLearningSignals(payload.ocrLearningPayload?.items || []);
    setOcrLearningSummaries(payload.ocrLearningPayload?.summaries || []);
    setOcrLearningStatuses(payload.ocrLearningPayload?.statuses || []);
    setOcrLearningTargetFields(payload.ocrLearningPayload?.target_fields || []);
    setOcrLearningProfileScopes(payload.ocrLearningPayload?.profile_scopes || []);
    setSystemStatus(payload.systemStatusPayload);
  }

  async function loadSystemStatus() {
    if (!token || userRole !== "admin") {
      return;
    }
    const requestId = systemStatusRequestIdRef.current + 1;
    systemStatusRequestIdRef.current = requestId;
    const payload = await apiRequest<SystemStatus>("/system/status", { method: "GET" }, token);
    if (systemStatusRequestIdRef.current !== requestId) {
      return;
    }
    systemStatusInitializedRef.current = true;
    setSystemStatus(payload);
  }

  async function loadOcrRules(profileScope: string = ocrRuleProfileFilter) {
    if (!token || userRole !== "admin") {
      return;
    }
    const requestId = ocrRulesRequestIdRef.current + 1;
    ocrRulesRequestIdRef.current = requestId;
    const queryString = buildOcrRulesQueryString(profileScope);
    const [payload, fullPayload] = await Promise.all([
      apiRequest<OcrRuleResponse>(`/ocr-rules${queryString ? `?${queryString}` : ""}`, { method: "GET" }, token),
      profileScope
        ? apiRequest<OcrRuleResponse>("/ocr-rules", { method: "GET" }, token)
        : Promise.resolve<OcrRuleResponse | null>(null),
    ]);
    if (ocrRulesRequestIdRef.current !== requestId) {
      return;
    }
    ocrRulesInitializedRef.current = true;
    setOcrRules(payload.items);
    setOcrRuleProfiles(payload.profile_scopes);
    setOcrRuleTargetFields(payload.target_fields);
    setAllOcrRules(fullPayload?.items || payload.items);
  }

  async function loadOcrProfileMatchers(profileScope: string = ocrProfileMatcherProfileFilter) {
    if (!token || userRole !== "admin") {
      return;
    }
    const requestId = ocrProfileMatchersRequestIdRef.current + 1;
    ocrProfileMatchersRequestIdRef.current = requestId;
    const queryString = buildOcrProfileMatchersQueryString(profileScope);
    const [payload, fullPayload] = await Promise.all([
      apiRequest<OcrProfileMatcherResponse>(
        `/ocr-profile-matchers${queryString ? `?${queryString}` : ""}`,
        { method: "GET" },
        token,
      ),
      profileScope
        ? apiRequest<OcrProfileMatcherResponse>("/ocr-profile-matchers", { method: "GET" }, token)
        : Promise.resolve<OcrProfileMatcherResponse | null>(null),
    ]);
    if (ocrProfileMatchersRequestIdRef.current !== requestId) {
      return;
    }
    ocrProfileMatchersInitializedRef.current = true;
    setOcrProfileMatchers(payload.items);
    setOcrProfileMatcherProfiles(payload.profile_scopes);
    setAllOcrProfileMatchers(fullPayload?.items || payload.items);
  }

  async function loadOcrLearningSignals(
    statusFilter: string = ocrLearningStatusFilter,
    targetFieldFilter: string = ocrLearningTargetFieldFilter,
    profileScopeFilter: string = ocrLearningProfileScopeFilter,
  ) {
    if (!token || userRole !== "admin") {
      return;
    }
    const requestId = ocrLearningRequestIdRef.current + 1;
    ocrLearningRequestIdRef.current = requestId;
    setOcrLearningLoading(true);
    try {
      const payload = await fetchAllOcrLearningSignals(statusFilter, targetFieldFilter, profileScopeFilter);
      if (ocrLearningRequestIdRef.current !== requestId) {
        return;
      }
      ocrLearningInitializedRef.current = true;
      setOcrLearningSignals(payload.items);
      setOcrLearningSummaries(payload.summaries);
      setOcrLearningStatuses(payload.statuses);
      setOcrLearningTargetFields(payload.target_fields);
      setOcrLearningProfileScopes(payload.profile_scopes);
    } finally {
      if (ocrLearningRequestIdRef.current === requestId) {
        setOcrLearningLoading(false);
      }
    }
  }

  async function fetchOcrLearningSignalsPage(
    statusFilter: string,
    targetFieldFilter: string,
    profileScopeFilter: string,
    limit: number,
    offset: number,
  ) {
    return apiRequest<OcrLearningResponse>(
      `/ocr-learning/signals?${buildOcrLearningSignalsQueryString(
        statusFilter,
        targetFieldFilter,
        profileScopeFilter,
        limit,
        offset,
      )}`,
      { method: "GET" },
      token || undefined,
    );
  }

  async function fetchAllOcrLearningSignals(
    statusFilter: string,
    targetFieldFilter: string,
    profileScopeFilter: string,
  ) {
    const pageSize = 200;
    const firstPage = await fetchOcrLearningSignalsPage(statusFilter, targetFieldFilter, profileScopeFilter, pageSize, 0);
    if (firstPage.total <= firstPage.items.length) {
      return firstPage;
    }

    const items = [...firstPage.items];
    for (let offset = firstPage.items.length; offset < firstPage.total; offset += pageSize) {
      const nextPage = await fetchOcrLearningSignalsPage(statusFilter, targetFieldFilter, profileScopeFilter, pageSize, offset);
      items.push(...nextPage.items);
    }

    return {
      ...firstPage,
      items,
    };
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
    ocrRulesRequestIdRef.current += 1;
    ocrProfileMatchersRequestIdRef.current += 1;
    ocrLearningRequestIdRef.current += 1;
    systemStatusRequestIdRef.current += 1;
    ocrRulesInitializedRef.current = false;
    ocrProfileMatchersInitializedRef.current = false;
    ocrLearningInitializedRef.current = false;
    systemStatusInitializedRef.current = false;
    setOcrRules([]);
    setAllOcrRules([]);
    setOcrRuleProfiles([]);
    setOcrRuleTargetFields([]);
    setOcrRuleProfileFilter("");
    setOcrRuleSaving(false);
    setOcrRuleForm(createEmptyOcrRuleForm());
    setOcrProfileMatchers([]);
    setAllOcrProfileMatchers([]);
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

  useEffect(() => {
    if (!token || userRole !== "admin") {
      return;
    }
    if ((activeWorkspaceTab === "admin" || activeWorkspaceTab === "tech_admin") && !systemStatusInitializedRef.current) {
      void loadSystemStatus().catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить статус системы");
      });
    }
    if (activeWorkspaceTab !== "tech_admin") {
      return;
    }
    if (activeTechAdminTab === "rules" && !ocrRulesInitializedRef.current) {
      void loadOcrRules().catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить OCR-правила");
      });
    } else if (activeTechAdminTab === "matchers" && !ocrProfileMatchersInitializedRef.current) {
      void loadOcrProfileMatchers().catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить правила выбора шаблона");
      });
    } else if (activeTechAdminTab === "learning" && !ocrLearningInitializedRef.current) {
      void loadOcrLearningSignals().catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить OCR-сигналы");
      });
    }
  }, [activeTechAdminTab, activeWorkspaceTab, setErrorMessage, token, userRole]);

  useEffect(() => {
    if (ocrRuleForm.id === null) {
      return;
    }
    if (allOcrRules.some((item) => item.id === ocrRuleForm.id)) {
      return;
    }
    resetOcrRuleEditor();
  }, [allOcrRules, ocrRuleForm.id]);

  useEffect(() => {
    if (ocrProfileMatcherForm.id === null) {
      return;
    }
    if (allOcrProfileMatchers.some((item) => item.id === ocrProfileMatcherForm.id)) {
      return;
    }
    resetOcrProfileMatcherEditor();
  }, [allOcrProfileMatchers, ocrProfileMatcherForm.id]);

  useEffect(() => {
    if (!ocrRuleProfileFilter || ocrRuleProfiles.includes(ocrRuleProfileFilter)) {
      return;
    }
    setOcrRuleProfileFilter("");
    if (!token || userRole !== "admin") {
      return;
    }
    void loadOcrRules("");
  }, [ocrRuleProfiles, ocrRuleProfileFilter, token, userRole]);

  useEffect(() => {
    if (!ocrProfileMatcherProfileFilter || ocrProfileMatcherProfiles.includes(ocrProfileMatcherProfileFilter)) {
      return;
    }
    setOcrProfileMatcherProfileFilter("");
    if (!token || userRole !== "admin") {
      return;
    }
    void loadOcrProfileMatchers("");
  }, [ocrProfileMatcherProfiles, ocrProfileMatcherProfileFilter, token, userRole]);

  useEffect(() => {
    const nextStatusFilter =
      ocrLearningStatusFilter && !ocrLearningStatuses.includes(ocrLearningStatusFilter) ? "" : ocrLearningStatusFilter;
    const nextTargetFieldFilter =
      ocrLearningTargetFieldFilter && !ocrLearningTargetFields.includes(ocrLearningTargetFieldFilter)
        ? ""
        : ocrLearningTargetFieldFilter;
    const nextProfileScopeFilter =
      ocrLearningProfileScopeFilter && !ocrLearningProfileScopes.includes(ocrLearningProfileScopeFilter)
        ? ""
        : ocrLearningProfileScopeFilter;

    if (
      nextStatusFilter === ocrLearningStatusFilter &&
      nextTargetFieldFilter === ocrLearningTargetFieldFilter &&
      nextProfileScopeFilter === ocrLearningProfileScopeFilter
    ) {
      return;
    }

    setOcrLearningStatusFilter(nextStatusFilter);
    setOcrLearningTargetFieldFilter(nextTargetFieldFilter);
    setOcrLearningProfileScopeFilter(nextProfileScopeFilter);

    if (!token || userRole !== "admin") {
      return;
    }
    void loadOcrLearningSignals(nextStatusFilter, nextTargetFieldFilter, nextProfileScopeFilter);
  }, [
    ocrLearningProfileScopeFilter,
    ocrLearningProfileScopes,
    ocrLearningStatusFilter,
    ocrLearningStatuses,
    ocrLearningTargetFieldFilter,
    ocrLearningTargetFields,
    token,
    userRole,
  ]);

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
