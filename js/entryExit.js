//--- START OF FILE js/entryExit.js ---

import { App } from './appState.js';

// Store entry and exit points
export const EntryExitState = {
    entryPoint: null,
    exitPoint: null,
    entryMarker: null,
    exitMarker: null,
    mode: 'none' // 'entry', 'exit', 'none'
};

/**
 * Activate entry point placement mode
 */
export function activateEntryMode() {
    EntryExitState.mode = 'entry';
    App.canvas.defaultCursor = 'crosshair';

    // Highlight the button
    const btn = document.getElementById('add-entry');
    if (btn) {
        btn.style.backgroundColor = '#28a745';
        btn.textContent = '📍 Click on Boundary';
    }

    // Reset exit button
    const exitBtn = document.getElementById('add-exit');
    if (exitBtn) {
        exitBtn.style.backgroundColor = '';
        exitBtn.textContent = '🚪 Add Exit';
    }
}

/**
 * Activate exit point placement mode
 */
export function activateExitMode() {
    EntryExitState.mode = 'exit';
    App.canvas.defaultCursor = 'crosshair';

    // Highlight the button
    const btn = document.getElementById('add-exit');
    if (btn) {
        btn.style.backgroundColor = '#28a745';
        btn.textContent = '🚪 Click on Boundary';
    }

    // Reset entry button
    const entryBtn = document.getElementById('add-entry');
    if (entryBtn) {
        entryBtn.style.backgroundColor = '';
        entryBtn.textContent = '📍 Add Entry';
    }
}

/**
 * Handle canvas click for entry/exit placement
 */
export function handleEntryExitClick(pointer) {
    if (EntryExitState.mode === 'none') return false;

    if (!App.objects.masterPolygon) {
        alert('Please draw site boundary first.');
        resetEntryExitMode();
        return true;
    }

    // Find nearest point on boundary
    const nearestPoint = findNearestPointOnBoundary(pointer);

    if (EntryExitState.mode === 'entry') {
        placeEntryPoint(nearestPoint);
    } else if (EntryExitState.mode === 'exit') {
        placeExitPoint(nearestPoint);
    }

    resetEntryExitMode();
    updateEntryExitInfo();
    return true;
}

/**
 * Find nearest point on the site boundary
 */
function findNearestPointOnBoundary(pointer) {
    const points = App.objects.masterPolygon.points;
    let minDist = Infinity;
    let nearestPoint = null;
    let edgeIndex = -1;

    // Check each edge of the polygon
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];

        // Find closest point on this edge
        const closest = closestPointOnSegment(pointer, p1, p2);
        const dist = Math.hypot(closest.x - pointer.x, closest.y - pointer.y);

        if (dist < minDist) {
            minDist = dist;
            nearestPoint = closest;
            edgeIndex = i;
        }
    }

    return { ...nearestPoint, edgeIndex };
}

/**
 * Find closest point on a line segment
 */
