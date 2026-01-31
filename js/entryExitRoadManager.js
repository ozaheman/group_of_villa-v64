//--- START OF FILE js/entryExitRoadManager.js ---

import { App } from './appState.js';
import { EntryExitState } from './entryExit.js';
import { polygonArea } from './utils.js';
import { UrbanStandards } from './standards.js';

/**
 * Create roads from entry/exit to ring road and remove conflicting plots
 */
export function createEntryExitRoadsAndCleanup() {
    if (!EntryExitState.entryPoint && !EntryExitState.exitPoint) {
        alert('Please set entry and exit points first.');
        return;
    }

    const turningRadius = parseFloat(document.getElementById('turning-radius')?.value || 15);
    const scale = App.state.scale;
    const radiusPx = turningRadius / scale;
    const std = UrbanStandards.Roads[document.getElementById('road-type').value];
    const roadWidth = std.carriage;

    // Find the ring road (inner road polygon)
    const ringRoad = App.data.generatedObjects.find(o => o.isInfra && o.type === 'polygon' && o.points);

    if (!ringRoad) {
        alert('No ring road found. Please run the wizard steps first.');
        return;
    }

    const createdRoads = [];
    const plotsToRemove = [];

    // Create entry road
    if (EntryExitState.entryPoint) {
        const entryRoad = createRoadPolygon(
            EntryExitState.entryPoint,
            ringRoad,
            roadWidth,
            scale,
            'entry'
        );
        if (entryRoad) {
            App.canvas.add(entryRoad);
            App.data.generatedObjects.push(entryRoad);
            createdRoads.push(entryRoad);
        }
    }

    // Create exit road
    if (EntryExitState.exitPoint) {
        const exitRoad = createRoadPolygon(
            EntryExitState.exitPoint,
            ringRoad,
            roadWidth,
            scale,
            'exit'
        );
        if (exitRoad) {
            App.canvas.add(exitRoad);
            App.data.generatedObjects.push(exitRoad);
            createdRoads.push(exitRoad);
        }
    }

    // Remove conflicting plots
    const plotDepth = parseFloat(document.getElementById('plot-depth')?.value || 30);
    const clearanceBuffer = (roadWidth + plotDepth) / scale;

    App.data.generatedObjects.forEach(obj => {
        if (obj.isPlot && obj.points) {
            // Check if plot overlaps with any created road
            for (const road of createdRoads) {
                if (road.points && checkPolygonOverlap(obj.points, road.points, clearanceBuffer)) {
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

    App.canvas.renderAll();
    alert(`Created ${createdRoads.length} entry/exit roads. Removed ${plotsToRemove.length} conflicting plots.`);
}

/**
 * Create a road polygon connecting boundary point to ring road
 */
function createRoadPolygon(boundaryPoint, ringRoad, roadWidth, scale, type) {
    const ringRoadPoints = ringRoad.points || [];

    // Find nearest point on ring road
    let nearestPt = null;
    let minDist = Infinity;

    for (let i = 0; i < ringRoadPoints.length; i++) {
        const p = ringRoadPoints[i];
        const dist = Math.hypot(p.x - boundaryPoint.x, p.y - boundaryPoint.y);
        if (dist < minDist) {
            minDist = dist;
            nearestPt = p;
        }
    }

    if (!nearestPt) return null;

    const dx = nearestPt.x - boundaryPoint.x;
    const dy = nearestPt.y - boundaryPoint.y;
    const len = Math.hypot(dx, dy);

    if (len < 1) return null;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const halfWidth = (roadWidth / 2) / scale;

    // Create road polygon
    const roadPoints = [
        { x: boundaryPoint.x + nx * halfWidth, y: boundaryPoint.y + ny * halfWidth },
        { x: nearestPt.x + nx * halfWidth, y: nearestPt.y + ny * halfWidth },
        { x: nearestPt.x - nx * halfWidth, y: nearestPt.y - ny * halfWidth },
        { x: boundaryPoint.x - nx * halfWidth, y: boundaryPoint.y - ny * halfWidth }
    ];

    return new fabric.Polygon(roadPoints, {
        fill: type === 'entry' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)',
        stroke: type === 'entry' ? '#4CAF50' : '#f44336',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        isEntryExitRoad: true,
        isInfra: true,
        roadType: type,
        points: roadPoints
    });
}

/**
 * Check if two polygons overlap with a buffer zone
 */
function checkPolygonOverlap(poly1, poly2, buffer = 0) {
    // Simple centroid distance check with buffer
    const c1 = getCentroid(poly1);
    const c2 = getCentroid(poly2);
    const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y);

    // Estimate polygon size
    const size1 = estimatePolygonSize(poly1);
    const size2 = estimatePolygonSize(poly2);

    return dist < (size1 + size2 + buffer) / 2;
}

/**
 * Get centroid of polygon
 */
function getCentroid(points) {
    let x = 0, y = 0;
    points.forEach(p => {
        x += p.x;
        y += p.y;
    });
    return { x: x / points.length, y: y / points.length };
}

/**
 * Estimate polygon size (max dimension)
 */
function estimatePolygonSize(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });
    return Math.max(maxX - minX, maxY - minY);
}
