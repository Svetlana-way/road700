import { useState } from "react";
import { buildServicePayload } from "../shared/adminPayloadBuilders";
import { apiRequest } from "../shared/api";
import { createEmptyServiceForm, createServiceFormFromItem } from "../shared/formStateFactories";
import { buildServiceQueryString } from "../shared/queryBuilders";
import type { ServiceItem, ServicesResponse, UserRole } from "../shared/workspaceBootstrapTypes";
import type { ServiceFormState } from "../shared/workspaceFormTypes";

type UseServicesAdminParams = {
  token: string;
  userRole: UserRole | null | undefined;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
};

export function useServicesAdmin({
  token,
  userRole,
  setErrorMessage,
  setSuccessMessage,
}: UseServicesAdminParams) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceCities, setServiceCities] = useState<string[]>([]);
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceCityFilter, setServiceCityFilter] = useState("");
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(createEmptyServiceForm);
  const [showServiceEditor, setShowServiceEditor] = useState(false);
  const [showServiceListDialog, setShowServiceListDialog] = useState(false);

  function applyBootstrapServices(payload: ServicesResponse | null | undefined) {
    setServices(payload?.items || []);
    setServiceCities(payload?.cities || []);
  }

  async function loadServices(
    query: string = serviceQuery,
    city: string = serviceCityFilter,
  ) {
    if (!token) {
      return;
    }
    setServiceLoading(true);
    try {
      const payload = await apiRequest<ServicesResponse>(
        `/services?${buildServiceQueryString(query, city)}`,
        { method: "GET" },
        token,
      );
      applyBootstrapServices(payload);
    } finally {
      setServiceLoading(false);
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
    setErrorMessage("");
    try {
      await loadServices("", "");
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

      await loadServices();
      resetServiceEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить сервис");
    } finally {
      setServiceSaving(false);
    }
  }

  function resetServicesState() {
    setServices([]);
    setServiceCities([]);
    setServiceQuery("");
    setServiceCityFilter("");
    setServiceLoading(false);
    setServiceSaving(false);
    setServiceForm(createEmptyServiceForm());
    setShowServiceEditor(false);
    setShowServiceListDialog(false);
  }

  return {
    services,
    serviceCities,
    serviceQuery,
    setServiceQuery,
    serviceCityFilter,
    setServiceCityFilter,
    serviceLoading,
    serviceSaving,
    serviceForm,
    showServiceEditor,
    setShowServiceEditor,
    showServiceListDialog,
    setShowServiceListDialog,
    applyBootstrapServices,
    loadServices,
    updateServiceFormField,
    editService,
    resetServiceEditor,
    handleServiceSearch,
    resetServicesFilters,
    handleSaveService,
    resetServicesState,
  };
}
