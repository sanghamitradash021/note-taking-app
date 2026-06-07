import type { ITag } from '@noteapp/shared';
import { apiFetch } from './apiClient.js';

type TagListResponse = { data: ITag[] };
type TagResponse = { data: ITag };

export async function listTags(): Promise<ITag[]> {
  const res = await apiFetch<TagListResponse>('/api/tags');
  return res.data;
}

export async function createTag(name: string): Promise<ITag> {
  const res = await apiFetch<TagResponse>('/api/tags', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return res.data;
}

export async function deleteTag(id: string): Promise<void> {
  await apiFetch(`/api/tags/${id}`, { method: 'DELETE' });
}
