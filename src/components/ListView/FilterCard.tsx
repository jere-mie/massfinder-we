import { DAYS_OF_WEEK, SECTION_OPTIONS } from '../../utils/constants';

interface FilterCardProps {
  selectedDay: string;
  selectedSection: string;
  onDayChange: (day: string) => void;
  onSectionChange: (section: string) => void;
}

/**
 * Filter card component for list view
 */
export function FilterCard({
  selectedDay,
  selectedSection,
  onDayChange,
  onSectionChange,
}: FilterCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter Schedules</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="group" aria-label="List filters">
        <div>
          <label
            htmlFor="day-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Day of Week
          </label>
          <select
            id="day-filter"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedDay}
            onChange={(e) => onDayChange(e.target.value)}
            aria-label="Filter schedules by day of week"
          >
            <option value="all">All Days</option>
            {DAYS_OF_WEEK.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="section-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Section
          </label>
          <select
            id="section-filter"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedSection}
            onChange={(e) => onSectionChange(e.target.value)}
            aria-label="Filter by schedule section"
          >
            {SECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
