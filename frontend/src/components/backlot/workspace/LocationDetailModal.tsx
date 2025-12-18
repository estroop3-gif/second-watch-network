/**
 * LocationDetailModal - Modal for viewing full location details with scout photos
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MapPin,
  Phone,
  Mail,
  Plug,
  FileCheck,
  DollarSign,
  Edit,
  Globe,
  Building2,
  ExternalLink,
  Camera,
  User,
  Info,
  Car,
} from 'lucide-react';
import { BacklotLocation, BacklotScoutPhoto } from '@/types/backlot';
import {
  ScoutPhotosGallery,
  AddScoutPhotoModal,
  ScoutPhotoDetailModal,
} from '@/components/backlot/scout-photos';

interface LocationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: BacklotLocation | null;
  canEdit?: boolean;
  onEdit?: (location: BacklotLocation) => void;
}

export function LocationDetailModal({
  isOpen,
  onClose,
  location,
  canEdit = false,
  onEdit,
}: LocationDetailModalProps) {
  const [showAddPhotoModal, setShowAddPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<BacklotScoutPhoto | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<BacklotScoutPhoto | null>(null);

  if (!location) return null;

  const fullAddress = [location.address, location.city, location.state, location.zip]
    .filter(Boolean)
    .join(', ');

  const handleViewPhoto = (photo: BacklotScoutPhoto) => {
    setSelectedPhoto(photo);
  };

  const handleEditPhoto = (photo: BacklotScoutPhoto) => {
    setSelectedPhoto(null);
    setEditingPhoto(photo);
    setShowAddPhotoModal(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-charcoal-black border-muted-gray/30 p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl text-bone-white flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-accent-yellow" />
                  {location.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  {location.location_type && (
                    <Badge variant="outline" className="text-xs border-muted-gray/30">
                      <Building2 className="w-3 h-3 mr-1" />
                      {location.location_type}
                    </Badge>
                  )}
                  {(location.visibility === 'public' || (location.is_public && !location.visibility)) && (
                    <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                      <Globe className="w-3 h-3 mr-1" />
                      Public
                    </Badge>
                  )}
                  {location.visibility === 'unlisted' && (
                    <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">
                      Unlisted
                    </Badge>
                  )}
                  {location.region_tag && (
                    <Badge variant="outline" className="text-xs border-muted-gray/30">
                      {location.region_tag}
                    </Badge>
                  )}
                </div>
              </div>
              {canEdit && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(location)}
                  className="border-muted-gray/30"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1">
            <div className="px-6 border-b border-muted-gray/20">
              <TabsList className="bg-transparent gap-4">
                <TabsTrigger
                  value="details"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent-yellow rounded-none px-1 pb-2"
                >
                  <Info className="w-4 h-4 mr-1" />
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="photos"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent-yellow rounded-none px-1 pb-2"
                >
                  <Camera className="w-4 h-4 mr-1" />
                  Scout Photos
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[60vh]">
              <TabsContent value="details" className="p-6 m-0">
                <div className="space-y-6">
                  {/* Scene Description */}
                  {(location.scene_description_override || location.scene_description) && (
                    <div className="p-3 bg-accent-yellow/10 rounded-lg border border-accent-yellow/20">
                      <span className="text-xs text-accent-yellow uppercase font-medium">Scene</span>
                      <p className="text-accent-yellow font-mono mt-1">
                        {location.scene_description_override || location.scene_description}
                      </p>
                    </div>
                  )}

                  {/* Project Notes */}
                  {location.project_notes && (
                    <div className="p-3 bg-muted-gray/10 rounded-lg">
                      <span className="text-xs text-accent-yellow uppercase font-medium">Project Notes</span>
                      <p className="text-bone-white mt-1">{location.project_notes}</p>
                    </div>
                  )}

                  {/* Description */}
                  {location.description && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-gray uppercase tracking-wide mb-2">
                        Description
                      </h4>
                      <p className="text-bone-white">{location.description}</p>
                    </div>
                  )}

                  {/* Address */}
                  {fullAddress && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-gray uppercase tracking-wide mb-2 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        Address
                      </h4>
                      <div className="flex items-center gap-2">
                        <p className="text-bone-white">{fullAddress}</p>
                        {location.latitude && location.longitude && (
                          <a
                            href={`https://maps.google.com/?q=${location.latitude},${location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-yellow hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Map
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Contact */}
                  {(location.contact_name || location.contact_phone || location.contact_email) && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-gray uppercase tracking-wide mb-2 flex items-center gap-1">
                        <User className="w-4 h-4" />
                        Contact
                      </h4>
                      <div className="space-y-1">
                        {location.contact_name && (
                          <p className="text-bone-white">{location.contact_name}</p>
                        )}
                        {location.contact_phone && (
                          <p className="text-muted-gray flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            <a href={`tel:${location.contact_phone}`} className="hover:text-accent-yellow">
                              {location.contact_phone}
                            </a>
                          </p>
                        )}
                        {location.contact_email && (
                          <p className="text-muted-gray flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <a href={`mailto:${location.contact_email}`} className="hover:text-accent-yellow">
                              {location.contact_email}
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Parking Notes */}
                  {location.parking_notes && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-gray uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Car className="w-4 h-4" />
                        Parking
                      </h4>
                      <p className="text-bone-white">{location.parking_notes}</p>
                    </div>
                  )}

                  {/* Amenities & Status */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-gray uppercase tracking-wide mb-2">
                      Amenities & Status
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {location.power_available && (
                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                          <Plug className="w-3 h-3 mr-1" />
                          Power Available
                        </Badge>
                      )}
                      {location.restrooms_available && (
                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                          Restrooms Available
                        </Badge>
                      )}
                      {location.permit_required && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            location.permit_obtained
                              ? 'border-green-500/30 text-green-400'
                              : 'border-orange-500/30 text-orange-400'
                          }`}
                        >
                          <FileCheck className="w-3 h-3 mr-1" />
                          {location.permit_obtained ? 'Permit Obtained' : 'Permit Required'}
                        </Badge>
                      )}
                      {location.location_fee !== undefined && location.location_fee !== null && (
                        <Badge variant="outline" className="text-xs border-muted-gray/30">
                          <DollarSign className="w-3 h-3 mr-1" />
                          ${location.location_fee} fee
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Images */}
                  {location.images && location.images.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-gray uppercase tracking-wide mb-2">
                        Images
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {location.images.map((img, idx) => (
                          <a
                            key={idx}
                            href={img}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-[4/3] rounded-lg overflow-hidden border border-muted-gray/20 hover:border-accent-yellow/50 transition-colors"
                          >
                            <img
                              src={img}
                              alt={`${location.name} image ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="photos" className="p-6 m-0">
                <ScoutPhotosGallery
                  locationId={location.id}
                  onAddPhoto={() => {
                    setEditingPhoto(null);
                    setShowAddPhotoModal(true);
                  }}
                  onViewPhoto={handleViewPhoto}
                  canEdit={canEdit}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Scout Photo Modal */}
      <AddScoutPhotoModal
        isOpen={showAddPhotoModal}
        onClose={() => {
          setShowAddPhotoModal(false);
          setEditingPhoto(null);
        }}
        locationId={location.id}
        editPhoto={editingPhoto}
      />

      {/* Scout Photo Detail Modal */}
      <ScoutPhotoDetailModal
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        photo={selectedPhoto}
        locationId={location.id}
        canEdit={canEdit}
        onEdit={handleEditPhoto}
      />
    </>
  );
}

export default LocationDetailModal;
