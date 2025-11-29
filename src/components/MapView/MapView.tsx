import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import type { Church, MapFilters } from '../../types/church';
import { ChurchPopup } from './ChurchPopup';
import { FilterPanel } from './FilterPanel';
import { getFilteredChurches } from '../../utils/filtering';
import { MAP_CENTER, MAP_ZOOM, MAP_MIN_ZOOM, MAP_MAX_ZOOM } from '../../utils/constants';

interface MapViewProps {
  churches: Church[];
}

export interface MapViewHandle {
  openMarkerPopup: (churchName: string) => void;
}

const DEFAULT_FILTERS: MapFilters = {
  filterType: 'masses',
  filterDay: 'all',
  filterAfterTime: '0000',
  filterBeforeTime: '9999',
};

/**
 * Map view component with Leaflet map and church markers
 */
export const MapView = forwardRef<MapViewHandle, MapViewProps>(({ churches }, ref) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());

  // Get filtered churches
  const filteredChurches = getFilteredChurches(
    churches,
    filters.filterType,
    filters.filterDay,
    filters.filterAfterTime,
    filters.filterBeforeTime
  );

  // Expose method to open specific marker popup
  useImperativeHandle(ref, () => ({
    openMarkerPopup: (churchName: string) => {
      const marker = markersRef.current.get(churchName);
      if (marker) {
        marker.openPopup();
      }
    },
  }));

  const handleFilterChange = (updates: Partial<MapFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
  };

  // Store marker ref
  const setMarkerRef = (churchName: string, marker: LeafletMarker | null) => {
    if (marker) {
      markersRef.current.set(churchName, marker);
    } else {
      markersRef.current.delete(churchName);
    }
  };

  return (
    <div role="region" aria-label="Map view" className="h-full flex flex-col">
      <button
        className="mb-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium self-start"
        type="button"
        onClick={() => setFiltersOpen(true)}
        aria-label="Open filter panel"
        aria-expanded={filtersOpen}
        aria-controls="filters-panel"
      >
        Filters
      </button>

      <div
        className="flex-1 min-h-0 w-full rounded-lg overflow-hidden shadow-lg"
        role="application"
        aria-label="Interactive map of Catholic churches in Windsor-Essex County"
      >
        <MapContainer
          center={MAP_CENTER}
          zoom={MAP_ZOOM}
          minZoom={MAP_MIN_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
          zoomControl={false}
          className="h-full w-full"
          ref={mapRef}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ZoomControl position="bottomright" />

          {filteredChurches.map((church) => (
            <Marker
              key={church.name}
              position={church.coordinates}
              ref={(marker) => setMarkerRef(church.name, marker)}
            >
              <Popup minWidth={250} maxWidth={350}>
                <ChurchPopup church={church} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <FilterPanel
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />
    </div>
  );
});

MapView.displayName = 'MapView';
