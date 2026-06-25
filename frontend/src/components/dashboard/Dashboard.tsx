import { useEffect, useState } from 'react';
import { FileText, Layers, MessageSquare, Clock, RefreshCw, AlertTriangle, CheckCircle, Play } from 'lucide-react';
import client from '../../api/client';
import { SystemMetrics, ProcessingJob } from '../../types';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, jobsRes] = await Promise.all([
        client.get('/dashboard/metrics'),
        client.get('/dashboard/jobs')
      ]);
      setMetrics(metricsRes.data);
      setJobs(jobsRes.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to fetch dashboard metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh stats every 8 seconds
    const interval = setInterval(fetchDashboardData, 8000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return '-';
    const durationMs = new Date(end).getTime() - new Date(start).getTime();
    return `${(durationMs / 1000).toFixed(1)}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-success/15 border border-success/30 text-success">
            <CheckCircle size={12} />
            <span>Success</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/15 border border-primary/30 text-primary-glow animate-pulse">
            <Play size={12} />
            <span>Running</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-danger/15 border border-danger/30 text-danger">
            <AlertTriangle size={12} />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-black/5 border border-black/10 text-[#8e8e93]">
            <Clock size={12} />
            <span>Queued</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-4 text-left">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1c1c1e]">System Metrics</h2>
          <p className="text-xs sm:text-sm text-[#8e8e93]">Real-time status of document ingestion and retrieval auditing.</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-black/5 border border-black/10 hover:bg-black/10 text-[#1c1c1e] transition-all disabled:opacity-50 cursor-pointer w-full sm:w-auto shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Stats</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl p-4">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-1 text-left">
            <span className="text-xs text-[#8e8e93] font-semibold uppercase tracking-wider">Total Documents</span>
            <h3 className="text-3xl font-extrabold text-[#1c1c1e]">{metrics?.total_documents ?? 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <FileText size={22} className="text-primary-glow" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-1 text-left">
            <span className="text-xs text-[#8e8e93] font-semibold uppercase tracking-wider">Indexed Chunks</span>
            <h3 className="text-3xl font-extrabold text-[#1c1c1e]">{metrics?.total_chunks ?? 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#5856d6]/10 flex items-center justify-center border border-[#5856d6]/20">
            <Layers size={22} className="text-[#5856d6]" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-1 text-left">
            <span className="text-xs text-[#8e8e93] font-semibold uppercase tracking-wider">Total Conversations</span>
            <h3 className="text-3xl font-extrabold text-[#1c1c1e]">{metrics?.total_conversations ?? 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center border border-success/20">
            <MessageSquare size={22} className="text-success" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-1 text-left">
            <span className="text-xs text-[#8e8e93] font-semibold uppercase tracking-wider">Avg Query Latency</span>
            <h3 className="text-3xl font-extrabold text-[#1c1c1e]">
              {metrics?.average_latency_ms ? `${metrics.average_latency_ms} ms` : '0 ms'}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center border border-warning/20">
            <Clock size={22} className="text-warning" />
          </div>
        </div>
      </div>

      {/* Background Pipeline Jobs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden text-left">
        <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1c1c1e]">Ingestion Queue Logs</h3>
          <span className="text-xs text-[#8e8e93] font-medium">Showing last 50 tasks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/5 border-b border-black/5 text-[#8e8e93] font-semibold text-[10px] sm:text-xs uppercase tracking-wider">
                <th className="px-4 sm:px-6 py-3 text-left">File Name</th>
                <th className="px-4 sm:px-6 py-3 text-left">Status</th>
                <th className="px-4 sm:px-6 py-3 text-left">Triggered At</th>
                <th className="px-4 sm:px-6 py-3 text-left">Duration</th>
                <th className="px-4 sm:px-6 py-3 text-left">Error/Trace Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#8e8e93]">
                    No ingestion jobs recorded yet. Upload files to trigger tasks.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-black/2.5 transition-colors text-xs sm:text-sm">
                    <td className="px-4 sm:px-6 py-3.5 font-semibold text-[#1c1c1e] truncate max-w-[150px] sm:max-w-xs" title={job.document_name}>{job.document_name}</td>
                    <td className="px-4 sm:px-6 py-3.5">{getStatusBadge(job.status)}</td>
                    <td className="px-4 sm:px-6 py-3.5 text-[#8e8e93]">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 text-[#8e8e93] font-mono">
                      {formatDuration(job.started_at, job.completed_at)}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 max-w-xs truncate text-xs text-[#ff3b30] font-mono font-semibold" title={job.error_message || ''}>
                      {job.error_message || <span className="text-[#8e8e93]">-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
