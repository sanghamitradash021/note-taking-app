import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as tagsApi from '../lib/tags.js';

const TAGS_KEY = ['tags'] as const;

export function useTags() {
  return useQuery({ queryKey: TAGS_KEY, queryFn: tagsApi.listTags });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => tagsApi.createTag(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: TAGS_KEY }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tagsApi.deleteTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TAGS_KEY });
      qc.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}
