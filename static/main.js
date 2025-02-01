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
 * @param {Church} church 
 * @returns {string}
 */
function addConfessions(church) {
    return !church.confession ? '' :
        `<h2>Confession Times</h2>
                <ul>
                ${church.confession.map(c => `<li>
                    ${c.day} - ${c.start} - ${c.end}
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
    return !church.adoration ? '' :
        `<h2>Adoration Times</h2>
        <ul>
            ${church.adoration.map(a => `<li>
                ${a.day} - ${a.start} - ${a.end}
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
    return !church.masses ? '' :
        `<h2>Masses</h2>
        <ul>
            ${church.masses.map(m => `<li>
                ${m.day} - ${m.time}
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
    return !church.daily_masses ? '' :
        `<h2>Daily Masses</h2>
        <ul>
            ${church.daily_masses.map(m => `<li>
                ${m.day} - ${m.time}
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
for (var i = 0; i < churches.length; i++) {
    /** @type {Church} */
    const church = churches[i];
    L.marker(church.coordinates).addTo(map).bindPopup(createPopup(church));
}
