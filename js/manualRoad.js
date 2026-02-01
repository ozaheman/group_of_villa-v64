
import { App } from './appState.js';
import { offsetPolyline, createInwardOffsetPolygon, polygonArea, pointsToPathData, getSegmentIntersection, splitPolygonGeneral, getBounds, splitPolygon, isPointInPolygon } from './utils.js';
import { generatePlotsAlongEdges } from './generative.js';
import { fillInnerArea } from './division_method/hybrid.js';
import { createInnerGreenAreaPolygon } from './greenArea.js';
import { createEntryExitRoad, removeConflictingPlots } from './entryExitRoadHelpers.js';
import { EntryExitState } from './entryExit.js';
import { UrbanStandards } from './standards.js';
import { clearGeneratedLayout, setMode } from './ui.js';
import { createVertexHandles } from './polygon.js';
import { updateAreaInfo } from './ui.js';

export function generatePlotsOuter() {
    if (!App.objects.masterPolygon) return alert("Define site boundary first.");

    const depth = parseFloat(App.elements.plotDepth.value);
    const width = parseFloat(App.elements.plotWidth.value);
    const scale = App.state.scale;
    const masterPoints = App.objects.masterPolygon.points;

    // Check existing infra to avoid overlaps
    const infraOnly = App.data.generatedObjects.filter(o => o.isInfra);

    // Step 2 logic: Inward offset from site boundary
    const plots = generatePlotsAlongEdges(
        masterPoints,
        depth,
        width,
        true, // CCW assumption for master polygon
        infraOnly,
        'mediumDensity',
        false,
        App.elements.plotPrototype.value
    );

    if (plots.length === 0) {
        // Try flipping direction if no plots created
        const plots2 = generatePlotsAlongEdges(masterPoints, depth, width, false, infraOnly, 'mediumDensity', false, App.elements.plotPrototype.value);
        if (plots2.length > 0) plots.push(...plots2);
    }

    plots.forEach(p => App.canvas.add(p));
    App.data.generatedObjects.push(...plots);
    App.canvas.requestRenderAll();
    updateAreaInfo();
}

export function bifurcateRoadManual() {
    let target = App.canvas.getActiveObject();
    if (!target || !target.isGreenArea) {
        // Fallback: search for first green area
        target = App.data.generatedObjects.find(o => o.isGreenArea && o.points);
    }

    if (!target || !target.points) return alert("Select a Green Area polygon to bifurcate.");

    const bounds = getBounds(target.points);
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const std = UrbanStandards.Roads[document.getElementById('road-type').value || 'local'];
    const gapPx = std.carriage / App.state.scale;

    let isVert = w > h;
    let mid = isVert ? (bounds.minX + bounds.maxX) / 2 : (bounds.minY + bounds.maxY) / 2;
    let pts1 = [], pts2 = [];
    let hasGeneralSplit = false;
    let splitLine = null;

    // Smart logic: use road centerline if it crosses the polygon
    const centerline = App.objects.roadCenterline;
    if (centerline && centerline.points) {
        let intersectionPoints = [];
        const pts = target.points;
        const cPts = centerline.points;

        // Check each segment of centerline against each edge of polygon
        for (let i = 0; i < cPts.length - 1; i++) {
            const cp1 = cPts[i], cp2 = cPts[i + 1];
            for (let j = 0; j < pts.length; j++) {
                const pp1 = pts[j], pp2 = pts[(j + 1) % pts.length];
                const inter = getSegmentIntersection(cp1, cp2, pp1, pp2);
                if (inter) intersectionPoints.push(inter);
            }
        }

        if (intersectionPoints.length >= 2) {
            const p1 = intersectionPoints[0], p2 = intersectionPoints[1];
            [pts1, pts2] = splitPolygonGeneral(target.points, p1, p2, gapPx);
            splitLine = { p1, p2 };
            hasGeneralSplit = true;
        }
    }

    if (!hasGeneralSplit) {
        [pts1, pts2] = splitPolygon(target.points, isVert, mid, gapPx);
    }

    if (pts1.length < 3 || pts2.length < 3) return alert("Polygon too small to bifurcate.");

    // Remove old green area
    App.canvas.remove(target);
    App.data.generatedObjects = App.data.generatedObjects.filter(o => o !== target);

    // Add 2 new green areas
    [pts1, pts2].forEach(pts => {
        const pathData = pointsToPathData(pts);
        const g = new fabric.Path(pathData, {
            fill: 'rgba(76, 175, 80, 0.4)', stroke: '#2e7d32', strokeWidth: 1.5,
            selectable: true, isGreenArea: true, isGreen: true, objectCaching: false
        });
        g.points = pts;
        App.canvas.add(g);
        App.data.generatedObjects.push(g);
    });

    // Add road in the gap
    let roadRect;
    if (hasGeneralSplit && splitLine) {
        // Calculate the rectangle in the gap
        const dx = splitLine.p2.x - splitLine.p1.x;
        const dy = splitLine.p2.y - splitLine.p1.y;
        const len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;
        const halfGap = gapPx / 2;

        roadRect = [
            { x: splitLine.p1.x + nx * halfGap, y: splitLine.p1.y + ny * halfGap },
            { x: splitLine.p2.x + nx * halfGap, y: splitLine.p2.y + ny * halfGap },
            { x: splitLine.p2.x - nx * halfGap, y: splitLine.p2.y - ny * halfGap },
            { x: splitLine.p1.x - nx * halfGap, y: splitLine.p1.y - ny * halfGap }
        ];
    } else {
        const limit1 = mid - gapPx / 2;
        const limit2 = mid + gapPx / 2;
        if (isVert) {
            roadRect = [{ x: limit1, y: bounds.minY }, { x: limit2, y: bounds.minY }, { x: limit2, y: bounds.maxY }, { x: limit1, y: bounds.maxY }];
        } else {
            roadRect = [{ x: bounds.minX, y: limit1 }, { x: bounds.minX, y: limit2 }, { x: bounds.maxX, y: limit2 }, { x: bounds.maxX, y: limit1 }];
        }
    }

    const road = new fabric.Polygon(roadRect, {
        fill: '#444', stroke: '#222', strokeWidth: 1, selectable: false, isInfra: true
    });
    road.points = roadRect;
    App.canvas.add(road);
    App.data.generatedObjects.push(road);

    App.canvas.requestRenderAll();
    updateAreaInfo();
}

