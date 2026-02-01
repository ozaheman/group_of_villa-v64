import { App } from './appState.js';
import { clearGeneratedLayout, updateAreaInfo } from './ui.js';
import { polygonArea, offsetPolyline, createInwardOffsetPolygon, pointsToPathData, isPointInPolygon, polygonSignedArea, getSegmentIntersection, distToSegment, splitPolygonGeneral, getOrientedBoundingRect, getBounds, splitPolygon } from './utils.js';
import { UrbanStandards, calculateKPIs } from './standards.js';
import { getRandomPrototypeByMix, getPrototypeByShape } from './prototype.js';
import { EntryExitState } from './entryExit.js';
import { createEntryExitRoad, removeConflictingPlots } from './entryExitRoadHelpers.js';

// Import Division Methods
import { fillInnerAreaWithGridBifurcation } from './division_method/grid.js';
import { fillInnerAreaWithRadialBifurcation } from './division_method/radial.js';
import { fillInnerAreaWithOrganicBifurcation } from './division_method/organic.js';
import { fillInnerAreaWithSubdivisionPlan } from './division_method/subdivision.js';
import { fillInnerArea } from './division_method/hybrid.js';

export const GenerativeState = {
    solutions: [],
    currentSolutionIndex: -1,
    wizardStep: 0,
    currentWizardSolution: null,
    currentShortestRoad: null
};

/**
 * Main entry point for generating multiple layout solutions.
 */
export async function generateLayoutSolutions() {
    if (!App.objects.masterPolygon) {
        alert("Please draw a site boundary first.");
        return;
    }

    const selectedMethods = Array.from(document.querySelectorAll('#methods-options input[type="checkbox"]:checked')).map(cb => cb.value);
    if (selectedMethods.length === 0) {
        alert("Please select at least one planning method.");
        return;
    }

    GenerativeState.solutions = [];
    const gallery = document.getElementById('solutions-gallery');
    gallery.innerHTML = 'Generating...';
    document.getElementById('solutions-panel').style.display = 'block';

    const roadStandard = document.getElementById('road-type').value;
    const std = UrbanStandards.Roads[roadStandard];

    const pw = parseFloat(App.elements.plotWidth.value);
    const pd = parseFloat(App.elements.plotDepth.value);
    if (isNaN(pw) || pw <= 0 || isNaN(pd) || pd <= 0) {
        alert("Please enter valid positive numbers for Plot Width and Depth.");
        return;
    }

    const baseParams = {
        plotWidth: pw,
        plotDepth: pd,
        greenPct: (parseFloat(document.getElementById('green-area').value) || 0) / 100,
        amenitiesPct: (parseFloat(document.getElementById('amenities-area').value) || 0) / 100,
        roadWidth: std.carriage,
        pavementLeft: std.footpath,
        pavementRight: std.footpath,
        roadStandard: roadStandard,
        densityStandard: document.getElementById('density-type').value,
        prototypeChoice: document.getElementById('plot-prototype').value,
        selectedMethods: selectedMethods
    };

    const variations = [];
    const numVariations = 20;
    for (let i = 0; i < numVariations; i++) {
        variations.push({
            name: `Option ${i + 1}`,
            plotDepthMult: 0.8 + (Math.random() * 0.5),
            plotWidthMult: 0.9 + (Math.random() * 0.2),
            gardenArea: Math.floor(Math.random() * 15),
            infraShift: (Math.random() - 0.5) * 5
        });
    }

    const overlay = document.getElementById('batch-progress-overlay');
    const fill = document.getElementById('batch-progress-fill');
    const status = document.getElementById('batch-progress-status');
    if (overlay) overlay.style.display = 'flex';

    for (let i = 0; i < variations.length; i++) {
        const progress = ((i + 1) / numVariations) * 100;
        if (fill) fill.style.width = `${progress}%`;
        if (status) status.textContent = `Processing Solution ${i + 1} of ${numVariations}...`;

        const variant = variations[i];
        const solution = createSolution(baseParams, variant, i);
        GenerativeState.solutions.push(solution);

        const targetGFA = parseFloat(document.getElementById('gfa').value) || 1;

        const plotsCount = solution.summary.plots;
        document.getElementById('metric-plots-val').textContent = plotsCount;
        document.getElementById('metric-plots-fill').style.width = `${Math.min(100, (plotsCount / 500) * 100)}%`;

        const gfaAchieved = solution.summary.gfa || 0;
        const gfaPct = (gfaAchieved / targetGFA) * 100;
        document.getElementById('metric-gfa-val').textContent = `${gfaPct.toFixed(1)}%`;
        document.getElementById('metric-gfa-fill').style.width = `${Math.min(100, gfaPct)}%`;

        const greenPct = solution.summary.greenPct;
        document.getElementById('metric-green-val').textContent = `${greenPct.toFixed(1)}%`;
        document.getElementById('metric-green-fill').style.width = `${Math.min(100, (greenPct / 40) * 100)}%`;

        const amenityPct = solution.summary.amenityPct;
        document.getElementById('metric-amenities-val').textContent = `${amenityPct.toFixed(1)}%`;
        document.getElementById('metric-amenities-fill').style.width = `${Math.min(100, (amenityPct / 20) * 100)}%`;

        const roadsPct = solution.summary.infraPct;
        document.getElementById('metric-roads-val').textContent = `${roadsPct.toFixed(1)}%`;
        document.getElementById('metric-roads-fill').style.width = `${Math.min(100, (roadsPct / 30) * 100)}%`;

        renderSolution(solution);
        await new Promise(r => setTimeout(r, 100));
        solution.thumbnail = App.canvas.toDataURL({ format: 'webp', quality: 0.3 });
    }

    if (overlay) overlay.style.display = 'none';
    clearGeneratedLayout();
    updateGallery();
}

/**
 * Creates a single layout solution based on parameters and site geometry.
 */
