/**
 * Main entry point for the WE Catholic Mass List application
 * Using HTM+Preact for component-based architecture
 * 
 * This module bootstraps the Preact application and renders it to the DOM.
 * The app displays Catholic church information and mass times for the Windsor-Essex area.
 * 
 * @module main
 */

import { render, html } from './standalone-preact.esm.js';
import { App } from './components/App.js';

// Render the app to the #app container
render(html`<${App} />`, document.getElementById('app'));