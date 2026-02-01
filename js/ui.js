//--- START OF FILE js/ui.js ---

import { App } from './appState.js';
import { polygonArea } from './utils.js';
import { destroyVertexHandles, createVertexHandles } from './polygon.js';
import { cleanupTempObjects } from './canvas.js';
import { updateGreenAreaCalculations } from './greenArea.js';

export function setMode(newMode) {
    if (App.state.mode === 'edit') destroyVertexHandles();
    if (App.state.mode === newMode && newMode !== 'draw') newMode = 'none';
    App.state.mode = newMode;

    // Reset all button styles
    document.querySelectorAll('.control-group button').forEach(b => {
        if (!b.classList.contains('primary')) b.style.backgroundColor = '';
    });

    App.canvas.defaultCursor = 'default';
    App.canvas.selection = false;
    if (App.elements.finishDrawBtn) App.elements.finishDrawBtn.disabled = true;
    if (App.elements.removeVertexBtn) App.elements.removeVertexBtn.disabled = true;
    if (App.elements.drawRoadBtn) App.elements.drawRoadBtn.style.display = 'block';
    if (App.elements.finishRoadBtn) App.elements.finishRoadBtn.style.display = 'none';

    // Update button states based on canvas content
    if (App.elements.startDrawBtn) App.elements.startDrawBtn.disabled = !!App.objects.masterPolygon;
    if (App.elements.editPolyBtn) App.elements.editPolyBtn.disabled = !App.objects.activePolygon;
    if (App.elements.generateCirclesBtn) App.elements.generateCirclesBtn.disabled = !App.objects.activePolygon;
    if (App.elements.createGreenAreaBtn) App.elements.createGreenAreaBtn.disabled = !App.objects.activePolygon;
    if (App.elements.genLayoutsBtn) App.elements.genLayoutsBtn.disabled = !App.objects.activePolygon;

    // Enable/Disable Step Wizard
    const hasPolygon = !!App.objects.activePolygon;
    ['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6', 'step-7', 'step-8', 'step-9', 'step-10', 'step-11', 'step-12', 'step-13', 'step-14', 'step-15', 'step-16', 'step-17'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = !hasPolygon;
    });

    const tangentCirclesExist = App.data.generatedObjects.filter(o => o.isTangentCircle || o.isGeneratedPlot).length > 0;
    if (App.elements.subdividePlotsBtn) App.elements.subdividePlotsBtn.disabled = !tangentCirclesExist;
    if (App.elements.createHouseLotsBtn) App.elements.createHouseLotsBtn.disabled = !tangentCirclesExist;
    if (App.elements.drawPlotLinesBtn) App.elements.drawPlotLinesBtn.disabled = !tangentCirclesExist;
    if (App.elements.arrayCirclesBtn) App.elements.arrayCirclesBtn.disabled = !tangentCirclesExist;
    if (App.elements.bufferRoadBtn) App.elements.bufferRoadBtn.disabled = !App.objects.roadCenterline;
    if (App.elements.setInnerBoundaryBtn) App.elements.setInnerBoundaryBtn.disabled = !App.objects.lastInnerBoundary;

    cleanupTempObjects();

    // Activate the new mode
    switch (App.state.mode) {
        case 'draw':
            App.elements.startDrawBtn.disabled = true;
            App.elements.finishDrawBtn.disabled = false;
            App.canvas.defaultCursor = 'crosshair';
            if (App.objects.masterPolygon) {
                App.canvas.remove(App.objects.masterPolygon);
                App.objects.masterPolygon = null;
                App.objects.activePolygon = null;
            }
            clearGeneratedLayout();
            App.data.polyPoints = [];
            break;
        case 'roadDraw':
            App.elements.drawRoadBtn.style.display = 'none';
            App.elements.finishRoadBtn.style.display = 'block';
            App.canvas.defaultCursor = 'crosshair';
            App.data.roadCenterlinePoints = [];
            if (App.objects.roadCenterline) {
                App.data.generatedObjects = App.data.generatedObjects.filter(o => o !== App.objects.roadCenterline);
                App.canvas.remove(App.objects.roadCenterline);
                App.objects.roadCenterline = null;
            }
            break;
        case 'edit':
            App.elements.editPolyBtn.style.backgroundColor = '#28a745';
            App.canvas.selection = true;
            createVertexHandles();
            break;
        case 'measure':
            App.elements.measureToolBtn.style.backgroundColor = '#28a745';
            App.canvas.defaultCursor = 'copy';
            App.data.measurePoints = [];
            break;
        case 'calibrate':
            App.elements.calibrateBtn.style.backgroundColor = '#28a745';
            App.canvas.defaultCursor = 'cell';
            App.data.calibrationPoints = [];
            break;
        case 'entry':
            App.elements.addEntryBtn.style.backgroundColor = '#28a745';
            App.canvas.defaultCursor = 'pointer';
            break;
    }
}

