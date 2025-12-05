import { useSettings } from '@/context/SettingsContext';
import { Wrench } from 'lucide-react';

const MaintenancePage = () => {
  const { settings } = useSettings();

  return (
    <div className="bg-charcoal-black text-white min-h-screen flex flex-col items-center justify-center text-center p-4">
      <Wrench className="h-24 w-24 text-accent-yellow mb-8" />
      <h1 className="text-5xl font-heading mb-4">Under Maintenance</h1>
      <p className="text-lg text-muted-gray max-w-2xl">
        {settings?.maintenance_message || "We're currently performing scheduled maintenance. We'll be back online shortly. Thank you for your patience!"}
      </p>
    </div>
  );
};

export default MaintenancePage;