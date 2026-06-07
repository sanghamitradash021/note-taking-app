import { useState } from 'react';
import { useAuthStore } from '../stores/authStore.js';
import { logout } from '../lib/auth.js';
import { useNotes, useCreateNote } from '../hooks/useNotes.js';
import { useTags, useCreateTag, useDeleteTag } from '../hooks/useTags.js';
import { NoteCard } from '../components/NoteCard.js';
import { NoteForm } from '../components/NoteForm.js';

export function NotesPage() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [creatingNote, setCreatingNote] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [tagError, setTagError] = useState('');

  const { data: notes = [], isLoading: notesLoading } = useNotes();
  const { data: tags = [] } = useTags();
  const createNote = useCreateNote();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();

  async function handleCreateNote(title: string, content: string) {
    await createNote.mutateAsync({ title, content });
    setCreatingNote(false);
  }

  async function handleLogout() {
    if (refreshToken) await logout(refreshToken).catch(() => null);
    clearAuth();
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    setTagError('');
    if (!newTagName.trim()) return;
    try {
      await createTag.mutateAsync(newTagName.trim());
      setNewTagName('');
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to create tag.');
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.logo}>NoteApp</span>
        <div style={styles.userArea}>
          <span style={styles.email}>{user?.email}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div style={styles.layout}>
        {/* Sidebar: Tags */}
        <aside style={styles.sidebar}>
          <h2 style={styles.sidebarTitle}>Tags</h2>
          <ul style={styles.tagList}>
            {tags.map((tag) => (
              <li key={tag.id} style={styles.tagItem}>
                <span>{tag.name}</span>
                <button
                  style={styles.removeTagBtn}
                  onClick={() => deleteTag.mutate(tag.id)}
                  title="Delete tag"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={handleCreateTag} style={styles.tagForm}>
            <input
              style={styles.tagInput}
              placeholder="New tag…"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <button type="submit" style={styles.addTagBtn}>
              Add
            </button>
          </form>
          {tagError && <p style={styles.error}>{tagError}</p>}
        </aside>

        {/* Main: Notes */}
        <main style={styles.main}>
          <div style={styles.mainHeader}>
            <h2 style={styles.mainTitle}>Notes</h2>
            {!creatingNote && (
              <button style={styles.newNoteBtn} onClick={() => setCreatingNote(true)}>
                + New note
              </button>
            )}
          </div>

          {creatingNote && (
            <div style={styles.formCard}>
              <NoteForm onSave={handleCreateNote} onCancel={() => setCreatingNote(false)} />
            </div>
          )}

          {notesLoading ? (
            <p style={styles.empty}>Loading…</p>
          ) : notes.length === 0 && !creatingNote ? (
            <p style={styles.empty}>No notes yet. Create your first one!</p>
          ) : (
            <div style={styles.grid}>
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} allTags={tags} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  header: {
    background: '#add8e6',
    color: '#1a1a1a',
    padding: '0.75rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
  logo: { fontWeight: 700, fontSize: '1.125rem' } as React.CSSProperties,
  userArea: { display: 'flex', alignItems: 'center', gap: '1rem' } as React.CSSProperties,
  email: { fontSize: '0.875rem', color: '#555' } as React.CSSProperties,
  logoutBtn: {
    background: 'none',
    border: '1px solid #1a1a1a',
    color: '#1a1a1a',
    borderRadius: '4px',
    padding: '0.25rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  layout: { display: 'flex', flex: 1, gap: 0 } as React.CSSProperties,
  sidebar: {
    width: '200px',
    background: '#fff',
    borderRight: '1px solid #e5e5e5',
    padding: '1.25rem',
    flexShrink: 0,
  } as React.CSSProperties,
  sidebarTitle: {
    margin: '0 0 0.75rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#888',
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  tagList: {
    listStyle: 'none',
    margin: '0 0 0.75rem',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  } as React.CSSProperties,
  tagItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
    padding: '0.2rem 0',
  } as React.CSSProperties,
  removeTagBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#aaa',
    fontSize: '1rem',
  } as React.CSSProperties,
  tagForm: { display: 'flex', gap: '0.25rem' } as React.CSSProperties,
  tagInput: {
    flex: 1,
    padding: '0.25rem 0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '0.8rem',
    minWidth: 0,
  } as React.CSSProperties,
  addTagBtn: {
    padding: '0.25rem 0.5rem',
    border: 'none',
    background: '#1a1a1a',
    color: '#fff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  error: { color: '#c00', fontSize: '0.75rem', marginTop: '0.5rem' } as React.CSSProperties,
  main: { flex: 1, padding: '1.5rem' } as React.CSSProperties,
  mainHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  } as React.CSSProperties,
  mainTitle: { margin: 0, fontSize: '1.25rem' } as React.CSSProperties,
  newNoteBtn: {
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '0.4rem 1rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  formCard: {
    background: '#fff',
    borderRadius: '8px',
    padding: '1rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    marginBottom: '1rem',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  } as React.CSSProperties,
  empty: { color: '#888', textAlign: 'center', marginTop: '3rem' } as React.CSSProperties,
};
