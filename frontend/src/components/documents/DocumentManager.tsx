import React, { useEffect, useState, useRef } from 'react';
import { UploadCloud, FileText, Trash2, ShieldAlert, CheckCircle, Clock, AlertTriangle, Play, Search } from 'lucide-react';
import client from '../../api/client';
import { Document } from '../../types';

export default function DocumentManager() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  
  // Upload States
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion States
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = async () => {
    try {
      const response = await client.get('/documents');
      setDocuments(response.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to fetch document list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // Poll documents status every 5 seconds to track background worker updates
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'txt') {
      setError('Invalid file type. Only PDF and TXT documents are supported.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('File size exceeds the 20MB limit.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setUploadProgress(20); // initial indicator progress
    setError('');

    try {
      await client.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadProgress(percentCompleted);
        },
      });
      fetchDocuments();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerDelete = (doc: Document) => {
    setDeleteTarget(doc);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await client.delete(`/documents/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchDocuments();
    } catch (err) {
      console.error(err);
      setError('Failed to delete document from server.');
    } finally {
      setDeleting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'INDEXED':
        return <span className="flex items-center gap-1.5 text-xs text-success font-semibold"><CheckCircle size={14} /> Indexed</span>;
      case 'PROCESSING':
        return <span className="flex items-center gap-1.5 text-xs text-primary-glow font-semibold animate-pulse"><Play size={14} /> Chunking...</span>;
      case 'FAILED':
        return <span className="flex items-center gap-1.5 text-xs text-danger font-semibold"><AlertTriangle size={14} /> Failed</span>;
      default:
        return <span className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold"><Clock size={14} /> Uploaded</span>;
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.file_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-black/5 pb-4 text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1c1c1e]">Document Manager</h2>
        <p className="text-xs sm:text-sm text-[#8e8e93]">Upload knowledge documents to feed into the vector storage indexing pipeline.</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl p-4">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`glass-panel border-2 border-dashed rounded-2xl sm:rounded-3xl p-6 sm:p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
          dragActive 
            ? 'border-primary bg-primary/5 scale-[0.99] shadow-glass-glow' 
            : 'border-black/10 hover:border-primary/40 hover:bg-black/2.5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />
        
        <div className="w-16 h-16 rounded-2xl bg-black/5 flex items-center justify-center border border-black/10">
          <UploadCloud size={30} className={uploading ? 'text-primary animate-bounce' : 'text-[#8e8e93]'} />
        </div>

        {uploading ? (
          <div className="w-full max-w-xs space-y-2">
            <p className="text-sm font-semibold text-[#1c1c1e]">Uploading document...</p>
            <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-[#8e8e93]">{uploadProgress}% complete</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#1c1c1e]">
              Drag & drop your files here, or <span className="text-primary-glow">browse</span>
            </p>
            <p className="text-xs text-[#8e8e93]">Supports PDF and TXT up to 20MB</p>
          </div>
        )}
      </div>

      {/* List Search Bar */}
      <div className="flex justify-between items-center gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-input !pl-10 !py-2 text-sm"
          />
        </div>
      </div>

      {/* Documents Grid / Table */}
      <div className="glass-panel rounded-2xl overflow-hidden text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/5 border-b border-black/5 text-[#8e8e93] font-semibold text-[10px] sm:text-xs uppercase tracking-wider">
                <th className="px-4 sm:px-6 py-3 text-left">File Name</th>
                <th className="px-4 sm:px-6 py-3 text-left">Size</th>
                <th className="px-4 sm:px-6 py-3 text-left">Format</th>
                <th className="px-4 sm:px-6 py-3 text-left">Pages</th>
                <th className="px-4 sm:px-6 py-3 text-left">Chunks</th>
                <th className="px-4 sm:px-6 py-3 text-left">Status</th>
                <th className="px-4 sm:px-6 py-3 text-left">Upload Date</th>
                <th className="px-4 sm:px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 sm:px-6 py-12 text-center text-[#8e8e93]">
                    Loading knowledge database documents...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 sm:px-6 py-12 text-center text-[#8e8e93]">
                    No documents found matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-black/2.5 transition-colors text-xs sm:text-sm">
                    <td className="px-4 sm:px-6 py-3.5 font-semibold text-[#1c1c1e] flex items-center gap-2">
                      <FileText size={16} className="text-primary-glow shrink-0" />
                      <span className="truncate max-w-[120px] xs:max-w-[150px] sm:max-w-xs" title={doc.file_name}>{doc.file_name}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 text-[#8e8e93]">{formatBytes(doc.file_size)}</td>
                    <td className="px-4 sm:px-6 py-3.5 text-[#8e8e93] font-semibold">{doc.file_type}</td>
                    <td className="px-4 sm:px-6 py-3.5 text-[#8e8e93]">{doc.total_pages ?? '-'}</td>
                    <td className="px-4 sm:px-6 py-3.5 text-[#8e8e93]">{doc.chunk_count ?? '-'}</td>
                    <td className="px-4 sm:px-6 py-3.5">{getStatusIcon(doc.status)}</td>
                    <td className="px-4 sm:px-6 py-3.5 text-[#8e8e93]">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 text-center">
                      <button
                        onClick={() => triggerDelete(doc)}
                        className="text-[#8e8e93] hover:text-[#ff3b30] p-1.5 hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete Document"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Warning Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative overflow-hidden border border-danger/30 text-left">
            <div className="flex items-center gap-3 text-danger mb-4">
              <ShieldAlert size={26} />
              <h3 className="text-lg font-bold text-[#1c1c1e]">Delete Knowledge Document</h3>
            </div>
            
            <p className="text-sm text-[#1c1c1e] mb-6">
              Are you sure you want to delete <span className="font-semibold text-[#ff3b30]">"{deleteTarget.file_name}"</span>? 
              This will permanently delete the file metadata, physical content on disk, and all vector embeddings from the Qdrant store. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-black/5 border border-black/10 text-[#1c1c1e] hover:bg-black/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#ff3b30] hover:bg-[#ff3b30]/80 text-white flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Delete File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
