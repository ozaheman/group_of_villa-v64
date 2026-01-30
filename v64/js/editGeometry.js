//--- START OF FILE js/editGeometry.js ---

import { App } from './appState.js';
import { setMode } from './ui.js';

// State for geometry editing
export const EditGeometryState = {
    editMode: 'none', // 'road', 'green', 'none'
    targetObject: null,
    vertexHandles: [],
    midpointHandles: []
};

/**
 * Enable editing mode for road centerline
 */
export function enableRoadCenterlineEdit() {
    // Find the road centerline
    const roadCenterline = App.objects.roadCenterline ||
        App.data.generatedObjects.find(o => o.isRoadCenterline || (o.type === 'polyline' && o.stroke === '#ff6b6b'));

    if (!roadCenterline) {
        alert('No road centerline found. Please draw a road first.');
        return;
    }

    EditGeometryState.editMode = 'road';
    EditGeometryState.targetObject = roadCenterline;

    // Highlight the road
    roadCenterline.set({
        stroke: '#ff6b6b',
        strokeWidth: 3,
        selectable: true
    });

    createEditHandles(roadCenterline);

    // Update button state
    const btn = document.getElementById('edit-road-centerline');
    if (btn) {
        btn.style.backgroundColor = '#28a745';
        btn.textContent = '✅ Editing Road';
    }

    App.canvas.renderAll();
}

/**
 * Enable editing mode for green area polygon
 */
export function enableGreenAreaEdit() {
    // Find the green area polygon
    const greenArea = App.data.generatedObjects.find(o => o.isGreenArea || o.isGreen);

    if (!greenArea) {
        alert('No green area found. Please create green area first.');
        return;
    }

    EditGeometryState.editMode = 'green';
    EditGeometryState.targetObject = greenArea;

    // Highlight the green area
    greenArea.set({
        stroke: '#4CAF50',
        strokeWidth: 2,
        selectable: true
    });

    createEditHandles(greenArea);

    // Update button state
    const btn = document.getElementById('edit-green-area');
    if (btn) {
        btn.style.backgroundColor = '#28a745';
        btn.textContent = '✅ Editing Green Area';
    }

    App.canvas.renderAll();
}

/**
 * Create vertex and midpoint handles for editing
 */
function createEditHandles(object) {
    destroyEditHandles();

    let points = [];

    // Get points based on object type
    if (object.type === 'polyline' || object.type === 'line') {
        points = object.points || [];
    } else if (object.type === 'polygon') {
        points = object.points || [];
    } else if (object.path) {
        // For path objects, extract points from path commands
        points = extractPointsFromPath(object);
    }

    if (points.length === 0) return;

    // Create vertex handles
    points.forEach((point, index) => {
        const handle = new fabric.Circle({
            left: point.x,
            top: point.y,
            radius: 6,
            fill: '#fff',
            stroke: '#0056b3',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            hasBorders: false,
            hasControls: false,
            isEditVertex: true,
            vertexIndex: index
        });

        EditGeometryState.vertexHandles.push(handle);
        App.canvas.add(handle);
    });

    // Create midpoint handles
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];

        const midpoint = new fabric.Circle({
            left: (p1.x + p2.x) / 2,
            top: (p1.y + p2.y) / 2,
            radius: 4,
            fill: '#4CAF50',
            stroke: '#fff',
            strokeWidth: 1,
            originX: 'center',
            originY: 'center',
            hasBorders: false,
            hasControls: false,
            isEditMidpoint: true,
            edgeIndex: i
        });

        EditGeometryState.midpointHandles.push(midpoint);
        App.canvas.add(midpoint);
    }

    App.canvas.renderAll();
}

/**
 * Extract points from a path object
 */
function extractPointsFromPath(pathObject) {
    const points = [];
    if (!pathObject.path) return points;

    pathObject.path.forEach(cmd => {
        if (cmd[0] === 'M' || cmd[0] === 'L') {
            points.push({ x: cmd[1], y: cmd[2] });
        } else if (cmd[0] === 'Q') {
            points.push({ x: cmd[3], y: cmd[4] });
        }
    });

    return points;
}

/**
 * Destroy all edit handles
 */
function destroyEditHandles() {
    EditGeometryState.vertexHandles.forEach(h => App.canvas.remove(h));
    EditGeometryState.midpointHandles.forEach(h => App.canvas.remove(h));
    EditGeometryState.vertexHandles = [];
    EditGeometryState.midpointHandles = [];
}

/**
 * Handle vertex movement
 */
