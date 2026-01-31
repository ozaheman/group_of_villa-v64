//--- START OF FILE js/road.js ---

import { App } from './appState.js';
import { setMode } from './ui.js';
import { getSnapPoint } from './canvas.js';
import { offsetPolyline, distToSegment } from './utils.js';

/**
 * Calculates the required pavement offset to make the outer edge tangent to all plot circles
 * @param {Array} roadPoints - Points along the road centerline
 * @param {Array} circles - Array of tangent circle objects (plots)
 * @param {number} baseOffset - Base offset in meters
 * @param {string} side - 'left' or 'right'
 * @returns {number} Required offset in meters to touch all circles
 */
function calculateTangentPavementOffset(roadPoints, circles, baseOffset, side) {
    let requiredOffset = baseOffset;
    const scale = App.state.scale;
    
    circles.forEach(circle => {
        // Circle center and radius in pixels
        const cx = circle.left;
        const cy = circle.top;
        const radius = circle.radius;
        
        // For each road segment, find the closest point to the circle
        for (let i = 0; i < roadPoints.length - 1; i++) {
            const p1 = roadPoints[i];
            const p2 = roadPoints[i + 1];
            
            // Find closest point on segment to circle center
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len2 = dx * dx + dy * dy;
            
            if (len2 < 1e-6) continue;
            
            let t = ((cx - p1.x) * dx + (cy - p1.y) * dy) / len2;
            t = Math.max(0, Math.min(1, t));
            
            const closestX = p1.x + t * dx;
            const closestY = p1.y + t * dy;
            
            // Distance from segment to circle center
            const distToCenter = Math.hypot(cx - closestX, cy - closestY);
            
            // Normal direction at this point on the segment
            const segLen = Math.hypot(dx, dy);
            const normalX = -dy / segLen;
            const normalY = dx / segLen;
            
            // Calculate required offset for this circle
            // Pavement should touch circle, so offset should be: distance to center - radius
            const requiredOffsetFromSegment = (distToCenter - radius) * scale;
            
            if (side === 'left') {
                requiredOffset = Math.max(requiredOffset, requiredOffsetFromSegment);
            } else {
                requiredOffset = Math.max(requiredOffset, requiredOffsetFromSegment);
            }
        }
    });
    
    return requiredOffset;
}

export function drawRoadPoint(pointer) {
    const snappedPointer = getSnapPoint(pointer);
    // Snap to close loop
    if (App.data.roadCenterlinePoints.length > 2) {
        const distToStart = Math.hypot(snappedPointer.x - App.data.roadCenterlinePoints[0].x, snappedPointer.y - App.data.roadCenterlinePoints[0].y);
        if (distToStart < 15 / App.canvas.getZoom()) {
            App.data.roadCenterlinePoints.push(App.data.roadCenterlinePoints[0]);
            finishRoadDrawing();
            return;
        }
    }
    App.data.roadCenterlinePoints.push({ x: snappedPointer.x, y: snappedPointer.y });
    if (App.data.roadCenterlinePoints.length > 1) {
        const prev = App.data.roadCenterlinePoints[App.data.roadCenterlinePoints.length - 2];
        const line = new fabric.Line([prev.x, prev.y, snappedPointer.x, snappedPointer.y], {
            stroke: '#ff8c00', strokeWidth: 3, selectable: false, evented: false
        });
        App.data.tempLines.push(line);
        App.canvas.add(line);
    }
}

export function finishRoadDrawing() {
    if (App.data.roadCenterlinePoints.length < 2) {
        setMode('none');
        return;
    }
    App.objects.roadCenterline = new fabric.Polyline(App.data.roadCenterlinePoints, {
        fill: 'transparent', stroke: 'rgba(255,140,0,0.5)', strokeWidth: 2,
        strokeDashArray: [5, 5], selectable: false, evented: false
    });
    App.data.generatedObjects.push(App.objects.roadCenterline);
    App.canvas.add(App.objects.roadCenterline);
    App.data.roadCenterlinePoints = [];
    setMode('none');
}