export function generateGreenAreaBalanceManual() {
    let poly = App.objects.manualInnerBoundary;
    if (!poly || poly.length < 3) return alert("Generate pavement first to define inner boundary.");

    const depth = parseFloat(App.elements.plotDepth.value);
    const scale = App.state.scale;
    const std = UrbanStandards.Roads[document.getElementById('road-type').value || 'local'];
    const roadWidthPx = std.carriage / scale;

    // 1. Subtract Plot Area (Assume 2 rows back to back)
    const greenIsland = createInwardOffsetPolygon(poly, (2 * depth) / scale);
    if (!greenIsland || greenIsland.length < 3) return alert("No space left for green area after plots.");

    // 2. Subtract Bifurcated Road Area (Check if large island needs split)
    const bounds = getBounds(greenIsland);
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const limit = (depth / scale) * 5 + roadWidthPx;

    let subPolys = [greenIsland];
    if (w > limit || h > limit) {
        const isVert = w > h;
        const mid = isVert ? (bounds.minX + bounds.maxX) / 2 : (bounds.minY + bounds.maxY) / 2;
        const [sub1, sub2] = splitPolygon(greenIsland, isVert, mid, roadWidthPx);
        subPolys = [];
        if (sub1 && sub1.length > 2) subPolys.push(sub1);
        if (sub2 && sub2.length > 2) subPolys.push(sub2);
    }

    // Create editable Green Polygons
    subPolys.forEach(pts => {
        const pathData = pointsToPathData(pts);
        const green = new fabric.Path(pathData, {
            fill: 'rgba(76, 175, 80, 0.4)',
            stroke: '#2e7d32',
            strokeWidth: 1.5,
            selectable: true,
            isGreenArea: true,
            isGreen: true,
            objectCaching: false
        });
        green.points = pts; // Attached for vertex editing
        App.canvas.add(green);
        App.data.generatedObjects.push(green);
    });

    App.canvas.requestRenderAll();
}

export function editRoadCenterline() {
    if (!App.objects.roadCenterline) return alert("No road centerline found.");
    App.objects.activePolygon = App.objects.roadCenterline;
    setMode('edit');
    createVertexHandles();
}

export function editGreenArea() {
    // Find green area in generated objects or a dedicated reference
    const greenPoly = App.data.generatedObjects.find(o => o.isGreenArea || o.isGreen);
    if (!greenPoly) return alert("No green area found to edit.");
    App.objects.activePolygon = greenPoly;
    setMode('edit');
    createVertexHandles();
}

