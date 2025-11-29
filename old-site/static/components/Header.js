import { html } from '../standalone-preact.esm.js';

/**
 * Header component displaying the site title and navigation tabs
 * @param {Object} props - Component props
 * @param {string} props.activeTab - Currently active tab ('map' or 'list')
 * @param {Function} props.onTabChange - Callback function when tab is changed
 * @returns {import('../standalone-preact.esm.js').VNode} Header component
 */
export function Header({ activeTab, onTabChange }) {
    return html`
        <div class="container text-center my-3">
            <h1>Windsor-Essex County Catholic Mass List</h1>
            <ul class="nav nav-tabs" role="tablist" aria-label="Main navigation">
                <li class="nav-item" role="presentation">
                    <button 
                        class="nav-link ${activeTab === 'map' ? 'active' : ''}" 
                        onClick=${() => onTabChange('map')}
                        type="button"
                        role="tab"
                        aria-selected=${activeTab === 'map'}
                        aria-controls="map-panel"
                        aria-label="Switch to map view">
                        Map
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button 
                        class="nav-link ${activeTab === 'list' ? 'active' : ''}" 
                        onClick=${() => onTabChange('list')}
                        type="button"
                        role="tab"
                        aria-selected=${activeTab === 'list'}
                        aria-controls="list-panel"
                        aria-label="Switch to list view">
                        List
                    </button>
                </li>
            </ul>
        </div>
    `;
}