function createSolution(base, variant, index) {
    const objects = [];
    const plotDepth = base.plotDepth * variant.plotDepthMult;
    const roadOffset = base.pavementLeft + base.roadWidth + base.pavementRight;
    const gardenDepth = variant.gardenArea;
    const selectedMethods = base.selectedMethods || ['hybrid'];
    const methodKey = selectedMethods[index % selectedMethods.length];

    const sitePoints = App.objects.masterPolygon.points;
    const isCCW = polygonSignedArea(sitePoints) < 0;
    const scale = App.state.scale;

    // 1. Boundary Offset for First Row of Plots
    const row1Plots = generatePlotsAlongEdges(sitePoints, plotDepth, base.plotWidth * variant.plotWidthMult, isCCW, [], base.densityStandard);
    objects.push(...row1Plots);

    // 2. Infrastructure Corridor (Pavement 1 + Road + Pavement 2)
    const infraVisuals = generateDetailedRoad(sitePoints, plotDepth, base.pavementLeft, base.roadWidth, base.pavementRight, isCCW);
    objects.push(...infraVisuals);

    // 3. Inner Space Analysis
    const p2OffsetPx = (plotDepth + base.pavementLeft + base.roadWidth + base.pavementRight) / scale;
    const remainderPolyPts = createInwardOffsetPolygon(sitePoints, p2OffsetPx);

    if (remainderPolyPts.length >= 3) {
        const totalSiteArea = polygonArea(sitePoints) * scale * scale;
        const targetGreenArea = totalSiteArea * base.greenPct;
        const targetAmenityArea = totalSiteArea * base.amenitiesPct;

        let innerPlots = [];
        switch (methodKey) {
            case 'grid': innerPlots = fillInnerAreaWithGridBifurcation(remainderPolyPts, plotDepth, base.plotWidth, gardenDepth, base.densityStandard, base.prototypeChoice); break;
            case 'radial': innerPlots = fillInnerAreaWithRadialBifurcation(remainderPolyPts, plotDepth, base.plotWidth, gardenDepth, base.densityStandard, base.prototypeChoice); break;
            case 'hybrid': innerPlots = fillInnerArea(remainderPolyPts, plotDepth, base.plotWidth, gardenDepth, targetGreenArea, targetAmenityArea, base.densityStandard, base.prototypeChoice); break;
            case 'subdivision': innerPlots = fillInnerAreaWithSubdivisionPlan(remainderPolyPts, plotDepth, base.plotWidth, gardenDepth, base.densityStandard, base.prototypeChoice); break;
            case 'organic': innerPlots = fillInnerAreaWithOrganicBifurcation(remainderPolyPts, plotDepth, base.plotWidth, gardenDepth, base.densityStandard, base.prototypeChoice); break;
            default: innerPlots = fillInnerArea(remainderPolyPts, plotDepth, base.plotWidth, gardenDepth, targetGreenArea, targetAmenityArea, base.densityStandard, base.prototypeChoice);
        }
        objects.push(...innerPlots);

        // 4. Create Green Island in the final central void
        const finalInnerBoundary = createInwardOffsetPolygon(remainderPolyPts, (plotDepth * 1.5) / scale);
        if (finalInnerBoundary.length >= 3) {
            const greenIsland = new fabric.Path(pointsToPathData(finalInnerBoundary), {
                fill: 'rgba(76, 175, 80, 0.4)', stroke: '#2e7d32', strokeWidth: 1.5,
                selectable: true, isGreenArea: true, isGreen: true, objectCaching: false
            });
            greenIsland.points = finalInnerBoundary;
            greenIsland.area = polygonArea(finalInnerBoundary) * scale * scale;
            objects.push(greenIsland);
        }

        // --- SECOND PASS PART A: Entry/Exit Coordination ---
        const std = UrbanStandards.Roads[base.roadStandard || 'local'];
        const turningRadius = parseFloat(document.getElementById('turning-radius')?.value || 15);
        if (EntryExitState.entryPoint || EntryExitState.exitPoint) {
            const ringRoadRing = remainderPolyPts;
            if (EntryExitState.entryPoint) {
                const entryObjs = createEntryExitRoad(EntryExitState.entryPoint, ringRoadRing, std, scale, turningRadius, 'entry');
                objects.push(...entryObjs);
            }
            if (EntryExitState.exitPoint) {
                const exitObjs = createEntryExitRoad(EntryExitState.exitPoint, ringRoadRing, std, scale, turningRadius, 'exit');
                objects.push(...exitObjs);
            }
        }
    }

    // 5. Global Overlap Filter for Plots
    const finalObjects = [];
    const plottedPolys = [];

    // Prioritize infra for overlap checks
    const roadPolys = objects.filter(o => o.isEntryExitRoad && o.type === 'polygon');

    objects.forEach(obj => {
        if (!obj.isPlot) {
            finalObjects.push(obj);
            return;
        }

        let isBlocked = false;
        // Check against Entry/Exit roads
        for (const road of roadPolys) {
            if (checkPolygonsOverlap(obj.points, road.points)) {
                isBlocked = true;
                break;
            }
        }

        // Check against other plots
        if (!isBlocked) {
            for (const poly of plottedPolys) {
                if (checkPolygonsOverlap(obj.points, poly)) {
                    isBlocked = true;
                    break;
                }
            }
        }

        if (!isBlocked) {
            finalObjects.push(obj);
            plottedPolys.push(obj.points);
        }
    });

    objects.length = 0;
    objects.push(...finalObjects);

    const siteArea = polygonArea(sitePoints) * scale * scale;
    const plotArea = objects.filter(o => o.isPlot).reduce((sum, o) => sum + (o.area || 0), 0);
    const infraAreaActual = objects.filter(o => o.isInfra).reduce((sum, o) => {
        if (o.area) return sum + o.area;
        if (o.points) return sum + (polygonArea(o.points) * scale * scale);
        return sum;
    }, 0);

    const leftoverArea = Math.max(0, siteArea - plotArea - infraAreaActual);
    const gPct = parseFloat(base.greenPct || 10);
    const greenArea = siteArea * (gPct / 100);
    const amenityArea = Math.max(0, leftoverArea - greenArea);
    const roadOnlyArea = objects.filter(o => o.isRoad).reduce((sum, o) => sum + (o.area || (o.points ? polygonArea(o.points) * scale * scale : 0)), 0);

    return {
        id: index,
        name: `${variant.name} (${methodKey.toUpperCase()})`,
        params: { ...base, ...variant },
        objects: objects,
        bifurcationType: methodKey,
        summary: {
            plots: objects.filter(o => o.isPlot).length,
            infraArea: infraAreaActual,
            greenPct: gPct,
            amenityPct: (amenityArea / siteArea) * 100,
            infraPct: (infraAreaActual / siteArea) * 100,
            plotPct: (plotArea / siteArea) * 100,
            roadLength: roadOnlyArea / (base.roadWidth || 1),
            gfa: plotArea * 0.8
        }
    };
}

// --- Step-by-Step Wizard Logic ---

