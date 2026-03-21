import { VEHICLES_FULL_LIST_LIMIT } from "./appUiConfig";
import { apiRequest } from "./api";
import { buildLaborNormQueryString } from "./queryBuilders";
import type {
  DashboardDataQuality,
  DashboardDataQualityDetails,
  DashboardSummary,
  DocumentsResponse,
  LaborNormCatalogConfigResponse,
  LaborNormCatalogResponse,
  LoadedWorkspaceData,
  OcrLearningResponse,
  OcrProfileMatcherResponse,
  OcrRuleResponse,
  ReviewQueueCategory,
  ReviewQueueResponse,
  ReviewRuleResponse,
  ServicesResponse,
  SystemStatus,
  User,
  UsersResponse,
  VehiclesResponse,
} from "./workspaceBootstrapTypes";

export type { LoadedWorkspaceData } from "./workspaceBootstrapTypes";

export async function loadWorkspaceBootstrapData(
  activeToken: string,
  reviewCategory: ReviewQueueCategory,
  laborNormFilters: {
    query: string;
    scope: string;
    category: string;
  },
): Promise<LoadedWorkspaceData> {
  const me = await apiRequest<User>("/auth/me", { method: "GET" }, activeToken);
  const [
    dashboard,
    dataQualityPayload,
    dataQualityDetailsPayload,
    vehicleList,
    recentDocuments,
    reviewQueueData,
    laborNormCatalog,
    laborNormCatalogConfigs,
    servicesPayload,
    reviewRulesPayload,
    ocrRulesPayload,
    ocrProfileMatchersPayload,
    ocrLearningPayload,
    usersPayload,
    systemStatusPayload,
  ] = await Promise.all([
    apiRequest<DashboardSummary>("/dashboard/summary", { method: "GET" }, activeToken),
    apiRequest<DashboardDataQuality>("/dashboard/data-quality", { method: "GET" }, activeToken),
    apiRequest<DashboardDataQualityDetails>("/dashboard/data-quality/details?limit=8", { method: "GET" }, activeToken),
    apiRequest<VehiclesResponse>(`/vehicles?limit=${VEHICLES_FULL_LIST_LIMIT}`, { method: "GET" }, activeToken),
    apiRequest<DocumentsResponse>("/documents?limit=8", { method: "GET" }, activeToken),
    apiRequest<ReviewQueueResponse>(`/review/queue?limit=6&category=${reviewCategory}`, { method: "GET" }, activeToken),
    me.role === "admin"
      ? apiRequest<LaborNormCatalogResponse>(
          `/labor-norms?${buildLaborNormQueryString(
            laborNormFilters.query,
            laborNormFilters.scope,
            laborNormFilters.category,
          )}`,
          { method: "GET" },
          activeToken,
        )
      : Promise.resolve(null),
    me.role === "admin"
      ? apiRequest<LaborNormCatalogConfigResponse>("/labor-norms/catalogs", { method: "GET" }, activeToken)
      : Promise.resolve(null),
    apiRequest<ServicesResponse>("/services?limit=100", { method: "GET" }, activeToken),
    me.role === "admin"
      ? apiRequest<ReviewRuleResponse>("/review/rules", { method: "GET" }, activeToken)
      : Promise.resolve(null),
    me.role === "admin"
      ? apiRequest<OcrRuleResponse>("/ocr-rules", { method: "GET" }, activeToken)
      : Promise.resolve(null),
    me.role === "admin"
      ? apiRequest<OcrProfileMatcherResponse>("/ocr-profile-matchers", { method: "GET" }, activeToken)
      : Promise.resolve(null),
    me.role === "admin"
      ? apiRequest<OcrLearningResponse>("/ocr-learning/signals?limit=50", { method: "GET" }, activeToken)
      : Promise.resolve(null),
    me.role === "admin"
      ? apiRequest<UsersResponse>("/users?include_inactive=true", { method: "GET" }, activeToken)
      : Promise.resolve(null),
    me.role === "admin"
      ? apiRequest<SystemStatus>("/system/status", { method: "GET" }, activeToken)
      : Promise.resolve(null),
  ]);

  return {
    me,
    dashboard,
    dataQualityPayload,
    dataQualityDetailsPayload,
    vehicleList,
    recentDocuments,
    reviewQueueData,
    laborNormCatalog,
    laborNormCatalogConfigs,
    servicesPayload,
    reviewRulesPayload,
    ocrRulesPayload,
    ocrProfileMatchersPayload,
    ocrLearningPayload,
    usersPayload,
    systemStatusPayload,
  };
}
