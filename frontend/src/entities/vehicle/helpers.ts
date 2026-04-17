import { formatOcrProfileName } from "../document/formatters";

type VehiclePreviewLike = {
  id: number;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
};

type QualityVehicleLike = {
  plate_number: string | null;
  brand: string | null;
  model: string | null;
};

type RepairDocumentWithVersionsLike = {
  id: number;
  versions: Array<{
    version_number?: number;
    parsed_payload: Record<string, unknown> | null;
    field_confidence_map: Record<string, unknown> | null;
  }>;
};

type RepairWithDocumentsLike = {
  documents: RepairDocumentWithVersionsLike[];
};

type DocumentVehicleFormStateLike = {
  vehicle_type: "truck" | "trailer";
  plate_number: string;
  vin: string;
  brand: string;
  model: string;
  year: string;
  comment: string;
};

type UserAssignmentLike = {
  starts_at: string;
  ends_at: string | null;
};

const PLACEHOLDER_EXTERNAL_ID = "__batch_import_placeholder__";

export function parseRepairDateFromFilename(filename: string): string | null {
  const normalized = filename.trim();
  const dayFirstMatch = normalized.match(/(\d{2})[.\-_](\d{2})[.\-_](\d{4})/);
  if (dayFirstMatch) {
    return `${dayFirstMatch[3]}-${dayFirstMatch[2]}-${dayFirstMatch[1]}`;
  }
  const isoMatch = normalized.match(/(\d{4})[.\-_](\d{2})[.\-_](\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  return null;
}

export function parseOrderNumberFromFilename(filename: string): string | null {
  const directNumberMatch = filename.match(/№\s*([A-Za-zА-Яа-я0-9\-\/]+)/u);
  if (directNumberMatch?.[1]) {
    return directNumberMatch[1].trim();
  }
  const orderMatch = filename.match(/(?:заказ[\s_-]*наряд|зн)[^\w]{0,3}([A-Za-zА-Яа-я0-9\-\/]+)/iu);
  if (orderMatch?.[1]) {
    return orderMatch[1].trim();
  }
  return null;
}

export function formatVehicle<TVehicle extends VehiclePreviewLike>(vehicle: TVehicle) {
  const parts = [vehicle.plate_number, vehicle.brand, vehicle.model].filter(Boolean);
  return parts.join(" • ") || `#${vehicle.id}`;
}

export function formatQualityVehicle<TVehicle extends QualityVehicleLike>(vehicle: TVehicle) {
  const parts = [vehicle.plate_number, vehicle.brand, vehicle.model].filter(Boolean);
  return parts.join(" • ") || "Техника не определена";
}

function normalizeIdentifier(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  return value
    .replace(/[Оо]/g, "O")
    .replace(/[Аа]/g, "A")
    .replace(/[Вв]/g, "B")
    .replace(/[Ее]/g, "E")
    .replace(/[Кк]/g, "K")
    .replace(/[Мм]/g, "M")
    .replace(/[Нн]/g, "H")
    .replace(/[Рр]/g, "P")
    .replace(/[Сс]/g, "C")
    .replace(/[Тт]/g, "T")
    .replace(/[Уу]/g, "Y")
    .replace(/[Хх]/g, "X")
    .toUpperCase()
    .replace(/[^A-Z0-9А-Я]/g, "");
}

export function inferVehicleTypeFromIdentifiers(plateNumber: string | null | undefined): "truck" | "trailer" {
  const normalizedPlate = normalizeIdentifier(plateNumber);
  if (/^[A-ZА-Я]{2}\d{4}\d{2,3}$/.test(normalizedPlate)) {
    return "trailer";
  }
  return "truck";
}

export function isPlaceholderVehicle(externalId: string | null | undefined) {
  return externalId === PLACEHOLDER_EXTERNAL_ID;
}

export function getLatestRepairDocumentVersion<
  TVersion extends {
    version_number?: number;
    parsed_payload: Record<string, unknown> | null;
    field_confidence_map?: Record<string, unknown> | null;
  },
>(versions: TVersion[] | null | undefined): TVersion | null {
  if (!versions || versions.length === 0) {
    return null;
  }
  return versions.reduce((latest, version) => {
    if (typeof latest.version_number !== "number" || typeof version.version_number !== "number") {
      return latest;
    }
    return version.version_number > latest.version_number ? version : latest;
  });
}

export function getLatestRepairDocumentPayload<TRepair extends RepairWithDocumentsLike>(
  repair: TRepair | null,
  documentId: number | null,
): Record<string, unknown> | null {
  if (!repair || documentId === null) {
    return null;
  }
  const selectedDocument = repair.documents.find((item) => item.id === documentId);
  const latestVersion = getLatestRepairDocumentVersion(selectedDocument?.versions);
  if (!latestVersion?.parsed_payload || typeof latestVersion.parsed_payload !== "object") {
    return null;
  }
  return latestVersion.parsed_payload;
}

export function getLatestRepairDocumentConfidenceMap<TRepair extends RepairWithDocumentsLike>(
  repair: TRepair | null,
  documentId: number | null,
): Record<string, unknown> | null {
  if (!repair || documentId === null) {
    return null;
  }
  const selectedDocument = repair.documents.find((item) => item.id === documentId);
  const latestVersion = getLatestRepairDocumentVersion(selectedDocument?.versions);
  if (!latestVersion?.field_confidence_map || typeof latestVersion.field_confidence_map !== "object") {
    return null;
  }
  return latestVersion.field_confidence_map;
}

export function getPayloadExtractedFields(payload: Record<string, unknown> | null | undefined) {
  const rawValue = payload?.extracted_fields;
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }
  return rawValue as Record<string, unknown>;
}

export function getPayloadExtractedItems(payload: Record<string, unknown> | null | undefined) {
  const rawValue = payload?.extracted_items;
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }
  return rawValue as {
    works?: Array<Record<string, unknown>>;
    parts?: Array<Record<string, unknown>>;
  };
}