export function updateAreaInfo() {
    const totalSiteAreaM2 = App.objects.masterPolygon ? polygonArea(App.objects.masterPolygon.points) * App.state.scale * App.state.scale : 0;
    const totalSiteAreaSft = totalSiteAreaM2 * 10.7639;
    App.elements.totalArea.textContent = `${totalSiteAreaM2.toFixed(2)} m² | ${totalSiteAreaSft.toFixed(2)} sq.ft`;

    const plots = App.data.generatedObjects.filter(o => o.isTangentCircle || o.isPlot);
    const plotCount = plots.length;

    let totalPlotAreaM2 = 0;
    plots.forEach(p => {
        if (p.isPlot) {
            totalPlotAreaM2 += (p.area || 0);
        } else if (p.isTangentCircle) {
            const r = p.radius * App.state.scale;
            totalPlotAreaM2 += Math.PI * r * r;
        }
    });
    const totalPlotAreaSft = totalPlotAreaM2 * 10.7639;

    App.elements.plotAreaCalc.textContent = `${totalPlotAreaM2.toFixed(2)} m² | ${totalPlotAreaSft.toFixed(2)} sq.ft`;
    App.elements.plotCount.textContent = plotCount;

    // Infrastructure Area
    let infraAreaM2 = 0;
    App.data.generatedObjects.filter(o => o.isInfra).forEach(o => {
        if (o.type === 'polygon') {
            infraAreaM2 += polygonArea(o.points) * App.state.scale * App.state.scale;
        } else if (o.type === 'group' && o.getObjects().find(c => c.type === 'polygon')) {
            // Groups might contain road polygons if complex
        }
    });
    const infraAreaSft = infraAreaM2 * 10.7639;
    const infraEl = document.getElementById('infra-area-calc');
    if (infraEl) infraEl.textContent = `${infraAreaM2.toFixed(2)} m² | ${infraAreaSft.toFixed(2)} sq.ft`;

    // Green Area (Multiple polygons)
    let totalGreenM2 = 0;
    App.data.generatedObjects.filter(o => o.isGreenArea || o.isGreen).forEach(o => {
        if (o.points) totalGreenM2 += polygonArea(o.points) * App.state.scale * App.state.scale;
    });
    const totalGreenSft = totalGreenM2 * 10.7639;
    const greenPercent = totalSiteAreaM2 > 0 ? (totalGreenM2 / totalSiteAreaM2) * 100 : 0;
    const greenPercentEl = document.getElementById('green-area-percent');
    if (greenPercentEl) greenPercentEl.textContent = `${totalGreenM2.toFixed(2)} m² | ${totalGreenSft.toFixed(2)} sq.ft (${greenPercent.toFixed(2)} %)`;

    // Amenities area (Multiple polygons)
    let amenitiesAreaM2 = 0;
    App.data.generatedObjects.filter(obj => obj.isAmenity).forEach(amenity => {
        if (amenity.points) {
            amenitiesAreaM2 += polygonArea(amenity.points) * App.state.scale * App.state.scale;
        }
    });
    const amenitiesAreaSft = amenitiesAreaM2 * 10.7639;
    const amenitiesPercentage = totalSiteAreaM2 > 0 ? (amenitiesAreaM2 / totalSiteAreaM2) * 100 : 0;
    const amenitiesPercentEl = document.getElementById('amenities-area-percent');
    if (amenitiesPercentEl) amenitiesPercentEl.textContent = `${amenitiesAreaM2.toFixed(2)} m² | ${amenitiesAreaSft.toFixed(2)} sq.ft (${amenitiesPercentage.toFixed(2)} %)`;

    updateRequiredAreas();
}

export function updateRequiredAreas() {
    const totalSiteAreaM2 = App.objects.masterPolygon ? polygonArea(App.objects.masterPolygon.points) * App.state.scale * App.state.scale : 0;
    
    // Green Area Required
    const greenSlider = document.getElementById('green-area');
    const greenVal = greenSlider ? parseFloat(greenSlider.value) : 0;
    const requiredGreenM2 = totalSiteAreaM2 * (greenVal / 100);
    const requiredGreenSft = requiredGreenM2 * 10.7639;
    
    const greenReqEl = document.getElementById('green-area-required');
    if (greenReqEl) {
        greenReqEl.textContent = `Required: ${requiredGreenM2.toFixed(2)} m² | ${requiredGreenSft.toFixed(2)} sq.ft`;
    }

    // Amenities Area Required
    const amenitiesSlider = document.getElementById('amenities-area');
    const amenitiesVal = amenitiesSlider ? parseFloat(amenitiesSlider.value) : 0;
    const requiredAmenitiesM2 = totalSiteAreaM2 * (amenitiesVal / 100);
    const requiredAmenitiesSft = requiredAmenitiesM2 * 10.7639;
    
    const amenitiesReqEl = document.getElementById('amenities-area-required');
    if (amenitiesReqEl) {
        amenitiesReqEl.textContent = `Required: ${requiredAmenitiesM2.toFixed(2)} m² | ${requiredAmenitiesSft.toFixed(2)} sq.ft`;
    }
}

export function clearGeneratedLayout() {
    App.data.generatedObjects.forEach(obj => App.canvas.remove(obj));
    App.data.generatedObjects = [];
    App.objects.roadCenterline = null;
    App.objects.lastInnerBoundary = null;
    if (App.objects.masterPolygon !== App.objects.activePolygon) {
        App.canvas.remove(App.objects.activePolygon);
    }
    App.objects.activePolygon = App.objects.masterPolygon;
    if (App.objects.masterPolygon) App.objects.masterPolygon.visible = true;
    App.canvas.renderAll();
    updateAreaInfo();
}