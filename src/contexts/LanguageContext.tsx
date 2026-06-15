import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, TranslationKeys } from '../lib/translations';
import { getSupabase } from '../supabase';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  t: (key: keyof TranslationKeys) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(() => {
    return localStorage.getItem('echonotes_language') || 'portuguese';
  });

  const setLanguage = async (newLang: string) => {
    setLanguageState(newLang);
    localStorage.setItem('echonotes_language', newLang);

    // Also update profile in Supabase if logged in
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from('profiles')
          .upsert({
            id: session.user.id,
            language: newLang,
            updated_at: new Date().toISOString()
          });
      }
    } catch (err) {
      console.error("Error saving language preference to profiles:", err);
    }
  };

  // Sync with database profile on mount/change
  useEffect(() => {
    const supabase = getSupabase();
    
    const syncProfileLanguage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('language')
            .eq('id', session.user.id)
            .single();

          if (profile?.language) {
            setLanguageState(profile.language);
            localStorage.setItem('echonotes_language', profile.language);
          }
        }
      } catch (err) {
        console.error("Error syncing profile language:", err);
      }
    };

    syncProfileLanguage();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        syncProfileLanguage();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const t = (key: keyof TranslationKeys): string => {
    // Fallback to portuguese if translation is missing
    const dictionary = translations[language] || translations.portuguese;
    return dictionary[key] ?? translations.portuguese[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
