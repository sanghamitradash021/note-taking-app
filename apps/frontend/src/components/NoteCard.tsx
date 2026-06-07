import { useState } from 'react';
import type { INoteResponse, ITag } from '@noteapp/shared';
import { NoteForm } from './NoteForm.js';
import { useUpdateNote, useDeleteNote, useAttachTag, useDetachTag } from '../hooks/useNotes.js';

interface Props {
  note: INoteResponse;
  allTags: ITag[];
}

export function NoteCard({ note, allTags }: Props) {
  const [editing, setEditing] = useState(false);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const attachTag = useAttachTag();
  const detachTag = useDetachTag();

  async function handleSave(title: string, content: string) {
    await updateNote.mutateAsync({ id: note.id, data: { title, content } });
    setEditing(false);
  }

  const attachedIds = new Set(note.tags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !attachedIds.has(t.id));

  return (
    <div style={styles.card}>
      {editing ? (
        <NoteForm initial={note} onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div style={styles.header}>
            <h3 style={styles.title}>{note.title}</h3>
            <div style={styles.headerActions}>
              <button style={styles.iconBtn} onClick={() => setEditing(true)} title="Edit">
                ✏️
              </button>
              <button
                style={styles.iconBtn}
                onClick={() => deleteNote.mutate(note.id)}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          </div>
          {note.content && <p style={styles.content}>{note.content}</p>}
          <div style={styles.tagRow}>
            {note.tags.map((tag) => (
              <span key={tag.id} style={styles.tag}>
                {tag.name}
                <button
                  style={styles.removeTag}
                  onClick={() => detachTag.mutate({ noteId: note.id, tagId: tag.id })}
                  title="Remove tag"
                >
                  ×
                </button>
              </span>
            ))}
            {availableTags.length > 0 && (
              <select
                style={styles.tagSelect}
                value=""
                onChange={(e) => {
                  if (e.target.value) attachTag.mutate({ noteId: note.id, tagId: e.target.value });
                }}
              >
                <option value="">+ tag</option>
                {availableTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p style={styles.date}>{new Date(note.updatedAt).toLocaleDateString()}</p>
        </>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: '#fff',
    borderRadius: '8px',
    padding: '1rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  title: { margin: 0, fontSize: '1rem', fontWeight: 600 } as React.CSSProperties,
  headerActions: { display: 'flex', gap: '0.25rem' } as React.CSSProperties,
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.1rem 0.25rem',
  } as React.CSSProperties,
  content: {
    margin: '0 0 0.75rem',
    fontSize: '0.875rem',
    color: '#444',
    whiteSpace: 'pre-wrap',
  } as React.CSSProperties,
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    alignItems: 'center',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  tag: {
    background: '#e8e8e8',
    borderRadius: '12px',
    padding: '0.15rem 0.5rem',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  } as React.CSSProperties,
  removeTag: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: 0,
    lineHeight: 1,
  } as React.CSSProperties,
  tagSelect: {
    fontSize: '0.75rem',
    border: '1px dashed #aaa',
    borderRadius: '12px',
    padding: '0.1rem 0.3rem',
    background: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,
  date: { margin: 0, fontSize: '0.7rem', color: '#aaa' } as React.CSSProperties,
};