export function filletRoadCenterline() {
    if (!App.objects.roadCenterline) return alert("Draw road centerline first.");
    const r = parseFloat(document.getElementById('manual-fillet-val')?.value) || 15;
    const scale = App.state.scale;
    const points = App.objects.roadCenterline.points;
    const rPx = r / scale;

    const newPoints = [];
    const isClosed = points.length > 2 && Math.abs(points[0].x - points[points.length - 1].x) < 2 && Math.abs(points[0].y - points[points.length - 1].y) < 2;
    const len = points.length;
    // For open line, we process 1 to len-2. For closed, we process all (wrapped).

    if (len < 3) return;

    for (let i = 0; i < len; i++) {
        // Skip first and last corner if Open
        if (!isClosed && (i === 0 || i === len - 1)) {
            newPoints.push(points[i]);
            continue;
        }

        const p1 = points[i];
        const p0 = points[(i - 1 + len) % len]; // Prev
        const p2 = points[(i + 1) % len];     // Next

        // If open and i=0, p0 is last (wrap), which is wrong. 
        // But the check above handles open case boundaries.

        const v1 = { x: p0.x - p1.x, y: p0.y - p1.y };
        const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const l1 = Math.hypot(v1.x, v1.y);
        const l2 = Math.hypot(v2.x, v2.y);

        if (l1 < 0.1 || l2 < 0.1) { newPoints.push(p1); continue; }

        const u1 = { x: v1.x / l1, y: v1.y / l1 };
        const u2 = { x: v2.x / l2, y: v2.y / l2 };

        let dot = u1.x * u2.x + u1.y * u2.y;
        if (dot < -1) dot = -1; if (dot > 1) dot = 1;
        const angle = Math.acos(dot);

        if (Math.abs(angle - Math.PI) < 0.1 || Math.abs(angle) < 0.1) {
            newPoints.push(p1); // Straight line
            continue;
        }

        const halfTan = Math.tan(angle / 2);
        let d = rPx / halfTan;
        const limit = Math.min(l1, l2) * 0.45;
        if (d > limit) d = limit;

        const t1 = { x: p1.x + u1.x * d, y: p1.y + u1.y * d };
        const t2 = { x: p1.x + u2.x * d, y: p1.y + u2.y * d };

        // Quadratic Bezier approx (3 points: t1, mid, t2)
        const c = p1;
        const mid = {
            x: 0.25 * t1.x + 0.5 * c.x + 0.25 * t2.x,
            y: 0.25 * t1.y + 0.5 * c.y + 0.25 * t2.y
        };

        newPoints.push(t1);
        newPoints.push(mid);
        newPoints.push(t2);
    }

    // If closed, ensure start/end match exactly if they drifted? 
    // Usually standard logic handles it, but if points count change:
    if (isClosed) {
        // The loop above wraps. newPoints[0] corresponds to first point processing.
    }

    App.objects.roadCenterline.set({ points: newPoints });

    // Update path data if it's a Path object
    if (App.objects.roadCenterline.type === 'path') {
        const pathData = pointsToPathData(newPoints);
        const newPathObj = new fabric.Path(pathData);
        App.objects.roadCenterline.set({
            path: newPathObj.path,
            width: newPathObj.width,
            height: newPathObj.height
        });
    }

    App.objects.roadCenterline.setCoords();
    App.canvas.requestRenderAll();
}

export function generateRoadPolygon() {
    if (!App.objects.roadCenterline) return alert("Draw road centerline first.");
    const widthM = parseFloat(App.elements.laneWidth.value) * parseInt(App.elements.numLanes.value);
    const halfInd = widthM / 2;
    const scale = App.state.scale;
    const points = App.objects.roadCenterline.points;
    const isClosed = points.length > 2 && Math.abs(points[0].x - points[points.length - 1].x) < 1;

    const left = offsetPolyline(points, halfInd / scale, isClosed);
    const right = offsetPolyline(points, -halfInd / scale, isClosed);

    let polyPoints = [...left, ...right.reverse()];

    const road = new fabric.Polygon(polyPoints, {
        fill: '#555', stroke: '#333', strokeWidth: 1,
        selectable: false, isInfra: true
    });

    App.objects.manualRoad = road;
    App.data.generatedObjects.push(road);
    App.canvas.add(road);

    // Store road width for pavement gen
    App.objects.manualRoadWidth = widthM;
}

