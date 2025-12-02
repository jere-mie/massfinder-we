import type { TabType } from '../types/church';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

/**
 * Header component with site title and tab navigation
 */
export function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <div className="container mx-auto px-4 text-center my-6">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
        Mass, Confession, & Adoration Times
      </h1>
      <nav className="flex justify-center" role="tablist" aria-label="Main navigation">
        <div className="inline-flex border-b border-gray-200">
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px ${
              activeTab === 'map'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => onTabChange('map')}
            type="button"
            role="tab"
            aria-selected={activeTab === 'map'}
            aria-controls="map-panel"
          >
            Map
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => onTabChange('list')}
            type="button"
            role="tab"
            aria-selected={activeTab === 'list'}
            aria-controls="list-panel"
          >
            List
          </button>
        </div>
      </nav>
    </div>
  );
}
