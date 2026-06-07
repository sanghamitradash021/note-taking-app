import { useState, type FormEvent } from 'react';
import type { INoteResponse } from '@noteapp/shared';

interface Props {
  initial?: INoteResponse;
  onSave: (title: string, content: string) => Promise<void>;
  onCancel: () => void;
}

export function NoteForm({ initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(title.trim(), content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        style={styles.titleInput}
        placeholder="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoFocus
      />
      <textarea
        style={styles.contentInput}
        placeholder="Note content (optional)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
      />
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.actions}>
        <button type="button" style={styles.cancelBtn} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" style={styles.saveBtn} disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

const styles = {
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } as React.CSSProperties,
  titleInput: {
    padding: '0.5rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
  } as React.CSSProperties,
  contentInput: {
    padding: '0.5rem',
    fontSize: '0.9rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    resize: 'vertical',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  error: { color: '#c00', margin: 0, fontSize: '0.875rem' } as React.CSSProperties,
  actions: { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' } as React.CSSProperties,
  cancelBtn: {
    padding: '0.4rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
  } as React.CSSProperties,
  saveBtn: {
    padding: '0.4rem 1rem',
    border: 'none',
    borderRadius: '4px',
    background: '#1a1a1a',
    color: '#fff',
    cursor: 'pointer',
  } as React.CSSProperties,
};