export async function runWizardStep(stepNum) {
    if (!App.objects.masterPolygon) {
        alert("Please draw site boundary first.");
        return;
    }

    if (stepNum === 1) {
        clearGeneratedLayout();
        const sitePoints = App.objects.masterPolygon.points;
        const isCCW = polygonSignedArea(sitePoints) < 0;
        const params = {
            plotWidth: parseFloat(App.elements.plotWidth.value),
            plotDepth: parseFloat(App.elements.plotDepth.value),
            densityStandard: document.getElementById('density-type').value,
            prototypeChoice: document.getElementById('plot-prototype').value
        };
        const plots = generatePlotsAlongEdges(sitePoints, params.plotDepth, params.plotWidth, isCCW, [], params.densityStandard, false, params.prototypeChoice);
        plots.forEach(p => {
            p.isOuterPlot = true;
            App.canvas.add(p);
        });
        App.data.generatedObjects.push(...plots);
        GenerativeState.wizardStep = 1;
    } else if (stepNum === 2) {
        const sitePoints = App.objects.masterPolygon.points;
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const plotDepth = parseFloat(App.elements.plotDepth.value);
        const scale = App.state.scale;
        const d1 = plotDepth / scale;
        const d2 = (plotDepth + std.footpath) / scale;
        const pts1 = createInwardOffsetPolygon(sitePoints, d1);
        const pts2 = createInwardOffsetPolygon(sitePoints, d2);
        if (pts1.length >= 3 && pts2.length >= 3) {
            const pave = new fabric.Polygon([...pts1, ...[...pts2].reverse()], { fill: '#cccccc', stroke: '#999', strokeWidth: 0.5, selectable: false });
            App.canvas.add(pave);
            App.data.generatedObjects.push(pave);
            const curbLine = new fabric.Polyline(pts1, { stroke: '#333', strokeWidth: 2, fill: '', selectable: false });
            App.canvas.add(curbLine);
            App.data.generatedObjects.push(curbLine);
        }
        GenerativeState.wizardStep = 2;
    } else if (stepNum === 3) {
        const sitePoints = App.objects.masterPolygon.points;
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const plotDepth = parseFloat(App.elements.plotDepth.value);
        const scale = App.state.scale;
        const d2 = (plotDepth + std.footpath) / scale;
        const d3 = (plotDepth + std.footpath + std.carriage) / scale;
        const pts2 = createInwardOffsetPolygon(sitePoints, d2);
        const pts3 = createInwardOffsetPolygon(sitePoints, d3);
        // Ring Road Fillet Support
        const turningRadius = parseFloat(document.getElementById('turning-radius')?.value || 15);
        const radiusPx = turningRadius / scale;

        if (pts2.length >= 3 && pts3.length >= 3) {
            // Outer and Inner paths for Ring Road (Donut)
            // Use fillet helper
            const outerPath = getFilletedPolygonPath(pts2, radiusPx);
            // Inner radius might be tighter or same depending on geometry, simple offset approx:
            const innerRadius = Math.max(1, radiusPx - (std.carriage / scale));
            const innerPath = getFilletedPolygonPath(pts3, innerRadius);

            const roadPathData = outerPath + " " + innerPath; // Concatenate for evenodd fill

            const road = new fabric.Path(roadPathData, {
                fill: '#444444',
                stroke: '#222',
                strokeWidth: 0.5,
                selectable: false,
                fillRule: 'evenodd',
                isInfra: true
            });
            // Approximate points for conflict detection if needed later (mocking bounding box or similar?)
            // For Step 9, we used specific logic. For now, rely on visual.
            road.points = pts2; // Fallback for simple bounds checks

            App.canvas.add(road);
            App.data.generatedObjects.push(road);

            const centerOffset = (plotDepth + std.footpath + std.carriage / 2) / scale;
            const centerLinePts = createInwardOffsetPolygon(sitePoints, centerOffset);
            if (centerLinePts.length >= 2) {
                // Create dashed center line for Visuals
                const centerPathData = getFilletedPolygonPath(centerLinePts, Math.max(1, radiusPx - (std.carriage / 2 / scale)));
                const visualLine = new fabric.Path(centerPathData, {
                    stroke: '#ffffff', strokeWidth: 1, strokeDashArray: [10, 10], selectable: false, fill: '', isInfra: true
                });
                App.canvas.add(visualLine);
                App.data.generatedObjects.push(visualLine);

                // Create EDITABLE Control Path (Sharp)
                // This enables manual "Edit Road Centerline" and "Gen Road" workflow if desired
                const controlPathData = pointsToPathData(centerLinePts);
                const controlPoly = new fabric.Path(controlPathData, {
                    fill: '', stroke: 'blue', strokeWidth: 1, strokeDashArray: [5, 5], opacity: 0.6,
                    selectable: true, evented: true, objectCaching: false
                });
                controlPoly.points = centerLinePts; // Attach points for vertex editing
                App.canvas.add(controlPoly);
                App.objects.roadCenterline = controlPoly; // Expose as global road centerline
                // Add to generatedObjects so it clears on restart, but filter it if needed
                // Usually roadCenterline is separate from generatedObjects in memory, but visual cleanup handles it.
                // We won't add it to generatedObjects to prevent auto-clear if 'roadCenterline' state persists.
            }
        }
        GenerativeState.wizardStep = 3;
    } else if (stepNum === 4) {
        if (App.objects.roadCenterline) {
            // Import and run manual tool logic from manualRoad.js
            import('./manualRoad.js').then(m => {
                // Clear existing visual road/pave from generatedObjects to prevent overlap
                App.data.generatedObjects = App.data.generatedObjects.filter(obj => {
                    const isOld = obj.isInfra || obj.fill === '#444444' || obj.fill === '#cccccc';
                    if (isOld) App.canvas.remove(obj);
                    return !isOld;
                });

                m.filletRoadCenterline();
                m.generateRoadPolygon();
                m.generatePavementPolygon();

                // Ensure Green Island is on top if it exists
                const existingGreen = App.data.generatedObjects.find(o => o.isGreenArea && o.isGreen);
                if (existingGreen) {
                    existingGreen.bringToFront();
                } else if (App.objects.manualInnerBoundary && App.objects.manualInnerBoundary.length >= 3) {
                    const pts = App.objects.manualInnerBoundary;
                    const pathData = pointsToPathData(pts);
                    const green = new fabric.Path(pathData, {
                        fill: 'rgba(76, 175, 80, 0.4)', stroke: '#2e7d32', strokeWidth: 1.5,
                        selectable: true, isGreenArea: true, isGreen: true, objectCaching: false
                    });
                    green.points = pts;
                    App.canvas.add(green);
                    App.data.generatedObjects.push(green);
                    green.bringToFront();
                }

                App.canvas.requestRenderAll();
            });
        } else {
            // Original auto-offset logic as fallback
            const sitePoints = App.objects.masterPolygon.points;
            const std = UrbanStandards.Roads[document.getElementById('road-type').value];
            const plotDepth = parseFloat(App.elements.plotDepth.value);
            const scale = App.state.scale;
            const d3 = (plotDepth + std.footpath + std.carriage) / scale;
            const d4 = (plotDepth + std.footpath + std.carriage + std.footpath) / scale;
            const pts3 = createInwardOffsetPolygon(sitePoints, d3);
            const pts4 = createInwardOffsetPolygon(sitePoints, d4);
            if (pts3.length >= 3 && pts4.length >= 3) {
                const pave = new fabric.Polygon([...pts3, ...[...pts4].reverse()], { fill: '#cccccc', stroke: '#999', strokeWidth: 0.5, selectable: false, isInfra: true });
                App.canvas.add(pave);
                App.data.generatedObjects.push(pave);
                App.objects.manualInnerBoundary = pts4; // Treat as internal island
            }
        }

        // AUTO-CREATE GREEN ISLAND (Fallback/Initial)
        if (!App.objects.roadCenterline && App.objects.manualInnerBoundary && App.objects.manualInnerBoundary.length >= 3) {
            const pts = App.objects.manualInnerBoundary;
            const pathData = pointsToPathData(pts);
            const green = new fabric.Path(pathData, {
                fill: 'rgba(76, 175, 80, 0.4)', stroke: '#2e7d32', strokeWidth: 1.5,
                selectable: true, isGreenArea: true, isGreen: true, objectCaching: false
            });
            green.points = pts;
            App.canvas.add(green);
            App.data.generatedObjects.push(green);
            green.bringToFront();
        }

        GenerativeState.wizardStep = 4;
    } else if (stepNum === 5) {
        const sitePoints = App.objects.masterPolygon.points;
        const isCCW = polygonSignedArea(sitePoints) < 0;
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const plotDepth = parseFloat(App.elements.plotDepth.value);
        const scale = App.state.scale;

        let innerBoundaryPts;
        if (App.objects.manualInnerBoundary && App.objects.manualInnerBoundary.length >= 3) {
            innerBoundaryPts = App.objects.manualInnerBoundary;
        } else if (App.objects.lastInnerBoundary && App.objects.lastInnerBoundary.length >= 3) {
            innerBoundaryPts = App.objects.lastInnerBoundary;
        } else {
            const roadOffset = std.footpath * 2 + std.carriage;
            const innerBoundaryOffsetPx = (plotDepth + roadOffset) / scale;
            innerBoundaryPts = createInwardOffsetPolygon(sitePoints, innerBoundaryOffsetPx);
        }

        if (innerBoundaryPts && innerBoundaryPts.length >= 3) {
            const pw = parseFloat(App.elements.plotWidth.value);

            // Tight bounding box (OBB) check for green area permit
            const obb = getOrientedBoundingRect(innerBoundaryPts);
            if (obb) {
                const realW = obb.width * scale;
                const realH = obb.height * scale;
                const realArea = obb.area * scale * scale;
                const minDim = Math.min(realW, realH);
                const maxDim = Math.max(realW, realH);

                // Check if area and dimensions permit at least one plot
                const minReqDim = Math.min(pw, plotDepth);
                const maxReqDim = Math.max(pw, plotDepth);

                if (realArea < (pw * plotDepth) || minDim < minReqDim || maxDim < maxReqDim) {
                    console.log("Internal green area dimensions do not permit plot placement.", { realArea, realW, realH });
                    // Still mark step as complete but no plots added
                    GenerativeState.wizardStep = 5;
                    App.canvas.renderAll();
                    updateAreaInfo();
                    return;
                }
            }

            const plots = generatePlotsAlongEdges(innerBoundaryPts, plotDepth, pw, isCCW, [], document.getElementById('density-type').value, false, document.getElementById('plot-prototype').value);
            plots.forEach(p => App.canvas.add(p));
            App.data.generatedObjects.push(...plots);
        }
        GenerativeState.wizardStep = 5;
    } else if (stepNum === 6) {
        const sitePoints = App.objects.masterPolygon.points;
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const plotDepth = parseFloat(App.elements.plotDepth.value);
        const roadOffset = std.footpath * 2 + std.carriage;
        const scale = App.state.scale;
        const analyzeOffsetPx = (plotDepth * 2 + roadOffset) / scale;
        const analyzerPts = createInwardOffsetPolygon(sitePoints, analyzeOffsetPx);
        if (analyzerPts.length >= 3) {
            const areaM2 = polygonArea(analyzerPts) * scale * scale;
            const analysisOverlay = new fabric.Polygon(analyzerPts, { fill: 'rgba(0,0,255,0.1)', stroke: '#0056b3', strokeDashArray: [10, 5], selectable: false });
            App.canvas.add(analysisOverlay);
            App.data.generatedObjects.push(analysisOverlay);
            alert(`Analysis: Area detected (${areaM2.toFixed(0)}m²). Step 7 will establish bifurcation.`);
        }
        GenerativeState.wizardStep = 6;
    } else if (stepNum === 7) {
        const sitePoints = App.objects.masterPolygon.points;
        const isCCW = polygonSignedArea(sitePoints) < 0;
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const plotDepth = parseFloat(App.elements.plotDepth.value);
        const roadOffsetM = std.footpath * 2 + std.carriage;
        const scale = App.state.scale;

        // Use manualInnerBoundary if it exists to limit bifurcation, otherwise use offset
        let subPoly;
        if (App.objects.manualInnerBoundary && App.objects.manualInnerBoundary.length >= 3) {
            subPoly = App.objects.manualInnerBoundary;
        } else {
            const innerStartOffsetPx = (plotDepth * 2 + roadOffsetM) / scale;
            subPoly = createInwardOffsetPolygon(sitePoints, innerStartOffsetPx);
        }

        if (subPoly && subPoly.length >= 3) {
            subPoly.forEach((p, idx) => {
                const pNext = subPoly[(idx + 1) % subPoly.length];
                const dx = pNext.x - p.x;
                const dy = pNext.y - p.y;
                const dist = Math.hypot(dx, dy);
                if (dist > (40 / scale)) {
                    const midX = (p.x + pNext.x) / 2;
                    const midY = (p.y + pNext.y) / 2;
                    let nx = -dy / dist, ny = dx / dist;
                    if (!isCCW) { nx = -nx; ny = -ny; }
                    const rayEnd = { x: midX + nx * 5000, y: midY + ny * 5000 };
                    let closestPt = null, minD = Infinity;
                    for (let j = 0; j < subPoly.length; j++) {
                        if (j === idx) continue;
                        const s1 = subPoly[j], s2 = subPoly[(j + 1) % subPoly.length];
                        const inter = getSegmentIntersection({ x: midX, y: midY }, rayEnd, s1, s2);
                        if (inter) {
                            const d = Math.hypot(inter.x - midX, inter.y - midY);
                            if (d > 1e-3 && d < minD) { minD = d; closestPt = inter; }
                        }
                    }
                    if (closestPt) {
                        const spine = new fabric.Line([midX, midY, closestPt.x, closestPt.y], { stroke: '#444', strokeWidth: std.carriage / scale, strokeDashArray: [5, 5], selectable: false, isInfra: true });
                        App.canvas.add(spine);
                        App.data.generatedObjects.push(spine);
                    }
                }
            });
            updateAreaInfo();
            alert("Bifurcation established. Use Step 8 to highlight.");
        }
        GenerativeState.wizardStep = 7;
    } else if (stepNum === 8) {
        const infraLines = App.data.generatedObjects.filter(o => o.isInfra && (o.type === 'line' || o.type === 'polyline'));
        if (infraLines.length === 0) return alert("Run Step 7 first.");

        // Find shortest road
        let shortest = infraLines[0], minLen = Infinity;
        infraLines.forEach(l => {
            const length = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
            if (length < minLen) { minLen = length; shortest = l; }
        });
        shortest.set({ stroke: '#ff0000', strokeWidth: 3 });
        GenerativeState.currentShortestRoad = shortest;

        // CLEANUP: Remove plots that overlap with ONLY the shortest road
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const scale = App.state.scale;
        const plotDepth = parseFloat(App.elements.plotDepth.value);
        // Clearance = road half-width + pavement + plot depth
        const clearanceBuffer = ((std.carriage / 2) + std.footpath + plotDepth) / scale;

        const plotsToRemove = [];
        App.data.generatedObjects.forEach(obj => {
            if (obj.isPlot && obj.points && !obj.isOuterPlot) {
                // Check if plot center is too close to the shortest road
                const plotCenter = {
                    x: obj.points.reduce((sum, p) => sum + p.x, 0) / obj.points.length,
                    y: obj.points.reduce((sum, p) => sum + p.y, 0) / obj.points.length
                };

                const dist = distToSegment(plotCenter, { x: shortest.x1, y: shortest.y1 }, { x: shortest.x2, y: shortest.y2 });
                if (dist < clearanceBuffer) {
                    plotsToRemove.push(obj);
                }
            }
        });

        // Remove overlapping plots
        plotsToRemove.forEach(plot => {
            App.canvas.remove(plot);
            App.data.generatedObjects = App.data.generatedObjects.filter(o => o !== plot);
        });

        alert(`Shortest road highlighted. Removed ${plotsToRemove.length} conflicting plots. Ready for Step 9.`);
        App.canvas.renderAll();
        updateAreaInfo();
    } else if (stepNum === 9) {
        const shortest = GenerativeState.currentShortestRoad;
        if (!shortest) return alert("Run Step 8 first.");

        const sitePoints = App.objects.masterPolygon.points;
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const plotDepth = parseFloat(App.elements.plotDepth.value);
        const scale = App.state.scale;

        const turningRadius = parseFloat(document.getElementById('turning-radius')?.value || 15);

        const removedCount = generateFilletedRoad(shortest, sitePoints, std, plotDepth, scale, turningRadius);

        alert(`Road filleted (R=${turningRadius}m) and connected. Removed ${removedCount} plots. Price search enabled.`);

        GenerativeState.wizardStep = 9;
    } else if (stepNum === 10) {
        updateAreaInfo();
        const greenPct = parseFloat(document.getElementById('green-area-percent').textContent);
        alert(`Green Area Analysis: ${greenPct.toFixed(2)}%. Capacity available.`);
    } else if (stepNum === 11 || stepNum === 12) {
        const shortest = GenerativeState.currentShortestRoad;
        if (!shortest) return alert("Run Step 8 first.");
        const start = { x: shortest.x1, y: shortest.y1 }, end = { x: shortest.x2, y: shortest.y2 };
        const dx = end.x - start.x, dy = end.y - start.y;
        const len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const scale = App.state.scale;
        const roadHalfWidth = (std.carriage / 2) / scale, p1Width = std.footpath / scale;
        const plotDepth = parseFloat(App.elements.plotDepth.value) / scale, plotWidth = parseFloat(App.elements.plotWidth.value) / scale;
        const side = stepNum === 11 ? 'left' : 'right', s = side === 'left' ? 1 : -1, offset = (roadHalfWidth + p1Width);
        for (let d = 0; d < len - plotWidth; d += plotWidth) {
            const pStartX = start.x + ux * d + nx * (offset * s);
            const pStartY = start.y + uy * d + ny * (offset * s);
            const plotPoints = [{ x: pStartX, y: pStartY }, { x: pStartX + ux * plotWidth, y: pStartY + uy * plotWidth }, { x: pStartX + ux * plotWidth + nx * (plotDepth * s), y: pStartY + uy * plotWidth + ny * (plotDepth * s) }, { x: pStartX + nx * (plotDepth * s), y: pStartY + ny * (plotDepth * s) }];
            const plot = new fabric.Polygon(plotPoints, { fill: '#E3F2FD', stroke: '#666', strokeWidth: 0.5, isPlot: true });
            let overlaps = false;
            for (let existing of App.data.generatedObjects) { if (existing.isPlot && existing.points && checkPolygonsOverlap(plotPoints, existing.points)) { overlaps = true; break; } }
            if (!overlaps) {
                plot.points = plotPoints; App.canvas.add(plot); App.data.generatedObjects.push(plot);
                const greenEl = document.getElementById('green-area');
                const newVal = Math.max(0, parseFloat(greenEl.value) - 0.2);
                greenEl.value = newVal; document.getElementById('green-area-val').textContent = newVal.toFixed(1);
            }
        }
    } else if (stepNum === 13) {
        // Step 13: Create Entry Road with Pavements
        if (!EntryExitState.entryPoint) {
            alert('Please set entry point first using "📍 Add Entry" button.');
            return;
        }

        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const scale = App.state.scale;
        const turningRadius = parseFloat(document.getElementById('turning-radius')?.value || 15);

        // Find ring road - robust check
        const ringRoad = App.data.generatedObjects.find(o => o.isInfra && o.type === 'polygon' && o.points) || App.objects.manualRoad;
        if (!ringRoad || !ringRoad.points) {
            alert('No ring road found. Please complete prior steps.');
            return;
        }

        // Create entry road connection
        const entryRoadObjs = createEntryExitRoad(
            EntryExitState.entryPoint,
            ringRoad.points,
            std,
            scale,
            turningRadius,
            'entry'
        );

        if (entryRoadObjs && entryRoadObjs.length > 0) {
            entryRoadObjs.forEach(obj => {
                App.canvas.add(obj);
                App.data.generatedObjects.push(obj);
            });

            // Remove conflicting plots
            const removed = removeConflictingPlots('entry', entryRoadObjs);
            alert(`Entry road created with pavements. Removed ${removed} conflicting plots.`);
        }

        GenerativeState.wizardStep = 13;
    } else if (stepNum === 14) {
        // Step 14: Create Exit Road with Pavements
        if (!EntryExitState.exitPoint) {
            alert('Please set exit point first using "🚪 Add Exit" button.');
            return;
        }

        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const scale = App.state.scale;
        const turningRadius = parseFloat(document.getElementById('turning-radius')?.value || 15);

        // Find ring road - robust check
        const ringRoad = App.data.generatedObjects.find(o => o.isInfra && o.type === 'polygon' && o.points) || App.objects.manualRoad;
        if (!ringRoad || !ringRoad.points) {
            alert('No ring road found. Please complete prior steps.');
            return;
        }

        // Create exit road connection
        const exitRoadObjs = createEntryExitRoad(
            EntryExitState.exitPoint,
            ringRoad.points,
            std,
            scale,
            turningRadius,
            'exit'
        );

        if (exitRoadObjs && exitRoadObjs.length > 0) {
            exitRoadObjs.forEach(obj => {
                App.canvas.add(obj);
                App.data.generatedObjects.push(obj);
            });

            // Remove conflicting plots
            const removed = removeConflictingPlots('exit', exitRoadObjs);

            // Final Area Calc
            const totArea = polygonArea(App.objects.masterPolygon.points) * scale * scale;
            let infra = 0, green = 0, amenity = 0;
            App.data.generatedObjects.forEach(o => {
                const a = (o.points ? polygonArea(o.points) : 0) * scale * scale;
                if (o.isInfra || o.type === 'line' || o.type === 'polyline') infra += a; // Note: Lines need width to have area
                if (o.type === 'path') { /* Complex path area calc omitted, assume simplified polygon logic usually used */ }
                if (o.fill === '#555' || o.fill === '#444444' || o.fill === '#cccccc') infra += a; // Heuristic

                if (o.isGreen || o.isGreenArea) green += a;
                if (o.isAmenity) amenity += a;
            });
            const tGreen = parseFloat(document.getElementById('green-area')?.value || 0);
            const tAmenity = parseFloat(document.getElementById('amenities-area')?.value || 0);

            const msg = `Exit road created. Removed ${removed} plots.\n\n` +
                `FINAL STATISTICS:\n` +
                `Infrastructure: ${infra.toFixed(0)} m² (${(infra / totArea * 100).toFixed(1)}%)\n` +
                `Green Area: Target ${tGreen}%, Achieved ${(green / totArea * 100).toFixed(1)}%\n` +
                `Amenities: Target ${tAmenity}%, Achieved ${(amenity / totArea * 100).toFixed(1)}%`;

            alert(msg);
        }

        GenerativeState.wizardStep = 14;
    } else if (stepNum === 15) {
        // Step 15: Show Parking
        const checkbox = document.getElementById('show-parking');
        if (checkbox) checkbox.checked = true;

        App.parking.showParking = true;
        App.parking.parallelParkingEnabled = true;

        // Regenerate roads to show parking
        const infra = App.data.generatedObjects.filter(o => o.isInfra);
        // This is a bit complex in wizard, as detailed roads were already generated.
        // We trigger a re-render/logic update if needed.
        // For simplicity in wizard, we alert.
        alert("Visitor Parking enabled on all pavements. Check the layout.");
        App.canvas.renderAll();
        GenerativeState.wizardStep = 15;
    } else if (stepNum === 16) {
        // Step 16: Show Project Report Panel
        import('./reporting.js').then(m => m.showReportPanel());
        GenerativeState.wizardStep = 16;
    } else if (stepNum === 17) {
        // Step 17: Detailed Plot Report
        import('./reporting.js').then(m => m.generateDetailedPlotReport());
        GenerativeState.wizardStep = 17;
    }
    App.canvas.renderAll();
    updateAreaInfo();
}