function getPayloadNormalizationNotes(payload: Record<string, unknown> | null | undefined) {
  const rawValue = payload?.normalization_notes;
  if (!Array.isArray(rawValue)) {
    return [];
  }
  return rawValue.filter((item): item is string => typeof item === "string");
}

function getPayloadProfileScopeLabel(payload: Record<string, unknown> | null | undefined) {
  const rawValue = payload?.ocr_profile_scope;
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return "OCR";
  }
  return formatOcrProfileName(rawValue);
}

function getPayloadBaseSourceLabel(payload: Record<string, unknown> | null | undefined) {
  const extractedFrom = typeof payload?.extracted_from === "string" ? payload.extracted_from.toLowerCase() : "";
  if (extractedFrom.includes("xlsx")) {
    return "Excel документ";
  }
  if (extractedFrom.includes("pdf_text")) {
    return "Текстовый PDF";
  }
  if (extractedFrom.includes("pdf")) {
    return "PDF OCR";
  }
  if (extractedFrom.includes("image") || extractedFrom.includes("ocr")) {
    return "OCR документа";
  }
  return "Документ";
}

function payloadHasNormalizationNote(
  payload: Record<string, unknown> | null | undefined,
  pattern: string | RegExp,
) {
  const notes = getPayloadNormalizationNotes(payload);
  return notes.some((note) => (typeof pattern === "string" ? note === pattern : pattern.test(note)));
}

export function getExtractedFieldSourceLabel(
  payload: Record<string, unknown> | null | undefined,
  fieldKey: string,
) {
  const profileLabel = getPayloadProfileScopeLabel(payload);
  const baseSourceLabel = getPayloadBaseSourceLabel(payload);

  if (fieldKey === "plate_number") {
    if (payloadHasNormalizationNote(payload, "Госномер дополнен по карточке техники.")) {
      return "Карточка техники";
    }
    if (payloadHasNormalizationNote(payload, "Госномер дополнен по совпадению с реестром техники.")) {
      return "Реестр техники";
    }
    if (payloadHasNormalizationNote(payload, "Госномер дополнен по имени файла или пути источника.")) {
      return "Имя файла / путь";
    }
  }

  if (fieldKey === "vin") {
    if (payloadHasNormalizationNote(payload, "VIN дополнен по карточке техники.")) {
      return "Карточка техники";
    }
    if (payloadHasNormalizationNote(payload, "VIN дополнен по совпадению с реестром техники.")) {
      return "Реестр техники";
    }
    if (payloadHasNormalizationNote(payload, "VIN дополнен по имени файла или пути источника.")) {
      return "Имя файла / путь";
    }
  }

  if (fieldKey === "order_number" && payloadHasNormalizationNote(payload, "Номер документа дополнен по имени файла или пути источника.")) {
    return "Имя файла / путь";
  }

  if (fieldKey === "repair_date" && payloadHasNormalizationNote(payload, "Дата ремонта дополнена по имени файла или пути источника.")) {
    return "Имя файла / путь";
  }

  if (fieldKey === "service_name") {
    if (payloadHasNormalizationNote(payload, /^Сервис распознан по тексту документа:/)) {
      return "Текст документа + справочник сервисов";
    }
    if (payloadHasNormalizationNote(payload, "Сервис дополнен по папке источника документа.")) {
      return "Папка источника";
    }
  }

  if (
    ["work_total", "parts_total", "vat_total", "grand_total"].includes(fieldKey) &&
    payloadHasNormalizationNote(payload, new RegExp(`^${fieldKey}_restored_|^${fieldKey}_derived_|^leader_trak_totals_restored_`))
  ) {
    return `Профиль OCR: ${profileLabel}`;
  }

  return baseSourceLabel;
}

export function createVehicleFormFromPayload(
  payload: Record<string, unknown> | null | undefined,
): DocumentVehicleFormStateLike {
  const extractedFields = getPayloadExtractedFields(payload);
  const plateNumber =
    typeof extractedFields?.plate_number === "string" ? extractedFields.plate_number.trim() : "";
  const vin = typeof extractedFields?.vin === "string" ? extractedFields.vin.trim() : "";
  return {
    vehicle_type: inferVehicleTypeFromIdentifiers(plateNumber),
    plate_number: plateNumber,
    vin,
    brand: "",
    model: "",
    year: "",
    comment: "",
  };
}

export function isAssignmentActive<TAssignment extends UserAssignmentLike>(assignment: TAssignment) {
  const today = new Date().toISOString().slice(0, 10);
  return assignment.starts_at <= today && (!assignment.ends_at || assignment.ends_at >= today);
}

export function matchesTextSearch(parts: Array<string | null | undefined>, search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }
  return parts.some((part) => part?.toLowerCase().includes(normalizedSearch));
}
