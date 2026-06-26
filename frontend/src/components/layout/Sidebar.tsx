import { BarChart3, FileText, MessageSquare, ShieldAlert } from 'lucide-react';
import { User } from '../../types';

interface SidebarProps {
  user: User | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ user, activeTab, onTabChange }: SidebarProps) {
  const isAdmin = user?.role === 'ADMIN';

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Metrics Dashboard',
      icon: BarChart3,
      adminOnly: true,
    },
    {
      id: 'documents',
      label: 'Document Manager',
      icon: FileText,
      adminOnly: true,
    },
    {
      id: 'chat',
      label: 'AI Support Chat',
      icon: MessageSquare,
      adminOnly: false,
    },
  ];

  return (
    <aside className="hidden md:flex w-64 glass-panel border-r border-black/5 flex-col h-full shrink-0">
      {/* Navigation tabs */}
      <div className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isVisible = !item.adminOnly || isAdmin;
          
          if (!isVisible) return null;
          
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/5 border border-transparent'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Role notice bottom card */}
      <div className="p-4 border-t border-black/5 bg-[#f2f2f7]/50 text-center">
        <div className="flex items-center justify-center gap-2 text-[10px] tracking-wider text-[#8e8e93] uppercase font-semibold">
          <ShieldAlert size={12} className="text-[#8e8e93]" />
          <span>Security Mode: {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'Local' : 'Cloud'}</span>
        </div>
      </div>
    </aside>
  );
}
