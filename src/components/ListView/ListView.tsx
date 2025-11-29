import { useState } from 'react';
import type { Church } from '../../types/church';
import { DataTable } from './DataTable';
import { FilterCard } from './FilterCard';
import {
  massesToTableRows,
  timeRangesToTableRows,
  filterRowsByDay,
} from '../../utils/filtering';

interface ListViewProps {
  churches: Church[];
  onChurchClick: (churchName: string) => void;
}

const TABLE_HEADERS = ['Church', 'Address', 'Day', 'Time', 'Notes'];

/**
 * List view component displaying church schedules in tabular format
 */
export function ListView({ churches, onChurchClick }: ListViewProps) {
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');

  // Prepare and filter data for tables
  const massesList = filterRowsByDay(massesToTableRows(churches, 'masses'), selectedDay);
  const dailyList = filterRowsByDay(massesToTableRows(churches, 'daily_masses'), selectedDay);
  const confessionList = filterRowsByDay(timeRangesToTableRows(churches, 'confession'), selectedDay);
  const adorationList = filterRowsByDay(timeRangesToTableRows(churches, 'adoration'), selectedDay);

  const shouldShowSection = (sectionValue: string) => {
    return selectedSection === 'all' || selectedSection === sectionValue;
  };

  return (
    <div className="container mx-auto px-4" role="region" aria-label="List view">
      <FilterCard
        selectedDay={selectedDay}
        selectedSection={selectedSection}
        onDayChange={setSelectedDay}
        onSectionChange={setSelectedSection}
      />

      {shouldShowSection('mass-times') && (
        <DataTable
          title="Mass Times"
          headers={TABLE_HEADERS}
          rows={massesList}
          onChurchClick={onChurchClick}
        />
      )}

      {shouldShowSection('daily-masses') && (
        <DataTable
          title="Daily Masses"
          headers={TABLE_HEADERS}
          rows={dailyList}
          onChurchClick={onChurchClick}
        />
      )}

      {shouldShowSection('confession-times') && (
        <DataTable
          title="Confession Times"
          headers={TABLE_HEADERS}
          rows={confessionList}
          onChurchClick={onChurchClick}
        />
      )}

      {shouldShowSection('adoration-times') && (
        <DataTable
          title="Adoration Times"
          headers={TABLE_HEADERS}
          rows={adorationList}
          onChurchClick={onChurchClick}
        />
      )}
    </div>
  );
}
