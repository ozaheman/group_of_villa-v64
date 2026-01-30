//--- START OF FILE js/export.js ---

// This module will handle exporting the canvas or data to various formats
// like SVG, PNG, JSON, or DXF.

import { App } from './appState.js';

export function exportAsSVG() {
    const svg = App.canvas.toSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'masterplan.svg';
    a.click();
    URL.revokeObjectURL(url);
    console.log("Exported as SVG.");
}

export function exportAsJSON() {
    const json = App.canvas.toJSON(['isTangentCircle', 'parentSegment', 'isGeneratedPlot', 'isEntryCircle']);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'masterplan.json';
    a.click();
    URL.revokeObjectURL(url);
    console.log("Exported as JSON.");
}