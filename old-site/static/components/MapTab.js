import { html } from '../standalone-preact.esm.js';
import { useState, useEffect, useRef } from '../standalone-preact.esm.js';
import * as L from '../leaflet/leaflet-src.esm.js';
import { formatPhoneNumber, formatUrl, formatTime } from '../utils.js';
import { FiltersOffcanvas } from './FiltersOffcanvas.js';

/**
 * Create popup HTML content for a church marker
 * @param {Object} church - Church data object
 * @param {string} church.name - Church name
 * @param {string} church.address - Church address
 * @param {string} church.map - Google Maps link
 * @param {string} church.phone - Phone number
 * @param {string} church.website - Website URL
 * @param {Array} church.masses - Array of mass objects
 * @param {Array} church.daily_masses - Array of daily mass objects
 * @param {Array} church.confession - Array of confession time objects
 * @param {Array} church.adoration - Array of adoration time objects
 * @returns {string} HTML string for popup content
 */
function createPopup(church) {
    const massesHTML = church.masses.length === 0 ? '' : `
        <h2>Masses</h2>
        <ul>
            ${church.masses.map(m => `<li>
                ${m.day} - ${formatTime(m.time)}
                ${m.note ? `<ul class="sublist"><li>${m.note}</li></ul>` : ''}
            </li>`).join('')}
        </ul>`;

    const dailyMassesHTML = church.daily_masses.length === 0 ? '' : `
        <h2>Daily Masses</h2>
        <ul>
            ${church.daily_masses.map(m => `<li>
                ${m.day} - ${formatTime(m.time)}
                ${m.note ? `<ul class="sublist"><li>${m.note}</li></ul>` : ''}
            </li>`).join('')}
        </ul>`;

    const confessionHTML = church.confession.length === 0 ? '' : `
        <h2>Confession Times</h2>
        <ul>
            ${church.confession.map(c => `<li>
                ${c.day} - ${formatTime(c.start)} - ${formatTime(c.end)}
                ${c.note ? `<ul class="sublist"><li>${c.note}</li></ul>` : ''}
            </li>`).join('')}
        </ul>`;

    const adorationHTML = church.adoration.length === 0 ? '' : `
        <h2>Adoration Times</h2>
        <ul>
            ${church.adoration.map(a => `<li>
                ${a.day} - ${formatTime(a.start)} - ${formatTime(a.end)}
                ${a.note ? `<ul class="sublist"><li>${a.note}</li></ul>` : ''}
            </li>`).join('')}
        </ul>`;

    return `
        <div class="churchPopup">            
            <h1>${church.name}</h1>
            <p>📍 <a href="${church.map}" target="_blank">${church.address}</a></p>
            <p>📞 ${formatPhoneNumber(church.phone)}</p>
            <p>🌐 <a href="${church.website}" target="_blank">${formatUrl(church.website)}</a></p>
            ${massesHTML}
            ${dailyMassesHTML}
            ${confessionHTML}
            ${adorationHTML}
        </div>
    `;
}

/**
 * MapTab component displaying an interactive Leaflet map with church markers
 * @param {Object} props - Component props
 * @param {Array} props.churches - Array of church objects to display
 * @param {React.MutableRefObject} props.onMarkerClick - Ref to expose marker click handler
 * @returns {import('../standalone-preact.esm.js').VNode} Map tab component
 */
export function MapTab({ churches, onMarkerClick }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filters, setFilters] = useState({
        filterType: 'masses',
        filterDay: 'all',
        filterAfterTime: '0000',
        filterBeforeTime: '9999'
    });

    // Initialize map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const map = L.map(mapRef.current, {
            zoomControl: false
        }).setView([42.16132298808876, -82.92932437200604], 11);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            minZoom: 9,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);

        mapInstanceRef.current = map;
    }, []);

    /**
     * Filter churches based on current filter settings
     * @returns {Array} Filtered array of church objects
     */
    const getFilteredChurches = () => {
        const { filterType, filterDay, filterAfterTime, filterBeforeTime } = filters;
        
        if (filterType === 'masses') {
            return churches.filter(church => {
                const masses = church.masses.concat(church.daily_masses);
                const filtered = masses.filter(mass => {
                    const timeMatch = mass.time >= filterAfterTime && mass.time <= filterBeforeTime;
                    const dayMatch = filterDay === 'all' || mass.day === filterDay;
                    return timeMatch && dayMatch;
                });
                return filtered.length > 0;
            });
        } else {
            // 'adoration' or 'confession'
            return churches.filter(church => {
                const items = church[filterType];
                const filtered = items.filter(item => {
                    const timeMatch = (item.start >= filterAfterTime && item.start <= filterBeforeTime) ||
                                    (item.end >= filterAfterTime && item.end <= filterBeforeTime);
                    const dayMatch = filterDay === 'all' || item.day === filterDay;
                    return timeMatch && dayMatch;
                });
                return filtered.length > 0;
            });
        }
    };

    // Update markers when churches or filters change
    useEffect(() => {
        if (!mapInstanceRef.current) return;

        // Clear existing markers
        markersRef.current.forEach(({ marker }) => {
            mapInstanceRef.current.removeLayer(marker);
        });
        markersRef.current = [];

        // Add new markers
        const filteredChurches = getFilteredChurches();
        filteredChurches.forEach(church => {
            const marker = L.marker(church.coordinates)
                .addTo(mapInstanceRef.current)
                .bindPopup(createPopup(church));
            
            markersRef.current.push({ church, marker });
        });
    }, [churches, filters]);

    /**
     * Handle filter value changes
     * @param {Object} newFilters - Object containing filter key-value pairs to update
     */
    const handleFilterChange = (newFilters) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    };

    /**
     * Reset all filters to default values
     */
    const handleResetFilters = () => {
        setFilters({
            filterType: 'masses',
            filterDay: 'all',
            filterAfterTime: '0000',
            filterBeforeTime: '9999'
        });
    };

    // Expose method to open specific marker (called from ListTab)
    useEffect(() => {
        if (onMarkerClick) {
            onMarkerClick.current = (churchName) => {
                const markerData = markersRef.current.find(m => m.church.name === churchName);
                if (markerData) {
                    markerData.marker.openPopup();
                }
            };
        }
    }, [onMarkerClick]);

    return html`
        <div role="region" aria-label="Map view">
            <button 
                class="btn btn-primary mb-3" 
                type="button"
                onClick=${() => setFiltersOpen(true)}
                aria-label="Open filter panel"
                aria-expanded=${filtersOpen}
                aria-controls="filters-panel">
                Filters
            </button>
            <div id="map" 
                 ref=${mapRef}
                 role="application"
                 aria-label="Interactive map of Catholic churches in Windsor-Essex County"></div>
            <${FiltersOffcanvas}
                isOpen=${filtersOpen}
                onClose=${() => setFiltersOpen(false)}
                filterType=${filters.filterType}
                filterDay=${filters.filterDay}
                filterAfterTime=${filters.filterAfterTime}
                filterBeforeTime=${filters.filterBeforeTime}
                onFilterChange=${handleFilterChange}
                onReset=${handleResetFilters}
            />
        </div>
    `;
}
