/**
 * SunWeatherWidget - Sun tracker and weather widget
 * Shows sunrise/sunset times, golden hour, and current weather for location
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Sun,
  Sunset,
  Sunrise,
  CloudSun,
  Cloud,
  CloudRain,
  Wind,
  Thermometer,
  MapPin,
  Settings,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDaySettings,
  useUpdateDaySettings,
  useSunWeather,
  DaySettings,
  SunWeatherData,
} from '@/hooks/backlot';

interface SunWeatherWidgetProps {
  projectId: string;
  productionDayId: string | null;
  canEdit: boolean;
  compact?: boolean;
}

// Helper to format time
const formatTime = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '--:--';
  try {
    const date = new Date(`2000-01-01T${timeStr}`);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return timeStr;
  }
};

// Calculate minutes until a time
const getMinutesUntil = (timeStr: string | null | undefined): number | null => {
  if (!timeStr) return null;
  try {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    const diff = (target.getTime() - now.getTime()) / (1000 * 60);
    return Math.round(diff);
  } catch {
    return null;
  }
};

// Weather icon mapping
const getWeatherIcon = (description: string | null | undefined): React.ElementType => {
  if (!description) return CloudSun;
  const lower = description.toLowerCase();
  if (lower.includes('rain') || lower.includes('shower')) return CloudRain;
  if (lower.includes('cloud') || lower.includes('overcast')) return Cloud;
  if (lower.includes('clear') || lower.includes('sunny')) return Sun;
  return CloudSun;
};

const SunWeatherWidget: React.FC<SunWeatherWidgetProps> = ({
  projectId,
  productionDayId,
  canEdit,
  compact = false,
}) => {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [formData, setFormData] = useState({
    latitude: '',
    longitude: '',
    timezone: '',
    location_name: '',
  });

  // Queries
  const { data: daySettings, isLoading: settingsLoading } = useDaySettings(
    projectId,
    productionDayId || undefined
  );
  const { data: sunWeather, isLoading: weatherLoading, refetch } = useSunWeather(
    projectId,
    productionDayId || undefined
  );

  // Mutations
  const updateSettings = useUpdateDaySettings();

  const isLoading = settingsLoading || weatherLoading;

  const handleOpenSettings = () => {
    setFormData({
      latitude: daySettings?.latitude?.toString() || '',
      longitude: daySettings?.longitude?.toString() || '',
      timezone: daySettings?.timezone || '',
      location_name: daySettings?.location_name || '',
    });
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    if (!productionDayId) return;

    await updateSettings.mutateAsync({
      projectId,
      productionDayId,
      data: {
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        timezone: formData.timezone || null,
        location_name: formData.location_name || null,
      },
    });
    setShowSettingsModal(false);
    // Refetch weather after updating location
    setTimeout(() => refetch(), 500);
  };

  // Calculate current light state
  const getCurrentLightState = (): { label: string; color: string; icon: React.ElementType } => {
    if (!sunWeather) return { label: 'Unknown', color: 'text-muted-gray', icon: Sun };

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const sunrise = sunWeather.sunrise || '06:00';
    const sunset = sunWeather.sunset || '18:00';
    const goldenMorningEnd = sunWeather.golden_hour_morning_end || '07:00';
    const goldenEveningStart = sunWeather.golden_hour_evening_start || '17:00';

    if (currentTime < sunrise) {
      return { label: 'Pre-Dawn', color: 'text-indigo-400', icon: Sunrise };
    } else if (currentTime < goldenMorningEnd) {
      return { label: 'Golden Hour', color: 'text-accent-yellow', icon: Sunrise };
    } else if (currentTime < goldenEveningStart) {
      return { label: 'Daylight', color: 'text-bone-white', icon: Sun };
    } else if (currentTime < sunset) {
      return { label: 'Golden Hour', color: 'text-accent-yellow', icon: Sunset };
    } else {
      return { label: 'Dusk/Night', color: 'text-purple-400', icon: Sunset };
    }
  };

  const lightState = getCurrentLightState();
  const LightIcon = lightState.icon;
  const WeatherIcon = getWeatherIcon(sunWeather?.weather_description);

  if (!productionDayId) {
    return (
      <Card className={cn('bg-soft-black border-muted-gray/20', compact && 'p-2')}>
        <CardContent className={cn('text-center', compact ? 'py-4' : 'py-8')}>
          <Sun className="w-8 h-8 mx-auto text-muted-gray mb-2" />
          <p className="text-muted-gray text-sm">Select a day to see sun & weather</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-soft-black border-muted-gray/20">
        <CardContent className="py-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Compact version for sidebar/overview
  if (compact) {
    return (
      <Card className="bg-soft-black border-muted-gray/20">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LightIcon className={cn('w-5 h-5', lightState.color)} />
              <span className={cn('text-sm font-medium', lightState.color)}>
                {lightState.label}
              </span>
            </div>
            {sunWeather && (
              <div className="flex items-center gap-3 text-sm text-muted-gray">
                <span className="flex items-center gap-1">
                  <Sunrise className="w-3.5 h-3.5 text-orange-400" />
                  {formatTime(sunWeather.sunrise)}
                </span>
                <span className="flex items-center gap-1">
                  <Sunset className="w-3.5 h-3.5 text-purple-400" />
                  {formatTime(sunWeather.sunset)}
                </span>
              </div>
            )}
          </div>
          {sunWeather?.temperature && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-gray">
              <WeatherIcon className="w-4 h-4" />
              <span>{Math.round(sunWeather.temperature)}°F</span>
              {sunWeather.weather_description && (
                <span className="capitalize">{sunWeather.weather_description}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full version
  return (
    <>
      <Card className="bg-soft-black border-muted-gray/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sun className="w-5 h-5 text-accent-yellow" />
              Sun & Weather
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetch()}
                disabled={weatherLoading}
              >
                <RefreshCw className={cn('w-4 h-4', weatherLoading && 'animate-spin')} />
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleOpenSettings}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          {daySettings?.location_name && (
            <p className="text-sm text-muted-gray flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {daySettings.location_name}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Light State */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-charcoal-black">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-full bg-soft-black', lightState.color)}>
                <LightIcon className="w-6 h-6" />
              </div>
              <div>
                <div className={cn('font-medium', lightState.color)}>{lightState.label}</div>
                <div className="text-xs text-muted-gray">Current light</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-bone-white">
                {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Sun Times */}
          {sunWeather && (
            <div className="grid grid-cols-2 gap-3">
              {/* Sunrise */}
              <div className="p-3 rounded-lg bg-charcoal-black">
                <div className="flex items-center gap-2 text-orange-400 mb-1">
                  <Sunrise className="w-4 h-4" />
                  <span className="text-xs font-medium">Sunrise</span>
                </div>
                <div className="text-lg font-bold text-bone-white">
                  {formatTime(sunWeather.sunrise)}
                </div>
              </div>

              {/* Sunset */}
              <div className="p-3 rounded-lg bg-charcoal-black">
                <div className="flex items-center gap-2 text-purple-400 mb-1">
                  <Sunset className="w-4 h-4" />
                  <span className="text-xs font-medium">Sunset</span>
                </div>
                <div className="text-lg font-bold text-bone-white">
                  {formatTime(sunWeather.sunset)}
                </div>
              </div>

              {/* Golden Hour Morning */}
              <div className="p-3 rounded-lg bg-charcoal-black">
                <div className="flex items-center gap-2 text-accent-yellow mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">AM Golden</span>
                </div>
                <div className="text-sm text-bone-white">
                  {formatTime(sunWeather.sunrise)} - {formatTime(sunWeather.golden_hour_morning_end)}
                </div>
              </div>

              {/* Golden Hour Evening */}
              <div className="p-3 rounded-lg bg-charcoal-black">
                <div className="flex items-center gap-2 text-accent-yellow mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">PM Golden</span>
                </div>
                <div className="text-sm text-bone-white">
                  {formatTime(sunWeather.golden_hour_evening_start)} - {formatTime(sunWeather.sunset)}
                </div>
              </div>
            </div>
          )}

          {/* Weather */}
          {sunWeather && (sunWeather.temperature || sunWeather.weather_description) && (
            <div className="p-3 rounded-lg bg-charcoal-black">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <WeatherIcon className="w-8 h-8 text-muted-gray" />
                  <div>
                    {sunWeather.temperature && (
                      <div className="text-2xl font-bold text-bone-white">
                        {Math.round(sunWeather.temperature)}°F
                      </div>
                    )}
                    {sunWeather.weather_description && (
                      <div className="text-sm text-muted-gray capitalize">
                        {sunWeather.weather_description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  {sunWeather.humidity && (
                    <div className="text-sm text-muted-gray">
                      Humidity: {sunWeather.humidity}%
                    </div>
                  )}
                  {sunWeather.wind_speed && (
                    <div className="text-sm text-muted-gray flex items-center gap-1 justify-end">
                      <Wind className="w-3.5 h-3.5" />
                      {Math.round(sunWeather.wind_speed)} mph
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!sunWeather?.latitude && !daySettings?.latitude && (
            <div className="text-center py-4 text-muted-gray text-sm">
              <MapPin className="w-6 h-6 mx-auto mb-2 opacity-50" />
              Set location to see sun times & weather
              {canEdit && (
                <Button
                  variant="link"
                  className="text-accent-yellow mt-1 p-0 h-auto"
                  onClick={handleOpenSettings}
                >
                  Configure Location
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Location Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Location Name</Label>
              <Input
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                placeholder="e.g., Downtown LA, Griffith Park"
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="34.0522"
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="-118.2437"
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
            </div>
            <div>
              <Label>Timezone</Label>
              <Input
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                placeholder="America/Los_Angeles"
                className="bg-charcoal-black border-muted-gray/30"
              />
              <p className="text-xs text-muted-gray mt-1">
                IANA timezone identifier (e.g., America/Los_Angeles)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={updateSettings.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              Save Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SunWeatherWidget;
