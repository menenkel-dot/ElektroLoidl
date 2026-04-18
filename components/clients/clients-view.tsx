'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Trash2, Building2, User, Phone, MapPin, Edit2 } from 'lucide-react';
import { Client } from '@/lib/mock-data';

export function ClientsView() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const { data: clients, isLoading } = useQuery({ queryKey: ['clients'], queryFn: api.getClients });

  const deleteMutation = useMutation({
    mutationFn: api.deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  });

  if (isLoading) {
    return <div className="text-slate-500">Lade Kunden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 mb-2 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">Kunden</h2>
          <p className="mt-2 text-[14px] text-slate-500">Kundenstamm verwalten und neue Kunden anlegen.</p>
        </div>
        <button
          onClick={() => {
            setEditingClient(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-[14px] font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Neuer Kunde
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {clients?.map(client => (
          <div key={client.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col relative group">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[18px] font-bold text-slate-900 leading-tight">{client.name}</h3>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3 text-[14px] text-slate-600">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{client.contactPerson || 'Kein Ansprechpartner hinterlegt'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[14px] text-slate-600">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>{client.phone || 'Keine Telefonnummer'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[14px] text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>{client.address || 'Keine Adresse'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setEditingClient(client);
                  setIsModalOpen(true);
                }}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Bearbeiten"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if(confirm('Kunde wirklich löschen?')) {
                    deleteMutation.mutate(client.id);
                  }
                }}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Löschen"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {clients?.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            Es wurden noch keine Kunden angelegt.
          </div>
        )}
      </div>

      {isModalOpen && (
        <ClientModal 
          client={editingClient}
          onClose={() => {
            setIsModalOpen(false);
            setEditingClient(null);
          }} 
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
        />
      )}
    </div>
  );
}

function ClientModal({ client, onClose, onSuccess }: { client: Client | null, onClose: () => void, onSuccess: () => void }) {
  const [name, setName] = useState(client?.name || '');
  const [contactPerson, setContactPerson] = useState(client?.contactPerson || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [address, setAddress] = useState(client?.address || '');

  const createMutation = useMutation({
    mutationFn: api.addClient,
    onSuccess: () => {
      onSuccess();
      onClose();
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Client>) => api.updateClient(client!.id, data),
    onSuccess: () => {
      onSuccess();
      onClose();
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (client) {
      updateMutation.mutate({ name, contactPerson, phone, address });
    } else {
      createMutation.mutate({ name, contactPerson, phone, address });
    }
  };

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            <div className="px-6 py-5 border-b border-slate-100">
               <h3 className="text-[18px] font-bold text-slate-900 leading-none">{client ? 'Kunde bearbeiten' : 'Kunde anlegen'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Firmenname</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" placeholder="z. B. Meyer GmbH" />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Ansprechpartner</label>
                <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" placeholder="Name der Kontaktperson" />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Telefonnummer</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" placeholder="+49 ..." />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Anschrift</label>
                <textarea rows={2} value={address} onChange={e => setAddress(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" placeholder="Straße, PLZ, Ort" />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="submit" disabled={isPending} className="flex-1 justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {isPending ? 'Speichert...' : client ? 'Änderungen speichern' : 'Kunde anlegen'}
                </button>
                <button type="button" onClick={onClose} className="flex-1 justify-center rounded-lg bg-white px-3 py-2.5 text-[14px] font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
