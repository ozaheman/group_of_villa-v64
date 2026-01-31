//--- START OF FILE js/polygon.js ---

import { App } from './appState.js';
import { setMode, updateAreaInfo, clearGeneratedLayout } from './ui.js';
import { getSnapPoint } from './canvas.js';
import { isPointInPolygon, distToSegment, polygonSignedArea, createInwardOffsetPolygon, pointsToPathData, getArcMidpoint, getBulgeFromMidpoint } from './utils.js';

// --- Drawing and Editing ---

export function drawPolygonPoint(pointer) {
    const snappedPointer = getSnapPoint(pointer);
    App.data.polyPoints.push({ x: snappedPointer.x, y: snappedPointer.y });
    const pointCircle = new fabric.Circle({
        radius: 4, fill: '#ff0000', left: snappedPointer.x - 4, top: snappedPointer.y - 4,
        selectable: false, evented: false,
    });
    App.data.tempPoints.push(pointCircle);
    App.canvas.add(pointCircle);
    if (App.data.polyPoints.length > 1) {
        const prevPoint = App.data.polyPoints[App.data.polyPoints.length - 2];
        const line = new fabric.Line([prevPoint.x, prevPoint.y, snappedPointer.x, snappedPointer.y], {
            stroke: '#003366', strokeWidth: 2, selectable: false, evented: false,
        });
        App.data.tempLines.push(line);
        App.canvas.add(line);
    }
}

export function finishDrawing() {
    if (App.data.polyPoints.length < 3) return;

    // Ensure points have bulge property
    const points = App.data.polyPoints.map(p => ({ x: p.x, y: p.y, bulge: 0 }));

    const pathData = pointsToPathData(points);
    App.objects.masterPolygon = new fabric.Path(pathData, {
        fill: 'rgba(100,200,255,0.2)', stroke: '#003366', strokeWidth: 2,
        selectable: false, evented: false, objectCaching: false,
    });
    App.objects.masterPolygon.points = points; // Store vertices for editing

    App.objects.activePolygon = App.objects.masterPolygon;
    App.canvas.add(App.objects.masterPolygon);
    setMode('none');
    App.data.polyPoints = [];
    updateAreaInfo();
}

export function createVertexHandles() {
    if (!App.objects.activePolygon) return;
    destroyVertexHandles();

    const poly = App.objects.activePolygon;

    // Make polygon selectable for moving
    poly.set({
        selectable: App.state.mode === 'edit',
        evented: App.state.mode === 'edit',
        hasControls: false,
        hasBorders: false
    });
    poly.lastLeft = poly.left;
    poly.lastTop = poly.top;

    poly.points.forEach((p, index) => {
        const handle = new fabric.Circle({
            radius: 6, fill: '#FFF', stroke: '#007bff', strokeWidth: 2,
            left: p.x, top: p.y, originX: 'center', originY: 'center',
            hasControls: false, hasBorders: false, isVertex: true, vertexIndex: index,
        });
        App.data.vertexHandles.push(handle);
    });

    for (let i = 0; i < poly.points.length; i++) {
        const p1 = poly.points[i];
        const p2 = poly.points[(i + 1) % poly.points.length];
        const mid = getArcMidpoint(p1, p2, p1.bulge || 0);

        const handle = new fabric.Rect({
            width: 10, height: 10, fill: (p1.bulge ? '#ffc107' : 'rgba(0,200,0,0.5)'), stroke: '#007bff',
            left: mid.x, top: mid.y, originX: 'center', originY: 'center',
            hasControls: false, hasBorders: false, isMidpoint: true, segmentIndex: i,
        });
        App.data.vertexHandles.push(handle);
    }
    App.data.vertexHandles.forEach(h => App.canvas.add(h));
}

export function destroyVertexHandles() {
    App.data.vertexHandles.forEach(h => App.canvas.remove(h));
    App.data.vertexHandles = [];
    if (App.objects.activePolygon) {
        App.objects.activePolygon.set({ selectable: false, evented: false });
    }
    App.canvas.discardActiveObject().renderAll();
}

