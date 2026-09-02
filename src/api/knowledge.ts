import { apiFetch } from './client'
import type { ListResponse } from './types'

export interface ApiKnowledgeBase {
  id: string
  name: string
  description: string
  embedding_model: string
  top_k: number
  similarity_threshold: number
  status: string
  document_count: number
  segment_count: number
  created_at: string
  updated_at: string
}

export interface ApiKnowledgeDocument {
  id: string
  knowledge_id: string
  name: string
  content_length: number
  segment_max_chars: number
  status: string
  segment_count: number
  created_at: string
  updated_at: string
}

export interface ApiKnowledgeDocumentDetail extends ApiKnowledgeDocument {
  content: string
}

export interface ApiKnowledgeSegment {
  id: string
  knowledge_id: string
  document_id: string
  content: string
  content_length: number
  status: string
  created_at: string
  updated_at: string
}

export interface ApiKnowledgeSearchHit {
  segment_id: string
  document_id: string
  document_name: string
  content: string
  score: number
}

export interface ApiKnowledgeSearchResponse {
  items: ApiKnowledgeSearchHit[]
  embedding_backend: string
}

export interface ApiKnowledgeChatResponse {
  answer: string
  citations: ApiKnowledgeSearchHit[]
  chat_backend: string
  embedding_backend: string
}

export interface CreateKnowledgeBaseInput {
  name: string
  description?: string
  embedding_model?: string | null
  top_k?: number
  similarity_threshold?: number
}

export type UpdateKnowledgeBaseInput = Partial<CreateKnowledgeBaseInput> & {
  status?: string
}

export interface CreateKnowledgeDocumentInput {
  name: string
  content: string
  segment_max_chars?: number
}

export function listKnowledgeBases() {
  return apiFetch<ListResponse<ApiKnowledgeBase>>('/knowledge/bases')
}

export function createKnowledgeBase(body: CreateKnowledgeBaseInput) {
  return apiFetch<ApiKnowledgeBase>('/knowledge/bases', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateKnowledgeBase(id: string, body: UpdateKnowledgeBaseInput) {
  return apiFetch<ApiKnowledgeBase>(`/knowledge/bases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteKnowledgeBase(id: string) {
  return apiFetch<void>(`/knowledge/bases/${id}`, { method: 'DELETE' })
}

export function reindexKnowledgeBase(id: string) {
  return apiFetch<ApiKnowledgeBase>(`/knowledge/bases/${id}/reindex`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function searchKnowledgeBase(
  id: string,
  body: { query: string; top_k?: number; similarity_threshold?: number },
) {
  return apiFetch<ApiKnowledgeSearchResponse>(`/knowledge/bases/${id}/search`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function chatKnowledgeBase(
  id: string,
  body: {
    message: string
    top_k?: number
    history?: { role: 'user' | 'assistant'; content: string }[]
  },
) {
  return apiFetch<ApiKnowledgeChatResponse>(`/knowledge/bases/${id}/chat`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listKnowledgeDocuments(knowledgeId: string) {
  return apiFetch<ListResponse<ApiKnowledgeDocument>>(
    `/knowledge/bases/${knowledgeId}/documents`,
  )
}

export function createKnowledgeDocument(
  knowledgeId: string,
  body: CreateKnowledgeDocumentInput,
) {
  return apiFetch<ApiKnowledgeDocument>(`/knowledge/bases/${knowledgeId}/documents`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getKnowledgeDocument(documentId: string) {
  return apiFetch<ApiKnowledgeDocumentDetail>(`/knowledge/documents/${documentId}`)
}

export function deleteKnowledgeDocument(documentId: string) {
  return apiFetch<void>(`/knowledge/documents/${documentId}`, { method: 'DELETE' })
}

export function listKnowledgeSegments(documentId: string) {
  return apiFetch<ListResponse<ApiKnowledgeSegment>>(
    `/knowledge/documents/${documentId}/segments`,
  )
}
