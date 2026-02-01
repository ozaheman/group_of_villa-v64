//--- START OF FILE js/canvas.js ---

import { App } from './appState.js';
import { setMode, updateAreaInfo, clearGeneratedLayout } from './ui.js';
import { drawPolygonPoint, addVertex, updatePolygonFromHandles } from './polygon.js';
import { drawRoadPoint, finishRoadDrawing } from './road.js';
import { handleMeasurement, handleCalibration, placeEntryMarker, updateEntryCircleLabel } from './tools.js';
import { toggleArc, handlePolygonMove } from './polygon.js';
import { handleEntryExitClick, EntryExitState } from './entryExit.js';
import {
    EditGeometryState,
    handleVertexMove,
    addVertexAtMidpoint,
    deleteVertex,
    isEditingGeometry
} from './editGeometry.js';

export function initCanvas() {
    const canvas = new fabric.Canvas('c', {
        selection: false,
        backgroundColor: '#fff',
        stopContextMenu: true
    });

    // --- Event Listeners ---
    canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.1) zoom = 0.1;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
    });

    canvas.on('mouse:down', (opt) => {
        if (opt.e.button === 1 || (opt.e.altKey && opt.e.button === 0)) { // Pan with middle mouse or Alt+Left Click
            App.state.isPanning = true;
            App.state.lastPosX = opt.e.clientX;
            App.state.lastPosY = opt.e.clientY;
        } else if (opt.e.button === 2) { // Finish drawing with Right Click
            if (App.state.mode === 'roadDraw') finishRoadDrawing();
        } else if (App.state.mode === 'edit' && opt.target && opt.target.isMidpoint && opt.e.shiftKey) {
            toggleArc(opt.target);
        } else if (isEditingGeometry() && opt.target && opt.target.isEditMidpoint) {
            // Add vertex at midpoint in geometry edit mode
            addVertexAtMidpoint(opt.target);
        } else {
            handleMouseDown(opt);
        }
    });

    canvas.on('mouse:move', (opt) => {
        if (App.state.isPanning) {
            const e = opt.e;
            const vpt = canvas.viewportTransform;
            vpt[4] += e.clientX - App.state.lastPosX;
            vpt[5] += e.clientY - App.state.lastPosY;
            canvas.requestRenderAll();
            App.state.lastPosX = e.clientX;
            App.state.lastPosY = e.clientY;
        }
    });

    canvas.on('mouse:up', () => {
        App.state.isPanning = false;
    });

    canvas.on('object:moving', (e) => {
        if (App.state.mode === 'edit') {
            if (e.target.isVertex || e.target.isMidpoint) {
                updatePolygonFromHandles(e.target);
            } else if (e.target === App.objects.activePolygon) {
                handlePolygonMove();
            }
        }
        // Handle geometry editing vertex movement
        if (isEditingGeometry() && e.target.isEditVertex) {
            handleVertexMove(e.target);
        }
        if (e.target.isEntryCircle) updateEntryCircleLabel(e.target);
    });

    canvas.on('object:scaling', (e) => {
        if (e.target.isEntryCircle) updateEntryCircleLabel(e.target);
    });

    canvas.on('selection:created', (e) => {
        if (e.target && App.state.mode === 'edit' && e.target.isVertex) {
            App.elements.removeVertexBtn.disabled = App.objects.activePolygon.points.length <= 3;
        }
    });

    canvas.on('selection:cleared', () => {
        App.elements.removeVertexBtn.disabled = true;
    });

    // Add keyboard event for deleting vertices in edit mode
    document.addEventListener('keydown', (e) => {
        if (isEditingGeometry() && (e.key === 'Delete' || e.key === 'Backspace')) {
            const activeObject = canvas.getActiveObject();
            if (activeObject && activeObject.isEditVertex) {
                e.preventDefault();
                deleteVertex(activeObject);
            }
        }
    });

    return canvas;
}

function handleMouseDown(o) {
    const pointer = App.canvas.getPointer(o.e);

    // Check for entry/exit mode first
    if (EntryExitState.mode !== 'none') {
        handleEntryExitClick(pointer);
        return;
    }

    switch (App.state.mode) {
        case 'draw':
            drawPolygonPoint(pointer);
            break;
        case 'roadDraw':
            drawRoadPoint(pointer);
            break;
        case 'measure':
            handleMeasurement(pointer);
            break;
        case 'calibrate':
            handleCalibration(pointer);
            break;
        case 'entry':
            placeEntryMarker(pointer);
            break;
        case 'edit':
            if (o.target && o.target.isMidpoint) {
                addVertex(o.target);
            }
            break;
    }
}

export function getSnapPoint(pointer) {
    let finalPointer = { ...pointer };
    // Ortho mode
    if (App.elements.orthoMode.checked && (App.data.polyPoints.length > 0 || App.data.roadCenterlinePoints.length > 0)) {
        const lastPoint = App.state.mode === 'draw' ? App.data.polyPoints[App.data.polyPoints.length - 1] : App.data.roadCenterlinePoints[App.data.roadCenterlinePoints.length - 1];
        const dx = Math.abs(pointer.x - lastPoint.x), dy = Math.abs(pointer.y - lastPoint.y);
        if (dx > dy) finalPointer.y = lastPoint.y; else finalPointer.x = lastPoint.x;
    }
    // OSNAP mode
    if (App.elements.osnapMode.checked) {
        let minDistance = 15 / App.canvas.getZoom();
        let pointsToSnap = [];
        if (App.state.mode === 'draw') pointsToSnap = App.data.polyPoints;
        else if (App.state.mode === 'roadDraw') pointsToSnap = App.data.roadCenterlinePoints.concat(App.objects.masterPolygon ? App.objects.masterPolygon.points : []);
        else pointsToSnap = App.objects.masterPolygon ? App.objects.masterPolygon.points : [];

        const checkSnap = (snapPt) => {
            const dist = Math.hypot(finalPointer.x - snapPt.x, finalPointer.y - snapPt.y);
            if (dist < minDistance) {
                minDistance = dist;
                finalPointer = { ...snapPt };
            }
        };
        pointsToSnap.forEach(pt => checkSnap(pt));
        for (let i = 0; i < pointsToSnap.length; i++) {
            const p1 = pointsToSnap[i];
            const p2 = pointsToSnap[(i + 1) % pointsToSnap.length];
            if (!p2) continue;
            checkSnap({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }); // Midpoint snap
        }
    }
    return finalPointer;
}


export function cleanupTempObjects() {
    App.data.tempLines.forEach(l => App.canvas.remove(l));
    App.data.tempPoints.forEach(p => App.canvas.remove(p));
    App.data.tempLines = [];
    App.data.tempPoints = [];
    App.canvas.renderAll();
}

export function resetView() {
    App.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
}

export function clearCanvas() {
    App.canvas.clear();
    App.canvas.setBackgroundColor('#fff');
    App.objects.masterPolygon = null;
    App.objects.activePolygon = null;
    clearGeneratedLayout();
    cleanupTempObjects();
    App.data.polyPoints = [];
    setMode('none');
    updateAreaInfo();
}