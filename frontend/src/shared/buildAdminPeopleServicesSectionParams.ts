import { formatStatus, formatUserRoleLabel, formatVehicleTypeLabel } from "./displayFormatters";
import { formatVehicle, isAssignmentActive } from "./fleetDocumentHelpers";
import type { BuildAdminWorkspacePropsParams } from "./buildAdminWorkspaceProps";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

type AdminPeopleServicesSectionParams = Pick<
  BuildAdminWorkspacePropsParams,
  | "userSearch"
  | "userLoading"
  | "showUserEditor"
  | "userForm"
  | "userSaving"
  | "usersTotal"
  | "usersList"
  | "selectedManagedUserId"
  | "selectedManagedUser"
  | "adminResetPasswordValue"
  | "userVehicleSearch"
  | "userVehicleSearchLoading"
  | "userVehicleSearchResults"
  | "userAssignmentForm"
  | "userAssignmentSaving"
  | "setUserSearch"
  | "handleUserSearch"
  | "resetUsersSearch"
  | "setShowUserEditor"
  | "updateUserFormField"
  | "handleSaveUser"
  | "resetUserEditor"
  | "setSelectedManagedUserId"
  | "editUser"
  | "setAdminResetPasswordValue"
  | "handleAdminResetUserPassword"
  | "setUserVehicleSearch"
  | "updateUserAssignmentFormField"
  | "handleSearchVehiclesForAssignment"
  | "handleCreateUserAssignment"
  | "handleCloseUserAssignment"
  | "formatUserRoleLabel"
  | "formatVehicle"
  | "formatVehicleTypeLabel"
  | "isAssignmentActive"
  | "serviceQuery"
  | "serviceCityFilter"
  | "serviceCities"
  | "serviceLoading"
  | "showServiceEditor"
  | "serviceForm"
  | "serviceSaving"
  | "services"
  | "showServiceListDialog"
  | "setServiceQuery"
  | "setServiceCityFilter"
  | "handleServiceSearch"
  | "resetServicesFilters"
  | "setShowServiceEditor"
  | "updateServiceFormField"
  | "handleSaveService"
  | "resetServiceEditor"
  | "setShowServiceListDialog"
  | "handleEditService"
  | "formatStatus"
>;

export function buildAdminPeopleServicesSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): AdminPeopleServicesSectionParams {
  const { employeesAdmin, servicesAdmin, repairWorkspaceActions } = context;

  return {
    userSearch: employeesAdmin.userSearch,
    userLoading: employeesAdmin.userLoading,
    showUserEditor: employeesAdmin.showUserEditor,
    userForm: employeesAdmin.userForm,
    userSaving: employeesAdmin.userSaving,
    usersTotal: employeesAdmin.usersTotal,
    usersList: employeesAdmin.usersList,
    selectedManagedUserId: employeesAdmin.selectedManagedUserId,
    selectedManagedUser: employeesAdmin.selectedManagedUser,
    adminResetPasswordValue: employeesAdmin.adminResetPasswordValue,
    userVehicleSearch: employeesAdmin.userVehicleSearch,
    userVehicleSearchLoading: employeesAdmin.userVehicleSearchLoading,
    userVehicleSearchResults: employeesAdmin.userVehicleSearchResults,
    userAssignmentForm: employeesAdmin.userAssignmentForm,
    userAssignmentSaving: employeesAdmin.userAssignmentSaving,
    setUserSearch: employeesAdmin.setUserSearch,
    handleUserSearch: employeesAdmin.handleUserSearch,
    resetUsersSearch: employeesAdmin.resetUsersSearch,
    setShowUserEditor: employeesAdmin.setShowUserEditor,
    updateUserFormField: employeesAdmin.updateUserFormField,
    handleSaveUser: employeesAdmin.handleSaveUser,
    resetUserEditor: employeesAdmin.resetUserEditor,
    setSelectedManagedUserId: employeesAdmin.setSelectedManagedUserId,
    editUser: employeesAdmin.editUser,
    setAdminResetPasswordValue: employeesAdmin.setAdminResetPasswordValue,
    handleAdminResetUserPassword: employeesAdmin.handleAdminResetUserPassword,
    setUserVehicleSearch: employeesAdmin.setUserVehicleSearch,
    updateUserAssignmentFormField: employeesAdmin.updateUserAssignmentFormField,
    handleSearchVehiclesForAssignment: employeesAdmin.handleSearchVehiclesForAssignment,
    handleCreateUserAssignment: employeesAdmin.handleCreateUserAssignment,
    handleCloseUserAssignment: employeesAdmin.handleCloseUserAssignment,
    formatUserRoleLabel,
    formatVehicle,
    formatVehicleTypeLabel,
    isAssignmentActive,
    serviceQuery: servicesAdmin.serviceQuery,
    serviceCityFilter: servicesAdmin.serviceCityFilter,
    serviceCities: servicesAdmin.serviceCities,
    serviceLoading: servicesAdmin.serviceLoading,
    showServiceEditor: servicesAdmin.showServiceEditor,
    serviceForm: servicesAdmin.serviceForm,
    serviceSaving: servicesAdmin.serviceSaving,
    services: servicesAdmin.services,
    showServiceListDialog: servicesAdmin.showServiceListDialog,
    setServiceQuery: servicesAdmin.setServiceQuery,
    setServiceCityFilter: servicesAdmin.setServiceCityFilter,
    handleServiceSearch: servicesAdmin.handleServiceSearch,
    resetServicesFilters: servicesAdmin.resetServicesFilters,
    setShowServiceEditor: servicesAdmin.setShowServiceEditor,
    updateServiceFormField: servicesAdmin.updateServiceFormField,
    handleSaveService: servicesAdmin.handleSaveService,
    resetServiceEditor: servicesAdmin.resetServiceEditor,
    setShowServiceListDialog: servicesAdmin.setShowServiceListDialog,
    handleEditService: repairWorkspaceActions.handleEditService,
    formatStatus,
  };
}
