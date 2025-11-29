import type { Church } from '../../types/church';
import { formatPhoneNumber, formatUrl, formatTime, formatTimeRange } from '../../utils/formatting';

interface ChurchPopupProps {
  church: Church;
}

/**
 * Popup content component for church markers
 */
export function ChurchPopup({ church }: ChurchPopupProps) {
  return (
    <div className="max-h-[50vh] overflow-y-auto pr-1 mt-2">
      <h1 className="text-lg font-bold text-gray-900 border-b-2 border-gray-200 pb-2 mb-3 mt-0">
        {church.name}
      </h1>

      {/* Contact Info */}
      <p className="my-1 text-sm">
        📍{' '}
        <a
          href={church.map}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {church.address}
        </a>
      </p>
      <p className="my-1 text-sm">📞 {formatPhoneNumber(church.phone)}</p>
      <p className="my-1 text-sm">
        🌐{' '}
        <a
          href={church.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {formatUrl(church.website)}
        </a>
      </p>

      {/* Masses */}
      {church.masses.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-gray-700 mt-4 mb-2">Masses</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {church.masses.map((m, i) => (
              <li key={i}>
                {m.day} - {formatTime(m.time)}
                {m.note && (
                  <ul className="list-disc pl-4 mt-1 text-gray-600">
                    <li>{m.note}</li>
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Daily Masses */}
      {church.daily_masses.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-gray-700 mt-4 mb-2">Daily Masses</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {church.daily_masses.map((m, i) => (
              <li key={i}>
                {m.day} - {formatTime(m.time)}
                {m.note && (
                  <ul className="list-disc pl-4 mt-1 text-gray-600">
                    <li>{m.note}</li>
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Confession */}
      {church.confession.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-gray-700 mt-4 mb-2">Confession Times</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {church.confession.map((c, i) => (
              <li key={i}>
                {c.day} - {formatTimeRange(c.start, c.end)}
                {c.note && (
                  <ul className="list-disc pl-4 mt-1 text-gray-600">
                    <li>{c.note}</li>
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Adoration */}
      {church.adoration.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-gray-700 mt-4 mb-2">Adoration Times</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {church.adoration.map((a, i) => (
              <li key={i}>
                {a.day} - {formatTimeRange(a.start, a.end)}
                {a.note && (
                  <ul className="list-disc pl-4 mt-1 text-gray-600">
                    <li>{a.note}</li>
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
