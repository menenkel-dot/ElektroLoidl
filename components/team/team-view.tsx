'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { User, Mail } from 'lucide-react';

export function TeamView() {
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Team</h2>
          <p className="mt-1 text-sm text-gray-500">Mitarbeiter und Soll-Arbeitszeiten verwalten.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users?.map(user => (
          <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center">
                  <span className="text-xl font-bold text-slate-500">{user.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                </div>
              </div>
              <div className="mt-6 border-t border-gray-100 pt-4 flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Soll-Arbeitszeit:</span>
                  <span className="font-medium text-gray-900">{user.targetHoursWeekly} h / Woche</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Überstundenkonto:</span>
                  <span className="font-medium text-emerald-600">+12.5 h</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
              <button className="text-sm font-medium text-blue-600 hover:text-blue-500">Bearbeiten</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
