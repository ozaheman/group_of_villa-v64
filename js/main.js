//--- START OF FILE js/main.js ---

import { App } from './appState.js';
import { initCanvas, resetView, clearCanvas } from './canvas.js';
import { setMode, updateAreaInfo } from './ui.js';
import { finishDrawing, removeSelectedVertex, generateTangentCircles, drawPlotBackLines, arrayCircles, subdivideInnerPlots, createInnerHouseLots } from './polygon.js';
import { finishRoadDrawing, bufferRoad, setInnerBoundaryAsPlot } from './road.js';
import { handleBackgroundLoad } from './io.js';
import { createInnerGreenAreaPolygon } from './greenArea.js';
import { generateLayoutSolutions, runWizardStep } from './generative.js';
import {
    updatePrototypeMixPercentage,
    toggleManualOverride,
    updateMixUI,
    calculatePrototypeStats,
    resetPrototypeMix,
    getPrototypeById,
    getTotalMixPercentage,
    renderPrototypes,
    addPrototype,
    deletePrototype,
    updatePrototypeName,
    updatePrototypeParams
} from './prototype.js';
import { activateEntryMode, activateExitMode, handleEntryExitClick } from './entryExit.js';
import { enableRoadCenterlineEdit, enableGreenAreaEdit, finishGeometryEdit } from './editGeometry.js';
import { initMarketSearch } from './marketData.js';


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize the canvas and store it in the App state
    App.canvas = initCanvas();

    // 2. Cache all DOM elements for easy access
    App.elements = {
        // Site Setup
        bgLoader: document.getElementById('bg-loader'),
        calibrateBtn: document.getElementById('calibrate-scale'),
        scaleInfo: document.getElementById('scale-info'),
        // Master Polygon
        startDrawBtn: document.getElementById('start-draw'),
        finishDrawBtn: document.getElementById('finish-draw'),
        editPolyBtn: document.getElementById('edit-poly'),
        removeVertexBtn: document.getElementById('remove-vertex'),
        orthoMode: document.getElementById('ortho-mode'),
        osnapMode: document.getElementById('osnap-mode'),
        // Layout Parameters
        plotDepth: document.getElementById('plot-depth'),
        plotWidth: document.getElementById('plot-width'),
        pavementWidthLeft: document.getElementById('pavement-width-left'),
        pavementWidthRight: document.getElementById('pavement-width-right'),
        numLanes: document.getElementById('num-lanes'),
        laneWidth: document.getElementById('lane-width'),
        plotPrototype: document.getElementById('plot-prototype'),
        // Actions & Tools
        generateCirclesBtn: document.getElementById('generate-circles'),
        drawPlotLinesBtn: document.getElementById('draw-plot-lines'),
        arrayCirclesBtn: document.getElementById('array-circles'),
        subdividePlotsBtn: document.getElementById('subdivide-plots'),
        createHouseLotsBtn: document.getElementById('create-house-lots'),
        createGreenAreaBtn: document.getElementById('create-green-area'), // Cache new button
        drawRoadBtn: document.getElementById('draw-road'),
        finishRoadBtn: document.getElementById('finish-road'),
        bufferRoadBtn: document.getElementById('buffer-road'),
        setInnerBoundaryBtn: document.getElementById('set-inner-boundary'),
        addEntryBtn: document.getElementById('add-entry'),
        measureToolBtn: document.getElementById('measure-tool'),
        resetViewBtn: document.getElementById('reset-view'),
        clearCanvasBtn: document.getElementById('clear-canvas'),
        genLayoutsBtn: document.getElementById('gen-layouts'),
        // Info Panel
        totalArea: document.getElementById('total-area'),
        plotAreaCalc: document.getElementById('plot-area-calc'),
        plotCount: document.getElementById('plot-count'),
        greenAreaCalc: document.getElementById('green-area-calc'), // Cache new info element
        greenAreaPercent: document.getElementById('green-area-percent'), // Cache new info element

        // Prototype Elements
        overrideMode: document.getElementById('override-mode'),
        resetPrototypesBtn: document.getElementById('reset-prototypes'),
        showProtoStatsBtn: document.getElementById('show-proto-stats'),
        protoStatsPanel: document.getElementById('proto-stats'),
        protoStatsContent: document.getElementById('proto-stats-content'),
    };

    renderPrototypes(); // Initial render
    // 3. Bind event listeners to their respective module functions
    // Site Setup
    App.elements.bgLoader.addEventListener('change', handleBackgroundLoad);
    App.elements.calibrateBtn.addEventListener('click', () => setMode('calibrate'));

    // Master Polygon
    App.elements.startDrawBtn?.addEventListener('click', () => setMode('draw'));
    App.elements.finishDrawBtn?.addEventListener('click', finishDrawing);
    App.elements.editPolyBtn?.addEventListener('click', () => setMode('edit'));
    App.elements.removeVertexBtn?.addEventListener('click', removeSelectedVertex);

    // Layout Generation
    App.elements.generateCirclesBtn?.addEventListener('click', generateTangentCircles);
    App.elements.drawPlotLinesBtn?.addEventListener('click', drawPlotBackLines);
    App.elements.arrayCirclesBtn?.addEventListener('click', arrayCircles);
    App.elements.subdividePlotsBtn?.addEventListener('click', subdivideInnerPlots);
    App.elements.createHouseLotsBtn?.addEventListener('click', createInnerHouseLots);
    App.elements.createGreenAreaBtn?.addEventListener('click', createInnerGreenAreaPolygon); // Bind new button

    // Road Tools
    App.elements.drawRoadBtn?.addEventListener('click', () => setMode('roadDraw'));
    App.elements.finishRoadBtn?.addEventListener('click', finishRoadDrawing);
    App.elements.bufferRoadBtn?.addEventListener('click', bufferRoad);
    App.elements.setInnerBoundaryBtn?.addEventListener('click', setInnerBoundaryAsPlot);

    // Other Tools
    App.elements.measureToolBtn?.addEventListener('click', () => setMode('measure'));
    App.elements.resetViewBtn?.addEventListener('click', resetView);
    App.elements.clearCanvasBtn?.addEventListener('click', clearCanvas);
    App.elements.genLayoutsBtn?.addEventListener('click', generateLayoutSolutions);

    // Entry/Exit Points
    document.getElementById('add-entry')?.addEventListener('click', activateEntryMode);
    document.getElementById('add-exit')?.addEventListener('click', activateExitMode);

    // Geometry Editing
    document.getElementById('edit-road-centerline')?.addEventListener('click', () => {
        if (document.getElementById('edit-road-centerline').textContent.includes('✅')) {
            finishGeometryEdit();
        } else {
            enableRoadCenterlineEdit();
        }
    });

    document.getElementById('edit-green-area')?.addEventListener('click', () => {
        if (document.getElementById('edit-green-area').textContent.includes('✅')) {
            finishGeometryEdit();
        } else {
            enableGreenAreaEdit();
        }
    });

    // Wizard Steps
    document.getElementById('step-1')?.addEventListener('click', () => runWizardStep(1));
    document.getElementById('step-2')?.addEventListener('click', () => runWizardStep(2));
    document.getElementById('step-3')?.addEventListener('click', () => runWizardStep(3));
    document.getElementById('step-4')?.addEventListener('click', () => runWizardStep(4));
    document.getElementById('step-5')?.addEventListener('click', () => runWizardStep(5));
    document.getElementById('step-6')?.addEventListener('click', () => runWizardStep(6));
    document.getElementById('step-7')?.addEventListener('click', () => runWizardStep(7));
    document.getElementById('step-8')?.addEventListener('click', () => runWizardStep(8));
    document.getElementById('step-9')?.addEventListener('click', () => runWizardStep(9));
    document.getElementById('step-10')?.addEventListener('click', () => runWizardStep(10));
    document.getElementById('step-11')?.addEventListener('click', () => runWizardStep(11));
    document.getElementById('step-12')?.addEventListener('click', () => runWizardStep(12));
    document.getElementById('step-13')?.addEventListener('click', () => runWizardStep(13));
    document.getElementById('step-14')?.addEventListener('click', () => runWizardStep(14));
    document.getElementById('step-15')?.addEventListener('click', () => runWizardStep(15));
    document.getElementById('step-16')?.addEventListener('click', () => runWizardStep(16));
    document.getElementById('step-finalize')?.addEventListener('click', () => runWizardStep(8)); // Redirect finalize to original Step 8 logic

    // Range slider value display
    document.getElementById('green-area')?.addEventListener('input', (e) => document.getElementById('green-area-val').textContent = e.target.value);
    document.getElementById('amenities-area')?.addEventListener('input', (e) => document.getElementById('amenities-area-val').textContent = e.target.value);

    // Prototype Management
    App.elements.overrideMode?.addEventListener('change', (e) => {
        toggleManualOverride(e.target.checked);
    });

    App.elements.resetPrototypesBtn?.addEventListener('click', () => {
        resetPrototypeMix();
        updateMixUI();
    });

    document.getElementById('normalize-mix')?.addEventListener('click', () => {
        import('./prototype.js').then(m => m.normalizeMix());
    });

    App.elements.showProtoStatsBtn?.addEventListener('click', () => {
        const statsPanel = App.elements.protoStatsPanel;
        if (statsPanel.style.display === 'none' || !statsPanel.style.display) {
            const stats = calculatePrototypeStats();
            const content = App.elements.protoStatsContent;

            let html = '<div style="font-size: 10px;">';
            html += `<div><strong>Total Plots (estimated):</strong> ${stats.totalPlots}</div>`;
            html += `<div><strong>Avg Plot Size:</strong> ${stats.averagePlotSize.toFixed(1)} m²</div>`;
            html += `<div><strong>Avg Built-up Area:</strong> ${stats.averageBuiltUpArea.toFixed(1)} m²</div>`;
            html += `<div><strong>Avg Floor Area:</strong> ${stats.averageFloorArea.toFixed(1)} m²</div>`;

            if (Object.keys(stats.byType).length > 0) {
                html += '<hr style="margin: 5px 0;">';
                html += '<strong>By Type:</strong>';
                Object.entries(stats.byType).forEach(([type, data]) => {
                    html += `<div style="margin-left: 10px; margin-top: 5px;">`;
                    html += `<strong>${type}:</strong> ${data.count} units, ${data.percentage.toFixed(1)}%<br>`;
                    html += `Built-up: ${data.builtUpArea.toFixed(0)} m², Floor: ${data.floorArea.toFixed(0)} m²`;
                    html += `</div>`;
                });
            }
            html += '</div>';

            content.innerHTML = html;
            statsPanel.style.display = 'block';
        } else {
            statsPanel.style.display = 'none';
        }
    });

    // Reporting System
    document.getElementById('export-pdf')?.addEventListener('click', () => {
        import('./reporting.js').then(m => m.exportPDF());
    });

    document.getElementById('export-csv')?.addEventListener('click', () => {
        import('./reporting.js').then(m => m.exportCSV());
    });

    document.getElementById('export-excel')?.addEventListener('click', () => {
        import('./reporting.js').then(m => m.exportExcel());
    });

    document.getElementById('show-report')?.addEventListener('click', () => {
        import('./reporting.js').then(m => m.showReportPanel());
    });

    document.getElementById('detailed-plot-report')?.addEventListener('click', () => {
        import('./reporting.js').then(m => m.generateDetailedPlotReport());
    });

    // Prototype Management - Dynamic Events Delegation
    const protoPanel = document.getElementById('prototype-panel');

    protoPanel?.addEventListener('input', (e) => {
        const target = e.target;
        const id = target.dataset.id;

        if (target.classList.contains('prototype-slider')) {
            const val = parseFloat(target.value);
            document.querySelector(`.proto-input[data-id="${id}"]`).value = val;
            updatePrototypeMixPercentage(id, val);
        }
    });

    protoPanel?.addEventListener('change', (e) => {
        const target = e.target;
        const id = target.dataset.id;

        if (target.classList.contains('proto-input')) {
            const val = parseFloat(target.value) || 0;
            document.querySelector(`.prototype-slider[data-id="${id}"]`).value = val;
            updatePrototypeMixPercentage(id, val);
        } else if (target.classList.contains('editable-proto-name')) {
            updatePrototypeName(id, target.value);
        } else if (target.classList.contains('proto-param-field')) {
            const param = target.dataset.param;
            const minEl = document.querySelector(`.proto-param-field[data-id="${id}"][data-param="${param}"][data-type="min"]`);
            const maxEl = document.querySelector(`.proto-param-field[data-id="${id}"][data-param="${param}"][data-type="max"]`);
            if (minEl && maxEl) {
                updatePrototypeParams(id, param, minEl.value, maxEl.value);
            }
        }
    });

    protoPanel?.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('delete-proto')) {
            if (confirm('Delete this prototype?')) {
                deletePrototype(target.dataset.id);
            }
        }
    });

    document.getElementById('add-villa-proto')?.addEventListener('click', () => addPrototype('villa'));
    document.getElementById('add-townhouse-proto')?.addEventListener('click', () => addPrototype('townhouse'));

    // Parking & Visitor Listeners
    document.getElementById('show-parking')?.addEventListener('change', (e) => {
        App.parking.showParking = e.target.checked;
    });

    document.getElementById('enable-parallel-parking')?.addEventListener('change', (e) => {
        App.parking.parallelParkingEnabled = e.target.checked;
    });

    document.getElementById('parking-interval')?.addEventListener('change', (e) => {
        App.parking.interval = parseFloat(e.target.value) || 15;
    });

    const visitorSlider = document.getElementById('visitor-parking-slider');
    const visitorVal = document.getElementById('visitor-parking-val');
    const visitorOverride = document.getElementById('visitor-manual-override');

    visitorSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        visitorVal.textContent = val;
        App.parking.visitorGoal = parseInt(val);
    });

    visitorOverride?.addEventListener('change', (e) => {
        App.parking.manualOverride = e.target.checked;
        visitorSlider.disabled = !e.target.checked;
    });

    // Show/Hide prototype panel based on Building Type selection
    const plotProtoDropdown = App.elements.plotPrototype;
    const updateProtoPanelVisibility = () => {
        if (protoPanel) {
            protoPanel.style.display = plotProtoDropdown.value === 'mixed' ? 'block' : 'none';
        }
    };
    plotProtoDropdown?.addEventListener('change', updateProtoPanelVisibility);
    updateProtoPanelVisibility();

    // DXF & Labels
    document.getElementById('export-dxf-btn')?.addEventListener('click', () => {
        import('./dxfExport.js').then(m => m.exportToDXF(App.data.generatedObjects));
    });

    document.getElementById('toggle-labels')?.addEventListener('change', (e) => {
        const show = e.target.checked;
        App.canvas.getObjects().forEach(obj => {
            if (obj.isPlot && obj.type === 'group') {
                const textObj = obj.getObjects().find(o => o.type === 'text');
                if (textObj) textObj.visible = show;
                obj.dirty = true;
            }
        });
        App.canvas.requestRenderAll();
    });

    // Save/Load Project
    document.getElementById('save-project-zip')?.addEventListener('click', () => {
        import('./io.js').then(m => m.saveProjectToZip());
    });

    document.getElementById('zip-loader')?.addEventListener('change', (e) => {
        import('./io.js').then(m => m.loadProjectFromZip(e));
    });

    // Manual Road Tools
    document.getElementById('manual-fillet-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.filletRoadCenterline()));
    document.getElementById('manual-gen-road-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.generateRoadPolygon()));
    document.getElementById('manual-gen-pave-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.generatePavementPolygon()));
    document.getElementById('manual-connect-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.connectEntryExit()));
    document.getElementById('manual-green-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.drawGreenManual()));
    document.getElementById('manual-green-balance-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.generateGreenAreaBalanceManual()));
    document.getElementById('manual-gen-plots-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.generatePlotsManual()));
    document.getElementById('manual-gen-plots-outer-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.generatePlotsOuter()));
    document.getElementById('manual-bifurcate-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.bifurcateRoadManual()));
    document.getElementById('manual-recalc-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.recalculateAreaManual()));
    document.getElementById('restart-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.restartDesign()));
    document.getElementById('delete-selected-btn')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.deleteSelectedPolygon()));
    document.getElementById('edit-road-centerline')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.editRoadCenterline()));
    document.getElementById('edit-green-area')?.addEventListener('click', () => import('./manualRoad.js').then(m => m.editGreenArea()));

    // Infra-only view toggle
    document.getElementById('infra-only-view')?.addEventListener('change', () => {
        import('./generative.js').then(m => {
            if (m.GenerativeState.currentSolutionIndex !== -1) {
                const currentSol = m.GenerativeState.solutions[m.GenerativeState.currentSolutionIndex];
                if (currentSol) m.renderSolution(currentSol);
            }
        });
    });

    // Initialize UI state
    setMode('none');
    updateAreaInfo();
    updateMixUI();
    initMarketSearch();
});