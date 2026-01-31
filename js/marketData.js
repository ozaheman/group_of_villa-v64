
/**
 * Handles market data search operations
 */

import { DUBAI_LOCATIONS, DUBAI_LAND_RATES } from './dubaiConfig.js';

export function initMarketSearch() {
    const searchBtn = document.getElementById('search-prices-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchLandPrices);
    }

    // Populate Datalist
    const dataList = document.getElementById('dubai-locations-list');
    if (dataList) {
        DUBAI_LOCATIONS.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.name;
            // storing id in dataset if needed, but option value is what shows
            option.dataset.id = loc.id;
            dataList.appendChild(option);
        });
    }

    // Auto-update price on selection
    const searchInput = document.getElementById('search-area');
    if (searchInput) {
        searchInput.addEventListener('change', () => { // 'change' fires on selection or enter
            const val = searchInput.value;
            const location = DUBAI_LOCATIONS.find(l => l.name === val);
            if (location) {
                // Find rate
                let rate = DUBAI_LAND_RATES[location.id];
                if (!rate) {
                    // Try to match partial keys or default
                    // e.g. 'al_barsha_1' -> check 'al_barsha'
                    const baseKey = location.id.split('_').slice(0, 2).join('_'); // approximation
                    rate = DUBAI_LAND_RATES[baseKey] || DUBAI_LAND_RATES['default'];
                }

                if (rate) {
                    const priceInput = document.getElementById('price-per-sqft');
                    if (priceInput) {
                        priceInput.value = rate;
                        // flash effect to show update?
                        priceInput.style.backgroundColor = '#e8f5e9';
                        setTimeout(() => priceInput.style.backgroundColor = '', 500);
                    }
                }
            }
        });
    }
}

function searchLandPrices() {
    const area = document.getElementById('search-area').value;
    if (!area) {
        alert("Please enter a search area.");
        return;
    }

    // Construct search queries for major UAE portals
    const query = encodeURIComponent(`land prices per sqft in ${area} UAE buy`);
    const bayutUrl = `https://www.google.com/search?q=site:bayut.com+${query}`;

    // Confirm with user
    if (confirm(`Open detailed search for "${area}" land prices? (Offline rate: ${getPriceForArea(area)} AED/sqft)`)) {
        window.open(bayutUrl, '_blank');
    }
}

function getPriceForArea(areaName) {
    const loc = DUBAI_LOCATIONS.find(l => l.name === areaName);
    if (loc && DUBAI_LAND_RATES[loc.id]) return DUBAI_LAND_RATES[loc.id];
    return DUBAI_LAND_RATES['default'];
}

export function getPricePerSqFt() {
    const input = document.getElementById('price-per-sqft');
    return input ? parseFloat(input.value) || 0 : 0;
}
