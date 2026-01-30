//--- START OF FILE js/generative.js ---

import { App } from './appState.js';
import { clearGeneratedLayout, updateAreaInfo } from './ui.js';
import { polygonArea, offsetPolyline, createInwardOffsetPolygon, pointsToPathData, isPointInPolygon, polygonSignedArea, getSegmentIntersection, distToSegment } from './utils.js';
import { UrbanStandards, calculateKPIs } from './standards.js';
import { getRandomPrototypeByMix, getPrototypeByShape } from './prototype.js';

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
        prototypeChoice: document.getElementById('plot-prototype').value
    };

    // Variation settings for generative design (Generate 20 options)
    const variations = [];
    for (let i = 0; i < 20; i++) {
        variations.push({
            name: `Option ${i + 1}`,
            plotDepthMult: 0.8 + (Math.random() * 0.5),
            plotWidthMult: 0.9 + (Math.random() * 0.2),
            gardenArea: Math.floor(Math.random() * 15),
            infraShift: (Math.random() - 0.5) * 5
        });
    }

    for (let i = 0; i < variations.length; i++) {
        const variant = variations[i];
        const solution = createSolution(baseParams, variant, i);
        GenerativeState.solutions.push(solution);

        // Temporarily render and take screenshot
        renderSolution(solution);
        await new Promise(r => setTimeout(r, 100)); // Allow canvas to render
        solution.thumbnail = App.canvas.toDataURL({ format: 'webp', quality: 0.5 });
    }

    // Clear canvas and show gallery
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

    const sitePoints = App.objects.masterPolygon.points;
    const isCCW = polygonSignedArea(sitePoints) < 0;
    const scale = App.state.scale;

    // 1. Boundary Offset for First Row of Plots
    const row1Plots = generatePlotsAlongEdges(sitePoints, plotDepth, base.plotWidth * variant.plotWidthMult, isCCW, [], base.densityStandard);
    objects.push(...row1Plots);

    // 2. Infrastructure Corridor (Pavement 1 + Road + Pavement 2)
    const infraVisuals = generateDetailedRoad(sitePoints, plotDepth, base.pavementLeft, base.roadWidth, base.pavementRight, isCCW);
    objects.push(...infraVisuals);

    // 3. Inner Space Analysis with DIFFERENT BIFURCATION METHODS
    const p2OffsetPx = (plotDepth + base.pavementLeft + base.roadWidth + base.pavementRight) / scale;
    const remainderPolyPts = createInwardOffsetPolygon(sitePoints, p2OffsetPx);

    if (remainderPolyPts.length >= 3) {
        const totalSiteArea = polygonArea(sitePoints) * scale * scale;
        const targetGreenArea = totalSiteArea * base.greenPct;
        const targetAmenityArea = totalSiteArea * base.amenitiesPct;

        // Choose bifurcation method based on solution index
        const bifurcationMethod = index % 4; // 0: Grid, 1: Radial, 2: Organic, 3: Hybrid

        let innerPlots;
        switch (bifurcationMethod) {
            case 0: // Grid Bifurcation
                innerPlots = fillInnerAreaWithGridBifurcation(remainderPolyPts, plotDepth, base.plotWidth, gardenDepth, base.densityStandard, base.prototypeChoice);
                break;
            case 1: // Radial Bifurcation
                innerPlots = fillInnerAreaWithRadialBifurcation(remainderPolyPts, plotDepth, base.plotWidth, gardenDepth, base.densityStandard, base.prototypeChoice);
                break;
            case 2: // Organic Bifurcation
                innerPlots = fillInnerAreaWithOrganicBifurcation(remainderPolyPts, plotDepth, base.plotWidth, gardenDepth, base.densityStandard, base.prototypeChoice);
                break;
            case 3: // Hybrid Bifurcation
                innerPlots = fillInnerArea(remainderPolyPts, plotDepth, base.plotWidth, gardenDepth, targetGreenArea, targetAmenityArea, base.densityStandard, base.prototypeChoice);
                break;
        }
        objects.push(...innerPlots);
    }

    return {
        id: index,
        name: `${variant.name} (${['Grid', 'Radial', 'Organic', 'Hybrid'][index % 4]})`,
        params: { ...base, ...variant },
        objects: objects,
        bifurcationType: ['Grid', 'Radial', 'Organic', 'Hybrid'][index % 4],
        summary: {
            plots: objects.filter(o => o.isPlot).length,
            infraArea: roadOffset * 100,
            greenArea: base.greenPct * 1000
        }
    };
}

