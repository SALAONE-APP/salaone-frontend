import api from "./api";

export type RecordPhotoType = "before" | "after";
export type RecordQuestionType = "single" | "multi" | "text";

export interface RecordPhoto {
  type: RecordPhotoType;
  url: string;
  publicId: string;
}

export interface RecordQuestion {
  id: string;
  label: string;
  type: RecordQuestionType;
  options: string[];
  dependsOn?: string;
  dependsValue?: string;
}

export interface RecordAnswer {
  questionId: string;
  label: string;
  values: string[];
}

export interface ClientRecord {
  id: string;
  clientId: string;
  treatmentDate: string;
  skinType?: string | null;
  allergies?: string | null;
  productsUsed?: string | null;
  notes?: string | null;
  photos: RecordPhoto[];
  customAnswers: RecordAnswer[];
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
  };
}

interface BackendRecord {
  id: string;
  client_id: string;
  treatment_date: string;
  skin_type?: string | null;
  allergies?: string | null;
  products_used?: string | null;
  notes?: string | null;
  photos?: RecordPhoto[];
  custom_answers?: RecordAnswer[];
  created_at: string;
  updated_at: string;
  clients: ClientRecord["client"];
}

const mapRecord = (item: BackendRecord): ClientRecord => ({
  id: item.id,
  clientId: item.client_id,
  treatmentDate: item.treatment_date,
  skinType: item.skin_type,
  allergies: item.allergies,
  productsUsed: item.products_used,
  notes: item.notes,
  photos: Array.isArray(item.photos) ? item.photos : [],
  customAnswers: Array.isArray(item.custom_answers) ? item.custom_answers : [],
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  client: item.clients,
});

export type ClientRecordPayload = Omit<
  ClientRecord,
  "id" | "createdAt" | "updatedAt" | "client"
>;

export async function listClientRecords(clientId?: string) {
  const response = await api.get<{ records: BackendRecord[] }>(
    "/client-records",
    { params: { clientId } },
  );
  return response.data.records.map(mapRecord);
}

export async function createClientRecord(payload: ClientRecordPayload) {
  const response = await api.post<{ record: BackendRecord }>(
    "/client-records",
    payload,
  );
  return mapRecord(response.data.record);
}

export async function updateClientRecord(
  id: string,
  payload: ClientRecordPayload,
) {
  const response = await api.patch<{ record: BackendRecord }>(
    `/client-records/${id}`,
    payload,
  );
  return mapRecord(response.data.record);
}

export async function deleteClientRecord(id: string) {
  await api.delete(`/client-records/${id}`);
}

export async function listRecordQuestions() {
  const response = await api.get<{ questions: RecordQuestion[] }>(
    "/client-records/questions",
  );
  return Array.isArray(response.data.questions) ? response.data.questions : [];
}

export async function saveRecordQuestions(questions: RecordQuestion[]) {
  const response = await api.put<{ questions: RecordQuestion[] }>(
    "/client-records/questions",
    { questions },
  );
  return response.data.questions;
}
