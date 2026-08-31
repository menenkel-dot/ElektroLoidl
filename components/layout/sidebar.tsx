'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, CalendarDays, BarChart3, Users, Briefcase, FileSignature, Building2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

const navigation = [
  { id: 'dashboard', name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { id: 'clients', name: 'Kunden', href: '/clients', icon: Building2 },
  { id: 'projects', name: 'Aufträge', href: '/projects', icon: Briefcase },
  { id: 'schedule', name: 'Einsatzplan', href: '/schedule', icon: CalendarDays },
  { id: 'time', name: 'Zeiterfassung', href: '/time', icon: Clock },
  { id: 'absence', name: 'Abwesenheiten', href: '/absence', icon: FileSignature },
  { id: 'team', name: 'Team', href: '/team', icon: Users },
  { id: 'reports', name: 'Berichte', href: '/reports', icon: BarChart3 },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('permissions').eq('id', user.id).single();
        if (data?.permissions?.visible_menu_items) {
          setPermissions(data.permissions.visible_menu_items);
        }
      }
    };
    fetchProfile();
  }, []);

  const visibleNav = navigation.filter(item => permissions.includes(item.id));

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <div className={`
        flex w-[240px] flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 h-screen fixed inset-y-0 z-50 py-6 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="px-6 pb-8 flex shrink-0 items-center justify-between">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logo.png" 
              alt="Firmenlogo" 
              className="h-8 w-auto max-w-[160px] object-contain dark:invert"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.insertAdjacentHTML('afterend', '<div class="h-8 flex items-center text-[20px] font-extrabold text-slate-300 dark:text-slate-700">LOGO</div>');
              }}
            />
          </div>
          <button onClick={onClose} className="lg:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 flex flex-col">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024 && onClose) {
                    onClose();
                  }
                }}
                className={`
                  group flex items-center px-6 py-3 text-[14px] font-medium transition-all duration-200
                  ${isActive 
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 py-[11px] border-r-[3px] border-blue-600 dark:border-blue-400' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-100'}
                `}
              >
                <item.icon
                  className={`
                    mr-3 h-5 w-5 shrink-0 transition-colors
                    ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'}
                  `}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      </div>
    </>
  );
}
