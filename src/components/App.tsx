import { useState, useRef } from 'react';
import { Header } from './Header';
import { MapView, type MapViewHandle } from './MapView';
import { ListView } from './ListView';
import { useChurches } from '../hooks/useChurches';
import type { TabType } from '../types/church';
import { CalendarView } from './CalendarView';

/**
 * Root application component
 * Manages global state for churches data and active tab
 */
export function App() {
  const { churches, loading, error } = useChurches();
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const mapViewRef = useRef<MapViewHandle>(null);

  /**
   * Handle church name click from list view
   * Switches to map tab and opens the church's marker popup
   */
  const handleChurchClick = (churchName: string) => {
    setActiveTab('map');
    // Give the map time to render, then open the marker
    setTimeout(() => {
      mapViewRef.current?.openMarkerPopup(churchName);
    }, 100);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 text-center my-12">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"
          role="status"
        >
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-4 text-gray-600" aria-live="polite">
          Loading church data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 text-center my-12">
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="text-lg font-semibold mb-2">Error Loading Data</h2>
          <p>Error loading church data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={activeTab === 'map' ? 'h-[calc(100vh-5rem)] flex flex-col overflow-hidden' : ''}>
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className={activeTab === 'map' ? 'flex-1 min-h-0 px-4 pb-4 w-full max-w-6xl mx-auto' : 'mx-auto px-4 md:max-w-4xl lg:max-w-5xl xl:max-w-6xl'}>
        <div
          id="map-panel"
          className={activeTab === 'map' ? 'h-full w-full flex flex-col' : 'hidden'}
          role="tabpanel"
          aria-labelledby="map-tab"
          aria-hidden={activeTab !== 'map'}
        >
          <MapView churches={churches} ref={mapViewRef} />
        </div>
        <div
          id="list-panel"
          className={activeTab === 'list' ? '' : 'hidden'}
          role="tabpanel"
          aria-labelledby="list-tab"
          aria-hidden={activeTab !== 'list'}
        >
          <ListView churches={churches} onChurchClick={handleChurchClick} />
        </div>
        <div
          id="calendar-panel"
          className={activeTab === 'calendar' ? '' : 'hidden'}
          role="tabpanel"
          aria-labelledby="calendar-tab"
          aria-hidden={activeTab !== 'calendar'}
        >
          <CalendarView churches={churches} />
        </div>
      </main>
    </div>
  );
}
