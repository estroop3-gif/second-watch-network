import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';

interface Setting {
  key: string;
  value: { value: any };
}

interface SettingsContextType {
  settings: Record<string, any> | null;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  isLoading: true,
});

export const useSettings = () => useContext(SettingsContext);

const fetchSettings = async (): Promise<Setting[]> => {
  try {
    const data = await api.getSiteSettings();
    return data || [];
  } catch {
    // Expected for non-admin users - silently return empty
    return [];
  }
};

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['siteSettings'],
    queryFn: fetchSettings,
    staleTime: 1000 * 60 * 5, // Cache settings for 5 minutes
    enabled: isAdmin, // Only fetch if user is admin
  });

  // Only show loading if we're actually fetching (admin users)
  // For non-admins, the query is disabled so we're not loading
  const isLoading = isAdmin ? queryLoading : false;

  const [settings, setSettings] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (data) {
      const settingsObject = data.reduce((acc, setting) => {
        acc[setting.key] = setting.value.value;
        return acc;
      }, {} as Record<string, any>);
      setSettings(settingsObject);

      // Dynamically apply the primary theme color as a CSS variable
      if (settingsObject.primary_theme_color) {
        document.documentElement.style.setProperty('--primary-theme-color', settingsObject.primary_theme_color);
      }
    }
  }, [data]);

  return (
    <SettingsContext.Provider value={{ settings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};
