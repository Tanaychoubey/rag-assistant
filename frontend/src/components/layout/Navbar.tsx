import { LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../../types';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  return (
    <nav className="glass-panel sticky top-0 z-40 w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-black/5">
      {/* Brand logo details */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-black/5 border border-black/10 flex items-center justify-center text-xl shadow-glass shrink-0">
          🧠
        </div>
        <div>
          <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-[#1c1c1e] truncate max-w-[150px] xs:max-w-[180px] sm:max-w-none">
            RAG Document QA System
          </h1>
          <p className="text-[10px] sm:text-xs text-[#8e8e93]">RAG Support Workspace</p>
        </div>
      </div>

      {/* User profile actions */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3 bg-black/5 rounded-full pl-1.5 pr-1.5 sm:pl-3 sm:pr-4 py-1.5 border border-black/5">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <UserIcon size={14} className="text-primary" />
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-[#1c1c1e] leading-tight">
                {user.full_name}
              </span>
              <span className="text-[10px] text-[#8e8e93] font-medium leading-none uppercase tracking-wider">
                {user.role.replace('_', ' ')}
              </span>
            </div>
            
            {/* Divider */}
            <div className="w-px h-5 bg-black/10 mx-1" />
            
            {/* Logout button */}
            <button
              onClick={onLogout}
              className="text-[#8e8e93] hover:text-danger transition-colors p-1 hover:bg-black/5 rounded-full"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
