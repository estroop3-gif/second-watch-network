/**
 * PositionSelector - Searchable dropdown for film production positions
 * Pre-populated with comprehensive list of industry positions
 * No "Add new" option - positions are fixed
 */
import React from 'react';
import { Briefcase } from 'lucide-react';
import SearchableCombobox, { SearchableItem } from './SearchableCombobox';

interface Position extends SearchableItem {
  id: string;
  name: string;
  department: string;
}

interface PositionSelectorProps {
  value: string | null;
  onChange: (id: string | null, position?: Position) => void;
  disabled?: boolean;
  className?: string;
}

// Comprehensive list of film production positions organized by department
const POSITIONS: Position[] = [
  // Direction
  { id: 'director', name: 'Director', department: 'Direction' },
  { id: 'first-ad', name: '1st Assistant Director', department: 'Direction' },
  { id: 'second-ad', name: '2nd Assistant Director', department: 'Direction' },
  { id: 'second-second-ad', name: '2nd 2nd Assistant Director', department: 'Direction' },
  { id: 'script-supervisor', name: 'Script Supervisor', department: 'Direction' },

  // Production
  { id: 'producer', name: 'Producer', department: 'Production' },
  { id: 'executive-producer', name: 'Executive Producer', department: 'Production' },
  { id: 'line-producer', name: 'Line Producer', department: 'Production' },
  { id: 'co-producer', name: 'Co-Producer', department: 'Production' },
  { id: 'associate-producer', name: 'Associate Producer', department: 'Production' },
  { id: 'upm', name: 'Unit Production Manager (UPM)', department: 'Production' },
  { id: 'production-supervisor', name: 'Production Supervisor', department: 'Production' },
  { id: 'production-coordinator', name: 'Production Coordinator', department: 'Production' },
  { id: 'production-secretary', name: 'Production Secretary', department: 'Production' },
  { id: 'production-assistant', name: 'Production Assistant (PA)', department: 'Production' },
  { id: 'office-pa', name: 'Office PA', department: 'Production' },
  { id: 'set-pa', name: 'Set PA', department: 'Production' },

  // Camera
  { id: 'dp', name: 'Director of Photography (DP)', department: 'Camera' },
  { id: 'cinematographer', name: 'Cinematographer', department: 'Camera' },
  { id: 'camera-operator', name: 'Camera Operator', department: 'Camera' },
  { id: 'first-ac', name: '1st Assistant Camera (Focus Puller)', department: 'Camera' },
  { id: 'second-ac', name: '2nd Assistant Camera (Clapper/Loader)', department: 'Camera' },
  { id: 'dit', name: 'Digital Imaging Technician (DIT)', department: 'Camera' },
  { id: 'steadicam-operator', name: 'Steadicam Operator', department: 'Camera' },
  { id: 'drone-operator', name: 'Drone Operator', department: 'Camera' },
  { id: 'camera-trainee', name: 'Camera Trainee', department: 'Camera' },

  // Lighting / Grip
  { id: 'gaffer', name: 'Gaffer', department: 'Lighting' },
  { id: 'best-boy-electric', name: 'Best Boy Electric', department: 'Lighting' },
  { id: 'electrician', name: 'Electrician', department: 'Lighting' },
  { id: 'lamp-operator', name: 'Lamp Operator', department: 'Lighting' },
  { id: 'key-grip', name: 'Key Grip', department: 'Grip' },
  { id: 'best-boy-grip', name: 'Best Boy Grip', department: 'Grip' },
  { id: 'dolly-grip', name: 'Dolly Grip', department: 'Grip' },
  { id: 'grip', name: 'Grip', department: 'Grip' },
  { id: 'rigging-gaffer', name: 'Rigging Gaffer', department: 'Lighting' },
  { id: 'rigging-grip', name: 'Rigging Grip', department: 'Grip' },

  // Sound
  { id: 'production-sound-mixer', name: 'Production Sound Mixer', department: 'Sound' },
  { id: 'sound-mixer', name: 'Sound Mixer', department: 'Sound' },
  { id: 'boom-operator', name: 'Boom Operator', department: 'Sound' },
  { id: 'sound-utility', name: 'Sound Utility', department: 'Sound' },
  { id: 'sound-assistant', name: 'Sound Assistant', department: 'Sound' },
  { id: 'playback-operator', name: 'Playback Operator', department: 'Sound' },

  // Art Department
  { id: 'production-designer', name: 'Production Designer', department: 'Art' },
  { id: 'art-director', name: 'Art Director', department: 'Art' },
  { id: 'assistant-art-director', name: 'Assistant Art Director', department: 'Art' },
  { id: 'set-designer', name: 'Set Designer', department: 'Art' },
  { id: 'set-decorator', name: 'Set Decorator', department: 'Art' },
  { id: 'leadman', name: 'Leadman', department: 'Art' },
  { id: 'set-dresser', name: 'Set Dresser', department: 'Art' },
  { id: 'prop-master', name: 'Property Master', department: 'Art' },
  { id: 'prop-assistant', name: 'Property Assistant', department: 'Art' },
  { id: 'buyer', name: 'Buyer', department: 'Art' },
  { id: 'art-department-coordinator', name: 'Art Department Coordinator', department: 'Art' },
  { id: 'scenic-artist', name: 'Scenic Artist', department: 'Art' },
  { id: 'graphic-designer', name: 'Graphic Designer', department: 'Art' },

  // Construction
  { id: 'construction-coordinator', name: 'Construction Coordinator', department: 'Construction' },
  { id: 'construction-foreman', name: 'Construction Foreman', department: 'Construction' },
  { id: 'carpenter', name: 'Carpenter', department: 'Construction' },
  { id: 'painter', name: 'Painter', department: 'Construction' },
  { id: 'greens', name: 'Greens', department: 'Construction' },

  // Costume / Wardrobe
  { id: 'costume-designer', name: 'Costume Designer', department: 'Wardrobe' },
  { id: 'assistant-costume-designer', name: 'Assistant Costume Designer', department: 'Wardrobe' },
  { id: 'costume-supervisor', name: 'Costume Supervisor', department: 'Wardrobe' },
  { id: 'key-costumer', name: 'Key Costumer', department: 'Wardrobe' },
  { id: 'costumer', name: 'Costumer', department: 'Wardrobe' },
  { id: 'wardrobe-assistant', name: 'Wardrobe Assistant', department: 'Wardrobe' },
  { id: 'tailor', name: 'Tailor', department: 'Wardrobe' },
  { id: 'seamstress', name: 'Seamstress', department: 'Wardrobe' },

  // Hair & Makeup
  { id: 'makeup-department-head', name: 'Makeup Department Head', department: 'Hair & Makeup' },
  { id: 'key-makeup-artist', name: 'Key Makeup Artist', department: 'Hair & Makeup' },
  { id: 'makeup-artist', name: 'Makeup Artist', department: 'Hair & Makeup' },
  { id: 'sfx-makeup', name: 'Special Effects Makeup Artist', department: 'Hair & Makeup' },
  { id: 'prosthetics', name: 'Prosthetics Artist', department: 'Hair & Makeup' },
  { id: 'hair-department-head', name: 'Hair Department Head', department: 'Hair & Makeup' },
  { id: 'key-hairstylist', name: 'Key Hairstylist', department: 'Hair & Makeup' },
  { id: 'hairstylist', name: 'Hairstylist', department: 'Hair & Makeup' },

  // Locations
  { id: 'location-manager', name: 'Location Manager', department: 'Locations' },
  { id: 'assistant-location-manager', name: 'Assistant Location Manager', department: 'Locations' },
  { id: 'location-scout', name: 'Location Scout', department: 'Locations' },
  { id: 'location-assistant', name: 'Location Assistant', department: 'Locations' },
  { id: 'location-coordinator', name: 'Location Coordinator', department: 'Locations' },

  // Transportation
  { id: 'transportation-coordinator', name: 'Transportation Coordinator', department: 'Transportation' },
  { id: 'transportation-captain', name: 'Transportation Captain', department: 'Transportation' },
  { id: 'driver', name: 'Driver', department: 'Transportation' },
  { id: 'picture-car-coordinator', name: 'Picture Car Coordinator', department: 'Transportation' },

  // Casting
  { id: 'casting-director', name: 'Casting Director', department: 'Casting' },
  { id: 'casting-associate', name: 'Casting Associate', department: 'Casting' },
  { id: 'casting-assistant', name: 'Casting Assistant', department: 'Casting' },
  { id: 'extras-casting', name: 'Extras Casting Director', department: 'Casting' },

  // Stunts
  { id: 'stunt-coordinator', name: 'Stunt Coordinator', department: 'Stunts' },
  { id: 'stunt-performer', name: 'Stunt Performer', department: 'Stunts' },
  { id: 'stunt-double', name: 'Stunt Double', department: 'Stunts' },
  { id: 'fight-choreographer', name: 'Fight Choreographer', department: 'Stunts' },

  // Special Effects
  { id: 'sfx-supervisor', name: 'Special Effects Supervisor', department: 'Special Effects' },
  { id: 'sfx-coordinator', name: 'Special Effects Coordinator', department: 'Special Effects' },
  { id: 'sfx-technician', name: 'Special Effects Technician', department: 'Special Effects' },
  { id: 'pyrotechnician', name: 'Pyrotechnician', department: 'Special Effects' },

  // VFX
  { id: 'vfx-supervisor', name: 'VFX Supervisor', department: 'VFX' },
  { id: 'vfx-producer', name: 'VFX Producer', department: 'VFX' },
  { id: 'vfx-coordinator', name: 'VFX Coordinator', department: 'VFX' },
  { id: 'vfx-artist', name: 'VFX Artist', department: 'VFX' },
  { id: 'compositor', name: 'Compositor', department: 'VFX' },
  { id: 'roto-artist', name: 'Roto Artist', department: 'VFX' },
  { id: 'matchmove-artist', name: 'Matchmove Artist', department: 'VFX' },
  { id: '3d-artist', name: '3D Artist', department: 'VFX' },
  { id: 'matte-painter', name: 'Matte Painter', department: 'VFX' },

  // Post-Production
  { id: 'editor', name: 'Editor', department: 'Post-Production' },
  { id: 'assistant-editor', name: 'Assistant Editor', department: 'Post-Production' },
  { id: 'post-supervisor', name: 'Post-Production Supervisor', department: 'Post-Production' },
  { id: 'post-coordinator', name: 'Post-Production Coordinator', department: 'Post-Production' },
  { id: 'colorist', name: 'Colorist', department: 'Post-Production' },
  { id: 'online-editor', name: 'Online Editor', department: 'Post-Production' },
  { id: 'dailies-operator', name: 'Dailies Operator', department: 'Post-Production' },

  // Post Sound
  { id: 'sound-designer', name: 'Sound Designer', department: 'Post Sound' },
  { id: 'supervising-sound-editor', name: 'Supervising Sound Editor', department: 'Post Sound' },
  { id: 'dialogue-editor', name: 'Dialogue Editor', department: 'Post Sound' },
  { id: 'sound-effects-editor', name: 'Sound Effects Editor', department: 'Post Sound' },
  { id: 'foley-artist', name: 'Foley Artist', department: 'Post Sound' },
  { id: 'foley-mixer', name: 'Foley Mixer', department: 'Post Sound' },
  { id: 'adr-supervisor', name: 'ADR Supervisor', department: 'Post Sound' },
  { id: 're-recording-mixer', name: 'Re-Recording Mixer', department: 'Post Sound' },

  // Music
  { id: 'composer', name: 'Composer', department: 'Music' },
  { id: 'music-supervisor', name: 'Music Supervisor', department: 'Music' },
  { id: 'music-editor', name: 'Music Editor', department: 'Music' },
  { id: 'music-coordinator', name: 'Music Coordinator', department: 'Music' },

  // Accounting
  { id: 'production-accountant', name: 'Production Accountant', department: 'Accounting' },
  { id: 'first-assistant-accountant', name: '1st Assistant Accountant', department: 'Accounting' },
  { id: 'second-assistant-accountant', name: '2nd Assistant Accountant', department: 'Accounting' },
  { id: 'payroll-accountant', name: 'Payroll Accountant', department: 'Accounting' },
  { id: 'accounting-clerk', name: 'Accounting Clerk', department: 'Accounting' },

  // Publicity / Marketing
  { id: 'unit-publicist', name: 'Unit Publicist', department: 'Publicity' },
  { id: 'still-photographer', name: 'Still Photographer', department: 'Publicity' },
  { id: 'bts-videographer', name: 'Behind-the-Scenes Videographer', department: 'Publicity' },
  { id: 'epk-producer', name: 'EPK Producer', department: 'Publicity' },

  // Craft Services / Catering
  { id: 'craft-services', name: 'Craft Services', department: 'Craft Services' },
  { id: 'caterer', name: 'Caterer', department: 'Craft Services' },
  { id: 'chef', name: 'Chef', department: 'Craft Services' },

  // Medic / Safety
  { id: 'set-medic', name: 'Set Medic', department: 'Safety' },
  { id: 'safety-coordinator', name: 'Safety Coordinator', department: 'Safety' },
  { id: 'intimacy-coordinator', name: 'Intimacy Coordinator', department: 'Safety' },
  { id: 'animal-wrangler', name: 'Animal Wrangler', department: 'Safety' },

  // Security
  { id: 'security-coordinator', name: 'Security Coordinator', department: 'Security' },
  { id: 'security-guard', name: 'Security Guard', department: 'Security' },

  // Talent
  { id: 'actor', name: 'Actor', department: 'Talent' },
  { id: 'background-actor', name: 'Background Actor / Extra', department: 'Talent' },
  { id: 'stand-in', name: 'Stand-In', department: 'Talent' },
  { id: 'photo-double', name: 'Photo Double', department: 'Talent' },
  { id: 'voice-actor', name: 'Voice Actor', department: 'Talent' },

  // Writing
  { id: 'screenwriter', name: 'Screenwriter', department: 'Writing' },
  { id: 'staff-writer', name: 'Staff Writer', department: 'Writing' },
  { id: 'story-editor', name: 'Story Editor', department: 'Writing' },
  { id: 'script-doctor', name: 'Script Doctor', department: 'Writing' },

  // Other
  { id: 'showrunner', name: 'Showrunner', department: 'Other' },
  { id: 'creative-director', name: 'Creative Director', department: 'Other' },
  { id: 'content-creator', name: 'Content Creator', department: 'Other' },
  { id: 'videographer', name: 'Videographer', department: 'Other' },
  { id: 'photographer', name: 'Photographer', department: 'Other' },
  { id: 'intern', name: 'Intern', department: 'Other' },
];

