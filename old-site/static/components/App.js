import { html } from '../standalone-preact.esm.js';
import { useState, useEffect, useRef } from '../standalone-preact.esm.js';
import { Header } from './Header.js';
import { MapTab } from './MapTab.js';
import { ListTab } from './ListTab.js';

/**
 * Root application component
 * Manages global state for churches data and active tab
 * @returns {import('../standalone-preact.esm.js').VNode} App component
 */
export function App() {
    const [churches, setChurches] = useState([]);
    const [activeTab, setActiveTab] = useState('map');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const markerClickRef = useRef(null);

    // Fetch church data on mount
    useEffect(() => {
        fetch('/static/churches.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                setChurches(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching Church data:', err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    /**
     * Handle church name click from list view
     * Switches to map tab and opens the church's marker popup
     * @param {string} churchName - Name of the church to display
     */
    const handleChurchClick = (churchName) => {
        setActiveTab('map');
        // Give the map time to render, then open the marker
        setTimeout(() => {
            if (markerClickRef.current) {
                markerClickRef.current(churchName);
            }
        }, 100);
    };

    if (loading) {
        return html`
            <div class="container text-center my-5">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3" aria-live="polite">Loading church data...</p>
            </div>
        `;
    }

    if (error) {
        return html`
            <div class="container text-center my-5">
                <div class="alert alert-danger" role="alert" aria-live="assertive">
                    <h2>Error Loading Data</h2>
                    <p>Error loading church data: ${error}</p>
                </div>
            </div>
        `;
    }

    return html`
        <div>
            <${Header} 
                activeTab=${activeTab} 
                onTabChange=${setActiveTab} 
            />
            <main class="tab-content container">
                <div 
                    id="map-panel"
                    class="${activeTab === 'map' ? '' : 'd-none'}"
                    role="tabpanel"
                    aria-labelledby="map-tab"
                    aria-hidden=${activeTab !== 'map'}>
                    <${MapTab} 
                        churches=${churches}
                        onMarkerClick=${markerClickRef}
                    />
                </div>
                <div 
                    id="list-panel"
                    class="${activeTab === 'list' ? '' : 'd-none'}"
                    role="tabpanel"
                    aria-labelledby="list-tab"
                    aria-hidden=${activeTab !== 'list'}>
                    <${ListTab} 
                        churches=${churches}
                        onChurchClick=${handleChurchClick}
                    />
                </div>
            </main>
        </div>
    `;
}
