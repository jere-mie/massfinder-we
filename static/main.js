/**
 * @typedef {Object} Mass
 * @property {string} day - The day of the Mass.
 * @property {string} time - The time of the Mass.
 * @property {string | undefined} [note] - An optional note about the Mass.
 */

/**
 * @typedef {Object} Confession
 * @property {string} day - The day of confession.
 * @property {string} start - The starting time of confession.
 * @property {string} end - The ending time of confession.
 * @property {string | undefined} [note] - An optional note about the confession.
 */

/**
 * @typedef {Object} Adoration
 * @property {string} day - The day of adoration.
 * @property {string} start - The starting time of adoration.
 * @property {string} end - The ending time of adoration.
 * @property {string | undefined} [note] - An optional note about the adoration.
 */

/**
 * @typedef {Object} Church
 * @property {string} name - The name of the church.
 * @property {string} address - The address of the church.
 * @property {Array<number>} coordinates - An array representing the coordinates [latitude, longitude].
 * @property {string} website - The website of the church.
 * @property {string} phone - The phone number of the church.
 * @property {Array<Mass>} masses - An array of Mass objects.
 * @property {Array<Confession>} confession - An array of Confession objects.
 * @property {Array<Adoration>} adoration - An array of Adoration objects.
 */

import { churches } from './churches.js';
import * as L from './leaflet/leaflet-src.esm.js';

export const map = L.map('map', {
    zoomControl: false // disable default zoom control
}).setView([42.16132298808876, -82.92932437200604], 11);

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

var markers = []; // Contains all the markers in the map.

/**
 * 
 * @param {string} phoneNumber 
 * @returns {string}
 */
function formatPhoneNumber(phoneNumber) {
    return phoneNumber.replace(/\D/g, '').replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '($2) $3-$4');
}

/**
 * 
 * @param {string} url 
 * @returns {string}
 */
function formatUrl(url) {
    return url.replace(/^(https?:\/\/)?/i, '').replace(/\/$/, '');
}

/**
 * 
 * @param {string} time 
 * @returns {string}
 */
