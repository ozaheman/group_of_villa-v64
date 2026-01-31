//--- START OF FILE js/entryExitRoadHelpers.js ---

import { App } from './appState.js';
import { UrbanStandards } from './standards.js';
import { isPointInPolygon, distToSegment } from './utils.js';

/**
 * Create entry/exit road from boundary to ring road with proper pavements and turning radius
 */
export function createEntryExitRoad(boundaryPoint, ringRoadPoints, std, scale, turningRadius, type) {
    const objects = [];

    // Find nearest point on ring road
    let nearestPt = null;
    let minDist = Infinity;
    let nearestSegIdx = -1;

    for (let i = 0; i < ringRoadPoints.length; i++) {
        const p1 = ringRoadPoints[i];
        const p2 = ringRoadPoints[(i + 1) % ringRoadPoints.length];
        const closest = closestPointOnLineSegment(boundaryPoint, p1, p2);
        const dist = Math.hypot(closest.x - boundaryPoint.x, closest.y - boundaryPoint.y);

        if (dist < minDist) {
            minDist = dist;
            nearestPt = closest;
            nearestSegIdx = i;
        }
    }

    if (!nearestPt) return objects;

    // Calculate road direction
    const dx = nearestPt.x - boundaryPoint.x;
    const dy = nearestPt.y - boundaryPoint.y;
    const len = Math.hypot(dx, dy);

    if (len < 1) return objects;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    // Road dimensions in pixels
    const roadHalfWidth = (std.carriage / 2) / scale;
    const paveWidth = std.footpath / scale;

    // Create connection points with fillet (smooth curve) at ring road junction
    const radiusPx = turningRadius / scale;
    const filletStart = Math.min(len * 0.7, radiusPx);

    // Main road polygon (carriage way)
    const roadPoints = [
        { x: boundaryPoint.x + nx * roadHalfWidth, y: boundaryPoint.y + ny * roadHalfWidth },
        { x: nearestPt.x + nx * roadHalfWidth, y: nearestPt.y + ny * roadHalfWidth },
        { x: nearestPt.x - nx * roadHalfWidth, y: nearestPt.y - ny * roadHalfWidth },
        { x: boundaryPoint.x - nx * roadHalfWidth, y: boundaryPoint.y - ny * roadHalfWidth }
    ];

    const road = new fabric.Polygon(roadPoints, {
        fill: '#444444',
        stroke: '#222',
        strokeWidth: 0.5,
        selectable: false,
        isInfra: true,
        isEntryExitRoad: true,
        roadType: type
    });
    road.points = roadPoints;
    objects.push(road);

    // Left pavement
    const paveLPoints = [
        { x: boundaryPoint.x + nx * roadHalfWidth, y: boundaryPoint.y + ny * roadHalfWidth },
        { x: nearestPt.x + nx * roadHalfWidth, y: nearestPt.y + ny * roadHalfWidth },
        { x: nearestPt.x + nx * (roadHalfWidth + paveWidth), y: nearestPt.y + ny * (roadHalfWidth + paveWidth) },
        { x: boundaryPoint.x + nx * (roadHalfWidth + paveWidth), y: boundaryPoint.y + ny * (roadHalfWidth + paveWidth) }
    ];

    const paveL = new fabric.Polygon(paveLPoints, {
        fill: '#cccccc',
        stroke: '#999',
        strokeWidth: 0.5,
        selectable: false,
        isInfra: true,
        isEntryExitRoad: true
    });
    paveL.points = paveLPoints;
    objects.push(paveL);

    // Right pavement
    const paveRPoints = [
        { x: boundaryPoint.x - nx * roadHalfWidth, y: boundaryPoint.y - ny * roadHalfWidth },
        { x: nearestPt.x - nx * roadHalfWidth, y: nearestPt.y - ny * roadHalfWidth },
        { x: nearestPt.x - nx * (roadHalfWidth + paveWidth), y: nearestPt.y - ny * (roadHalfWidth + paveWidth) },
        { x: boundaryPoint.x - nx * (roadHalfWidth + paveWidth), y: boundaryPoint.y - ny * (roadHalfWidth + paveWidth) }
    ];

    const paveR = new fabric.Polygon(paveRPoints, {
        fill: '#cccccc',
        stroke: '#999',
        strokeWidth: 0.5,
        selectable: false,
        isInfra: true,
        isEntryExitRoad: true
    });
    paveR.points = paveRPoints;
    objects.push(paveR);

    // Add centerline marking
    const centerLine = new fabric.Line([
        boundaryPoint.x, boundaryPoint.y,
        nearestPt.x, nearestPt.y
    ], {
        stroke: type === 'entry' ? '#4CAF50' : '#f44336',
        strokeWidth: 2,
        strokeDashArray: [10, 10],
        selectable: false,
        isEntryExitRoad: true
    });
    objects.push(centerLine);

    // Add entry/exit marker on road
    const markerPos = {
        x: boundaryPoint.x + ux * (len * 0.2),
        y: boundaryPoint.y + uy * (len * 0.2)
    };

    const marker = new fabric.Text(type === 'entry' ? 'ENTRY ▶' : '◀ EXIT', {
        left: markerPos.x,
        top: markerPos.y,
        fontSize: 8,
        fill: type === 'entry' ? '#4CAF50' : '#f44336',
        fontWeight: 'bold',
        selectable: false,
        isEntryExitRoad: true
    });
    objects.push(marker);

    return objects;
}

