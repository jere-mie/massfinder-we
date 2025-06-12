import Alpine from './deps/alpine/alpine.esm.min.js';
import * as L from './deps/leaflet/leaflet-src.esm.js';
import { createPopup } from './popups.js';
import './components/offcanvas.js';
import './components/listsection.js';


window.Alpine = Alpine;
window.markers = [];
window.map = null;

Alpine.start();

Alpine.store('app', {
    allChurches: [],
    filterType: 'masses',
    filterDay: 'all',
    filterBeforeTime: '9999',
    filterAfterTime: '0000',
    tab: 'map',

    get filteredChurches() {
        const { filterType, filterDay, filterBeforeTime, filterAfterTime, allChurches } = this;
        return filterChurches({
            filterType,
            filterDay,
            filterBeforeTime,
            filterAfterTime,
            allChurches
        });
    },

    setDefaults() {
        this.filterType = 'masses';
        this.filterDay = 'all';
        this.filterBeforeTime = '9999';
        this.filterAfterTime = '0000';
    },

    getPopup(church) {
        return createPopup(church);
    },
});

// runs whenever "app.filteredChurches" changes
Alpine.effect(() => {
    updateMarkers();
});

async function main() {
    const response = await fetch("/static/churches.json");
    const churches = await response.json();
    Alpine.store('app').allChurches = churches;

    const map = L.map('map', {
        zoomControl: false // disable default zoom control
    }).setView([42.16132298808876, -82.92932437200604], 11);
    window.map = map;

    // Add OpenStreetMap tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        minZoom: 9,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Add zoom control
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    updateMarkers();
}

function updateMarkers() {
    const map = window.map;
    const markers = window.markers;
    if (map) {
        for (let i = 0; i < markers.length; i++) {
            map.removeLayer(markers[i].marker);
        }
        markers.length = 0; // clear the markers array
    }
    const filteredChurches = Alpine.store('app').filteredChurches;
    for (let i = 0; i < filteredChurches.length; i++) {
        const church = filteredChurches[i];
        let marker = L.marker(church.coordinates).addTo(map).bindPopup(createPopup(church));
        markers.push({church: church, marker: marker});
    }
    window.markers = markers; // update global markers array
}

function filterChurches({ filterType, filterDay, filterBeforeTime, filterAfterTime, allChurches }) {
    return allChurches.filter(church => {
        let events;
        if (filterType === "masses") {
            events = (church.masses || []).concat(church.daily_masses || []);
            } else {
                events = church[filterType] || [];
            }

            return events.some(event => {
                const dayMatch = filterDay === "all" || event.day === filterDay;
                if (!dayMatch) return false;

                if (filterType === "masses") {
                    return event.time >= filterAfterTime && event.time <= filterBeforeTime;
                } else {
                    return (
                        (event.start >= filterAfterTime && event.start <= filterBeforeTime) ||
                        (event.end >= filterAfterTime && event.end <= filterBeforeTime)
                    );
                }
            });
        });
}

main();