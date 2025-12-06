import { useAuth } from '../context/AuthContext';

interface AdminReportsProps {
  onNavigate: (page: string) => void;
}

export default function AdminReports(_props: AdminReportsProps) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <span className="text-slate-300 text-sm">Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
          <h1 className="text-xl font-semibold text-white mb-2">Raporlar</h1>
          <p className="text-slate-300 text-sm">Raporlar sekmesi güncelleniyor.</p>
        </div>
      </div>
    </div>
  );
}
