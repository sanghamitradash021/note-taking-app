import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as notesApi from '../lib/notes.js';

const NOTES_KEY = ['notes'] as const;

export function useNotes() {
  return useQuery({ queryKey: NOTES_KEY, queryFn: notesApi.listNotes });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ title, content }: { title: string; content?: string }) =>
      notesApi.createNote(title, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string | null } }) =>
      notesApi.updateNote(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.deleteNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

export function useAttachTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, tagId }: { noteId: string; tagId: string }) =>
      notesApi.attachTag(noteId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

export function useDetachTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, tagId }: { noteId: string; tagId: string }) =>
      notesApi.detachTag(noteId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}
