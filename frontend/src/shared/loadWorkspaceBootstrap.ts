import { apiRequest } from "./apiCore";
import { REVIEW_QUEUE_PAGE_SIZE } from "./appUiConfig";
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

async function fetchReviewQueuePage(
  activeToken: string,
  reviewCategory: ReviewQueueCategory,
  limit = REVIEW_QUEUE_PAGE_SIZE,
  offset = 0,
): Promise<ReviewQueueResponse> {
  return apiRequest<ReviewQueueResponse>(
    `/review/queue?limit=${limit}&offset=${offset}&category=${reviewCategory}`,
    { method: "GET" },
    activeToken,
  );
}

export async function loadWorkspaceBootstrapData(
  activeToken: string,
  reviewCategory: ReviewQueueCategory,
  reviewQueueOffset = 0,
  reviewQueueLimit = REVIEW_QUEUE_PAGE_SIZE,
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
    fetchReviewQueuePage(activeToken, reviewCategory, reviewQueueLimit, reviewQueueOffset),
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
  return apiRequest<DashboardDataQualityDetails>("/dashboard/data-quality/details", { method: "GET" }, activeToken);
}

export async function loadWorkspaceOperationalData(
  activeToken: string,
  reviewCategory: ReviewQueueCategory,
  reviewQueueOffset = 0,
  reviewQueueLimit = REVIEW_QUEUE_PAGE_SIZE,
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
    fetchReviewQueuePage(activeToken, reviewCategory, reviewQueueLimit, reviewQueueOffset),
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
    apiRequest<DashboardDataQualityDetails>("/dashboard/data-quality/details", { method: "GET" }, activeToken),
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
  reviewQueueOffset = 0,
  reviewQueueLimit = REVIEW_QUEUE_PAGE_SIZE,
): Promise<WorkspaceReviewData> {
  const [dashboard, dataQualityPayload, reviewQueueData] = await Promise.all([
    apiRequest<DashboardSummary>("/dashboard/summary", { method: "GET" }, activeToken),
    apiRequest<DashboardDataQuality>("/dashboard/data-quality", { method: "GET" }, activeToken),
    fetchReviewQueuePage(activeToken, reviewCategory, reviewQueueLimit, reviewQueueOffset),
  ]);

  return {
    dashboard,
    dataQualityPayload,
    reviewQueueData,
  };
}
