//--- START OF FILE js/prototype.js ---

import { App } from './appState.js';

// Prototype definitions with built-up area and plot specifications
export const PROTOTYPES = {
    villa: [
        {
            id: 'villa-1',
            name: 'Compact Villa',
            type: 'villa',
            plotSize: { min: 150, max: 200, typical: 175 },
            builtUpArea: { min: 100, max: 120, typical: 110 },
            floorArea: { min: 120, max: 160, typical: 140 },
            shape: 'Compact',
            units: 1,
            description: 'Single compact residential unit'
        },
        {
            id: 'villa-2',
            name: 'L-Shaped Villa',
            type: 'villa',
            plotSize: { min: 200, max: 300, typical: 250 },
            builtUpArea: { min: 140, max: 170, typical: 155 },
            floorArea: { min: 180, max: 240, typical: 210 },
            shape: 'L-Shape',
            units: 1,
            description: 'L-shaped residential unit with good aspect'
        },
        {
            id: 'villa-3',
            name: 'Courtyard Villa',
            type: 'villa',
            plotSize: { min: 250, max: 350, typical: 300 },
            builtUpArea: { min: 160, max: 200, typical: 180 },
            floorArea: { min: 200, max: 300, typical: 250 },
            shape: 'Courtyard',
            units: 1,
            description: 'Villa with central courtyard'
        },
        {
            id: 'villa-4',
            name: 'U-Shaped Villa',
            type: 'villa',
            plotSize: { min: 300, max: 450, typical: 375 },
            builtUpArea: { min: 200, max: 250, typical: 225 },
            floorArea: { min: 280, max: 400, typical: 340 },
            shape: 'U-Shape',
            units: 1,
            description: 'Luxury U-shaped villa with expansive courtyard'
        }
    ],
    townhouse: [
        {
            id: 'th-end',
            name: 'Townhouse End Unit',
            type: 'townhouse',
            plotSize: { min: 80, max: 120, typical: 100 },
            builtUpArea: { min: 60, max: 80, typical: 70 },
            floorArea: { min: 100, max: 140, typical: 120 },
            shape: 'Townhouse-End',
            units: 1,
            description: 'End unit townhouse with additional exposure'
        },
        {
            id: 'th-mid',
            name: 'Townhouse Mid Unit',
            type: 'townhouse',
            plotSize: { min: 70, max: 100, typical: 85 },
            builtUpArea: { min: 50, max: 70, typical: 60 },
            floorArea: { min: 80, max: 120, typical: 100 },
            shape: 'Townhouse-Mid',
            units: 1,
            description: 'Mid unit townhouse optimized for density'
        },
        {
            id: 'th-twin',
            name: 'Twin Townhouse',
            type: 'townhouse',
            plotSize: { min: 150, max: 200, typical: 175 },
            builtUpArea: { min: 110, max: 140, typical: 125 },
            floorArea: { min: 180, max: 240, typical: 210 },
            shape: 'Twin',
            units: 2,
            description: 'Twin townhouse units'
        }
    ],
    apartment: [
        {
            id: 'apt-1',
            name: 'Low-Rise Apartment',
            type: 'apartment',
            plotSize: { min: 500, max: 800, typical: 650 },
            builtUpArea: { min: 300, max: 500, typical: 400 },
            floorArea: { min: 1000, max: 2000, typical: 1500 },
            shape: 'Rectangular',
            units: 8,
            description: '4-6 storey apartment building'
        }
    ]
};

// Prototype Mix Configuration
export const PrototypeMix = {
    currentMix: {
        'villa-1': 20,
        'villa-2': 20,
        'villa-3': 20,
        'villa-4': 10,
        'th-end': 10,
        'th-mid': 10,
        'th-twin': 10,
        'apt-1': 0
    },
    manualOverride: false,
    overrideValues: {}
};

