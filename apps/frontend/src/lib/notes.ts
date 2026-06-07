import type { INoteResponse } from '@noteapp/shared';
import { apiFetch } from './apiClient.js';

type NoteListResponse = { data: INoteResponse[] };
type NoteResponse = { data: INoteResponse };

export async function listNotes(): Promise<INoteResponse[]> {
  const res = await apiFetch<NoteListResponse>('/api/notes');
  return res.data;
}

export async function getNote(id: string): Promise<INoteResponse> {
  const res = await apiFetch<NoteResponse>(`/api/notes/${id}`);
  return res.data;
}

export async function createNote(title: string, content?: string): Promise<INoteResponse> {
  const res = await apiFetch<NoteResponse>('/api/notes', {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  });
  return res.data;
}

export async function updateNote(
  id: string,
  data: { title?: string; content?: string | null },
): Promise<INoteResponse> {
  const res = await apiFetch<NoteResponse>(`/api/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteNote(id: string): Promise<void> {
  await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
}

export async function attachTag(noteId: string, tagId: string): Promise<INoteResponse> {
  const res = await apiFetch<NoteResponse>(`/api/notes/${noteId}/tags/${tagId}`, {
    method: 'POST',
  });
  return res.data;
}

export async function detachTag(noteId: string, tagId: string): Promise<INoteResponse> {
  const res = await apiFetch<NoteResponse>(`/api/notes/${noteId}/tags/${tagId}`, {
    method: 'DELETE',
  });
  return res.data;
}
