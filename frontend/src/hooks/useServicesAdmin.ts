import { useEffect, useRef, useState } from "react";
import type { AdminTab, WorkspaceTab } from "../shared/appRoute";
import { buildServicePayload } from "../shared/adminPayloadBuilders";
import { apiRequest } from "../shared/api";
import { createEmptyServiceForm, createServiceFormFromItem } from "../shared/formStateFactories";
import { buildServiceQueryString } from "../shared/queryBuilders";
import type { ServiceItem, ServicesResponse, ServiceStatus, UserRole } from "../shared/workspaceBootstrapTypes";
import type { ServiceFormState } from "../shared/workspaceFormTypes";

type UseServicesAdminParams = {
  token: string;
  userRole: UserRole | null | undefined;
  activeWorkspaceTab: WorkspaceTab;
  activeAdminTab: AdminTab;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
};

export function useServicesAdmin({
  token,
  userRole,
  activeWorkspaceTab,
  activeAdminTab,
  setErrorMessage,
  setSuccessMessage,
}: UseServicesAdminParams) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [allServices, setAllServices] = useState<ServiceItem[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceItem[]>([]);
  const [serviceCities, setServiceCities] = useState<string[]>([]);
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceCityFilter, setServiceCityFilter] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState<"" | ServiceStatus>("");
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(createEmptyServiceForm);
  const [showServiceEditor, setShowServiceEditor] = useState(false);
  const [showServiceListDialog, setShowServiceListDialog] = useState(false);
  const serviceCatalogRequestIdRef = useRef(0);
  const serviceOptionsInitializedRef = useRef(false);
  const servicesCatalogInitializedRef = useRef(false);

  function applyBootstrapServices(payload: ServicesResponse | null | undefined) {
    if (payload !== null && payload !== undefined) {
      serviceOptionsInitializedRef.current = true;
      servicesCatalogInitializedRef.current = true;
    }
    const items = payload?.items || [];
    setServices(items);
    setAllServices(items);
    setServiceOptions(items.filter((item) => item.status !== "archived"));
    setServiceCities(payload?.cities || []);
  }

  async function fetchServices(
    query: string = serviceQuery,
    city: string = serviceCityFilter,
    statusFilter: string = serviceStatusFilter,
  ) {
    return apiRequest<ServicesResponse>(
      `/services?${buildServiceQueryString(query, city, statusFilter)}`,
      { method: "GET" },
      token,
    );
  }

  async function loadServices(
    query: string = serviceQuery,
    city: string = serviceCityFilter,
    statusFilter: string = serviceStatusFilter,
  ) {
    if (!token) {
      return;
    }
    const requestId = serviceCatalogRequestIdRef.current + 1;
    serviceCatalogRequestIdRef.current = requestId;
    setServiceLoading(true);
    try {
      const [payload, fullPayload] = await Promise.all([
        fetchServices(query, city, statusFilter),
        query || city || statusFilter ? fetchServices("", "", "") : Promise.resolve<ServicesResponse | null>(null),
      ]);
      if (serviceCatalogRequestIdRef.current !== requestId) {
        return;
      }
      servicesCatalogInitializedRef.current = true;
      serviceOptionsInitializedRef.current = true;
      setServices(payload.items);
      setServiceCities(payload.cities);
      const nextAllServices = fullPayload?.items || payload.items;
      setAllServices(nextAllServices);
      setServiceOptions(nextAllServices.filter((item) => item.status !== "archived"));
    } finally {
      if (serviceCatalogRequestIdRef.current === requestId) {
        setServiceLoading(false);
      }
    }
  }

  async function loadServiceOptions() {
    if (!token) {
      return;
    }
    const requestId = serviceCatalogRequestIdRef.current + 1;
    serviceCatalogRequestIdRef.current = requestId;
    const payload = await fetchServices("", "", "");
    if (serviceCatalogRequestIdRef.current !== requestId) {
      return;
    }
    serviceOptionsInitializedRef.current = true;
    setAllServices(payload.items);
    setServiceOptions(payload.items.filter((item) => item.status !== "archived"));
  }

  async function refreshServicesState() {
    await loadServices();
    if (serviceQuery || serviceCityFilter || serviceStatusFilter) {
      await loadServiceOptions();
    }
  }

  function updateServiceFormField(field: keyof ServiceFormState, value: string) {
    setServiceForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function editService(item: ServiceItem) {
    setShowServiceEditor(true);
    setServiceForm(createServiceFormFromItem(item));
  }

  function resetServiceEditor() {
    setServiceForm(createEmptyServiceForm());
  }

  async function handleServiceSearch() {
    if (!token || userRole !== "admin") {
      return;
    }
    setErrorMessage("");
    try {
      await loadServices();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить сервисы");
    }
  }

  async function resetServicesFilters() {
    if (!token || userRole !== "admin") {
      return;
    }
    setServiceQuery("");
    setServiceCityFilter("");
    setServiceStatusFilter("");
    setErrorMessage("");
    try {
      await loadServices("", "", "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить сервисы");
    }
  }

  async function handleSaveService() {
    if (!token || userRole !== "admin") {
      return;
    }
    if (!serviceForm.name.trim()) {
      setErrorMessage("Название сервиса обязательно");
      return;
    }

    setServiceSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = buildServicePayload(serviceForm);

      if (serviceForm.id) {
        await apiRequest<ServiceItem>(
          `/services/${serviceForm.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Сервис обновлён");
      } else {
        await apiRequest<ServiceItem>(
          "/services",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Сервис создан");
      }

      await refreshServicesState();
      resetServiceEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить сервис");
    } finally {
      setServiceSaving(false);
    }
  }

  async function handleArchiveService(item: ServiceItem) {
    if (!token || userRole !== "admin") {
      return;
    }
    setServiceSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<ServiceItem>(`/services/${item.id}/archive`, { method: "POST" }, token);
      setSuccessMessage(`Сервис «${item.name}» отправлен в архив`);
      if (serviceForm.id === item.id) {
        resetServiceEditor();
        setShowServiceEditor(false);
      }
      await refreshServicesState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось архивировать сервис");
    } finally {
      setServiceSaving(false);
    }
  }

  async function handleRestoreService(item: ServiceItem) {
    if (!token || userRole !== "admin") {
      return;
    }
    setServiceSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<ServiceItem>(`/services/${item.id}/restore`, { method: "POST" }, token);
      setSuccessMessage(`Сервис «${item.name}» восстановлен`);
      await loadServices(serviceQuery, serviceCityFilter, serviceStatusFilter || "archived");
      await loadServiceOptions();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось восстановить сервис");
    } finally {
      setServiceSaving(false);
    }
  }

  function resetServicesState() {
    serviceCatalogRequestIdRef.current += 1;
    serviceOptionsInitializedRef.current = false;
    servicesCatalogInitializedRef.current = false;
    setServices([]);
    setAllServices([]);
    setServiceOptions([]);
    setServiceCities([]);
    setServiceQuery("");
    setServiceCityFilter("");
    setServiceStatusFilter("");
    setServiceLoading(false);
    setServiceSaving(false);
    setServiceForm(createEmptyServiceForm());
    setShowServiceEditor(false);
    setShowServiceListDialog(false);
  }

  useEffect(() => {
    if (!token || activeWorkspaceTab !== "repair") {
      return;
    }
    if (serviceOptionsInitializedRef.current) {
      return;
    }
    void loadServiceOptions().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить сервисы");
    });
  }, [activeWorkspaceTab, setErrorMessage, token]);

  useEffect(() => {
    if (!token || userRole !== "admin" || activeWorkspaceTab !== "admin" || activeAdminTab !== "services") {
      return;
    }
    if (servicesCatalogInitializedRef.current) {
      return;
    }
    void loadServices("", "", "").catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить сервисы");
    });
  }, [activeAdminTab, activeWorkspaceTab, setErrorMessage, token, userRole]);

  useEffect(() => {
    if (!showServiceEditor || serviceForm.id === null) {
      return;
    }
    if (allServices.some((item) => item.id === serviceForm.id)) {
      return;
    }
    resetServiceEditor();
    setShowServiceEditor(false);
  }, [allServices, serviceForm.id, showServiceEditor]);

  return {
    services,
    allServices,
    serviceOptions,
    serviceCities,
    serviceQuery,
    setServiceQuery,
    serviceCityFilter,
    setServiceCityFilter,
    serviceStatusFilter,
    setServiceStatusFilter,
    serviceLoading,
    serviceSaving,
    serviceForm,
    showServiceEditor,
    setShowServiceEditor,
    showServiceListDialog,
    setShowServiceListDialog,
    applyBootstrapServices,
    loadServices,
    loadServiceOptions,
    updateServiceFormField,
    editService,
    resetServiceEditor,
    handleServiceSearch,
    resetServicesFilters,
    handleSaveService,
    handleArchiveService,
    handleRestoreService,
    resetServicesState,
  };
}