// Get all prototypes
export function getAllPrototypes() {
    return [...PROTOTYPES.villa, ...PROTOTYPES.townhouse, ...PROTOTYPES.apartment];
}

// Get prototypes by type
export function getPrototypesByType(type) {
    return PROTOTYPES[type] || [];
}

// Get prototype by ID
export function getPrototypeById(id) {
    return getAllPrototypes().find(p => p.id === id);
}

// Get prototype by shape key (used in standards)
export function getPrototypeByShape(shape) {
    return getAllPrototypes().find(p => p.shape === shape);
}

// Update prototype mix percentages with auto-scaling if it exceeds 100%
export function updatePrototypeMixPercentage(prototypeId, percentage) {
    if (PrototypeMix.currentMix.hasOwnProperty(prototypeId)) {
        PrototypeMix.currentMix[prototypeId] = Math.max(0, Math.min(100, percentage));

        // If total exceeds 100%, we could either cap it or scale others.
        // User said "individually divide percentage", let's just show remaining.
        // But to be helpful, let's implement a "Normalize" function if they want.

        updateMixUI();
    }
}

// Update prototype name
export function updatePrototypeName(prototypeId, newName) {
    const proto = getPrototypeById(prototypeId);
    if (proto) {
        proto.name = newName;
        updateMixUI();
    }
}

// Update prototype parameters (plotSize, builtUpArea)
export function updatePrototypeParams(prototypeId, paramKey, min, max) {
    const proto = getPrototypeById(prototypeId);
    if (proto && proto[paramKey]) {
        proto[paramKey].min = parseFloat(min) || 0;
        proto[paramKey].max = parseFloat(max) || 0;
        proto[paramKey].typical = (proto[paramKey].min + proto[paramKey].max) / 2;
        updateMixUI();
    }
}

/**
 * Adds a new prototype of a given type.
 */
export function addPrototype(type) {
    const category = PROTOTYPES[type];
    if (!category) return;

    const newId = `${type}-${Date.now()}`;
    const newProto = {
        id: newId,
        name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        type: type,
        plotSize: { min: 100, max: 200, typical: 150 },
        builtUpArea: { min: 60, max: 100, typical: 80 },
        floorArea: { min: 100, max: 150, typical: 125 },
        shape: type === 'villa' ? 'Compact' : 'Townhouse-Mid',
        units: 1,
        description: 'User defined prototype'
    };

    category.push(newProto);
    PrototypeMix.currentMix[newId] = 0;
    renderPrototypes();
    updateMixUI();
}

/**
 * Deletes a prototype by ID.
 */
export function deletePrototype(prototypeId) {
    for (const type in PROTOTYPES) {
        const index = PROTOTYPES[type].findIndex(p => p.id === prototypeId);
        if (index !== -1) {
            PROTOTYPES[type].splice(index, 1);
            delete PrototypeMix.currentMix[prototypeId];
            break;
        }
    }
    renderPrototypes();
    updateMixUI();
}

/**
 * Renders all prototypes into the UI containers.
 */
