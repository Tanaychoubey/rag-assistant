import { useState } from 'react';
import Login from './components/auth/Login';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/dashboard/Dashboard';
import DocumentManager from './components/documents/DocumentManager';
import ChatWindow from './components/chat/ChatWindow';
import { User } from './types';
import { BarChart3, FileText, MessageSquare } from 'lucide-react';

export default function App() {
  // Try loading credentials from localStorage for persistent session
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Default active tab based on user role
  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser) as User;
        return u.role === 'ADMIN' ? 'dashboard' : 'chat';
      } catch {
        return 'chat';
      }
    }
    return 'chat';
  });

  const handleLoginSuccess = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setActiveTab(newUser.role === 'ADMIN' ? 'dashboard' : 'chat');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setActiveTab('chat');
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'documents':
        return <DocumentManager />;
      case 'chat':
        return <ChatWindow />;
      default:
        return <ChatWindow />;
    }
  };

  // If not authenticated, render Login view
  if (!token || !user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = user?.role === 'ADMIN';
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Metrics',
      icon: BarChart3,
      adminOnly: true,
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: FileText,
      adminOnly: true,
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      adminOnly: false,
    },
  ];

  return (
    <div className="flex flex-col h-screen h-[100dvh] overflow-hidden bg-[#f2f2f7]">
      <Navbar user={user} onLogout={handleLogout} />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          user={user} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
        
        <main className="flex-1 flex flex-col overflow-hidden bg-[#f2f2f7]/50">
          {renderActiveTab()}
        </main>
      </div>

      {/* Bottom Tab Bar for Mobile Devices */}
      <nav className="md:hidden border-t border-black/10 bg-[#ffffff]/90 backdrop-blur-lg flex items-center justify-around pt-2 pb-3 px-4 shrink-0 shadow-glass">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isVisible = !item.adminOnly || isAdmin;
          if (!isVisible) return null;
          
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 text-[10px] font-semibold transition-all ${
                isActive
                  ? 'text-primary'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e]'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-primary' : 'text-[#8e8e93]'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