export function generatePavementPolygon() {
    if (!App.objects.roadCenterline) return alert("Generate Road first (centerline needed).");
    const widthM = App.objects.manualRoadWidth || (parseFloat(App.elements.laneWidth.value) * parseInt(App.elements.numLanes.value));
    const paveM = parseFloat(App.elements.pavementWidthLeft.value);
    const scale = App.state.scale;
    const totalOffset = (widthM / 2) + paveM;
    const innerOffset = widthM / 2;

    const points = App.objects.roadCenterline.points;
    const isClosed = points.length > 2 && Math.abs(points[0].x - points[points.length - 1].x) < 1;

    const outerLeft = offsetPolyline(points, totalOffset / scale, isClosed);
    const outerRight = offsetPolyline(points, -totalOffset / scale, isClosed);
    const innerLeft = offsetPolyline(points, innerOffset / scale, isClosed);
    const innerRight = offsetPolyline(points, -innerOffset / scale, isClosed);

    const lPave = new fabric.Polygon([...outerLeft, ...innerLeft.reverse()], { fill: '#ccc', stroke: '#999', isInfra: true });
    const rPave = new fabric.Polygon([...outerRight, ...innerRight.reverse()], { fill: '#ccc', stroke: '#999', isInfra: true });

    App.canvas.add(lPave);
    App.canvas.add(rPave);
    App.data.generatedObjects.push(lPave, rPave);

    // Identify Inner Boundary for plots automatically by comparing area (smaller area = inner loop)
    if (isClosed && outerLeft.length > 2 && outerRight.length > 2) {
        const aL = polygonArea(outerLeft);
        const aR = polygonArea(outerRight);
        App.objects.manualInnerBoundary = (aL < aR) ? outerLeft : outerRight;
    } else {
        // Fallback for open lines or if area calc fails
        App.objects.manualInnerBoundary = outerRight;
    }
}

export function connectEntryExit() {
    // Prefer connecting to centerline for robust intersection
    const targetPoints = (App.objects.roadCenterline && App.objects.roadCenterline.points) ? App.objects.roadCenterline.points : (App.objects.manualRoad ? App.objects.manualRoad.points : null);

    if (!targetPoints) return alert("Generate road centerline or polygon first.");

    const std = UrbanStandards.Roads[document.getElementById('road-type').value];
    const scale = App.state.scale;
    const r = 15;

    ['entry', 'exit'].forEach(mode => {
        const pt = mode === 'entry' ? EntryExitState.entryPoint : EntryExitState.exitPoint;
        if (pt) {
            const objs = createEntryExitRoad(pt, targetPoints, std, scale, r, mode);
            if (objs) {
                objs.forEach(o => { App.canvas.add(o); App.data.generatedObjects.push(o); });
            }
        }
    });
}

export function generatePlotsManual() {
    let poly = App.objects.manualInnerBoundary;

    // Auto-generate pavement if missing
    if (!poly || poly.length < 3) {
        if (App.objects.roadCenterline) {
            generatePavementPolygon();
            poly = App.objects.manualInnerBoundary;
        } else {
            return alert("Draw road centerline first.");
        }
    }

    if (!poly || poly.length < 3) return alert("Failed to generate plot boundary.");

    const depth = parseFloat(App.elements.plotDepth.value);
    const width = parseFloat(App.elements.plotWidth.value);

    // Use target Percentages for Green/Amenity
    const greenPct = parseFloat(document.getElementById('green-area')?.value || 0);
    const amenityPct = parseFloat(document.getElementById('amenities-area')?.value || 0);

    // Try hybrid fill with targets
    const plots = fillInnerArea(poly, depth, width, 0, greenPct, amenityPct, 'mediumDensity', 'mixed');
    plots.forEach(p => App.canvas.add(p));
    App.data.generatedObjects.push(...plots);
    App.canvas.requestRenderAll();
}

export function drawGreenManual() {
    createInnerGreenAreaPolygon();
}



export function recalculateAreaManual() {
    const scale = App.state.scale;
    let plotA = 0, greenA = 0, infraA = 0;
    App.data.generatedObjects.forEach(o => {
        const a = o.points ? polygonArea(o.points) * scale * scale : 0;
        if (o.isPlot) plotA += a;
        else if (o.isGreen || o.isGreenArea) greenA += a;
        else if (o.isInfra) infraA += a;
    });
    const total = plotA + greenA + infraA; // Approx total usage
    alert(`Breakdown:\nTotal Used: ${total.toFixed(0)}m2\nPlots: ${plotA.toFixed(0)}\nGreen: ${greenA.toFixed(0)}\nInfra: ${infraA.toFixed(0)}`);
}

export function restartDesign() {
    if (confirm("Clear all generated items? Site boundary will remain.")) {
        clearGeneratedLayout();
        App.objects.manualRoad = null;
        App.objects.manualInnerBoundary = null;
        App.data.roadCenterlinePoints = [];

        // Ensure master polygon is active/visible
        if (App.objects.masterPolygon) {
            App.objects.masterPolygon.set({ visible: true, opacity: 1 });
            App.canvas.renderAll();
        }
    }
}

export function deleteSelectedPolygon() {
    const activeObjects = App.canvas.getActiveObjects();
    if (activeObjects.length === 0) return alert("Select objects to delete.");

    let count = 0;
    activeObjects.forEach(obj => {
        if (obj !== App.objects.masterPolygon) {
            App.canvas.remove(obj);
            App.data.generatedObjects = App.data.generatedObjects.filter(o => o !== obj);
            count++;
        }
    });

    App.canvas.discardActiveObject();
    App.canvas.requestRenderAll();
    updateAreaInfo();
}
