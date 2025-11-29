import { DAYS_OF_WEEK, TIME_OPTIONS } from '../../utils/constants';
import type { MapFilters, FilterType } from '../../types/church';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: MapFilters;
  onFilterChange: (updates: Partial<MapFilters>) => void;
  onReset: () => void;
}

/**
 * Slide-out filter panel for map view
 */
export function FilterPanel({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onReset,
}: FilterPanelProps) {
  const handleChange = (key: keyof MapFilters, value: string) => {
    onFilterChange({ [key]: value });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[1000] transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-80 max-w-full bg-white shadow-xl z-[1001] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-labelledby="filters-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <h2 id="filters-title" className="text-lg font-semibold text-gray-900">
            Filter Churches
          </h2>
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            onClick={onClose}
            aria-label="Close filter panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Event Type */}
          <div>
            <label htmlFor="filter-type" className="block text-sm font-medium text-gray-700 mb-1">
              Event Type
            </label>
            <select
              id="filter-type"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.filterType}
              onChange={(e) => handleChange('filterType', e.target.value as FilterType)}
            >
              <option value="masses">Masses</option>
              <option value="confession">Confession Times</option>
              <option value="adoration">Adoration Times</option>
            </select>
          </div>

          {/* Day of Week */}
          <div>
            <label htmlFor="filter-day" className="block text-sm font-medium text-gray-700 mb-1">
              Day of Week
            </label>
            <select
              id="filter-day"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.filterDay}
              onChange={(e) => handleChange('filterDay', e.target.value)}
            >
              <option value="all">All Days</option>
              {DAYS_OF_WEEK.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div>
            <label htmlFor="filter-after-time" className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <select
              id="filter-after-time"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.filterAfterTime}
              onChange={(e) => handleChange('filterAfterTime', e.target.value)}
            >
              <option value="0000">Start of Day</option>
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* End Time */}
          <div>
            <label htmlFor="filter-before-time" className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <select
              id="filter-before-time"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.filterBeforeTime}
              onChange={(e) => handleChange('filterBeforeTime', e.target.value)}
            >
              <option value="9999">End of Day</option>
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div className="space-y-2 pt-4">
            <button
              type="button"
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              onClick={onReset}
            >
              Reset Filters
            </button>
            <button
              type="button"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              onClick={onClose}
            >
              Apply & Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
