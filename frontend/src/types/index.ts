export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'SUPPORT_AGENT';
}

export interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'UPLOADED' | 'PROCESSING' | 'INDEXED' | 'FAILED';
  total_pages?: number;
  chunk_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ProcessingJob {
  id: string;
  document_id: string;
  document_name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  chunk_id: string;
  document_name: string;
  page_number: number;
  similarity: number;
  chunk_text: string;
}

export interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  retrieved_sources?: Citation[];
  created_at: string;
}

export interface SystemMetrics {
  total_documents: number;
  total_chunks: number;
  total_conversations: number;
  average_latency_ms: number;
}
