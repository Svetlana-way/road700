import { API_BASE_URL, ApiError, readApiError } from "../../shared/apiCore";

export async function downloadDocumentFile(documentId: number, token: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new ApiError(await readApiError(response), response.status);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