export function renderPrototypes() {
    const villaContainer = document.getElementById('villas-container');
    const thContainer = document.getElementById('townhouses-container');

    if (villaContainer) villaContainer.innerHTML = '';
    if (thContainer) thContainer.innerHTML = '';

    const renderItem = (p) => `
        <div class="prototype-item" data-proto="${p.id}">
            <div class="proto-label">
                <div style="display: flex; gap: 4px; align-items: center;">
                    <input type="text" class="editable-proto-name" data-id="${p.id}" value="${p.name}" ${!PrototypeMix.manualOverride ? 'disabled' : ''}>
                    <button class="delete-proto" data-id="${p.id}" title="Delete prototype" style="width: auto; padding: 0 4px; height: 16px; font-size: 10px; background: none; color: #dc3545; margin: 0; box-shadow: none;">×</button>
                </div>
                <div class="proto-specs">
                    Plot: <input type="number" class="proto-param-field" data-id="${p.id}" data-param="plotSize" data-type="min" value="${p.plotSize.min}" ${!PrototypeMix.manualOverride ? 'disabled' : ''}>-<input type="number" class="proto-param-field" data-id="${p.id}" data-param="plotSize" data-type="max" value="${p.plotSize.max}" ${!PrototypeMix.manualOverride ? 'disabled' : ''}>m²
                    BUA: <input type="number" class="proto-param-field" data-id="${p.id}" data-param="builtUpArea" data-type="min" value="${p.builtUpArea.min}" ${!PrototypeMix.manualOverride ? 'disabled' : ''}>-<input type="number" class="proto-param-field" data-id="${p.id}" data-param="builtUpArea" data-type="max" value="${p.builtUpArea.max}" ${!PrototypeMix.manualOverride ? 'disabled' : ''}>m²
                </div>
            </div>
            <input type="range" class="prototype-slider" data-id="${p.id}" min="0" max="100" value="${PrototypeMix.currentMix[p.id] || 0}" ${!PrototypeMix.manualOverride ? 'disabled' : ''}>
            <input type="number" class="proto-input" data-id="${p.id}" min="0" max="100" value="${PrototypeMix.currentMix[p.id] || 0}" ${!PrototypeMix.manualOverride ? 'disabled' : ''}>
            <span class="proto-unit">%</span>
        </div>
    `;

    PROTOTYPES.villa.forEach(p => villaContainer.insertAdjacentHTML('beforeend', renderItem(p)));
    PROTOTYPES.townhouse.forEach(p => thContainer.insertAdjacentHTML('beforeend', renderItem(p)));
}

/**
 * Returns a random prototype key (shape) based on the current mix distribution.
 */
export function getRandomPrototypeByMix() {
    const total = getTotalMixPercentage();
    if (total === 0) return 'Compact'; // Fallback

    let rand = Math.random() * total;
    const entries = Object.entries(PrototypeMix.currentMix);

    for (const [id, pct] of entries) {
        if (pct <= 0) continue;
        rand -= pct;
        if (rand <= 0) {
            const proto = getPrototypeById(id);
            return proto ? proto.shape : 'Compact';
        }
    }

    return 'Compact';
}

// Get total percentage
export function getTotalMixPercentage() {
    return Object.values(PrototypeMix.currentMix).reduce((a, b) => a + b, 0);
}

// Calculate remaining percentage
export function getRemainingPercentage() {
    return Math.max(0, 100 - getTotalMixPercentage());
}

// Update mix info display
export function updateMixUI() {
    const total = getTotalMixPercentage();
    const remaining = getRemainingPercentage();

    // Update labels and badges
    const mixInfo = document.getElementById('mix-info');
    if (mixInfo) {
        const values = Object.entries(PrototypeMix.currentMix)
            .filter(([, v]) => v > 0)
            .map(([id, v]) => `${getPrototypeById(id)?.name}: ${v}%`)
            .join(', ');

        mixInfo.textContent = values || 'No prototypes selected';
        mixInfo.style.color = Math.abs(total - 100) < 0.1 ? '#28a745' : total > 100 ? '#dc3545' : '#ff9800';
    }

    const remainingSpan = document.getElementById('remaining-percentage');
    if (remainingSpan) {
        remainingSpan.textContent = remaining.toFixed(1) + '%';
        remainingSpan.style.color = Math.abs(remaining) < 0.1 ? '#28a745' : remaining < 0 ? '#dc3545' : '#ff9800';
    }

    // Sync sliders and inputs in the DOM
    Object.entries(PrototypeMix.currentMix).forEach(([id, val]) => {
        const slider = document.querySelector(`.prototype-slider[data-id="${id}"]`);
        const input = document.querySelector(`.proto-input[data-id="${id}"]`);
        if (slider) slider.value = val;
        if (input) input.value = val;
    });
}

/**
 * Normalizes the current mix so it sums exactly to 100%.
 */
