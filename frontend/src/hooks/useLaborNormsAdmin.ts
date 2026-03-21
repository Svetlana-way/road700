import { useEffect, useState } from "react";
import {
  buildLaborNormCatalogCreatePayload,
  buildLaborNormCatalogPayload,
  buildLaborNormEntryPayload,
} from "../shared/adminPayloadBuilders";
import { apiRequest } from "../shared/api";
import {
  createCatalogFormFromItem,
  createEmptyCatalogForm,
  createEmptyLaborNormEntryForm,
  createLaborNormEntryFormFromItem,
} from "../shared/formStateFactories";
import { buildLaborNormQueryString } from "../shared/queryBuilders";
import type {
  LaborNormCatalogConfigItem,
  LaborNormCatalogConfigResponse,
  LaborNormCatalogItem,
  LaborNormCatalogResponse,
  UserRole,
} from "../shared/workspaceBootstrapTypes";
import type { LaborNormCatalogFormState, LaborNormEntryFormState } from "../shared/workspaceFormTypes";

type LaborNormImportResponse = {
  message: string;
  filename: string;
  imported_at: string;
  created: number;
  updated: number;
  skipped: number;
};

type UseLaborNormsAdminParams = {
  token: string | null;
  userRole: UserRole | null | undefined;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  openLaborNormsAdmin: () => void;
};