/**
 * Helper function: closest point on line segment
 */
export function closestPointOnLineSegment(point, segStart, segEnd) {
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    const len2 = dx * dx + dy * dy;

    if (len2 === 0) return { x: segStart.x, y: segStart.y };

    let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    return {
        x: segStart.x + t * dx,
        y: segStart.y + t * dy
    };
}

/**
 * Remove plots that conflict with entry/exit roads
 */
export function removeConflictingPlots(roadType, roadObjects) {
    const plotsToRemove = [];
    const scale = App.state.scale;
    const std = UrbanStandards.Roads[document.getElementById('road-type').value];
    const clearanceBuffer = ((std.carriage + std.footpath * 2) / 2) / scale;

    // Get all road polygons
    const roadPolygons = roadObjects.filter(obj => obj.points && obj.type === 'polygon');

    App.data.generatedObjects.forEach(obj => {
        if (obj.isPlot && obj.points && !obj.isEntryExitRoad) {
            // Check if plot overlaps with road
            for (const roadPoly of roadPolygons) {
                if (roadPoly.points && doPolygonsOverlap(obj.points, roadPoly.points, clearanceBuffer)) {
                    plotsToRemove.push(obj);
                    break;
                }
            }
        }
    });

    // Remove conflicting plots
    plotsToRemove.forEach(plot => {
        App.canvas.remove(plot);
        App.data.generatedObjects = App.data.generatedObjects.filter(o => o !== plot);
    });

    return plotsToRemove.length;
}

/**
 * Check if polygons overlap with buffer
 */
function doPolygonsOverlap(poly1, poly2, buffer = 0) {
    // Check if any point of poly1 is near poly2
    for (const p1 of poly1) {
        if (isPointNearPolygon(p1, poly2, buffer)) {
            return true;
        }
    }

    // Check if any point of poly2 is near poly1
    for (const p2 of poly2) {
        if (isPointNearPolygon(p2, poly1, buffer)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if point is near polygon
 */
function isPointNearPolygon(point, polygon, buffer) {
    // Check if point is inside polygon or near its edges
    if (isPointInPolygon(point, polygon)) {
        return true;
    }

    // Check distance to edges
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        const dist = distToSegment(point, p1, p2);

        if (dist < buffer) {
            return true;
        }
    }

    return false;
}