export function bufferRoad() {
    if (!App.objects.roadCenterline) return;
    const leftPavementM = parseFloat(App.elements.pavementWidthLeft.value);
    const rightPavementM = parseFloat(App.elements.pavementWidthRight.value);
    const numLanes = parseInt(App.elements.numLanes.value);
    const laneWidthM = parseFloat(App.elements.laneWidth.value);
    if (isNaN(leftPavementM) || isNaN(rightPavementM) || isNaN(numLanes) || isNaN(laneWidthM) || numLanes < 1) {
        alert("Invalid road parameters."); return;
    }

    const roadWidthM = numLanes * laneWidthM;
    const roadEdgeLeftOffsetM = roadWidthM / 2;
    let pavementEdgeLeftOffsetM = roadEdgeLeftOffsetM + leftPavementM;
    const roadEdgeRightOffsetM = -roadWidthM / 2;
    let pavementEdgeRightOffsetM = roadEdgeRightOffsetM - rightPavementM;

    // Adjust pavement width to be tangent to all plot circles
    const tangentCircles = App.data.generatedObjects.filter(o => o.isTangentCircle);
    if (tangentCircles.length > 0) {
        const roadPoints = App.objects.roadCenterline.points;
        pavementEdgeLeftOffsetM = calculateTangentPavementOffset(roadPoints, tangentCircles, roadEdgeLeftOffsetM, 'left');
        pavementEdgeRightOffsetM = -calculateTangentPavementOffset(roadPoints, tangentCircles, -roadEdgeRightOffsetM, 'right');
    }

    const roadPoints = App.objects.roadCenterline.points;
    const isClosed = roadPoints.length > 2 && roadPoints[0].x === roadPoints[roadPoints.length - 1].x && roadPoints[0].y === roadPoints[roadPoints.length - 1].y;

    const outerLeftPts = offsetPolyline(roadPoints, pavementEdgeLeftOffsetM / App.state.scale, isClosed);
    const innerLeftPts = offsetPolyline(roadPoints, roadEdgeLeftOffsetM / App.state.scale, isClosed);
    const innerRightPts = offsetPolyline(roadPoints, roadEdgeRightOffsetM / App.state.scale, isClosed);
    const outerRightPts = offsetPolyline(roadPoints, pavementEdgeRightOffsetM / App.state.scale, isClosed);

    if (isClosed) {
        const leftPavement = new fabric.Polygon([...outerLeftPts, ...innerLeftPts.reverse()], { fill: '#bbbbbb', stroke: '#999', strokeWidth: 0.5, selectable: false, evented: false });
        const roadSurface = new fabric.Polygon([...innerLeftPts, ...innerRightPts.reverse()], { fill: '#555555', stroke: '#999', strokeWidth: 0.5, selectable: false, evented: false });
        const rightPavement = new fabric.Polygon([...innerRightPts, ...outerRightPts.reverse()], { fill: '#bbbbbb', stroke: '#999', strokeWidth: 0.5, selectable: false, evented: false });
        [leftPavement, roadSurface, rightPavement].forEach(obj => { App.data.generatedObjects.push(obj); App.canvas.add(obj); });
        App.objects.lastInnerBoundary = [...innerLeftPts, ...innerRightPts.reverse()];
    } else {
        const roadSurface = new fabric.Polygon([...innerLeftPts, ...innerRightPts.reverse()], { fill: '#555555', strokeWidth: 0, selectable: false, evented: false });
        const leftPave = new fabric.Polygon([...outerLeftPts, ...innerLeftPts.reverse()], { fill: '#bbbbbb', strokeWidth: 0, selectable: false, evented: false });
        const rightPave = new fabric.Polygon([...innerRightPts, ...outerRightPts.reverse()], { fill: '#bbbbbb', strokeWidth: 0, selectable: false, evented: false });
        [roadSurface, leftPave, rightPave].forEach(obj => { App.data.generatedObjects.push(obj); App.canvas.add(obj); });
    }

    // Lane markings
    if (numLanes >= 2) {
        const centerLine = new fabric.Polyline(offsetPolyline(roadPoints, 0.1 / App.state.scale, isClosed), { stroke: '#f0e68c', strokeWidth: 1.5, selectable: false, evented: false });
        const centerLine2 = new fabric.Polyline(offsetPolyline(roadPoints, -0.1 / App.state.scale, isClosed), { stroke: '#f0e68c', strokeWidth: 1.5, selectable: false, evented: false });
        App.data.generatedObjects.push(centerLine, centerLine2); App.canvas.add(centerLine, centerLine2);
    }
    for (let i = 1; i < numLanes; i++) {
        const offsetM = (-roadWidthM / 2) + (i * laneWidthM);
        if (Math.abs(offsetM) < 0.2) continue;
        const laneLine = new fabric.Polyline(offsetPolyline(roadPoints, offsetM / App.state.scale, isClosed), { stroke: 'white', strokeWidth: 1, strokeDashArray: [10, 10], selectable: false, evented: false });
        App.data.generatedObjects.push(laneLine); App.canvas.add(laneLine);
    }
    
    App.objects.roadCenterline.visible = false;
    App.canvas.renderAll();
    setMode('none');
}

export function setInnerBoundaryAsPlot() {
    if (!App.objects.lastInnerBoundary) return;
    if (App.objects.masterPolygon) App.objects.masterPolygon.visible = false;
    const newPoly = new fabric.Polygon(App.objects.lastInnerBoundary, {
        fill: 'rgba(100,200,255,0.2)', stroke: '#003366', strokeWidth: 2,
        selectable: false, evented: false, objectCaching: false
    });
    App.objects.masterPolygon = newPoly;
    App.objects.activePolygon = newPoly;
    App.data.generatedObjects.push(newPoly);
    App.canvas.add(newPoly);
    App.objects.lastInnerBoundary = null;
    setMode('none');
}