const PositionSelector: React.FC<PositionSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const searchPositions = async (query: string): Promise<Position[]> => {
    // Filter positions locally - no API call needed
    if (!query || query.length < 1) {
      // Return all positions sorted alphabetically
      return [...POSITIONS].sort((a, b) => a.name.localeCompare(b.name));
    }

    const lowerQuery = query.toLowerCase();
    const filtered = POSITIONS.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.department.toLowerCase().includes(lowerQuery)
    );

    // Sort: exact matches first, then starts with, then contains
    filtered.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      if (aName === lowerQuery && bName !== lowerQuery) return -1;
      if (bName === lowerQuery && aName !== lowerQuery) return 1;
      if (aName.startsWith(lowerQuery) && !bName.startsWith(lowerQuery)) return -1;
      if (bName.startsWith(lowerQuery) && !aName.startsWith(lowerQuery)) return 1;
      return aName.localeCompare(bName);
    });

    return filtered;
  };

  const renderItem = (position: Position) => (
    <div className="flex items-center gap-2">
      <Briefcase className="h-4 w-4 text-muted-gray" />
      <div className="flex flex-col">
        <span className="text-bone-white">{position.name}</span>
        <span className="text-[10px] text-muted-gray">{position.department}</span>
      </div>
    </div>
  );

  const renderSelected = (position: Position) => (
    <div className="flex items-center gap-2 truncate">
      <Briefcase className="h-4 w-4 text-muted-gray flex-shrink-0" />
      <span className="truncate">{position.name}</span>
    </div>
  );

  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      searchFn={searchPositions}
      // No onAddNew - positions are fixed
      placeholder="Select position..."
      searchPlaceholder="Search positions..."
      emptyMessage="No positions found."
      renderItem={renderItem}
      renderSelected={renderSelected}
      disabled={disabled}
      className={className}
    />
  );
};

export default PositionSelector;
