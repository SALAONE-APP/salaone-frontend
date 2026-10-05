import api from "./api";
import type { SalesProduct } from "./salesCrmService";

// Espelha SALES_DOC_CATEGORIES do backend (salesDocSchemas.ts).
export const SALES_DOC_CATEGORIES = ["comercial", "onboarding", "operacao", "outros"] as const;
export type SalesDocCategory = (typeof SALES_DOC_CATEGORIES)[number];

export const SALES_DOC_CATEGORY_LABELS: Record<SalesDocCategory, string> = {
  comercial: "Comercial",
  onboarding: "Onboarding",
  operacao: "Operação",
  outros: "Outros",
};

export function salesDocCategoryLabel(category: string) {
  return SALES_DOC_CATEGORY_LABELS[category as SalesDocCategory] ?? category;
}

export type SalesDocAttachmentType = "image" | "video" | "audio" | "pdf" | "document";

export interface SalesDocAttachment {
  id: string;
  type: SalesDocAttachmentType;
  name: string;
  url: string;
  mimeType: string;
  bytes: number;
  createdAt: string;
}

// Espelha MAX_ATTACHMENTS_PER_DOC e o limite do multer no backend.
export const SALES_DOC_MAX_ATTACHMENTS = 20;
export const SALES_DOC_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const SALES_DOC_ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,image/jpeg,image/png,image/webp,image/gif,audio/*,video/*";

interface DocAuthor {
  id: string;
  name: string;
}

export interface SalesDocSummary {
  id: string;
  product: SalesProduct;
  title: string;
  slug: string;
  category: SalesDocCategory;
  active: boolean;
  sortOrder: number;
  createdBy: DocAuthor | null;
  updatedBy: DocAuthor | null;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
}

export interface SalesDoc extends Omit<SalesDocSummary, "attachmentCount"> {
  content: string;
  attachments: SalesDocAttachment[];
}

export interface CreateSalesDocInput {
  product: SalesProduct;
  title: string;
  category: SalesDocCategory;
  content?: string;
  active?: boolean;
}

export type UpdateSalesDocInput = Partial<Pick<SalesDoc, "title" | "category" | "content" | "active">>;

export async function listSalesDocs(filters: { product: SalesProduct; category?: SalesDocCategory }) {
  const response = await api.get<{ docs: SalesDocSummary[] }>("/sales-docs", { params: filters });
  return response.data.docs;
}

export async function getSalesDocBySlug(product: SalesProduct, slug: string) {
  const response = await api.get<{ doc: SalesDoc }>(`/sales-docs/by-slug/${encodeURIComponent(slug)}`, { params: { product } });
  return response.data.doc;
}

export async function createSalesDoc(input: CreateSalesDocInput) {
  const response = await api.post<{ doc: SalesDoc }>("/sales-docs", input);
  return response.data.doc;
}

export async function updateSalesDoc(id: string, input: UpdateSalesDocInput) {
  const response = await api.patch<{ doc: SalesDoc }>(`/sales-docs/${id}`, input);
  return response.data.doc;
}

export async function deleteSalesDoc(id: string) {
  await api.delete(`/sales-docs/${id}`);
}

export async function reorderSalesDocs(items: { id: string; sortOrder: number }[]) {
  await api.patch("/sales-docs/reorder", { items });
}

export async function uploadSalesDocAttachment(docId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<{ attachment: SalesDocAttachment }>(`/sales-docs/${docId}/attachments`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.attachment;
}

export async function deleteSalesDocAttachment(docId: string, attachmentId: string) {
  await api.delete(`/sales-docs/${docId}/attachments/${attachmentId}`);
}
