/**
 * TranspoView - Coming soon placeholder for Transpo Logistics tab
 */
import React from 'react';
import { Truck, MapPin, Clock, Users, Car, Package } from 'lucide-react';

interface TranspoViewProps {
  projectId: string;
}

export function TranspoView({ projectId }: TranspoViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4">
      <div className="relative mb-6">
        {/* Animated truck icon */}
        <div className="w-20 h-20 bg-muted-gray/10 rounded-full flex items-center justify-center">
          <Truck className="w-10 h-10 text-muted-gray" />
        </div>
        {/* Decorative icons */}
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent-yellow/10 rounded-full flex items-center justify-center">
          <MapPin className="w-4 h-4 text-accent-yellow/60" />
        </div>
        <div className="absolute -bottom-1 -left-2 w-7 h-7 bg-muted-gray/10 rounded-full flex items-center justify-center">
          <Clock className="w-3 h-3 text-muted-gray/60" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-bone-white mb-2">
        Transpo Logistics
      </h2>

      <p className="text-muted-gray text-center max-w-md mb-8">
        Vehicle assignments, pickup schedules, driver contacts, and transport logistics management.
      </p>

      {/* Feature preview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-2xl">
        <FeatureCard
          icon={<Car className="w-5 h-5" />}
          title="Vehicle Fleet"
          description="Manage production vehicles and assignments"
        />
        <FeatureCard
          icon={<Users className="w-5 h-5" />}
          title="Driver Schedule"
          description="Track driver availability and routes"
        />
        <FeatureCard
          icon={<MapPin className="w-5 h-5" />}
          title="Pickup Points"
          description="Coordinate cast and crew pickups"
        />
        <FeatureCard
          icon={<Clock className="w-5 h-5" />}
          title="Time Tracking"
          description="Monitor departure and arrival times"
        />
        <FeatureCard
          icon={<Package className="w-5 h-5" />}
          title="Equipment Transport"
          description="Coordinate gear and equipment moves"
        />
        <FeatureCard
          icon={<Truck className="w-5 h-5" />}
          title="Manifest System"
          description="Generate transport manifests for each day"
        />
      </div>

      <div className="mt-8 px-4 py-2 bg-accent-yellow/10 rounded-full">
        <span className="text-accent-yellow text-sm font-medium">Coming Soon</span>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-muted-gray/5 border border-muted-gray/20 rounded-lg p-4 text-center">
      <div className="w-10 h-10 bg-muted-gray/10 rounded-full flex items-center justify-center mx-auto mb-3 text-muted-gray/60">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-bone-white mb-1">{title}</h3>
      <p className="text-xs text-muted-gray">{description}</p>
    </div>
  );
}

export default TranspoView;