/**
 * Advanced Recursive Filling Logic
 */
function recursiveFill(points, depth, width, garden, isCCW, densityZone, std, protoChoice = 'mixed') {
    if (points.length < 3) return [];
    const scale = App.state.scale;
    const roadOffsetM = std.footpath * 2 + std.carriage;
    if (polygonArea(points) < (depth * width / (scale * scale)) * 0.5) return [];
    const requiredForSubdivision = (depth * 2 + garden + roadOffsetM) / scale;
    const subPoly = createInwardOffsetPolygon(points, requiredForSubdivision);
    const objs = [];
    if (subPoly.length >= 3 && polygonArea(subPoly) > (depth * width * 5 / (scale * scale))) {
        const rowA = generatePlotsAlongEdges(points, depth, width, isCCW, [], densityZone, false, protoChoice);
        objs.push(...rowA);
        const infra = generateDetailedRoad(points, depth, std.footpath, std.carriage, std.footpath, isCCW);
        objs.push(...infra);
        const nextDepth = (depth + roadOffsetM) / scale;
        const nextTarget = createInwardOffsetPolygon(points, nextDepth);
        objs.push(...recursiveFill(nextTarget, depth, width, garden, isCCW, densityZone, std, protoChoice));
    } else {
        objs.push(...fillInnerArea(points, depth, width, garden, 0, 0, densityZone, protoChoice));
    }
    return objs;
}

