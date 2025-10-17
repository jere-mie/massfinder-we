import { html } from '../standalone-preact.esm.js';
import { useState } from '../standalone-preact.esm.js';
import { formatTime, DAYS_OF_WEEK } from '../utils.js';

/**
 * Data table component for displaying church schedules
 * @param {Object} props - Component props
 * @param {string} props.title - Table title
 * @param {Array<string>} props.headers - Array of column header labels
 * @param {Array<Object>} props.rows - Array of row data objects
 * @param {string} props.selectedDay - Currently selected day filter ('all' or day name)
 * @param {Function} props.onChurchClick - Callback when church name is clicked
 * @returns {import('../standalone-preact.esm.js').VNode|null} Table component or null if no rows
 */
function DataTable({ title, headers, rows, selectedDay, onChurchClick }) {
    const filteredRows = selectedDay === 'all' 
        ? rows 
        : rows.filter(row => row.day === selectedDay);

    if (filteredRows.length === 0) {
        return null;
    }

    return html`
        <div class="mb-4">
            <h2 class="text-center">${title}</h2>
            <div class="table-responsive">
                <table class="table">
                    <caption class="visually-hidden">${title} for Windsor-Essex County churches</caption>
                    <thead>
                        <tr>
                            ${headers.map(header => html`
                                <th key=${header} scope="col">${header}</th>
                            `)}
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredRows.map((row, idx) => html`
                            <tr key=${idx}>
                                <td class="text-wrap text-start">
                                    <button 
                                        class="btn btn-sm btn-link text-start p-0" 
                                        onClick=${() => onChurchClick(row.name)}
                                        aria-label="View ${row.name} on map">
                                        ${row.name}
                                    </button>
                                </td>
                                <td class="text-wrap">${row.address}</td>
                                <td class="text-nowrap">${row.day}</td>
                                <td class="text-nowrap">${row.time}</td>
                                <td class="text-wrap">${row.note || ''}</td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * ListTab component displaying church schedules in tabular format
 * @param {Object} props - Component props
 * @param {Array} props.churches - Array of church objects
 * @param {Function} props.onChurchClick - Callback when church name is clicked
 * @returns {import('../standalone-preact.esm.js').VNode} List tab component
 */
export function ListTab({ churches, onChurchClick }) {
    const [selectedDay, setSelectedDay] = useState('all');
    const [selectedSection, setSelectedSection] = useState('all');

    // Prepare data for tables
    const massesList = churches.flatMap(church => 
        church.masses.map(mass => ({
            name: church.name,
            address: church.address,
            day: mass.day,
            time: formatTime(mass.time),
            rawTime: mass.time,
            note: mass.note
        }))
    );

    const dailyList = churches.flatMap(church => 
        church.daily_masses.map(mass => ({
            name: church.name,
            address: church.address,
            day: mass.day,
            time: formatTime(mass.time),
            rawTime: mass.time,
            note: mass.note
        }))
    );

    const confessionList = churches.flatMap(church => 
        church.confession.map(confession => ({
            name: church.name,
            address: church.address,
            day: confession.day,
            time: `${formatTime(confession.start)} - ${formatTime(confession.end)}`,
            start: confession.start,
            note: confession.note
        }))
    );

    const adorationList = churches.flatMap(church => 
        church.adoration.map(adoration => ({
            name: church.name,
            address: church.address,
            day: adoration.day,
            time: `${formatTime(adoration.start)} - ${formatTime(adoration.end)}`,
            start: adoration.start,
            note: adoration.note
        }))
    );

    // Sort all lists (need to sort before formatting for display)
    const orderOfDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    massesList.sort((a, b) => {
        const dayComp = orderOfDays.indexOf(a.day) - orderOfDays.indexOf(b.day);
        return dayComp !== 0 ? dayComp : a.rawTime.localeCompare(b.rawTime);
    });
    
    dailyList.sort((a, b) => {
        const dayComp = orderOfDays.indexOf(a.day) - orderOfDays.indexOf(b.day);
        return dayComp !== 0 ? dayComp : a.rawTime.localeCompare(b.rawTime);
    });
    
    confessionList.sort((a, b) => {
        const dayComp = orderOfDays.indexOf(a.day) - orderOfDays.indexOf(b.day);
        return dayComp !== 0 ? dayComp : a.start.localeCompare(b.start);
    });
    
    adorationList.sort((a, b) => {
        const dayComp = orderOfDays.indexOf(a.day) - orderOfDays.indexOf(b.day);
        return dayComp !== 0 ? dayComp : a.start.localeCompare(b.start);
    });

    const headers = ['Church', 'Address', 'Day', 'Time', 'Notes'];

    /**
     * Determine if a section should be displayed based on selected filter
     * @param {string} sectionValue - Section value to check ('mass-times', 'daily-masses', etc.)
     * @returns {boolean} True if section should be shown
     */
    const shouldShowSection = (sectionValue) => {
        return selectedSection === 'all' || selectedSection === sectionValue;
    };

    return html`
        <div class="container" role="region" aria-label="List view">
            <!-- Filter Section -->
            <div class="card mb-4 shadow-sm">
                <div class="card-body">
                    <h5 class="card-title mb-3">Filter Schedules</h5>
                    <div class="row g-3" role="group" aria-label="List filters">
                        <div class="col-md-6">
                            <label for="day-filter" class="form-label fw-semibold">Day of Week</label>
                            <select 
                                id="day-filter"
                                class="form-select"
                                value=${selectedDay}
                                onChange=${(e) => setSelectedDay(e.target.value)}
                                aria-label="Filter schedules by day of week">
                                <option value="all">All Days</option>
                                ${DAYS_OF_WEEK.map(day => html`
                                    <option key=${day} value=${day}>${day}</option>
                                `)}
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label for="section-filter" class="form-label fw-semibold">Section</label>
                            <select 
                                id="section-filter"
                                class="form-select"
                                value=${selectedSection}
                                onChange=${(e) => setSelectedSection(e.target.value)}
                                aria-label="Filter by schedule section">
                                <option value="all">All Sections</option>
                                <option value="mass-times">Mass Times</option>
                                <option value="daily-masses">Daily Masses</option>
                                <option value="confession-times">Confession Times</option>
                                <option value="adoration-times">Adoration Times</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            
            ${shouldShowSection('mass-times') && html`
                <${DataTable}
                    title="Mass Times"
                    headers=${headers}
                    rows=${massesList}
                    selectedDay=${selectedDay}
                    onChurchClick=${onChurchClick}
                />
            `}
            
            ${shouldShowSection('daily-masses') && html`
                <${DataTable}
                    title="Daily Masses"
                    headers=${headers}
                    rows=${dailyList}
                    selectedDay=${selectedDay}
                    onChurchClick=${onChurchClick}
                />
            `}
            
            ${shouldShowSection('confession-times') && html`
                <${DataTable}
                    title="Confession Times"
                    headers=${headers}
                    rows=${confessionList}
                    selectedDay=${selectedDay}
                    onChurchClick=${onChurchClick}
                />
            `}
            
            ${shouldShowSection('adoration-times') && html`
                <${DataTable}
                    title="Adoration Times"
                    headers=${headers}
                    rows=${adorationList}
                    selectedDay=${selectedDay}
                    onChurchClick=${onChurchClick}
                />
            `}
        </div>
    `;
}