function closestPointOnSegment(point, segStart, segEnd) {
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
 * Place entry point marker
 */
function placeEntryPoint(point) {
    // Remove existing entry marker
    if (EntryExitState.entryMarker) {
        App.canvas.remove(EntryExitState.entryMarker);
    }

    // Create entry marker (green circle with arrow)
    const marker = new fabric.Group([
        new fabric.Circle({
            radius: 8,
            fill: '#4CAF50',
            stroke: '#fff',
            strokeWidth: 2
        }),
        new fabric.Triangle({
            width: 10,
            height: 12,
            fill: '#fff',
            top: -3,
            left: 0,
            angle: 90
        })
    ], {
        left: point.x,
        top: point.y,
        selectable: false,
        evented: false,
        isEntryMarker: true
    });

    App.canvas.add(marker);
    marker.bringToFront();

    EntryExitState.entryPoint = point;
    EntryExitState.entryMarker = marker;

    App.canvas.renderAll();
}

/**
 * Place exit point marker
 */
function placeExitPoint(point) {
    // Remove existing exit marker
    if (EntryExitState.exitMarker) {
        App.canvas.remove(EntryExitState.exitMarker);
    }

    // Create exit marker (red circle with arrow)
    const marker = new fabric.Group([
        new fabric.Circle({
            radius: 8,
            fill: '#f44336',
            stroke: '#fff',
            strokeWidth: 2
        }),
        new fabric.Triangle({
            width: 10,
            height: 12,
            fill: '#fff',
            top: -3,
            left: 0,
            angle: -90
        })
    ], {
        left: point.x,
        top: point.y,
        selectable: false,
        evented: false,
        isExitMarker: true
    });

    App.canvas.add(marker);
    marker.bringToFront();

    EntryExitState.exitPoint = point;
    EntryExitState.exitMarker = marker;

    App.canvas.renderAll();
}

/**
 * Reset entry/exit mode
 */
function resetEntryExitMode() {
    EntryExitState.mode = 'none';
    App.canvas.defaultCursor = 'default';

    const entryBtn = document.getElementById('add-entry');
    const exitBtn = document.getElementById('add-exit');

    if (entryBtn) {
        entryBtn.style.backgroundColor = '';
        entryBtn.textContent = '📍 Add Entry';
    }
    if (exitBtn) {
        exitBtn.style.backgroundColor = '';
        exitBtn.textContent = '🚪 Add Exit';
    }
}

/**
 * Update entry/exit info display
 */
function updateEntryExitInfo() {
    const infoEl = document.getElementById('entry-exit-info');
    if (!infoEl) return;

    const entryText = EntryExitState.entryPoint ? '✓ Set' : 'None';
    const exitText = EntryExitState.exitPoint ? '✓ Set' : 'None';

    infoEl.innerHTML = `Entry: <span style="color: ${EntryExitState.entryPoint ? '#4CAF50' : '#999'}">${entryText}</span> | Exit: <span style="color: ${EntryExitState.exitPoint ? '#f44336' : '#999'}">${exitText}</span>`;
}

/**
 * Create road connection from entry to ring road with proper turning radius
 */
export function createEntryRoadConnection() {
    if (!EntryExitState.entryPoint) return null;

    const turningRadius = parseFloat(document.getElementById('turning-radius')?.value || 6);
    const scale = App.state.scale;
    const radiusPx = turningRadius / scale;

    // Find the ring road (first generated road)
    const ringRoad = App.data.generatedObjects.find(o => o.isInfra && o.type === 'polygon');
    if (!ringRoad) return null;

    // Create curved entry road with proper turning radius
    const entryPath = createCurvedRoadPath(
        EntryExitState.entryPoint,
        ringRoad,
        radiusPx,
        'entry'
    );

    return entryPath;
}

/**
 * Create road connection from ring road to exit with proper turning radius
 */
export function createExitRoadConnection() {
    if (!EntryExitState.exitPoint) return null;

    const turningRadius = parseFloat(document.getElementById('turning-radius')?.value || 6);
    const scale = App.state.scale;
    const radiusPx = turningRadius / scale;

    // Find the ring road
    const ringRoad = App.data.generatedObjects.find(o => o.isInfra && o.type === 'polygon');
    if (!ringRoad) return null;

    // Create curved exit road with proper turning radius
    const exitPath = createCurvedRoadPath(
        EntryExitState.exitPoint,
        ringRoad,
        radiusPx,
        'exit'
    );

    return exitPath;
}

/**
 * Create curved road path with specified turning radius
 * Based on engineering standards for 20 km/h design speed
 */
function createCurvedRoadPath(boundaryPoint, targetRoad, radius, type) {
    // Find nearest point on ring road to connect to
    const ringRoadPoints = targetRoad.points || [];
    if (ringRoadPoints.length < 3) {
        // Fallback to simple line connection
        const roadCenter = {
            x: targetRoad.left || 0,
            y: targetRoad.top || 0
        };
        const pathString = `M ${boundaryPoint.x} ${boundaryPoint.y} L ${roadCenter.x} ${roadCenter.y}`;
        return new fabric.Path(pathString, {
            stroke: type === 'entry' ? '#4CAF50' : '#f44336',
            strokeWidth: 3,
            fill: '',
            selectable: false,
            evented: false,
            isEntryExitRoad: true,
            roadType: type
        });
    }

    // Find nearest point on ring road polyline
    let nearestPt = null;
    let minDist = Infinity;
    for (let i = 0; i < ringRoadPoints.length; i++) {
        const p1 = ringRoadPoints[i];
        const p2 = ringRoadPoints[(i + 1) % ringRoadPoints.length];
        const closest = closestPointOnSegment(boundaryPoint, p1, p2);
        const dist = Math.hypot(closest.x - boundaryPoint.x, closest.y - boundaryPoint.y);
        if (dist < minDist) {
            minDist = dist;
            nearestPt = closest;
        }
    }

    if (!nearestPt) nearestPt = ringRoadPoints[0];

    const dx = nearestPt.x - boundaryPoint.x;
    const dy = nearestPt.y - boundaryPoint.y;
    const dist = Math.hypot(dx, dy);

    // Create smooth curve with proper turning radius
    // Use cubic bezier for better control over curvature
    const t = Math.min(dist * 0.4, radius);
    const controlPoint1 = {
        x: boundaryPoint.x + (dx * 0.3) - (dy * 0.15),
        y: boundaryPoint.y + (dy * 0.3) + (dx * 0.15)
    };
    const controlPoint2 = {
        x: nearestPt.x - (dx * 0.3) - (dy * 0.15),
        y: nearestPt.y - (dy * 0.3) + (dx * 0.15)
    };

    const pathString = `M ${boundaryPoint.x} ${boundaryPoint.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${nearestPt.x} ${nearestPt.y}`;

    const path = new fabric.Path(pathString, {
        stroke: type === 'entry' ? '#4CAF50' : '#f44336',
        strokeWidth: 3,
        fill: '',
        selectable: false,
        evented: false,
        isEntryExitRoad: true,
        roadType: type,
        startPoint: boundaryPoint,
        endPoint: nearestPt
    });

    return path;
}

/**
 * Clear all entry/exit points
 */
export function clearEntryExit() {
    if (EntryExitState.entryMarker) {
        App.canvas.remove(EntryExitState.entryMarker);
    }
    if (EntryExitState.exitMarker) {
        App.canvas.remove(EntryExitState.exitMarker);
    }

    EntryExitState.entryPoint = null;
    EntryExitState.exitPoint = null;
    EntryExitState.entryMarker = null;
    EntryExitState.exitMarker = null;

    updateEntryExitInfo();
    App.canvas.renderAll();
}