/**
 * Core engine for boundary-aligned plot generation.
 */
export function generatePlotsAlongEdges(points, depth, width, isCCW, excludes = [], densityZone = 'high', isInternal = false, protoChoice = 'mixed') {
    const plots = [];
    const scale = App.state.scale;
    const depthPx = depth / scale;
    const widthPx = width / scale;
    const zone = UrbanStandards.Zones[densityZone];
    const setbacks = UrbanStandards.Setbacks;
    const socialMix = UrbanStandards.SocialMix;

    for (let i = 0; i < points.length; i++) {
        const p1 = points[i], p2 = points[(i + 1) % points.length];
        const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
        if (len < zone.minFrontage / scale) continue;
        const ux = dx / len, uy = dy / len;
        let nx = -uy, ny = ux;
        if (!isCCW) { nx = -nx; ny = -ny; }

        // Robustness check: Ensure normal points INWARD. 
        // Samples a point along the normal and checks if it is inside the polygon points.
        const testPt = { x: (p1.x + p2.x) / 2 + nx * 0.1, y: (p1.y + p2.y) / 2 + ny * 0.1 };
        if (!isPointInPolygon(testPt, points)) {
            nx = -nx; ny = -ny;
        }

        for (let d = 0; d < len - 1e-3;) {
            const protoKey = (protoChoice && protoChoice !== 'mixed') ? protoChoice : getRandomPrototypeByMix();
            const protoInfo = getPrototypeByShape(protoKey);
            let targetWidth = width;
            if (protoChoice === 'mixed' && protoInfo && protoInfo.plotSize) targetWidth = Math.max(zone.minFrontage, protoInfo.plotSize.typical / depth);
            let currentWidthPx = targetWidth / scale;
            if (d + currentWidthPx > len) currentWidthPx = len - d;
            if (currentWidthPx < (zone.minFrontage / scale) * 0.8) break;

            const startX = p1.x + ux * d, startY = p1.y + uy * d;
            const plotPoints = [{ x: startX, y: startY }, { x: startX + ux * currentWidthPx, y: startY + uy * currentWidthPx }, { x: startX + ux * currentWidthPx + nx * depthPx, y: startY + uy * currentWidthPx + ny * depthPx }, { x: startX + nx * depthPx, y: startY + ny * depthPx }];

            const fSet = setbacks.front / scale, rSet = setbacks.rear / scale, sSet = setbacks.side / scale;
            const proto = UrbanStandards.Prototypes[protoKey];
            const footprintData = proto.getFootprints(currentWidthPx, depthPx, fSet, rSet, sSet);
            const rand = Math.random();
            let socialType = rand < socialMix.affordable ? 'EWS/LIG' : (rand < socialMix.affordable + socialMix.midIncome ? 'MIG' : 'HIG');
            let fillColor = socialType === 'EWS/LIG' ? '#F5F5F5' : (socialType === 'MIG' ? zone.color : '#FFF9C4');

            const buildingPolys = footprintData.map(polyPts => {
                const worldPts = polyPts.map(lp => ({ x: startX + ux * lp.x + nx * lp.y, y: startY + uy * lp.x + ny * lp.y }));
                return new fabric.Polygon(worldPts, { fill: proto.color || 'rgba(255,255,255,0.6)', stroke: '#333', strokeWidth: 0.5, selectable: false });
            });

            const plotGroup = new fabric.Group([
                new fabric.Polygon(plotPoints, { fill: fillColor, stroke: '#666', strokeWidth: 0.5 }),
                ...buildingPolys,
                new fabric.Text(`${socialType}\n${protoKey}`, { fontSize: 7, left: startX + 3, top: startY + 3, fill: '#444', fontStyle: 'italic', selectable: false })
            ], { isPlot: true, area: (currentWidthPx * depthPx) * scale * scale, socialType: socialType, protoType: protoKey, selectable: false });
            plotGroup.points = plotPoints;

            let hasOverlap = false;
            // Check against current plots and excluded objects
            for (const existing of [...plots, ...excludes]) {
                if (existing.points && checkPolygonsOverlap(plotGroup.points, existing.points)) {
                    hasOverlap = true;
                    break;
                }
            }
            if (!hasOverlap) plots.push(plotGroup);
            d += currentWidthPx;
        }
    }
    return plots;
}

