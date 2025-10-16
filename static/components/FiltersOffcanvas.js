import { html } from '../standalone-preact.esm.js';
import { DAYS_OF_WEEK, TIME_OPTIONS } from '../utils.js';

/**
 * Offcanvas filter panel component for map view
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the offcanvas is open
 * @param {Function} props.onClose - Callback to close the offcanvas
 * @param {string} props.filterType - Current filter type ('masses', 'confession', 'adoration')
 * @param {string} props.filterDay - Current day filter
 * @param {string} props.filterAfterTime - Start time filter (24hr format)
 * @param {string} props.filterBeforeTime - End time filter (24hr format)
 * @param {Function} props.onFilterChange - Callback when filter values change
 * @param {Function} props.onReset - Callback to reset all filters
 * @returns {import('../standalone-preact.esm.js').VNode} Offcanvas filter panel
 */
export function FiltersOffcanvas({ isOpen, onClose, filterType, filterDay, filterAfterTime, filterBeforeTime, onFilterChange, onReset }) {
    /**
     * Handle individual filter field changes
     * @param {string} key - Filter key to update
     * @param {string} value - New value for the filter
     */
    const handleFilterChange = (key, value) => {
        onFilterChange({ [key]: value });
    };

    return html`
        <div class="offcanvas offcanvas-start ${isOpen ? 'show' : ''}" 
             tabindex="-1" 
             role="dialog"
             aria-labelledby="filters-title"
             aria-modal="true"
             style="visibility: ${isOpen ? 'visible' : 'hidden'}; max-width: 320px;">
            <div class="offcanvas-header border-bottom">
                <h5 class="offcanvas-title fw-bold" id="filters-title">Filter Churches</h5>
                <button type="button" 
                        class="btn-close" 
                        onClick=${onClose} 
                        aria-label="Close filter panel"></button>
            </div>
            <div class="offcanvas-body">
                <div class="mb-3">
                    <label for="filter-type" class="form-label fw-semibold">Event Type</label>
                    <select class="form-select" 
                            id="filter-type" 
                            value=${filterType}
                            onChange=${(e) => handleFilterChange('filterType', e.target.value)}
                            aria-label="Select type of event to filter by">
                        <option value="masses">Masses</option>
                        <option value="confession">Confession Times</option>
                        <option value="adoration">Adoration Times</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label for="filter-day" class="form-label fw-semibold">Day of Week</label>
                    <select class="form-select" 
                            id="filter-day" 
                            value=${filterDay}
                            onChange=${(e) => handleFilterChange('filterDay', e.target.value)}
                            aria-label="Select day of week to filter by">
                        <option value="all">All Days</option>
                        ${DAYS_OF_WEEK.map(day => html`
                            <option key=${day} value=${day}>${day}</option>
                        `)}
                    </select>
                </div>
                <div class="mb-3">
                    <label for="filter-after-time" class="form-label fw-semibold">Start Time</label>
                    <select class="form-select" 
                            id="filter-after-time" 
                            value=${filterAfterTime}
                            onChange=${(e) => handleFilterChange('filterAfterTime', e.target.value)}
                            aria-label="Select start time for time range filter">
                        <option value="0000">Start of Day</option>
                        ${TIME_OPTIONS.map(opt => html`
                            <option key=${opt.value} value=${opt.value}>${opt.label}</option>
                        `)}
                    </select>
                </div>
                <div class="mb-3">
                    <label for="filter-before-time" class="form-label fw-semibold">End Time</label>
                    <select class="form-select" 
                            id="filter-before-time" 
                            value=${filterBeforeTime}
                            onChange=${(e) => handleFilterChange('filterBeforeTime', e.target.value)}
                            aria-label="Select end time for time range filter">
                        <option value="9999">End of Day</option>
                        ${TIME_OPTIONS.map(opt => html`
                            <option key=${opt.value} value=${opt.value}>${opt.label}</option>
                        `)}
                    </select>
                </div>
                <div class="d-grid gap-2">
                    <button type="button" 
                            class="btn btn-outline-secondary" 
                            onClick=${onReset}
                            aria-label="Reset all filters to default values">
                        Reset Filters
                    </button>
                    <button type="button" 
                            class="btn btn-primary" 
                            onClick=${onClose}
                            aria-label="Apply filters and close panel">
                        Apply & Close
                    </button>
                </div>
            </div>
        </div>
        ${isOpen && html`
            <div class="offcanvas-backdrop fade show" 
                 onClick=${onClose}
                 aria-hidden="true"></div>
        `}
    `;
}
