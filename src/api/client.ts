/**
 * API client for frontend to communicate with backend.
 */

export interface Note {
  id: string;
  content: string;
  createdAt: number;
  expiresAt: number;
}

export interface CreateNoteResponse {
  noteId: string;
  deleteToken: string;
}

const API_BASE = '/api';

export async function createNote(content: string): Promise<CreateNoteResponse> {
  const response = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create note: ${response.statusText}`);
  }
  
  return response.json();
}

export async function getNote(noteId: string): Promise<Note> {
  const response = await fetch(`${API_BASE}/notes/${noteId}`);
  
  if (!response.ok) {
    const error = new Error(response.status === 404 ? 'Not found' : 'Failed to fetch note');
    const errorWithStatus = error as Error & { status?: number };
    errorWithStatus.status = response.status;
    throw error;
  }
  
  return response.json();
}

export async function updateNote(noteId: string, content: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/notes/${noteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update note: ${response.statusText}`);
  }
  
  return response.json();
}

export async function deleteNote(noteId: string, deleteToken: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/notes/${noteId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deleteToken }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete note: ${response.statusText}`);
  }
  
  return response.json();
}