/**
 * Robust Separating Axis Theorem (SAT)
 */
function checkPolygonsOverlap(pts1, pts2) {
    const polygons = [pts1, pts2];
    for (let i = 0; i < polygons.length; i++) {
        const polygon = polygons[i];
        for (let i1 = 0; i1 < polygon.length; i1++) {
            const i2 = (i1 + 1) % polygon.length;
            const p1 = polygon[i1], p2 = polygon[i2];
            const normal = { x: p2.y - p1.y, y: p1.x - p2.x };
            let minA = null, maxA = null;
            for (const p of pts1) { const proj = normal.x * p.x + normal.y * p.y; if (minA === null || proj < minA) minA = proj; if (maxA === null || proj > maxA) maxA = proj; }
            let minB = null, maxB = null;
            for (const p of pts2) { const proj = normal.x * p.x + normal.y * p.y; if (minB === null || proj < minB) minB = proj; if (maxB === null || proj > maxB) maxB = proj; }
            if (maxA <= minB + 0.1 || maxB <= minA + 0.1) return false;
        }
    }
    return true;
}

function generateDetailedRoad(points, plotDepth, p1Width, roadWidth, p2Width, isCCW) {
    const scale = App.state.scale, visuals = [];
    const d1 = plotDepth / scale;
    const d2 = (plotDepth + p1Width) / scale;
    const d3 = (plotDepth + p1Width + roadWidth) / scale;
    const d4 = (plotDepth + p1Width + roadWidth + p2Width) / scale;
    const pts1 = createInwardOffsetPolygon(points, d1), pts2 = createInwardOffsetPolygon(points, d2);
    const pts3 = createInwardOffsetPolygon(points, d3), pts4 = createInwardOffsetPolygon(points, d4);
    if (pts1.length < 3 || pts2.length < 3) return [];

    const pave1 = new fabric.Polygon([...pts1, ...[...pts2].reverse()], {
        fill: '#cccccc', stroke: '#999', strokeWidth: 0.5, selectable: false, isInfra: true, isPavement: true
    });
    pave1.area = polygonArea(pave1.points) * scale * scale;
    visuals.push(pave1);

    if (pts3.length >= 3) {
        const road = new fabric.Polygon([...pts2, ...[...pts3].reverse()], {
            fill: '#444444', stroke: '#222', strokeWidth: 0.5, selectable: false, isInfra: true, isRoad: true
        });
        road.area = polygonArea(road.points) * scale * scale;
        visuals.push(road);

        const centerOffset = (plotDepth + p1Width + roadWidth / 2) / scale;
        const centerLinePts = createInwardOffsetPolygon(points, centerOffset);
        if (centerLinePts.length >= 2) {
            visuals.push(new fabric.Polyline(centerLinePts, { stroke: '#ffffff', strokeWidth: 1, strokeDashArray: [10, 10], selectable: false, isInfra: true }));
        }
    }

    if (pts3.length >= 3 && pts4.length >= 3) {
        const pave2 = new fabric.Polygon([...pts3, ...[...pts4].reverse()], {
            fill: '#cccccc', stroke: '#999', strokeWidth: 0.5, selectable: false, isInfra: true, isPavement: true
        });
        pave2.area = polygonArea(pave2.points) * scale * scale;
        visuals.push(pave2);

        if (App.parking.parallelParkingEnabled && App.parking.showParking) {
            const intervalPx = App.parking.interval / scale, boxWPx = 2.4 / scale, boxLPx = 6.0 / scale;

            // Side 1: Outer Pavement (along pts2, going outwards)
            if (pts2.length >= 2) {
                for (let i = 0; i < pts2.length; i++) {
                    const p1 = pts2[i], p2 = pts2[(i + 1) % pts2.length], dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
                    if (len < boxLPx) continue;
                    const ux = dx / len, uy = dy / len;
                    let nx = -uy, ny = ux; if (!isCCW) { nx = -nx; ny = -ny; }
                    // For side 1, we want to go AWAY from the road (opposite of the inward normal)
                    const pnx = -nx, pny = -ny;
                    for (let d = 0; d < len - boxLPx; d += intervalPx) {
                        const startX = p1.x + ux * d, startY = p1.y + uy * d;
                        const park = new fabric.Polygon([
                            { x: startX, y: startY },
                            { x: startX + ux * boxLPx, y: startY + uy * boxLPx },
                            { x: startX + ux * boxLPx + pnx * boxWPx, y: startY + uy * boxLPx + pny * boxWPx },
                            { x: startX + pnx * boxWPx, y: startY + pny * boxWPx }
                        ], { fill: 'rgba(255, 255, 255, 0.4)', stroke: '#fff', strokeWidth: 0.5, selectable: false, isParking: true, isInfra: true });
                        park.area = (boxLPx * boxWPx) * scale * scale;
                        visuals.push(park);
                    }
                }
            }

            // Side 2: Inner Pavement (along pts3, going inwards)
            if (pts3.length >= 2) {
                for (let i = 0; i < pts3.length; i++) {
                    const p1 = pts3[i], p2 = pts3[(i + 1) % pts3.length], dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
                    if (len < boxLPx) continue;
                    const ux = dx / len, uy = dy / len;
                    let nx = -uy, ny = ux; if (!isCCW) { nx = -nx; ny = -ny; }
                    // For side 2, the inward normal ALREADY points into the pavement
                    for (let d = 0; d < len - boxLPx; d += intervalPx) {
                        const startX = p1.x + ux * d, startY = p1.y + uy * d;
                        const park = new fabric.Polygon([
                            { x: startX, y: startY },
                            { x: startX + ux * boxLPx, y: startY + uy * boxLPx },
                            { x: startX + ux * boxLPx + nx * boxWPx, y: startY + uy * boxLPx + ny * boxWPx },
                            { x: startX + nx * boxWPx, y: startY + ny * boxWPx }
                        ], { fill: 'rgba(255, 255, 255, 0.4)', stroke: '#fff', strokeWidth: 0.5, selectable: false, isParking: true, isInfra: true });
                        park.area = (boxLPx * boxWPx) * scale * scale;
                        visuals.push(park);
                    }
                }
            }
        }
    }
    return visuals;
}

