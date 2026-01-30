//--- START OF FILE js/greenArea.js ---

import { App } from './appState.js';
import { polygonArea, createInwardOffsetPolygon } from './utils.js';
import { updateAreaInfo } from './ui.js';

export function createInnerGreenAreaPolygon() {
    if (!App.objects.activePolygon) {
        alert("Please draw or select a master polygon first.");
        return;
    }

    // Read values from the UI
    const leftPaveM = parseFloat(App.elements.pavementWidthLeft.value);
    const rightPaveM = parseFloat(App.elements.pavementWidthRight.value);
    const numLanes = parseInt(App.elements.numLanes.value);
    const laneWidthM = parseFloat(App.elements.laneWidth.value);
    const plotDepthM = parseFloat(App.elements.plotDepth.value);

    if (isNaN(leftPaveM) || isNaN(rightPaveM) || isNaN(numLanes) || isNaN(laneWidthM) || isNaN(plotDepthM)) {
        alert("Invalid layout parameters. Please check all values.");
        return;
    }

    // Remove any previously generated green area polygon
    const existingGreenArea = App.data.generatedObjects.find(obj => obj.isGreenArea);
    if (existingGreenArea) {
        App.canvas.remove(existingGreenArea);
        App.data.generatedObjects = App.data.generatedObjects.filter(obj => !obj.isGreenArea);
    }

    // Calculate the total offset from the boundary to the green area
    const roadWidthM = numLanes * laneWidthM;
    const totalOffsetM = plotDepthM + leftPaveM + roadWidthM + rightPaveM;
    const totalOffsetPx = totalOffsetM / App.state.scale;

    // Use the new robust function to create the inner polygon
    const innerPoints = createInwardOffsetPolygon(App.objects.activePolygon.points, totalOffsetPx);

    if (innerPoints.length < 3) {
        alert("The calculated setbacks are too large for the site polygon. No green area can be created.");
        updateAreaInfo(); // This will reset the green area display
        return;
    }

    const greenAreaPolygon = new fabric.Polygon(innerPoints, {
        fill: 'rgba(34, 139, 34, 0.3)',
        stroke: '#228B22',
        strokeWidth: 1.5,
        selectable: false,
        evented: false,
        isGreenArea: true, // Custom property for identification
    });

    App.data.generatedObjects.push(greenAreaPolygon);
    App.canvas.add(greenAreaPolygon).sendToBack(greenAreaPolygon);

    // Calculate and display the area
    updateGreenAreaCalculations(greenAreaPolygon);
    App.canvas.renderAll();
}

export function updateGreenAreaCalculations(greenPolygon) {
    let greenAreaM2 = 0;
    let percentage = 0;

    const totalAreaM2 = App.objects.masterPolygon ? polygonArea(App.objects.masterPolygon.points) * App.state.scale * App.state.scale : 0;

    if (greenPolygon && totalAreaM2 > 0) {
        greenAreaM2 = polygonArea(greenPolygon.points) * App.state.scale * App.state.scale;
        percentage = (greenAreaM2 / totalAreaM2) * 100;
    }

    // Update the UI Panel
    if (App.elements.greenAreaCalc) App.elements.greenAreaCalc.textContent = `${greenAreaM2.toFixed(2)} m²`;
    if (App.elements.greenAreaPercent) App.elements.greenAreaPercent.textContent = `${percentage.toFixed(2)} %`;
}