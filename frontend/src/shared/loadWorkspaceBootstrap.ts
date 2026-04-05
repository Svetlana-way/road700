import { apiRequest } from "./api";
import type {
  DashboardDataQuality,
  DashboardDataQualityDetails,
  DashboardSummary,
  DocumentsResponse,
  ReviewQueueCategory,
  ReviewQueueResponse,
  User,
} from "./workspaceBootstrapTypes";

export type WorkspaceRefreshScope = "full" | "documents" | "metrics" | "review";
export type WorkspaceBootstrapData = {
  me: User;
  dashboard: DashboardSummary;
  dataQualityPayload: DashboardDataQuality;
  recentDocuments: DocumentsResponse;
  reviewQueueData: ReviewQueueResponse;
};

export type OperationalWorkspaceData = {
  dashboard: DashboardSummary;
  dataQualityPayload: DashboardDataQuality;
  recentDocuments: DocumentsResponse;
  reviewQueueData: ReviewQueueResponse;
};

export type WorkspaceMetricsData = {
  dashboard: DashboardSummary;
  dataQualityPayload: DashboardDataQuality;
  dataQualityDetailsPayload: DashboardDataQualityDetails;
};

export type WorkspaceReviewData = {
  dashboard: DashboardSummary;
  dataQualityPayload: DashboardDataQuality;
  reviewQueueData: ReviewQueueResponse;
};

export async function loadWorkspaceBootstrapData(
  activeToken: string,
  reviewCategory: ReviewQueueCategory,
): Promise<WorkspaceBootstrapData> {
  const [
    me,
    dashboard,
    dataQualityPayload,
    recentDocuments,
    reviewQueueData,
  ] = await Promise.all([
    apiRequest<User>("/auth/me", { method: "GET" }, activeToken),
    apiRequest<DashboardSummary>("/dashboard/summary", { method: "GET" }, activeToken),
    apiRequest<DashboardDataQuality>("/dashboard/data-quality", { method: "GET" }, activeToken),
    apiRequest<DocumentsResponse>("/documents?limit=8", { method: "GET" }, activeToken),
    apiRequest<ReviewQueueResponse>(`/review/queue?limit=6&category=${reviewCategory}`, { method: "GET" }, activeToken),
  ]);

  return {
    me,
    dashboard,
    dataQualityPayload,
    recentDocuments,
    reviewQueueData,
  };
}

export async function loadWorkspaceDataQualityDetails(
  activeToken: string,
): Promise<DashboardDataQualityDetails> {
  return apiRequest<DashboardDataQualityDetails>("/dashboard/data-quality/details?limit=8", { method: "GET" }, activeToken);
}

export async function loadWorkspaceOperationalData(
  activeToken: string,
  reviewCategory: ReviewQueueCategory,
): Promise<OperationalWorkspaceData> {
  const [
    dashboard,
    dataQualityPayload,
    recentDocuments,
    reviewQueueData,
  ] = await Promise.all([
    apiRequest<DashboardSummary>("/dashboard/summary", { method: "GET" }, activeToken),
    apiRequest<DashboardDataQuality>("/dashboard/data-quality", { method: "GET" }, activeToken),
    apiRequest<DocumentsResponse>("/documents?limit=8", { method: "GET" }, activeToken),
    apiRequest<ReviewQueueResponse>(`/review/queue?limit=6&category=${reviewCategory}`, { method: "GET" }, activeToken),
  ]);

  return {
    dashboard,
    dataQualityPayload,
    recentDocuments,
    reviewQueueData,
  };
}

export async function loadWorkspaceMetricsData(
  activeToken: string,
): Promise<WorkspaceMetricsData> {
  const [dashboard, dataQualityPayload, dataQualityDetailsPayload] = await Promise.all([
    apiRequest<DashboardSummary>("/dashboard/summary", { method: "GET" }, activeToken),
    apiRequest<DashboardDataQuality>("/dashboard/data-quality", { method: "GET" }, activeToken),
    apiRequest<DashboardDataQualityDetails>("/dashboard/data-quality/details?limit=8", { method: "GET" }, activeToken),
  ]);

  return {
    dashboard,
    dataQualityPayload,
    dataQualityDetailsPayload,
  };
}

export async function loadWorkspaceReviewData(
  activeToken: string,
  reviewCategory: ReviewQueueCategory,
): Promise<WorkspaceReviewData> {
  const [dashboard, dataQualityPayload, reviewQueueData] = await Promise.all([
    apiRequest<DashboardSummary>("/dashboard/summary", { method: "GET" }, activeToken),
    apiRequest<DashboardDataQuality>("/dashboard/data-quality", { method: "GET" }, activeToken),
    apiRequest<ReviewQueueResponse>(`/review/queue?limit=6&category=${reviewCategory}`, { method: "GET" }, activeToken),
  ]);

  return {
    dashboard,
    dataQualityPayload,
    reviewQueueData,
  };
}