export function useLaborNormsAdmin({
  token,
  userRole,
  setErrorMessage,
  setSuccessMessage,
  openLaborNormsAdmin,
}: UseLaborNormsAdminParams) {
  const [showLaborNormCatalogEditor, setShowLaborNormCatalogEditor] = useState(false);
  const [showLaborNormImport, setShowLaborNormImport] = useState(false);
  const [showLaborNormEntryEditor, setShowLaborNormEntryEditor] = useState(false);
  const [showLaborNormListDialog, setShowLaborNormListDialog] = useState(false);
  const [laborNorms, setLaborNorms] = useState<LaborNormCatalogItem[]>([]);
  const [laborNormCatalogs, setLaborNormCatalogs] = useState<LaborNormCatalogConfigItem[]>([]);
  const [laborNormTotal, setLaborNormTotal] = useState(0);
  const [laborNormScopes, setLaborNormScopes] = useState<string[]>([]);
  const [laborNormCategories, setLaborNormCategories] = useState<string[]>([]);
  const [laborNormSourceFiles, setLaborNormSourceFiles] = useState<string[]>([]);
  const [laborNormQuery, setLaborNormQuery] = useState("");
  const [laborNormScope, setLaborNormScope] = useState("");
  const [laborNormCategory, setLaborNormCategory] = useState("");
  const [laborNormLoading, setLaborNormLoading] = useState(false);
  const [laborNormImportLoading, setLaborNormImportLoading] = useState(false);
  const [laborNormFile, setLaborNormFile] = useState<File | null>(null);
  const [laborNormImportScope, setLaborNormImportScope] = useState("");
  const [laborNormImportBrandFamily, setLaborNormImportBrandFamily] = useState("");
  const [laborNormImportCatalogName, setLaborNormImportCatalogName] = useState("");
  const [laborNormCatalogSaving, setLaborNormCatalogSaving] = useState(false);
  const [laborNormEntrySaving, setLaborNormEntrySaving] = useState(false);
  const [editingLaborNormCatalogId, setEditingLaborNormCatalogId] = useState<number | null>(null);
  const [laborNormCatalogForm, setLaborNormCatalogForm] = useState<LaborNormCatalogFormState>(createEmptyCatalogForm);
  const [laborNormEntryForm, setLaborNormEntryForm] = useState<LaborNormEntryFormState>(createEmptyLaborNormEntryForm);

  function applyBootstrapLaborNorms(payload: {
    laborNormCatalog: LaborNormCatalogResponse | null;
    laborNormCatalogConfigs: LaborNormCatalogConfigResponse | null;
  }) {
    setLaborNorms(payload.laborNormCatalog?.items || []);
    setLaborNormTotal(payload.laborNormCatalog?.total || 0);
    setLaborNormScopes(payload.laborNormCatalog?.scopes || []);
    setLaborNormCategories(payload.laborNormCatalog?.categories || []);
    setLaborNormSourceFiles(payload.laborNormCatalog?.source_files || []);
    setLaborNormCatalogs(payload.laborNormCatalogConfigs?.items || []);
  }

  async function loadLaborNormCatalog(
    query: string = laborNormQuery,
    scope: string = laborNormScope,
    category: string = laborNormCategory,
  ) {
    if (!token) {
      return;
    }
    setLaborNormLoading(true);
    try {
      const payload = await apiRequest<LaborNormCatalogResponse>(
        `/labor-norms?${buildLaborNormQueryString(query, scope, category)}`,
        { method: "GET" },
        token,
      );
      setLaborNorms(payload.items);
      setLaborNormTotal(payload.total);
      setLaborNormScopes(payload.scopes);
      setLaborNormCategories(payload.categories);
      setLaborNormSourceFiles(payload.source_files);
    } finally {
      setLaborNormLoading(false);
    }
  }

  async function loadLaborNormCatalogConfigs() {
    if (!token) {
      return;
    }
    const payload = await apiRequest<LaborNormCatalogConfigResponse>(
      "/labor-norms/catalogs",
      { method: "GET" },
      token,
    );
    setLaborNormCatalogs(payload.items);
    if (!editingLaborNormCatalogId) {
      setLaborNormCatalogForm((current) => {
        if (current.scope || current.catalog_name || current.brand_family || current.notes) {
          return current;
        }
        return createEmptyCatalogForm();
      });
    }
  }

  function updateLaborNormCatalogFormField(field: keyof LaborNormCatalogFormState, value: string) {
    setLaborNormCatalogForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleLaborNormSearch() {
    if (!token || userRole !== "admin") {
      return;
    }
    setErrorMessage("");
    try {
      await loadLaborNormCatalog();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить справочник нормо-часов");
    }
  }

  async function resetLaborNormFilters() {
    if (!token) {
      return;
    }
    setLaborNormQuery("");
    setLaborNormScope("");
    setLaborNormCategory("");
    await loadLaborNormCatalog("", "", "");
  }

  async function handleLaborNormImport() {
    if (!token || userRole !== "admin" || !laborNormFile) {
      setErrorMessage("Выберите .xlsx файл справочника");
      return;
    }

    setLaborNormImportLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = new FormData();
      body.append("file", laborNormFile);
      body.append("scope", laborNormImportScope);
      body.append("brand_family", laborNormImportBrandFamily);
      body.append("catalog_name", laborNormImportCatalogName);

      const result = await apiRequest<LaborNormImportResponse>(
        "/labor-norms/import",
        {
          method: "POST",
          body,
        },
        token,
      );

      setSuccessMessage(
        `${result.message}. Создано ${result.created}, обновлено ${result.updated}, пропущено ${result.skipped}.`,
      );
      setLaborNormFile(null);
      setLaborNormScope(laborNormImportScope);
      await loadLaborNormCatalogConfigs();
      await loadLaborNormCatalog();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось импортировать справочник нормо-часов");
    } finally {
      setLaborNormImportLoading(false);
    }
  }

  function editLaborNormCatalog(item: LaborNormCatalogConfigItem) {
    openLaborNormsAdmin();
    setShowLaborNormCatalogEditor(true);
    setEditingLaborNormCatalogId(item.id);
    setLaborNormCatalogForm(createCatalogFormFromItem(item));
  }

  function resetLaborNormCatalogEditor() {
    setEditingLaborNormCatalogId(null);
    setLaborNormCatalogForm(createEmptyCatalogForm());
  }

  function selectCatalogScope(scope: string) {
    openLaborNormsAdmin();
    setShowLaborNormImport(true);
    setLaborNormImportScope(scope);
    const selectedCatalog = laborNormCatalogs.find((item) => item.scope === scope);
    if (selectedCatalog) {
      setLaborNormImportBrandFamily(selectedCatalog.brand_family || "");
      setLaborNormImportCatalogName(selectedCatalog.catalog_name);
      if (!laborNormEntryForm.scope) {
        setLaborNormEntryForm((current) => ({ ...current, scope }));
      }
    }
  }

  async function handleSaveLaborNormCatalog() {
    if (!token || userRole !== "admin") {
      return;
    }

    if (!laborNormCatalogForm.scope.trim() || !laborNormCatalogForm.catalog_name.trim()) {
      setErrorMessage("Для каталога обязательны код и название");
      return;
    }

    setLaborNormCatalogSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = buildLaborNormCatalogPayload(laborNormCatalogForm);

      if (editingLaborNormCatalogId) {
        await apiRequest<LaborNormCatalogConfigItem>(
          `/labor-norms/catalogs/${editingLaborNormCatalogId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Каталог нормо-часов обновлён");
      } else {
        await apiRequest<LaborNormCatalogConfigItem>(
          "/labor-norms/catalogs",
          {
            method: "POST",
            body: JSON.stringify(buildLaborNormCatalogCreatePayload(laborNormCatalogForm)),
          },
          token,
        );
        setSuccessMessage("Каталог нормо-часов создан");
      }

      await loadLaborNormCatalogConfigs();
      selectCatalogScope(laborNormCatalogForm.scope.trim());
      if (laborNormScope === laborNormCatalogForm.scope.trim()) {
        await loadLaborNormCatalog();
      }
      resetLaborNormCatalogEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить каталог нормо-часов");
    } finally {
      setLaborNormCatalogSaving(false);
    }
  }

  function updateLaborNormEntryFormField(field: keyof LaborNormEntryFormState, value: string) {
    setLaborNormEntryForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function editLaborNormItem(item: LaborNormCatalogItem) {
    openLaborNormsAdmin();
    setShowLaborNormEntryEditor(true);
    setLaborNormEntryForm(createLaborNormEntryFormFromItem(item));
  }

  function resetLaborNormEntryEditor(scope = laborNormScope || laborNormImportScope || laborNormCatalogs[0]?.scope || "") {
    setLaborNormEntryForm(createEmptyLaborNormEntryForm(scope));
  }

  async function handleSaveLaborNormEntry() {
    if (!token || userRole !== "admin") {
      return;
    }
    if (!laborNormEntryForm.scope.trim() || !laborNormEntryForm.code.trim() || !laborNormEntryForm.name_ru.trim()) {
      setErrorMessage("Для записи обязательны каталог, код и русское название");
      return;
    }
    if (!laborNormEntryForm.standard_hours.trim()) {
      setErrorMessage("Укажите норматив в часах");
      return;
    }

    setLaborNormEntrySaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = buildLaborNormEntryPayload(laborNormEntryForm);

      if (laborNormEntryForm.id) {
        await apiRequest<LaborNormCatalogItem>(
          `/labor-norms/${laborNormEntryForm.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Запись нормо-часов обновлена");
      } else {
        await apiRequest<LaborNormCatalogItem>(
          "/labor-norms",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Запись нормо-часов создана");
      }

      setLaborNormScope(laborNormEntryForm.scope.trim());
      await loadLaborNormCatalogConfigs();
      await loadLaborNormCatalog(laborNormQuery, laborNormEntryForm.scope.trim(), laborNormCategory);
      resetLaborNormEntryEditor(laborNormEntryForm.scope.trim());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить запись нормо-часов");
    } finally {
      setLaborNormEntrySaving(false);
    }
  }

  async function handleArchiveLaborNormItem(item: LaborNormCatalogItem) {
    if (!token || userRole !== "admin") {
      return;
    }
    setLaborNormEntrySaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<LaborNormCatalogItem>(
        `/labor-norms/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "archived" }),
        },
        token,
      );
      setSuccessMessage(`Запись ${item.code} отправлена в архив`);
      await loadLaborNormCatalog();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось отправить запись в архив");
    } finally {
      setLaborNormEntrySaving(false);
    }
  }

  function resetLaborNormsState() {
    setShowLaborNormCatalogEditor(false);
    setShowLaborNormImport(false);
    setShowLaborNormEntryEditor(false);
    setShowLaborNormListDialog(false);
    setLaborNorms([]);
    setLaborNormCatalogs([]);
    setLaborNormTotal(0);
    setLaborNormScopes([]);
    setLaborNormCategories([]);
    setLaborNormSourceFiles([]);
    setLaborNormQuery("");
    setLaborNormScope("");
    setLaborNormCategory("");
    setLaborNormLoading(false);
    setLaborNormImportLoading(false);
    setLaborNormFile(null);
    setLaborNormImportScope("");
    setLaborNormImportBrandFamily("");
    setLaborNormImportCatalogName("");
    setLaborNormCatalogSaving(false);
    setLaborNormEntrySaving(false);
    setEditingLaborNormCatalogId(null);
    setLaborNormCatalogForm(createEmptyCatalogForm());
    setLaborNormEntryForm(createEmptyLaborNormEntryForm());
  }

  useEffect(() => {
    if (laborNormCatalogs.length === 0) {
      return;
    }
    if (!laborNormEntryForm.scope) {
      setLaborNormEntryForm((current) => ({ ...current, scope: laborNormCatalogs[0].scope }));
    }
    if (!laborNormImportScope) {
      selectCatalogScope(laborNormCatalogs[0].scope);
    }
  }, [laborNormCatalogs, laborNormEntryForm.scope, laborNormImportScope]);

  return {
    showLaborNormCatalogEditor,
    setShowLaborNormCatalogEditor,
    showLaborNormImport,
    setShowLaborNormImport,
    showLaborNormEntryEditor,
    setShowLaborNormEntryEditor,
    showLaborNormListDialog,
    setShowLaborNormListDialog,
    laborNorms,
    laborNormCatalogs,
    laborNormTotal,
    laborNormScopes,
    laborNormCategories,
    laborNormSourceFiles,
    laborNormQuery,
    setLaborNormQuery,
    laborNormScope,
    setLaborNormScope,
    laborNormCategory,
    setLaborNormCategory,
    laborNormLoading,
    laborNormImportLoading,
    laborNormFile,
    setLaborNormFile,
    laborNormImportScope,
    laborNormImportBrandFamily,
    setLaborNormImportBrandFamily,
    laborNormImportCatalogName,
    setLaborNormImportCatalogName,
    laborNormCatalogSaving,
    laborNormEntrySaving,
    editingLaborNormCatalogId,
    laborNormCatalogForm,
    laborNormEntryForm,
    applyBootstrapLaborNorms,
    loadLaborNormCatalog,
    loadLaborNormCatalogConfigs,
    updateLaborNormCatalogFormField,
    handleLaborNormSearch,
    resetLaborNormFilters,
    handleLaborNormImport,
    editLaborNormCatalog,
    resetLaborNormCatalogEditor,
    selectCatalogScope,
    handleSaveLaborNormCatalog,
    updateLaborNormEntryFormField,
    editLaborNormItem,
    resetLaborNormEntryEditor,
    handleSaveLaborNormEntry,
    handleArchiveLaborNormItem,
    resetLaborNormsState,
  };
}