// Helpers were moved to utils.js and division methods refactored into js/division_method/

export function renderSolution(solution) {
    clearGeneratedLayout();

    const analysisReport = document.getElementById('analysis-report');
    if (analysisReport) analysisReport.style.display = 'block';

    const onlyInfra = document.getElementById('infra-only-view')?.checked;

    solution.objects.forEach(obj => {
        if (onlyInfra && !obj.isInfra) return;
        App.canvas.add(obj);
    });
    App.data.generatedObjects.push(...solution.objects);

    if (onlyInfra) {
        document.getElementById('infra-metrics').style.display = 'block';
        document.getElementById('infra-length').textContent = solution.summary.roadLength.toFixed(0);
        document.getElementById('infra-area').textContent = solution.summary.infraArea.toFixed(0);
    } else {
        document.getElementById('infra-metrics').style.display = 'none';
    }

    const siteArea = polygonArea(App.objects.masterPolygon.points) * App.state.scale * App.state.scale;
    const kpis = calculateKPIs(solution, siteArea);
    const kpiEl = document.getElementById('kpi-report');
    const parkingCount = solution.objects.filter(o => o.isParking).length;

    if (kpiEl) {
        kpiEl.innerHTML = `
        <div class="control-item"><span>Density:</span><b>${kpis.densityEfficiency.toFixed(1)} plots/ha</b></div>
        <div class="control-item"><span>Green Pervious:</span><b>${kpis.greenPercentage.toFixed(1)} %</b></div>
        <div class="control-item"><span>Open Space Ratio:</span><b>${kpis.openSpaceRatio.toFixed(2)}</b></div>
        <div class="control-item"><span>Infra Index:</span><b>${kpis.infrastructureCostIndex.toFixed(2)}</b></div>
        <div class="control-item"><span>Visitor Parking:</span><b>${parkingCount} / ${App.parking.visitorGoal}</b></div>
        <hr>
        <div class="control-item"><span>Social Mix:</span><b>${kpis.socialMix['EWS/LIG'] || 0} / ${kpis.socialMix['MIG'] || 0} / ${kpis.socialMix['HIG'] || 0}</b></div>
    `;
    }

    if (!App.parking.manualOverride) {
        const plotCount = solution.objects.filter(o => o.isPlot).length;
        const autoGoal = Math.ceil(plotCount * 0.1);
        App.parking.visitorGoal = autoGoal;
        const slider = document.getElementById('visitor-parking-slider');
        const valLabel = document.getElementById('visitor-parking-val');
        if (slider) slider.value = autoGoal;
        if (valLabel) valLabel.textContent = autoGoal;
    }
    App.canvas.renderAll();
    updateAreaInfo();
}

export function updateGallery() {
    const gallery = document.getElementById('solutions-gallery');
    gallery.innerHTML = '';
    GenerativeState.solutions.forEach((sol, idx) => {
        const item = document.createElement('div');
        item.className = 'solution-item';
        if (idx === GenerativeState.currentSolutionIndex) item.classList.add('active');

        const s = sol.summary;
        item.innerHTML = `
            <img src="${sol.thumbnail}" alt="Solution ${idx}">
            <div class="sol-info">
                <span class="label"><b>${sol.name}</b></span>
                <div class="sol-stat">
                    <span><b>${s.plots}</b> Plots</span>
                    <span><b>${s.roadLength.toFixed(0)}m</b> Road</span>
                </div>
                <div class="stacked-progress" title="Land Use: Plots(${s.plotPct.toFixed(1)}%), Green(${s.greenPct.toFixed(1)}%), Amenity(${s.amenityPct.toFixed(1)}%), Roads(${s.infraPct.toFixed(1)}%)">
                    <div class="stacked-fill" style="width:${s.plotPct}%; background:#2196F3;"></div>
                    <div class="stacked-fill" style="width:${s.greenPct}%; background:#4CAF50;"></div>
                    <div class="stacked-fill" style="width:${s.amenityPct}%; background:#FFC107;"></div>
                    <div class="stacked-fill" style="width:${s.infraPct}%; background:#9E9E9E;"></div>
                </div>
                <div style="font-size: 9px; color: #777;">
                    Infra Area: ${s.infraArea.toFixed(0)}m²
                </div>
            </div>
        `;
        item.onclick = () => { GenerativeState.currentSolutionIndex = idx; renderSolution(sol); updateGallery(); };
        gallery.appendChild(item);
    });
}

/**
 * Helper to generate filleted road for Step 9
 */