export function updatePolygonFromHandles(movedHandle) {
    const poly = App.objects.activePolygon;
    if (movedHandle.isVertex) {
        poly.points[movedHandle.vertexIndex].x = movedHandle.left;
        poly.points[movedHandle.vertexIndex].y = movedHandle.top;
    } else if (movedHandle.isMidpoint) {
        const i = movedHandle.segmentIndex;
        const p1 = poly.points[i];
        const p2 = poly.points[(i + 1) % poly.points.length];
        // Dragging midpoint always changes bulge
        poly.points[i].bulge = getBulgeFromMidpoint(p1, p2, { x: movedHandle.left, y: movedHandle.top });
    }
    refreshPolygonPath();
    updateAreaInfo();
}

/**
 * Updates the polygon path data based on its points and bulges.
 */
export function refreshPolygonPath() {
    const poly = App.objects.activePolygon;
    if (!poly) return;
    const pathData = pointsToPathData(poly.points);

    // Create temporary path to get new dimension/path data
    const newPathObj = new fabric.Path(pathData);
    poly.set({
        path: newPathObj.path,
        left: newPathObj.left,
        top: newPathObj.top,
        width: newPathObj.width,
        height: newPathObj.height
    });
    poly.setCoords();

    syncHandlesToPoints();
    App.canvas.renderAll();
}

export function syncHandlesToPoints() {
    const poly = App.objects.activePolygon;
    App.data.vertexHandles.forEach(h => {
        if (h.isVertex) {
            const p = poly.points[h.vertexIndex];
            h.set({ left: p.x, top: p.y });
        } else if (h.isMidpoint) {
            const p1 = poly.points[h.segmentIndex];
            const p2 = poly.points[(h.segmentIndex + 1) % poly.points.length];
            const mid = getArcMidpoint(p1, p2, p1.bulge || 0);
            h.set({
                left: mid.x,
                top: mid.y,
                fill: (p1.bulge ? '#ffc107' : 'rgba(0,200,0,0.5)')
            });
        }
        h.setCoords();
    });
}

export function handlePolygonMove() {
    const poly = App.objects.activePolygon;
    const dx = poly.left - poly.lastLeft;
    const dy = poly.top - poly.lastTop;

    if (dx === 0 && dy === 0) return;

    poly.points.forEach(p => {
        p.x += dx;
        p.y += dy;
    });

    poly.lastLeft = poly.left;
    poly.lastTop = poly.top;

    syncHandlesToPoints();
    updateAreaInfo();
    App.canvas.renderAll();
}

export function toggleArc(midpointHandle) {
    const poly = App.objects.activePolygon;
    const i = midpointHandle.segmentIndex;
    poly.points[i].bulge = poly.points[i].bulge ? 0 : 0.5;
    refreshPolygonPath();
    syncHandlesToPoints();
}

export function addVertex(midpointHandle) {
    const poly = App.objects.activePolygon;
    const index = midpointHandle.segmentIndex;
    const newPoint = { x: midpointHandle.left, y: midpointHandle.top, bulge: 0 };

    // Reset bulge of the segment we are splitting
    poly.points[index].bulge = 0;
    poly.points.splice(index + 1, 0, newPoint);

    refreshPolygonPath();
    createVertexHandles();
}

export function removeSelectedVertex() {
    const activeObj = App.canvas.getActiveObject();
    if (activeObj && activeObj.isVertex && App.objects.activePolygon.points.length > 3) {
        App.objects.activePolygon.points.splice(activeObj.vertexIndex, 1);
        refreshPolygonPath();
        createVertexHandles();
        updateAreaInfo();
    }
}


// --- Plot Generation ---

