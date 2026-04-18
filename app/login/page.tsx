"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <Zap className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">VoltTime Login</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-center text-sm">
            Bitte melden Sie sich an, um Ihre Zeiterfassung zu verwalten.
          </p>
        </div>
        
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#2563eb',
                  brandAccent: '#1d4ed8',
                },
              },
            },
          }}
          providers={[]}
          localization={{
            variables: {
              sign_in: {
                email_label: 'E-Mail',
                password_label: 'Passwort',
                button_label: 'Anmelden',
                loading_button_label: 'Anmeldung...',
                email_input_placeholder: 'Deine E-Mail Adresse',
                password_input_placeholder: 'Dein Passwort',
              },
              sign_up: {
                email_label: 'E-Mail',
                password_label: 'Passwort',
                button_label: 'Registrieren',
                loading_button_label: 'Registrierung...',
                email_input_placeholder: 'Deine E-Mail Adresse',
                password_input_placeholder: 'Dein Passwort',
              }
            }
          }}
          theme="light"
        />
      </div>
    </div>
  );
}