import type { TableRow } from '../../types/church';
import { getChurchPath } from '../../utils/slugify';

interface DataTableProps {
  title: string;
  headers: string[];
  rows: TableRow[];
  onChurchClick: (churchName: string) => void;
}

/**
 * Reusable data table component for displaying church schedules
 */
export function DataTable({ title, headers, rows, onChurchClick }: DataTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-center text-gray-800 mb-4">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <caption className="sr-only">{title} for Windsor-Essex County churches</caption>
          <thead className="bg-gray-50">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm">
                  <a
                    href={getChurchPath(row.id)}
                    className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium"
                  >
                    {row.name}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{row.address}</td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.day}</td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.time}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{row.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