export function generateTangentCircles() {
    if (!App.objects.activePolygon) return;
    clearGeneratedLayout();
    const plotDepthM = parseFloat(App.elements.plotDepth.value);
    const plotWidthM = parseFloat(App.elements.plotWidth.value);
    if (isNaN(plotDepthM) || plotDepthM <= 0 || isNaN(plotWidthM) || plotWidthM <= 0) return;

    const radiusPx = (plotDepthM / 2) / App.state.scale;
    const spacingPx = plotWidthM / App.state.scale;
    const circles = [];

    // Use inner pavement boundary as constraint if available, otherwise use polygon boundary
    const isUsingInnerBoundary = !!App.objects.lastInnerBoundary;
    let constraintBoundary = isUsingInnerBoundary ? [...App.objects.lastInnerBoundary] : App.objects.activePolygon.points;
    const safeBoundaryPoints = createInwardOffsetPolygon(constraintBoundary, radiusPx);
    if (safeBoundaryPoints.length < 3) {
        alert("Polygon is too narrow to fit any plots of the specified depth.");
        return;
    }

    const isCCW = polygonSignedArea(constraintBoundary) < 0;

    for (let i = 0; i < constraintBoundary.length; i++) {
        const p1 = constraintBoundary[i];
        const p2 = constraintBoundary[(i + 1) % constraintBoundary.length];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < spacingPx) continue;

        const ux = dx / len;
        const uy = dy / len;

        let nx = -uy, ny = ux;
        if (!isCCW) { nx = -nx; ny = -ny; }
        // For inner boundary, flip the normal to point inward
        if (isUsingInnerBoundary) { nx = -nx; ny = -ny; }

        // Loop along the segment to place circles spaced by plotWidth
        for (let d = spacingPx / 2; d <= len - spacingPx / 2 + 0.001; d += spacingPx) {
            const centerOnLine = {
                x: p1.x + ux * d,
                y: p1.y + uy * d
            };

            const potentialCenter = {
                x: centerOnLine.x + nx * radiusPx,
                y: centerOnLine.y + ny * radiusPx
            };

            if (isPointInPolygon(potentialCenter, safeBoundaryPoints)) {
                const circle = new fabric.Circle({
                    radius: radiusPx, fill: 'rgba(0,150,255,0.4)', stroke: '#0056b3',
                    left: potentialCenter.x, top: potentialCenter.y,
                    originX: 'center', originY: 'center', selectable: false, evented: false,
                    isTangentCircle: true,
                    parentSegment: { p1: p1, p2: p2, normal: { x: nx, y: ny } }
                });
                circles.push(circle);
                App.data.generatedObjects.push(circle);
                App.canvas.add(circle);
            }
        }
    }

    setMode('none');
    App.canvas.renderAll();
    updateAreaInfo();
}

export function drawPlotBackLines() {
    const tangentCircles = App.data.generatedObjects.filter(o => o.isTangentCircle);
    if (tangentCircles.length === 0) return;

    const plotDepthM = parseFloat(App.elements.plotDepth.value);
    if (isNaN(plotDepthM) || plotDepthM <= 0) {
        alert("Invalid Plot Depth value.");
        return;
    }
    const offsetDist = plotDepthM / App.state.scale;

    tangentCircles.forEach(c => {
        const seg = c.parentSegment;
        const p1 = seg.p1, p2 = seg.p2, n = seg.normal;
        const p1_new = { x: p1.x + n.x * offsetDist, y: p1.y + n.y * offsetDist };
        const p2_new = { x: p2.x + n.x * offsetDist, y: p2.y + n.y * offsetDist };
        const backLine = new fabric.Line([p1_new.x, p1_new.y, p2_new.x, p2_new.y], {
            stroke: '#0056b3', strokeWidth: 1.5, strokeDashArray: [5, 5],
            selectable: false, evented: false
        });
        App.data.generatedObjects.push(backLine);
        App.canvas.add(backLine);
    });
    setMode('none');
}