function generateFilletedRoad(shortest, sitePoints, std, plotDepth, scale, turningRadius) {
    // 1. Calculate Ring Road Inner Edge
    const roadOuterOffset = plotDepth + std.footpath;
    const roadInnerOffset = roadOuterOffset + std.carriage;
    const ringRoadInnerPoly = createInwardOffsetPolygon(sitePoints, roadInnerOffset / scale);

    // 2. Extend shortest road and find intersection info (tangents)
    let start = { x: shortest.x1, y: shortest.y1 };
    let end = { x: shortest.x2, y: shortest.y2 };
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const nx = -uy, ny = ux; // Road Normal

    let extendedStart = start, extendedEnd = end;
    let startDistMin = Infinity, endDistMin = Infinity;
    let startTangent = { x: nx, y: ny }, endTangent = { x: nx, y: ny }; // Default to perpendicular

    for (let i = 0; i < ringRoadInnerPoly.length; i++) {
        const p1 = ringRoadInnerPoly[i];
        const p2 = ringRoadInnerPoly[(i + 1) % ringRoadInnerPoly.length];

        // Tangent of ring road segment
        const segDx = p2.x - p1.x;
        const segDy = p2.y - p1.y;
        const segLen = Math.hypot(segDx, segDy);
        const tx = segDx / segLen, ty = segDy / segLen;

        // Backward from start
        const rayStart = { x: start.x, y: start.y };
        const rayEndBackward = { x: start.x - ux * 10000, y: start.y - uy * 10000 };
        const intStart = getSegmentIntersection(rayStart, rayEndBackward, p1, p2);
        if (intStart) {
            const d = Math.hypot(intStart.x - start.x, intStart.y - start.y);
            if (d < startDistMin) {
                startDistMin = d;
                extendedStart = intStart;
                startTangent = { x: tx, y: ty };
            }
        }

        // Forward from end
        const rayEndForward = { x: end.x + ux * 10000, y: end.y + uy * 10000 };
        const intEnd = getSegmentIntersection(end, rayEndForward, p1, p2);
        if (intEnd) {
            const d = Math.hypot(intEnd.x - end.x, intEnd.y - end.y);
            if (d < endDistMin) {
                endDistMin = d;
                extendedEnd = intEnd;
                endTangent = { x: tx, y: ty };
            }
        }
    }

    start = extendedStart;
    end = extendedEnd;
    shortest.set({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });

    // 3. Generate Filleted Paths
    const roadHalfWidth = (std.carriage / 2) / scale;
    const p1Width = std.footpath / scale;
    const radiusPx = turningRadius / scale;

    const alignTangent = (t, n) => {
        if (t.x * n.x + t.y * n.y < 0) return { x: -t.x, y: -t.y };
        return t;
    };

    const tStart = alignTangent(startTangent, { x: nx, y: ny });
    const tEnd = alignTangent(endTangent, { x: nx, y: ny });

    const createFilletPathStr = (widthOffset) => {
        const r = radiusPx + (widthOffset - roadHalfWidth);
        const w = widthOffset;

        const sr_c = { x: start.x + nx * w, y: start.y + ny * w };
        const sr_road = { x: sr_c.x + ux * r, y: sr_c.y + uy * r };
        const sr_ring = { x: sr_c.x + tStart.x * r, y: sr_c.y + tStart.y * r };

        const er_c = { x: end.x + nx * w, y: end.y + ny * w };
        const er_road = { x: er_c.x - ux * r, y: er_c.y - uy * r };
        const er_ring = { x: er_c.x + tEnd.x * r, y: er_c.y + tEnd.y * r };

        const el_c = { x: end.x - nx * w, y: end.y - ny * w };
        const el_road = { x: el_c.x - ux * r, y: el_c.y - uy * r };
        const el_ring = { x: el_c.x - tEnd.x * r, y: el_c.y - tEnd.y * r };

        const sl_c = { x: start.x - nx * w, y: start.y - ny * w };
        const sl_road = { x: sl_c.x + ux * r, y: sl_c.y + uy * r };
        const sl_ring = { x: sl_c.x - tStart.x * r, y: sl_c.y - tStart.y * r };

        return `M ${sr_ring.x} ${sr_ring.y} Q ${sr_c.x} ${sr_c.y} ${sr_road.x} ${sr_road.y} ` +
            `L ${er_road.x} ${er_road.y} Q ${er_c.x} ${er_c.y} ${er_ring.x} ${er_ring.y} ` +
            `L ${el_ring.x} ${el_ring.y} Q ${el_c.x} ${el_c.y} ${el_road.x} ${el_road.y} ` +
            `L ${sl_road.x} ${sl_road.y} Q ${sl_c.x} ${sl_c.y} ${sl_ring.x} ${sl_ring.y} Z`;
    };

    const roadPathStr = createFilletPathStr(roadHalfWidth);
    const pavePathStr = createFilletPathStr(roadHalfWidth + p1Width);

    const pavePath = new fabric.Path(pavePathStr, { fill: '#ccc', stroke: '#999', strokeWidth: 1, selectable: false, isInfra: true });
    const roadPath = new fabric.Path(roadPathStr, { fill: '#444', stroke: '#222', strokeWidth: 1, selectable: false, isInfra: true });

    App.canvas.add(pavePath, roadPath);
    App.data.generatedObjects.push(pavePath, roadPath);

    // 4. Cleanup
    const buffer = roadHalfWidth + p1Width + radiusPx;
    const conflictPoints = [
        { x: start.x + nx * buffer, y: start.y + ny * buffer },
        { x: end.x + nx * buffer, y: end.y + ny * buffer },
        { x: end.x - nx * buffer, y: end.y - ny * buffer },
        { x: start.x - nx * buffer, y: start.y - ny * buffer }
    ];

    const conflictRect = [
        { x: start.x + nx * (roadHalfWidth + p1Width), y: start.y + ny * (roadHalfWidth + p1Width) },
        { x: end.x + nx * (roadHalfWidth + p1Width), y: end.y + ny * (roadHalfWidth + p1Width) },
        { x: end.x - nx * (roadHalfWidth + p1Width), y: end.y - ny * (roadHalfWidth + p1Width) },
        { x: start.x - nx * (roadHalfWidth + p1Width), y: start.y - ny * (roadHalfWidth + p1Width) }
    ];

    const plotsToRemove = [];
    App.data.generatedObjects.forEach(obj => {
        if (obj.isPlot && obj.points && !obj.isOuterPlot) {
            if (checkPolygonsOverlap(obj.points, conflictPoints) || checkPolygonsOverlap(obj.points, conflictRect)) {
                plotsToRemove.push(obj);
            }
        }
    });

    plotsToRemove.forEach(p => {
        App.canvas.remove(p);
        App.data.generatedObjects = App.data.generatedObjects.filter(o => o !== p);
    });

    // 5. Bifurcate ANY Green Areas that the final road crosses
    const allGreens = App.data.generatedObjects.filter(o => o.isGreenArea && o.points);
    const roadGap = (roadHalfWidth + p1Width) * 2;

    allGreens.forEach(targetGreen => {
        const [sub1, sub2] = splitPolygonGeneral(targetGreen.points, start, end, roadGap);
        if (sub1 && sub1.length > 2 && sub2 && sub2.length > 2) {
            App.canvas.remove(targetGreen);
            App.data.generatedObjects = App.data.generatedObjects.filter(o => o !== targetGreen);
            [sub1, sub2].forEach(subPts => {
                const pathData = pointsToPathData(subPts);
                const g = new fabric.Path(pathData, {
                    fill: 'rgba(76, 175, 80, 0.4)', stroke: '#2e7d32', strokeWidth: 1.5,
                    selectable: true, isGreenArea: true, isGreen: true, objectCaching: false
                });
                g.points = subPts;
                App.canvas.add(g);
                App.data.generatedObjects.push(g);
            });
        }
    });

    return plotsToRemove.length;
}

/**
 * Fillets the corners of a polygon path
 * @param {Array} points - Array of {x,y}
 * @param {Number} radius - Fillet radius in pixels
 * @returns {String} SVG Path string
 */
function getFilletedPolygonPath(points, radius) {
    if (!points || points.length < 3) return "";
    let path = "";
    const len = points.length;

    for (let i = 0; i < len; i++) {
        const p0 = points[(i - 1 + len) % len];
        const p1 = points[i];
        const p2 = points[(i + 1) % len];

        // Vectors pointing OUT from corner p1
        const v1 = { x: p0.x - p1.x, y: p0.y - p1.y };
        const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const l1 = Math.hypot(v1.x, v1.y);
        const l2 = Math.hypot(v2.x, v2.y);

        // Normalize
        const u1 = { x: v1.x / l1, y: v1.y / l1 };
        const u2 = { x: v2.x / l2, y: v2.y / l2 };

        // Angle between vectors
        // Dot product
        const dot = u1.x * u2.x + u1.y * u2.y;
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))); // Clamp for safety

        // Half angle tangent
        // If angle is near PI (straight line), tan is huge.
        const halfTan = Math.tan(angle / 2);

        // Distance from corner to tangent points
        // d = r / tan(theta/2). 
        // Note: For sharp corners (small angle), tan is small, d is large.
        // For flat corners (large angle), tan is large, d is small.

        // Safe check for colinear
        if (halfTan < 1e-6) {
            if (i === 0) path += `M ${p1.x} ${p1.y} `;
            else path += `L ${p1.x} ${p1.y} `;
            continue;
        }

        let d = radius / halfTan;

        // Clamp d to avoid overlap (max half length of segment)
        // This is a naive clamp, checking only adjacent segments
        const limit = Math.min(l1, l2) * 0.45;
        if (d > limit) d = limit;

        const t1 = { x: p1.x + u1.x * d, y: p1.y + u1.y * d };
        const t2 = { x: p1.x + u2.x * d, y: p1.y + u2.y * d };

        // Control point is p1
        if (i === 0) {
            path += `M ${t1.x} ${t1.y} `;
        } else {
            path += `L ${t1.x} ${t1.y} `;
        }
        path += `Q ${p1.x} ${p1.y} ${t2.x} ${t2.y} `;
    }
    path += "Z";
    return path;
}