// --- Step-by-Step Wizard Logic ---

export function runWizardStep(stepNum) {
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
        plots.forEach(p => App.canvas.add(p));
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
        if (pts2.length >= 3 && pts3.length >= 3) {
            const road = new fabric.Polygon([...pts2, ...[...pts3].reverse()], { fill: '#444444', stroke: '#222', strokeWidth: 0.5, selectable: false });
            App.canvas.add(road);
            App.data.generatedObjects.push(road);
            const centerOffset = (plotDepth + std.footpath + std.carriage / 2) / scale;
            const centerLinePts = createInwardOffsetPolygon(sitePoints, centerOffset);
            if (centerLinePts.length >= 2) {
                const line = new fabric.Polyline(centerLinePts, { stroke: '#ffffff', strokeWidth: 1, strokeDashArray: [10, 10], selectable: false });
                App.canvas.add(line);
                App.data.generatedObjects.push(line);
            }
        }
        GenerativeState.wizardStep = 3;
    } else if (stepNum === 4) {
        const sitePoints = App.objects.masterPolygon.points;
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const plotDepth = parseFloat(App.elements.plotDepth.value);
        const scale = App.state.scale;
        const d3 = (plotDepth + std.footpath + std.carriage) / scale;
        const d4 = (plotDepth + std.footpath + std.carriage + std.footpath) / scale;
        const pts3 = createInwardOffsetPolygon(sitePoints, d3);
        const pts4 = createInwardOffsetPolygon(sitePoints, d4);
        if (pts3.length >= 3 && pts4.length >= 3) {
            const pave = new fabric.Polygon([...pts3, ...[...pts4].reverse()], { fill: '#cccccc', stroke: '#999', strokeWidth: 0.5, selectable: false });
            App.canvas.add(pave);
            App.data.generatedObjects.push(pave);
        }
        GenerativeState.wizardStep = 4;
    } else if (stepNum === 5) {
        const sitePoints = App.objects.masterPolygon.points;
        const isCCW = polygonSignedArea(sitePoints) < 0;
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const plotDepth = parseFloat(App.elements.plotDepth.value);
        const roadOffset = std.footpath * 2 + std.carriage;
        const scale = App.state.scale;
        const innerBoundaryOffsetPx = (plotDepth + roadOffset) / scale;
        const innerBoundaryPts = createInwardOffsetPolygon(sitePoints, innerBoundaryOffsetPx);
        if (innerBoundaryPts.length >= 3) {
            const plots = generatePlotsAlongEdges(innerBoundaryPts, plotDepth, parseFloat(App.elements.plotWidth.value), isCCW, [], document.getElementById('density-type').value, false, document.getElementById('plot-prototype').value);
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
        const innerStartOffsetPx = (plotDepth * 2 + roadOffsetM) / scale;
        const subPoly = createInwardOffsetPolygon(sitePoints, innerStartOffsetPx);
        if (subPoly.length >= 3) {
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
            alert("Bifurcation established. Use Step 8 to highlight the shortest road.");
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
            if (obj.isPlot && obj.points) {
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
        const start = { x: shortest.x1, y: shortest.y1 }, end = { x: shortest.x2, y: shortest.y2 };
        const dx = end.x - start.x, dy = end.y - start.y;
        const len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
        const std = UrbanStandards.Roads[document.getElementById('road-type').value];
        const scale = App.state.scale;
        const roadHalfWidth = (std.carriage / 2) / scale;
        const p1Width = std.footpath / scale;
        const roadPoly = new fabric.Polygon([
            { x: start.x + nx * roadHalfWidth, y: start.y + ny * roadHalfWidth },
            { x: end.x + nx * roadHalfWidth, y: end.y + ny * roadHalfWidth },
            { x: end.x - nx * roadHalfWidth, y: end.y - ny * roadHalfWidth },
            { x: start.x - nx * roadHalfWidth, y: start.y - ny * roadHalfWidth }
        ], { fill: '#444', selectable: false, isInfra: true });
        const paveL = new fabric.Polygon([
            { x: start.x + nx * (roadHalfWidth), y: start.y + ny * (roadHalfWidth) },
            { x: end.x + nx * (roadHalfWidth), y: end.y + ny * (roadHalfWidth) },
            { x: end.x + nx * (roadHalfWidth + p1Width), y: end.y + ny * (roadHalfWidth + p1Width) },
            { x: start.x + nx * (roadHalfWidth + p1Width), y: start.y + ny * (roadHalfWidth + p1Width) }
        ], { fill: '#ccc', selectable: false, isInfra: true });
        const paveR = new fabric.Polygon([
            { x: start.x - nx * (roadHalfWidth), y: start.y - ny * (roadHalfWidth) },
            { x: end.x - nx * (roadHalfWidth), y: end.y - ny * (roadHalfWidth) },
            { x: end.x - nx * (roadHalfWidth + p1Width), y: end.y - ny * (roadHalfWidth + p1Width) },
            { x: start.x - nx * (roadHalfWidth + p1Width), y: start.y - ny * (roadHalfWidth + p1Width) }
        ], { fill: '#ccc', selectable: false, isInfra: true });
        App.canvas.add(roadPoly, paveL, paveR);
        App.data.generatedObjects.push(roadPoly, paveL, paveR);
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
 * Generates plots aligned to the polygon segments.
 */
function generatePlotsAlongEdges(points, depth, width, isCCW, existingObjects = [], densityZone = 'mediumDensity', flipRotation = false, prototypeChoice = 'mixed') {
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
        if (flipRotation) { nx = -nx; ny = -ny; }

        for (let d = 0; d < len - 1e-3;) {
            const protoKey = (prototypeChoice && prototypeChoice !== 'mixed') ? prototypeChoice : getRandomPrototypeByMix();
            const protoInfo = getPrototypeByShape(protoKey);
            let targetWidth = width;
            if (prototypeChoice === 'mixed' && protoInfo && protoInfo.plotSize) targetWidth = Math.max(zone.minFrontage, protoInfo.plotSize.typical / depth);
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
            for (const existing of [...plots, ...existingObjects]) { if (existing.isPlot && checkPolygonsOverlap(plotGroup.points, existing.points)) { hasOverlap = true; break; } }
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
    visuals.push(new fabric.Polygon([...pts1, ...[...pts2].reverse()], { fill: '#cccccc', stroke: '#999', strokeWidth: 0.5, selectable: false }));
    if (pts3.length >= 3) {
        visuals.push(new fabric.Polygon([...pts2, ...[...pts3].reverse()], { fill: '#444444', stroke: '#222', strokeWidth: 0.5, selectable: false }));
        const centerOffset = (plotDepth + p1Width + roadWidth / 2) / scale;
        const centerLinePts = createInwardOffsetPolygon(points, centerOffset);
        if (centerLinePts.length >= 2) visuals.push(new fabric.Polyline(centerLinePts, { stroke: '#ffffff', strokeWidth: 1, strokeDashArray: [10, 10], selectable: false }));
    }
    if (pts3.length >= 3 && pts4.length >= 3) {
        visuals.push(new fabric.Polygon([...pts3, ...[...pts4].reverse()], { fill: '#cccccc', stroke: '#999', strokeWidth: 0.5, selectable: false }));
        if (App.parking.parallelParkingEnabled && App.parking.showParking) {
            const intervalPx = App.parking.interval / scale, boxWPx = 2.4 / scale, boxLPx = 6.0 / scale;
            for (let i = 0; i < pts3.length; i++) {
                const p1 = pts3[i], p2 = pts3[(i + 1) % pts3.length], dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
                if (len < boxLPx) continue;
                const ux = dx / len, uy = dy / len;
                let nx = -uy, ny = ux; if (!isCCW) { nx = -nx; ny = -ny; }
                for (let d = 0; d < len - boxLPx; d += intervalPx) {
                    const startX = p1.x + ux * d, startY = p1.y + uy * d;
                    visuals.push(new fabric.Polygon([{ x: startX, y: startY }, { x: startX + ux * boxLPx, y: startY + uy * boxLPx }, { x: startX + ux * boxLPx + nx * boxWPx, y: startY + uy * boxLPx + ny * boxWPx }, { x: startX + nx * boxWPx, y: startY + ny * boxWPx }], { fill: 'rgba(255, 255, 255, 0.4)', stroke: '#fff', strokeWidth: 0.5, selectable: false, isParking: true }));
                }
            }
        }
    }
    return visuals;
}

function fillInnerArea(points, depth, width, garden, targetGreen, targetAmenity, densityZone, protoChoice = 'mixed') {
    const plots = [], scale = App.state.scale;
    const requiredDouble = (depth * 2 + garden) / scale, requiredSingle = (depth + garden) / scale;
    const doublePts = createInwardOffsetPolygon(points, requiredDouble), singlePts = createInwardOffsetPolygon(points, requiredSingle);
    if (doublePts.length >= 3) {
        const rowA = generatePlotsAlongEdges(points, depth, width, false, plots, densityZone, false, protoChoice);
        const innerBound = createInwardOffsetPolygon(points, (depth + garden) / scale);
        const rowB = generatePlotsAlongEdges(innerBound, depth, width, false, [...plots, ...rowA], densityZone, false, protoChoice);
        plots.push(...rowA, ...rowB);
    } else if (singlePts.length >= 3) {
        const row = generatePlotsAlongEdges(points, depth, width, false, plots, densityZone, false, protoChoice);
        plots.push(...row);
        const pockets = divideIntoPockets(singlePts, 3);
        pockets.forEach(p => plots.push(new fabric.Polygon(p, { fill: 'rgba(76, 175, 80, 0.4)', stroke: '#2e7d32', strokeWidth: 1, isGreen: true, selectable: false })));
    } else {
        plots.push(new fabric.Polygon(points, { fill: 'rgba(255, 193, 7, 0.4)', stroke: '#ffa000', strokeWidth: 1, isAmenity: true, selectable: false }));
    }
    return plots;
}

function divideIntoPockets(points, num) {
    if (num <= 1) return [points];
    const result = [], step = Math.floor(points.length / num);
    for (let i = 0; i < num; i++) {
        const start = i * step, end = (i === num - 1) ? points.length : (i + 1) * step;
        const slice = points.slice(Math.max(0, start - 1), end + 1);
        if (slice.length >= 3) result.push(slice);
    }
    return result.length > 0 ? result : [points];
}

function renderSolution(solution) {
    clearGeneratedLayout();

    const analysisReport = document.getElementById('analysis-report');
    if (analysisReport) analysisReport.style.display = 'block';

    solution.objects.forEach(obj => App.canvas.add(obj));
    App.data.generatedObjects.push(...solution.objects);
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

    // Show report panel after generating layout
    const reportPanel = document.getElementById('report-panel');
    if (reportPanel) {
        import('./reporting.js').then(m => m.showReportPanel());
    }
}

function updateGallery() {
    const gallery = document.getElementById('solutions-gallery');
    gallery.innerHTML = '';
    GenerativeState.solutions.forEach((sol, idx) => {
        const item = document.createElement('div');
        item.className = 'solution-item';
        if (idx === GenerativeState.currentSolutionIndex) item.classList.add('active');
        item.innerHTML = `<img src="${sol.thumbnail}" alt="Solution ${idx}"><span class="label">${sol.name}</span><span class="label" style="font-size:10px">${sol.summary.plots} Plots</span>`;
        item.onclick = () => { GenerativeState.currentSolutionIndex = idx; renderSolution(sol); updateGallery(); };
        gallery.appendChild(item);
    });
}

// --- Different Bifurcation Methods for Generative Variety ---

/**
 * Grid Bifurcation: Creates orthogonal grid pattern
 */
function fillInnerAreaWithGridBifurcation(points, depth, width, garden, densityZone, protoChoice = 'mixed') {
    const plots = [], scale = App.state.scale;
    const depthPx = depth / scale, widthPx = width / scale;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });

    // Create grid of plots
    for (let y = minY; y < maxY; y += depthPx) {
        for (let x = minX; x < maxX; x += widthPx) {
            const plotPoints = [
                { x, y }, { x: x + widthPx, y },
                { x: x + widthPx, y: y + depthPx }, { x, y: y + depthPx }
            ];
            // Check if plot center is inside polygon
            const center = { x: x + widthPx / 2, y: y + depthPx / 2 };
            if (isPointInPolygon(center, points)) {
                const plot = new fabric.Polygon(plotPoints, {
                    fill: '#E3F2FD', stroke: '#666', strokeWidth: 0.5, isPlot: true,
                    area: widthPx * depthPx * scale * scale, selectable: false
                });
                plot.points = plotPoints;
                plots.push(plot);
            }
        }
    }
    return plots;
}

/**
 * Radial Bifurcation: Creates roads radiating from center
 */
function fillInnerAreaWithRadialBifurcation(points, depth, width, garden, densityZone, protoChoice = 'mixed') {
    const plots = [], scale = App.state.scale;

    // Find centroid
    let cx = 0, cy = 0;
    points.forEach(p => { cx += p.x; cy += p.y; });
    cx /= points.length; cy /= points.length;

    // Create radial sectors (8 sectors)
    const sectors = 8;
    for (let i = 0; i < sectors; i++) {
        const angle1 = (i / sectors) * Math.PI * 2;
        const angle2 = ((i + 1) / sectors) * Math.PI * 2;

        // Place plots along each sector
        for (let r = depth / scale; r < 100; r += depth / scale) {
            const x1 = cx + Math.cos(angle1) * r;
            const y1 = cy + Math.sin(angle1) * r;
            const x2 = cx + Math.cos(angle2) * r;
            const y2 = cy + Math.sin(angle2) * r;

            if (isPointInPolygon({ x: x1, y: y1 }, points)) {
                const plotPoints = [
                    { x: cx + Math.cos(angle1) * r, y: cy + Math.sin(angle1) * r },
                    { x: cx + Math.cos(angle2) * r, y: cy + Math.sin(angle2) * r },
                    { x: cx + Math.cos(angle2) * (r + depth / scale), y: cy + Math.sin(angle2) * (r + depth / scale) },
                    { x: cx + Math.cos(angle1) * (r + depth / scale), y: cy + Math.sin(angle1) * (r + depth / scale) }
                ];
                const plot = new fabric.Polygon(plotPoints, {
                    fill: '#FFF9C4', stroke: '#666', strokeWidth: 0.5, isPlot: true,
                    area: polygonArea(plotPoints) * scale * scale, selectable: false
                });
                plot.points = plotPoints;
                plots.push(plot);
            }
        }
    }
    return plots;
}

/**
 * Organic Bifurcation: Creates irregular, natural-looking subdivisions
 */
function fillInnerAreaWithOrganicBifurcation(points, depth, width, garden, densityZone, protoChoice = 'mixed') {
    const plots = [], scale = App.state.scale;

    // Use Voronoi-like subdivision (simplified)
    const numSeeds = Math.floor(polygonArea(points) * scale * scale / (depth * width * 2));
    const seeds = [];

    // Generate random seed points inside polygon
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });

    for (let i = 0; i < numSeeds; i++) {
        let attempts = 0;
        while (attempts < 50) {
            const x = minX + Math.random() * (maxX - minX);
            const y = minY + Math.random() * (maxY - minY);
            if (isPointInPolygon({ x, y }, points)) {
                seeds.push({ x, y });
                break;
            }
            attempts++;
        }
    }

    // Create organic plots around seeds
    seeds.forEach(seed => {
        const size = (depth / scale) * (0.8 + Math.random() * 0.4);
        const rotation = Math.random() * Math.PI * 2;
        const plotPoints = [];
        const sides = 4 + Math.floor(Math.random() * 3); // 4-6 sides

        for (let i = 0; i < sides; i++) {
            const angle = rotation + (i / sides) * Math.PI * 2;
            plotPoints.push({
                x: seed.x + Math.cos(angle) * size,
                y: seed.y + Math.sin(angle) * size
            });
        }

        const plot = new fabric.Polygon(plotPoints, {
            fill: '#C8E6C9', stroke: '#666', strokeWidth: 0.5, isPlot: true,
            area: polygonArea(plotPoints) * scale * scale, selectable: false
        });
        plot.points = plotPoints;
        plots.push(plot);
    });

    return plots;
}