export function handleVertexMove(vertex) {
    if (EditGeometryState.editMode === 'none' || !EditGeometryState.targetObject) return;

    const object = EditGeometryState.targetObject;
    const index = vertex.vertexIndex;

    // Update the point
    if (object.type === 'polyline' || object.type === 'line') {
        if (object.points && object.points[index]) {
            object.points[index].x = vertex.left;
            object.points[index].y = vertex.top;
        }
    } else if (object.type === 'polygon') {
        if (object.points && object.points[index]) {
            object.points[index].x = vertex.left;
            object.points[index].y = vertex.top;
        }
    }

    // Update the object
    updateObjectGeometry(object);

    // Update handles
    updateHandlePositions();

    App.canvas.renderAll();
}

/**
 * Update object geometry after vertex movement
 */
function updateObjectGeometry(object) {
    if (object.type === 'polyline') {
        object.set({
            points: object.points,
            dirty: true
        });
    } else if (object.type === 'polygon') {
        // Recreate polygon with new points
        const newPolygon = new fabric.Polygon(object.points, {
            fill: object.fill,
            stroke: object.stroke,
            strokeWidth: object.strokeWidth,
            selectable: object.selectable,
            isGreenArea: object.isGreenArea,
            isGreen: object.isGreen
        });

        // Replace in canvas
        const index = App.canvas.getObjects().indexOf(object);
        App.canvas.remove(object);
        App.canvas.insertAt(newPolygon, index);

        // Update references
        EditGeometryState.targetObject = newPolygon;
        const dataIndex = App.data.generatedObjects.indexOf(object);
        if (dataIndex !== -1) {
            App.data.generatedObjects[dataIndex] = newPolygon;
        }
    }
}

/**
 * Update handle positions after vertex movement
 */
function updateHandlePositions() {
    const object = EditGeometryState.targetObject;
    if (!object || !object.points) return;

    const points = object.points;

    // Update vertex handles
    EditGeometryState.vertexHandles.forEach((handle, index) => {
        if (points[index]) {
            handle.set({
                left: points[index].x,
                top: points[index].y
            });
        }
    });

    // Update midpoint handles
    EditGeometryState.midpointHandles.forEach((handle, index) => {
        const p1 = points[index];
        const p2 = points[(index + 1) % points.length];
        if (p1 && p2) {
            handle.set({
                left: (p1.x + p2.x) / 2,
                top: (p1.y + p2.y) / 2
            });
        }
    });
}

/**
 * Add vertex at midpoint
 */
export function addVertexAtMidpoint(midpoint) {
    if (EditGeometryState.editMode === 'none' || !EditGeometryState.targetObject) return;

    const object = EditGeometryState.targetObject;
    const edgeIndex = midpoint.edgeIndex;

    const newPoint = {
        x: midpoint.left,
        y: midpoint.top
    };

    // Insert new point
    if (object.points) {
        object.points.splice(edgeIndex + 1, 0, newPoint);
    }

    // Update geometry
    updateObjectGeometry(object);

    // Recreate handles
    createEditHandles(EditGeometryState.targetObject);

    App.canvas.renderAll();
}

/**
 * Delete vertex
 */
export function deleteVertex(vertex) {
    if (EditGeometryState.editMode === 'none' || !EditGeometryState.targetObject) return;

    const object = EditGeometryState.targetObject;
    const index = vertex.vertexIndex;

    // Don't allow deletion if too few points
    if (object.points && object.points.length <= 3) {
        alert('Cannot delete vertex. Minimum 3 points required.');
        return;
    }

    // Remove point
    if (object.points) {
        object.points.splice(index, 1);
    }

    // Update geometry
    updateObjectGeometry(object);

    // Recreate handles
    createEditHandles(EditGeometryState.targetObject);

    App.canvas.renderAll();
}

/**
 * Finish editing and clean up
 */
export function finishGeometryEdit() {
    if (EditGeometryState.editMode === 'none') return;

    // Reset object appearance
    if (EditGeometryState.targetObject) {
        if (EditGeometryState.editMode === 'road') {
            EditGeometryState.targetObject.set({
                stroke: '#ff6b6b',
                strokeWidth: 2,
                selectable: false
            });
        } else if (EditGeometryState.editMode === 'green') {
            EditGeometryState.targetObject.set({
                stroke: '#228B22',
                strokeWidth: 1.5,
                selectable: false
            });
        }
    }

    // Destroy handles
    destroyEditHandles();

    // Reset button states
    const roadBtn = document.getElementById('edit-road-centerline');
    const greenBtn = document.getElementById('edit-green-area');

    if (roadBtn) {
        roadBtn.style.backgroundColor = '';
        roadBtn.textContent = '✏️ Edit Road Centerline';
    }
    if (greenBtn) {
        greenBtn.style.backgroundColor = '';
        greenBtn.textContent = '✏️ Edit Green Area';
    }

    // Reset state
    EditGeometryState.editMode = 'none';
    EditGeometryState.targetObject = null;

    App.canvas.renderAll();
}

/**
 * Check if currently in edit mode
 */
export function isEditingGeometry() {
    return EditGeometryState.editMode !== 'none';
}