export function arrayCircles() {
    if (!App.objects.activePolygon) { alert("Please draw or set a polygon first."); return; }
    App.data.generatedObjects.filter(o => o.isGeneratedPlot).forEach(o => App.canvas.remove(o));
    App.data.generatedObjects = App.data.generatedObjects.filter(o => !o.isGeneratedPlot);

    const plotWidthM = parseFloat(App.elements.plotWidth.value);
    const plotDepthM = parseFloat(App.elements.plotDepth.value);
    if (isNaN(plotWidthM) || plotWidthM <= 0 || isNaN(plotDepthM) || plotDepthM <= 0) {
        alert("Please set valid Plot Width and Depth."); return;
    }
    const plotWidthPx = plotWidthM / App.state.scale;
    const radiusPx = (plotDepthM / 2) / App.state.scale;
    let allPlots = [...App.data.generatedObjects.filter(o => o.isTangentCircle)];

    // Use inner pavement boundary as constraint if available, otherwise use polygon boundary
    const isUsingInnerBoundary = !!App.objects.lastInnerBoundary;
    let constraintBoundary = isUsingInnerBoundary ? [...App.objects.lastInnerBoundary] : App.objects.activePolygon.points;
    const safeBoundaryPoints = createInwardOffsetPolygon(constraintBoundary, radiusPx);
    if (safeBoundaryPoints.length < 3) {
        alert("Polygon is too narrow to array any plots of the specified depth.");
        return;
    }

    // **FIX**: For a Y-down coordinate system, a CCW polygon has a NEGATIVE area.
    const isCCW = polygonSignedArea(constraintBoundary) < 0;

    for (let i = 0; i < constraintBoundary.length; i++) {
        const p1 = constraintBoundary[i];
        const p2 = constraintBoundary[(i + 1) % constraintBoundary.length];
        const dir = { x: p2.x - p1.x, y: p2.y - p1.y };
        const len = Math.hypot(dir.x, dir.y);
        if (len < plotWidthPx) continue;
        dir.x /= len; dir.y /= len;

        let nx = -dir.y, ny = dir.x;
        if (!isCCW) {
            nx = -nx; ny = -ny;
        }
        // For inner boundary, flip the normal to point inward
        if (isUsingInnerBoundary) { nx = -nx; ny = -ny; }

        for (let dist = plotWidthPx / 2; dist < len; dist += plotWidthPx) {
            const centerOnLine = { x: p1.x + dir.x * dist, y: p1.y + dir.y * dist };
            const potentialCenter = { x: centerOnLine.x + nx * radiusPx, y: centerOnLine.y + ny * radiusPx };

            if (!isPointInPolygon(potentialCenter, safeBoundaryPoints)) {
                continue;
            }

            let collision = false;
            for (const existingPlot of allPlots) {
                if (Math.hypot(potentialCenter.x - existingPlot.left, potentialCenter.y - existingPlot.top) < radiusPx * 2 - 0.1) {
                    collision = true; break;
                }
            }
            if (collision) continue;

            const newCircle = new fabric.Circle({
                radius: radiusPx, fill: 'rgba(0, 150, 255, 0.4)', stroke: '#0056b3',
                left: potentialCenter.x, top: potentialCenter.y, originX: 'center', originY: 'center',
                selectable: false, evented: false, isGeneratedPlot: true
            });
            App.canvas.add(newCircle);
            App.data.generatedObjects.push(newCircle);
            allPlots.push(newCircle);
        }
    }
    App.canvas.renderAll();
    updateAreaInfo();
    setMode('none');
    alert(`Array generation complete. Total plots: ${allPlots.length}`);
}

