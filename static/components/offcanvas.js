class AppOffcanvas extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = /* html */`
            <div class="offcanvas offcanvas-start" tabindex="-1" id="filtersOffcanvas" aria-labelledby="offcanvasExampleLabel">
                <div class="offcanvas-header">
                    <h5 class="offcanvas-title" id="offcanvasExampleLabel">Filters</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                </div>
                <div class="offcanvas-body">
                    <div class="mb-3">
                        <label for="filter-type" class="form-label">Filter Type</label>
                        <select x-model="$store.app.filterType" class="mapfilter form-select form-select-sm" id="filter-type" aria-label="Filter Type">
                            <option selected value="masses">Masses</option>
                            <option value="confession">Confession Times</option>
                            <option value="adoration">Adoration Times</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="filter-day" class="form-label">Filter Day</label>
                        <select x-model="$store.app.filterDay" class="mapfilter form-select form-select-sm" id="filter-day" aria-label="Filter Day">
                            <option selected value="all">Show All Days</option>
                            <option value="Sunday">Sunday</option>
                            <option value="Monday">Monday</option>
                            <option value="Tuesday">Tuesday</option>
                            <option value="Wednesday">Wednesday</option>
                            <option value="Thursday">Thursday</option>
                            <option value="Friday">Friday</option>
                            <option value="Saturday">Saturday</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="filter-after-time" class="form-label">Between</label>
                        <select x-model="$store.app.filterAfterTime" class="mapfilter form-select form-select-sm" id="filter-after-time" aria-label="Filter After">
                            <option selected value="0000">Start of Day</option>
                            <option value="0000">12am</option>
                            <option value="0100">1am</option>
                            <option value="0200">2am</option>
                            <option value="0300">3am</option>
                            <option value="0400">4am</option>
                            <option value="0500">5am</option>
                            <option value="0600">6am</option>
                            <option value="0700">7am</option>
                            <option value="0800">8am</option>
                            <option value="0900">9am</option>
                            <option value="1000">10am</option>
                            <option value="1100">11am</option>
                            <option value="1200">12pm</option>
                            <option value="1300">1pm</option>
                            <option value="1400">2pm</option>
                            <option value="1500">3pm</option>
                            <option value="1600">4pm</option>
                            <option value="1700">5pm</option>
                            <option value="1800">6pm</option>
                            <option value="1900">7pm</option>
                            <option value="2000">8pm</option>
                            <option value="2100">9pm</option>
                            <option value="2200">10pm</option>
                            <option value="2300">11pm</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="filter-before-time" class="form-label">And</label>
                        <select x-model="$store.app.filterBeforeTime" class="mapfilter form-select form-select-sm" id="filter-before-time" aria-label="Filter Before">
                            <option selected value="9999">End of Day</option>
                            <option value="0000">12am</option>
                            <option value="0100">1am</option>
                            <option value="0200">2am</option>
                            <option value="0300">3am</option>
                            <option value="0400">4am</option>
                            <option value="0500">5am</option>
                            <option value="0600">6am</option>
                            <option value="0700">7am</option>
                            <option value="0800">8am</option>
                            <option value="0900">9am</option>
                            <option value="1000">10am</option>
                            <option value="1100">11am</option>
                            <option value="1200">12pm</option>
                            <option value="1300">1pm</option>
                            <option value="1400">2pm</option>
                            <option value="1500">3pm</option>
                            <option value="1600">4pm</option>
                            <option value="1700">5pm</option>
                            <option value="1800">6pm</option>
                            <option value="1900">7pm</option>
                            <option value="2000">8pm</option>
                            <option value="2100">9pm</option>
                            <option value="2200">10pm</option>
                            <option value="2300">11pm</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <div class="d-flex gap-2 justify-content-end">
                            <button @click="$store.app.setDefaults()" type="button" class="btn btn-primary" id="reset-filters-btn">Reset Filters</button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="offcanvas" aria-label="Close">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('app-offcanvas', AppOffcanvas);