function formatTime(time) {
    const hours = time.slice(0, 2);
    const minutes = time.slice(2);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes} ${ampm}`;
}

/**
 * 
 * @returns {string}
 */
function getCurrentDay() {
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return daysOfWeek[new Date().getDay()];
}

/**
 * 
 * @param {Church} church 
 * @returns {string}
 */
function addConfessions(church) {
    return church.confession.length == 0 ? '' :
        `<h2>Confession Times</h2>
                <ul>
                ${church.confession.map(c => `<li>
                    ${c.day} - ${formatTime(c.start)} - ${formatTime(c.end)}
                    ${c.note ? `<ul class="sublist"><li>${c.note}</li></ul>` : ''}
                </li>`).join('')}
            </ul>`;
}

/**
 * 
 * @param {Church} church 
 * @returns {string}
 */
function addAdorations(church) {
    return church.adoration.length == 0 ? '' :
        `<h2>Adoration Times</h2>
        <ul>
            ${church.adoration.map(a => `<li>
                ${a.day} - ${formatTime(a.start)} - ${formatTime(a.end)}
                ${a.note ? `<ul class="sublist"><li>${a.note}</li></ul>` : ''}
            </li>`).join('')}
        </ul>`;
}

/**
 * 
 * @param {Church} church 
 * @returns {string}
 */
function addMasses(church) {
    return church.masses.length == 0 ? '' :
        `<h2>Masses</h2>
        <ul>
            ${church.masses.map(m => `<li>
                ${m.day} - ${formatTime(m.time)}
                ${m.note ? `<ul class="sublist"><li>${m.note}</li></ul>` : ''}
            </li>`).join('')}
        </ul>`;
}

/**
 * 
 * @param {Church} church 
 * @returns {string}
 */
function addDailyMasses(church) {
    return church.daily_masses.length == 0 ? '' :
        `<h2>Daily Masses</h2>
        <ul>
            ${church.daily_masses.map(m => `<li>
                ${m.day} - ${formatTime(m.time)}
                ${m.note ? `<ul class="sublist"><li>${m.note}</li></ul>` : ''}
            </li>`).join('')}
        </ul>`;
}

/**
 * 
 * @param {Church} church 
 * @returns {string}
 */
function createPopup(church) {
    return `
    <div class="churchPopup">            
        <h1>${church.name}</h1>
        <p><i class="fas fa-map-marker-alt"></i> ${church.address}</p>
        <p><i class="fas fa-phone"></i> ${formatPhoneNumber(church.phone)}</p>
        <p><i class="fas fa-globe"></i> <a href="${church.website}" target="_blank">${formatUrl(church.website)}</a></p>
        ${addMasses(church)}
        ${addDailyMasses(church)}
        ${addConfessions(church)}
        ${addAdorations(church)}
    </div>
    `
}

// adding the markers
document.addEventListener("DOMContentLoaded", () => {
    addMarkers(churches);
});

function addMarkers(churches) {
    for (let i = 0; i < churches.length; i++) {
        /** @type {Church} */
        const church = churches[i];
        let marker = L.marker(church.coordinates).addTo(map).bindPopup(createPopup(church));
        markers.push({church: church, marker: marker});
    }
}

function clearMarkers() {
    for (let i = 0; i < markers.length; i++) {
        map.removeLayer(markers[i].marker);
    }
    markers = [];
}

function updateFilters() {
    let filteredChurches = churches;
    const filterType = document.getElementById("filter-type").value;
    const filterDay = document.getElementById("filter-day").value;
    const filterBeforeTime = document.getElementById("filter-before-time").value;
    const filterAfterTime = document.getElementById("filter-after-time").value;

    if (filterType == "masses") {
        if (filterDay == "all") {
            filteredChurches = filteredChurches.filter(church => {
                const masses = church.masses.concat(church.daily_masses);
                return masses.filter(mass => {
                    return mass.time >= filterAfterTime && mass.time <= filterBeforeTime;
                }).length > 0;
            });
        } else {
            filteredChurches = filteredChurches.filter(church => {
                const masses = church.masses.concat(church.daily_masses);
                return masses.filter(mass => {
                    return mass.day == filterDay && mass.time >= filterAfterTime && mass.time <= filterBeforeTime;
                }).length > 0;
            });
        }
    } else {
        // 'adoration' or 'confession'
        if (filterDay == "all") {
            filteredChurches = filteredChurches.filter(church => {
                return church[filterType].filter(a => {
                    return (a.start >= filterAfterTime && a.start <= filterBeforeTime) || (a.end >= filterAfterTime && a.end <= filterBeforeTime);
                }).length > 0;
            });
        } else {
            filteredChurches = filteredChurches.filter(church => {
                return church[filterType].filter(a => {
                    return a.day == filterDay && ((a.start >= filterAfterTime && a.start <= filterBeforeTime) || (a.end >= filterAfterTime && a.end <= filterBeforeTime));
                }).length > 0;
            });
        }
    }
    clearMarkers();
    addMarkers(filteredChurches);
}

function resetFilters() {
    document.querySelectorAll(".mapfilter").forEach(item => {
        item.selectedIndex = 0;
    });
    updateFilters();
}

// Grid
function sortMasses(masses) {
    const orderOfDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    masses.sort((a, b) => {
        const dayComparison = orderOfDays.indexOf(a.day) - orderOfDays.indexOf(b.day);
        return dayComparison !== 0 ? dayComparison : a.time.localeCompare(b.time);
    });
}

function sortTimeRange(elms) {
    const orderOfDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    elms.sort((a, b) => {
        const dayComparison = orderOfDays.indexOf(a.day) - orderOfDays.indexOf(b.day);
        return dayComparison !== 0 ? dayComparison : a.start.localeCompare(b.start);
    });
}

function massesToHTML(masses) {
    let newHTML = "";
    masses.forEach(mass => {
        newHTML += `
        <tr class="list-entry ${mass.day}">
            <td class="text-wrap"><span class="church-name btn btn-sm btn-link">${mass.name}</span></td>
            <td class="text-wrap">${mass.address}</td>
            <td class="text-nowrap">${mass.day}</td>
            <td class="text-nowrap">${formatTime(mass.time)}</td>
            <td class="text-wrap">${mass.note ? mass.note : ''}</td>
        </tr>
        `
    });
    return newHTML;
}

function timeRangeToHTML(elms) {
    let newHTML = "";
    elms.forEach(elm => {
        newHTML += `
        <tr class="list-entry ${elm.day}">
            <td class="text-wrap church-name">${elm.name}</td>
            <td class="text-wrap">${elm.address}</td>
            <td class="text-nowrap">${elm.day}</td>
            <td class="text-nowrap">${formatTime(elm.start)} - ${formatTime(elm.end)}</td>
            <td class="text-wrap">${elm.note ? elm.note : ''}</td>
        </tr>
        `
    });
    return newHTML;
}

// Add elements to the list.
document.addEventListener("DOMContentLoaded", () => {
    let elm = document.getElementById("list");
    
    const massesList = churches.flatMap(church => 
        church.masses.map(mass => ({
            ...mass,
            name: church.name,
            address: church.address
        }))
    );

    const dailyList = churches.flatMap(church => 
        church.daily_masses.map(mass => ({
            ...mass,
            name: church.name,
            address: church.address
        }))
    );

    const confessionList = churches.flatMap(church => 
        church.confession.map(confession => ({
            ...confession,
            name: church.name,
            address: church.address
        }))
    );

    const adorationList = churches.flatMap(church => 
        church.adoration.map(adoration => ({
            ...adoration,
            name: church.name,
            address: church.address
        }))
    );
    
    // Sort by "time" in ascending order
    sortMasses(massesList);
    sortMasses(dailyList);
    sortTimeRange(confessionList);
    sortTimeRange(adorationList);

    document.getElementById('masses-body').innerHTML = massesToHTML(massesList);
    document.getElementById('daily-body').innerHTML = massesToHTML(dailyList);
    document.getElementById('confession-body').innerHTML = timeRangeToHTML(confessionList);
    document.getElementById('adoration-body').innerHTML = timeRangeToHTML(adorationList);
});

// Add various event listeners to the buttons to toggle the map and list.
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('to-map').addEventListener('click', toMap);
    document.getElementById('to-map').addEventListener('touchstart', toMap, { passive: true });
    document.getElementById('to-list').addEventListener('click', toList);
    document.getElementById('to-list').addEventListener('touchstart', toList, { passive: true });

    document.querySelectorAll("#day-dropdown > ul .dropdown-item").forEach(item => {
        item.addEventListener("click", selectDay);
    });

    document.querySelectorAll("#section-dropdown > ul .dropdown-item").forEach(item => {
        item.addEventListener("click", selectSection);
    });

    document.querySelectorAll(".church-name").forEach(item => {
        item.addEventListener("click", selectChurch);
    });

    document.querySelectorAll(".mapfilter").forEach(item => {
        item.addEventListener("change", updateFilters);
    });
});


function toMap(e) {
    document.getElementById('maptab').classList.remove('d-none');
    document.getElementById('list').classList.add('d-none');
    document.getElementById('to-map').classList.add('active');
    document.getElementById('to-list').classList.remove('active');
}

function toList(e) {
    document.getElementById('list').classList.remove('d-none');
    document.getElementById('maptab').classList.add('d-none');
    document.getElementById('to-list').classList.add('active');
    document.getElementById('to-map').classList.remove('active');
    // reset markers
    resetFilters();
    clearMarkers();
    addMarkers(churches);
}

function selectDay(e) {
    e.preventDefault();

    const day = this.getAttribute("data-value");
    document.getElementById("select-day").textContent = day;

    const rows = document.querySelectorAll(".list-entry");
    if (day === "Show All Days") {
        rows.forEach(row => row.classList.remove("d-none"));
    } else {
        rows.forEach(row => row.classList.add("d-none"));
        document.querySelectorAll(`.list-entry.${day}`).forEach(row => row.classList.remove("d-none"));
    }
}

function selectSection(e) {
    e.preventDefault();

    const section = this.getAttribute("data-value");
    document.getElementById("select-section").textContent = this.textContent;

    const tables = document.querySelectorAll(".section-table");
    if (section === "show-all-sections") {
        tables.forEach(table => table.classList.remove("d-none"));
    } else {
        tables.forEach(table => table.classList.add("d-none"));
        document.querySelectorAll(`.section-table.${section}`).forEach(table => table.classList.remove("d-none"));
    }
}

function selectChurch(e) {
    const name = this.textContent.trim();
    const marker = markers.find(m => m.church.name === name);
    if (!marker) return;

    toMap(e);
    marker.marker.openPopup();
}