export function subdivideInnerPlots() {
    const allPlots = App.data.generatedObjects.filter(o => o.isTangentCircle || o.isGeneratedPlot);
    if (allPlots.length === 0) {
        alert("Please generate plots first.");
        return;
    }

    // Get parameters
    const greenPercent = parseFloat(App.elements.greenArea.value) / 100;
    const amenitiesPercent = parseFloat(App.elements.amenitiesArea.value) / 100;
    const usablePercent = 1 - greenPercent - amenitiesPercent;

    if (usablePercent < 0) {
        alert("Green + Amenities percentage cannot exceed 100%");
        return;
    }

    // Remove old subdivisions
    App.data.generatedObjects = App.data.generatedObjects.filter(o => !o.isPlotSubdivision);
    App.data.generatedObjects.forEach(o => {
        if (o.isPlotSubdivision) App.canvas.remove(o);
    });

    allPlots.forEach(plot => {
        const cx = plot.left;
        const cy = plot.top;
        const radius = plot.radius;

        // Create plot area (usable area)
        const plotArea = new fabric.Circle({
            radius: radius * Math.sqrt(usablePercent),
            fill: 'rgba(100, 200, 255, 0.5)',
            stroke: '#0056b3',
            strokeWidth: 1,
            left: cx,
            top: cy,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            isPlotSubdivision: true,
            subdivisionType: 'usable'
        });
        App.data.generatedObjects.push(plotArea);
        App.canvas.add(plotArea);

        // Create green area (inside usable or as ring)
        const greenRadius = radius * Math.sqrt(usablePercent * greenPercent / (greenPercent + amenitiesPercent));
        const greenArea = new fabric.Circle({
            radius: greenRadius,
            fill: 'rgba(76, 175, 80, 0.6)',
            stroke: '#388E3C',
            strokeWidth: 1,
            left: cx,
            top: cy,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            isPlotSubdivision: true,
            subdivisionType: 'green'
        });
        App.data.generatedObjects.push(greenArea);
        App.canvas.add(greenArea);

        // Create amenities area (ring around green)
        const amenitiesRadius = radius * Math.sqrt(usablePercent);
        const amenitiesRing = new fabric.Circle({
            radius: amenitiesRadius,
            fill: 'transparent',
            stroke: '#FF9800',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            left: cx,
            top: cy,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            isPlotSubdivision: true,
            subdivisionType: 'amenities'
        });
        App.data.generatedObjects.push(amenitiesRing);
        App.canvas.add(amenitiesRing);

        // Create outer margin (non-usable)
        const marginRing = new fabric.Circle({
            radius: radius,
            fill: 'transparent',
            stroke: '#999',
            strokeWidth: 1,
            strokeDashArray: [2, 2],
            left: cx,
            top: cy,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            isPlotSubdivision: true,
            subdivisionType: 'margin'
        });
        App.data.generatedObjects.push(marginRing);
        App.canvas.add(marginRing);
    });

    App.canvas.renderAll();
    updateAreaInfo();
    setMode('none');
    alert(`Subdivided ${allPlots.length} plots with Green: ${(greenPercent * 100).toFixed(1)}%, Amenities: ${(amenitiesPercent * 100).toFixed(1)}%`);
}

export function createInnerHouseLots() {
    const allPlots = App.data.generatedObjects.filter(o => (o.isTangentCircle || o.isGeneratedPlot) && !o.isPlotSubdivision);
    if (allPlots.length === 0) {
        alert("Please generate and subdivide plots first.");
        return;
    }

    // Remove old house lots
    App.data.generatedObjects = App.data.generatedObjects.filter(o => !o.isHouseLot);
    App.data.generatedObjects.forEach(o => {
        if (o.isHouseLot) App.canvas.remove(o);
    });

    const greenPercent = parseFloat(App.elements.greenArea.value) / 100;
    const amenitiesPercent = parseFloat(App.elements.amenitiesArea.value) / 100;
    const usablePercent = 1 - greenPercent - amenitiesPercent;

    // Subdivide each plot into house lots
    allPlots.forEach(plot => {
        const cx = plot.left;
        const cy = plot.top;
        const radius = plot.radius;
        const lotRadius = radius * Math.sqrt(usablePercent) * 0.6; // Inner house lot radius

        // Divide plot into 2-4 house lots
        const lotsCount = Math.random() < 0.5 ? 2 : 3;
        const angleStep = (Math.PI * 2) / lotsCount;

        for (let i = 0; i < lotsCount; i++) {
            const angle = (Math.PI / 2) + (i * angleStep);
            const offset = radius * Math.sqrt(usablePercent) * 0.35;
            const lotX = cx + Math.cos(angle) * offset;
            const lotY = cy + Math.sin(angle) * offset;

            const houseLot = new fabric.Circle({
                radius: lotRadius * 0.7,
                fill: 'rgba(220, 180, 130, 0.7)',
                stroke: '#8B4513',
                strokeWidth: 2,
                left: lotX,
                top: lotY,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
                isHouseLot: true
            });

            // Add area label
            const lotArea = (Math.PI * (lotRadius * 0.7) ** 2) * (App.state.scale ** 2);
            const label = new fabric.Text(`${(lotArea).toFixed(0)}m²`, {
                fontSize: 8,
                fill: '#333',
                left: lotX,
                top: lotY,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
                isHouseLot: true
            });

            App.data.generatedObjects.push(houseLot, label);
            App.canvas.add(houseLot, label);
        }
    });

    App.canvas.renderAll();
    updateAreaInfo();
    setMode('none');
    alert(`Created inner house lots for ${allPlots.length} plots`);
}