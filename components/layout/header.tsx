'use client';
import { User, Menu, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/auth/auth-provider';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const { data: userProfile } = useQuery({
    queryKey: ['currentUser', session?.user.id],
    queryFn: api.getCurrentUser,
    enabled: Boolean(session?.user.id),
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Fehler beim Abmelden: ' + error.message);
    } else {
      queryClient.clear();
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
          aria-label="Navigation öffnen"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Design wechseln"
            aria-label="Design wechseln"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
        
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end mr-1">
             <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-none">
               {userProfile?.name || 'Lädt...'}
             </span>
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
