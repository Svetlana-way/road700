import { useEffect, useState } from "react";
import { buildUserPayload } from "../shared/adminPayloadBuilders";
import { apiRequest } from "../shared/api";
import { createEmptyUserAssignmentForm, createEmptyUserForm, createUserFormFromItem } from "../shared/formStateFactories";
import { buildUsersQueryString } from "../shared/queryBuilders";
import type { UserItem, UserRole, UsersResponse, Vehicle, VehiclesResponse, UserAssignment } from "../shared/workspaceBootstrapTypes";
import type { UserAssignmentFormState, UserFormState } from "../shared/workspaceFormTypes";

type UseEmployeesAdminParams = {
  token: string;
  userRole: UserRole | null | undefined;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
};

export function useEmployeesAdmin({
  token,
  userRole,
  setErrorMessage,
  setSuccessMessage,
}: UseEmployeesAdminParams) {
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userLoading, setUserLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [showUserEditor, setShowUserEditor] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(createEmptyUserForm);
  const [selectedManagedUserId, setSelectedManagedUserId] = useState<number | null>(null);
  const [userVehicleSearch, setUserVehicleSearch] = useState("");
  const [userVehicleSearchLoading, setUserVehicleSearchLoading] = useState(false);
  const [userVehicleSearchResults, setUserVehicleSearchResults] = useState<Vehicle[]>([]);
  const [userAssignmentForm, setUserAssignmentForm] = useState<UserAssignmentFormState>(createEmptyUserAssignmentForm);
  const [userAssignmentSaving, setUserAssignmentSaving] = useState(false);
  const [adminResetPasswordValue, setAdminResetPasswordValue] = useState("");

  const selectedManagedUser = usersList.find((item) => item.id === selectedManagedUserId) ?? null;

  function applyBootstrapUsers(payload: UsersResponse | null | undefined) {
    const items = payload?.items || [];
    setUsersList(items);
    setUsersTotal(payload?.total || 0);
    setSelectedManagedUserId((current) => current ?? items[0]?.id ?? null);
  }

  async function loadUsers(search: string = userSearch) {
    if (!token) {
      return;
    }
    setUserLoading(true);
    try {
      const payload = await apiRequest<UsersResponse>(
        `/users?${buildUsersQueryString(search)}`,
        { method: "GET" },
        token,
      );
      applyBootstrapUsers(payload);
    } finally {
      setUserLoading(false);
    }
  }

  async function searchVehiclesForUserAssignment(search: string) {
    if (!token) {
      return;
    }
    if (!search.trim()) {
      setUserVehicleSearchResults([]);
      return;
    }
    setUserVehicleSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("search", search.trim());
      const payload = await apiRequest<VehiclesResponse>(`/vehicles?${params.toString()}`, { method: "GET" }, token);
      setUserVehicleSearchResults(payload.items);
    } finally {
      setUserVehicleSearchLoading(false);
    }
  }

  function resetUserEditor() {
    setUserForm(createEmptyUserForm());
    setUserAssignmentForm(createEmptyUserAssignmentForm());
    setUserVehicleSearch("");
    setUserVehicleSearchResults([]);
  }

  function editUser(item: UserItem) {
    setUserForm(createUserFormFromItem(item));
    setSelectedManagedUserId(item.id);
    setShowUserEditor(true);
  }

  function updateUserFormField(field: keyof UserFormState, value: string) {
    setUserForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateUserAssignmentFormField(field: keyof UserAssignmentFormState, value: string) {
    setUserAssignmentForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleUserSearch() {
    if (!token || userRole !== "admin") {
      return;
    }
    setErrorMessage("");
    try {
      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить список сотрудников");
    }
  }

  async function resetUsersSearch() {
    if (!token || userRole !== "admin") {
      return;
    }
    setUserSearch("");
    setErrorMessage("");
    try {
      await loadUsers("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить список сотрудников");
    }
  }

  async function handleSaveUser() {
    if (!token || userRole !== "admin") {
      return;
    }
    if (!userForm.full_name.trim() || !userForm.login.trim() || !userForm.email.trim()) {
      setErrorMessage("Имя, логин и почта обязательны");
      return;
    }
    if (!userForm.id && !userForm.password.trim()) {
      setErrorMessage("Для нового пользователя нужно задать пароль");
      return;
    }

    setUserSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = buildUserPayload(userForm);

      if (userForm.id) {
        await apiRequest<UserItem>(
          `/users/${userForm.id}`,
          { method: "PATCH", body: JSON.stringify(body) },
          token,
        );
        setSuccessMessage("Пользователь обновлён");
      } else {
        await apiRequest<UserItem>("/users", { method: "POST", body: JSON.stringify(body) }, token);
        setSuccessMessage("Пользователь создан");
      }
      await loadUsers();
      resetUserEditor();
      setShowUserEditor(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить пользователя");
    } finally {
      setUserSaving(false);
    }
  }

  async function handleSearchVehiclesForAssignment() {
    if (!token || userRole !== "admin") {
      return;
    }
    setErrorMessage("");
    try {
      await searchVehiclesForUserAssignment(userVehicleSearch);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось найти технику");
    }
  }

  async function handleCreateUserAssignment(vehicleId: number) {
    if (!token || userRole !== "admin" || selectedManagedUserId === null) {
      return;
    }
    setUserAssignmentSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<UserItem>(
        `/users/${selectedManagedUserId}/vehicle-assignments`,
        {
          method: "POST",
          body: JSON.stringify({
            vehicle_id: vehicleId,
            starts_at: userAssignmentForm.starts_at,
            ends_at: userAssignmentForm.ends_at || null,
            comment: userAssignmentForm.comment.trim() || null,
          }),
        },
        token,
      );
      setSuccessMessage("Техника закреплена за сотрудником");
      setUserAssignmentForm(createEmptyUserAssignmentForm());
      setUserVehicleSearch("");
      setUserVehicleSearchResults([]);
      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось закрепить технику");
    } finally {
      setUserAssignmentSaving(false);
    }
  }

  async function handleAdminResetUserPassword() {
    if (!token || userRole !== "admin" || selectedManagedUserId === null) {
      return;
    }
    if (!adminResetPasswordValue.trim()) {
      setErrorMessage("Укажите новый пароль для сотрудника");
      return;
    }

    setUserSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<UserItem>(
        `/users/${selectedManagedUserId}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({ new_password: adminResetPasswordValue.trim() }),
        },
        token,
      );
      setSuccessMessage("Пароль сотрудника обновлён");
      setAdminResetPasswordValue("");
      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сбросить пароль сотрудника");
    } finally {
      setUserSaving(false);
    }
  }

  async function handleCloseUserAssignment(assignment: UserAssignment) {
    if (!token || userRole !== "admin" || selectedManagedUserId === null) {
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const closeDate = assignment.starts_at > today ? assignment.starts_at : today;
    setUserAssignmentSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<UserItem>(
        `/users/${selectedManagedUserId}/vehicle-assignments/${assignment.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ends_at: closeDate,
            comment: assignment.comment,
          }),
        },
        token,
      );
      setSuccessMessage("Назначение техники закрыто");
      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось закрыть назначение техники");
    } finally {
      setUserAssignmentSaving(false);
    }
  }

  function resetUsersState() {
    setUsersList([]);
    setUsersTotal(0);
    setUserLoading(false);
    setUserSaving(false);
    setUserSearch("");
    setShowUserEditor(false);
    setUserForm(createEmptyUserForm());
    setSelectedManagedUserId(null);
    setUserVehicleSearch("");
    setUserVehicleSearchLoading(false);
    setUserVehicleSearchResults([]);
    setUserAssignmentForm(createEmptyUserAssignmentForm());
    setUserAssignmentSaving(false);
    setAdminResetPasswordValue("");
  }

  useEffect(() => {
    setAdminResetPasswordValue("");
  }, [selectedManagedUserId]);

  return {
    usersList,
    usersTotal,
    userLoading,
    userSaving,
    userSearch,
    setUserSearch,
    showUserEditor,
    setShowUserEditor,
    userForm,
    selectedManagedUserId,
    setSelectedManagedUserId,
    selectedManagedUser,
    adminResetPasswordValue,
    setAdminResetPasswordValue,
    userVehicleSearch,
    setUserVehicleSearch,
    userVehicleSearchLoading,
    userVehicleSearchResults,
    userAssignmentForm,
    userAssignmentSaving,
    applyBootstrapUsers,
    loadUsers,
    resetUserEditor,
    editUser,
    updateUserFormField,
    updateUserAssignmentFormField,
    handleUserSearch,
    resetUsersSearch,
    handleSaveUser,
    handleSearchVehiclesForAssignment,
    handleCreateUserAssignment,
    handleAdminResetUserPassword,
    handleCloseUserAssignment,
    resetUsersState,
  };
}
