//--- START OF FILE js/appState.js ---

// The single source of truth for the application's state and data.
export const App = {
    // Core Fabric.js instance
    canvas: null,

    // Application state
    state: {
        mode: 'none', // 'draw', 'roadDraw', 'edit', 'measure', 'calibrate', 'entry'
        isPanning: false,
        lastPosX: 0,
        lastPosY: 0,
        scale: 1.0, // pixels to meters
    },

    // Data arrays for drawing and objects
    data: {
        polyPoints: [],
        roadCenterlinePoints: [],
        tempLines: [],
        tempPoints: [],
        generatedObjects: [],
        vertexHandles: [],
        calibrationPoints: [],
        measurePoints: [],
    },

    // Core Fabric.js objects
    objects: {
        masterPolygon: null,
        activePolygon: null,
        roadCenterline: null,
        lastInnerBoundary: null,
    },

    // Prototype and building configuration
    prototypes: {
        selectedPrototypes: {
            'villa-1': 0,
            'villa-2': 0,
            'villa-3': 0,
            'villa-4': 0,
            'th-end': 0,
            'th-mid': 0,
            'th-twin': 0,
            'apt-1': 0
        },
        manualOverride: false,
        lastStats: null
    },

    // Parking and Visitor Configuration
    parking: {
        showParking: false,
        parallelParkingEnabled: false,
        interval: 15,
        visitorGoal: 0,
        manualOverride: false
    },

    // Cached DOM elements
    elements: {}
};