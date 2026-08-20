import api from './api';

export type DatafileScope = 'BUSINESS_LOCATION' | 'UNIT_CONFIG';
export type DatafileCategory = 'LOGO' | 'AVATAR' | 'DOCUMENT' | 'TEMPLATE' | 'TMP' | 'OTHER';

export interface DatafileUploadResult {
  id: string;
  publicUrl: string;
  relativePath: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
}

export function hasPendingUploadFile(file: File | null | undefined): file is File {
  return file instanceof File;
}

export async function uploadDatafileAsset(args: {
  scope: DatafileScope;
  category: DatafileCategory;
  file: File;
  originalName?: string;
  businessLocationId?: string;
  unitConfigId?: string;
}) {
  const formData = new FormData();
  formData.append('scope', args.scope);
  formData.append('category', args.category);
  if (args.businessLocationId) formData.append('businessLocationId', args.businessLocationId);
  if (args.unitConfigId) formData.append('unitConfigId', args.unitConfigId);
  if (args.originalName) formData.append('originalName', args.originalName);
  formData.append('file', args.file, args.originalName || args.file.name);
  const res = await api.post<DatafileUploadResult>('/api/files/upload', formData);
  return res.data;
}
