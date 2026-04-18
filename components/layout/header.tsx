'use client';
import { User, Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      <div className="flex items-center gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Design wechseln"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
        <div className="text-right flex items-center justify-center p-2 rounded-full bg-slate-100/50 dark:bg-slate-800">
           <User className="h-5 w-5 text-slate-500 flex-shrink-0" />
        </div>
      </div>
    </header>
  );
}