export function normalizeMix() {
    const total = getTotalMixPercentage();
    if (total === 0) {
        // If everything is zero, reset to a default distribution
        const keys = Object.keys(PrototypeMix.currentMix);
        const share = Math.floor(100 / keys.length);
        keys.forEach(k => PrototypeMix.currentMix[k] = share);
    } else {
        const factor = 100 / total;
        Object.keys(PrototypeMix.currentMix).forEach(k => {
            PrototypeMix.currentMix[k] = parseFloat((PrototypeMix.currentMix[k] * factor).toFixed(1));
        });
    }
    updateMixUI();
}

// Toggle manual override mode
export function toggleManualOverride(enabled) {
    PrototypeMix.manualOverride = enabled;
    const sliders = document.querySelectorAll('.prototype-slider');
    sliders.forEach(slider => slider.disabled = !enabled);

    // Also toggle name and parameter fields
    const nameFields = document.querySelectorAll('.editable-proto-name');
    nameFields.forEach(field => field.disabled = !enabled);

    const paramFields = document.querySelectorAll('.proto-param-field');
    paramFields.forEach(field => field.disabled = !enabled);

    renderPrototypes(); // Refresh to update disabled states in the dynamic list
    updateMixUI();
}

// Calculate statistics for selected prototypes
export function calculatePrototypeStats() {
    const stats = {
        totalPlots: 0,
        totalBuiltUpArea: 0,
        totalFloorArea: 0,
        averagePlotSize: 0,
        averageBuiltUpArea: 0,
        averageFloorArea: 0,
        byType: {}
    };

    let totalCount = 0;

    Object.entries(PrototypeMix.currentMix).forEach(([id, percentage]) => {
        if (percentage > 0) {
            const proto = getPrototypeById(id);
            if (proto) {
                const count = Math.round((percentage / 100) * (App.data.generatedObjects?.length || 0));
                stats.totalPlots += count;
                stats.totalBuiltUpArea += count * proto.builtUpArea.typical;
                stats.totalFloorArea += count * proto.floorArea.typical;

                if (!stats.byType[proto.type]) {
                    stats.byType[proto.type] = {
                        count: 0,
                        percentage: 0,
                        builtUpArea: 0,
                        floorArea: 0
                    };
                }

                stats.byType[proto.type].count += count;
                stats.byType[proto.type].percentage += percentage;
                stats.byType[proto.type].builtUpArea += count * proto.builtUpArea.typical;
                stats.byType[proto.type].floorArea += count * proto.floorArea.typical;

                totalCount += count;
            }
        }
    });

    if (totalCount > 0) {
        stats.averagePlotSize = stats.totalPlots > 0 ?
            Object.entries(PrototypeMix.currentMix).reduce((sum, [id, pct]) => {
                const proto = getPrototypeById(id);
                return sum + (pct / 100) * proto.plotSize.typical;
            }, 0) : 0;

        stats.averageBuiltUpArea = stats.totalBuiltUpArea / totalCount;
        stats.averageFloorArea = stats.totalFloorArea / totalCount;
    }

    return stats;
}

// Export mix configuration
export function exportMixConfiguration() {
    return {
        timestamp: new Date().toISOString(),
        mix: { ...PrototypeMix.currentMix },
        manualOverride: PrototypeMix.manualOverride,
        stats: calculatePrototypeStats()
    };
}

// Import mix configuration
export function importMixConfiguration(config) {
    if (config.mix) {
        PrototypeMix.currentMix = { ...config.mix };
        PrototypeMix.manualOverride = config.manualOverride || false;
        updateMixUI();
    }
}

// Reset all prototypes
export function resetPrototypeMix() {
    Object.keys(PrototypeMix.currentMix).forEach(key => {
        PrototypeMix.currentMix[key] = 0;
    });
    PrototypeMix.manualOverride = false;
    updateMixUI();
}
