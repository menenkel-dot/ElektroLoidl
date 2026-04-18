'use client';
import { User, Menu, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Fehler beim Abmelden: ' + error.message);
    } else {
      toast.success('Erfolgreich abgemeldet');
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-4 sm:px-8 transition-colors">
      <div className="flex relative items-center gap-2 sm:gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <input 
          type="text" 
          placeholder="Suche..." 
          className="hidden sm:block px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-900 w-[200px] lg:w-[300px] text-[14px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Design wechseln"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
        
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end mr-1">
             <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-none">Mein Profil</span>
          </div>
          <div className="flex items-center justify-center p-2 rounded-full bg-slate-100 dark:bg-slate-800">
             <User className="h-5 w-5 text-slate-500 flex-shrink-0" />
          </div>
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
            title="Abmelden"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}