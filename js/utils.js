//--- START OF FILE js/utils.js ---

/**
 * Checks if a point is inside a polygon.
 * @param {{x: number, y: number}} point - The point to check.
 * @param {Array<{x: number, y: number}>} vs - The vertices of the polygon.
 * @returns {boolean} - True if the point is inside.
 */
export function isPointInPolygon(point, vs) {
    const x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].x, yi = vs[i].y;
        const xj = vs[j].x, yj = vs[j].y;
        const intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Calculates the area of a polygon.
 * @param {Array<{x: number, y: number}>} points - The vertices of the polygon.
 * @returns {number} - The area of the polygon in pixel units.
 */
export function polygonArea(points) {
    return Math.abs(polygonSignedArea(points));
}

/**
 * Calculates the signed area of a polygon. The sign indicates the winding order.
 * (e.g., positive for counter-clockwise, negative for clockwise).
 * @param {Array<{x: number, y: number}>} points - The vertices of the polygon.
 * @returns {number} - The signed area.
 */
export function polygonSignedArea(points) {
    let area = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    return area / 2;
}

/**
 * Calculates the midpoint of an arc defined by two points and a bulge.
 */
export function getArcMidpoint(p1, p2, bulge) {
    if (!bulge || bulge === 0) {
        return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const d = Math.hypot(dx, dy);
    const s = d / 2; // half-chord
    const h = s * bulge; // sagitta

    // Midpoint of the chord
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;

    // Normal to the chord
    const nx = -dy / d;
    const ny = dx / d;

    // Peak of the arc
    return {
        x: mx + nx * h,
        y: my + ny * h
    };
}

/**
 * Calculates the bulge from two points and a midpoint (peak) of the arc.
 */
export function getBulgeFromMidpoint(p1, p2, mid) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return 0;

    // Midpoint of the chord
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;

    // Vector from chord midpoint to arc midpoint
    const vx = mid.x - mx;
    const vy = mid.y - my;

    // Project this vector onto the normal
    const nx = -dy / d;
    const ny = dx / d;
    const h = vx * nx + vy * ny;

    return h / (d / 2);
}

/**
 * Converts points with bulge data into a Fabric path string.
 */
export function pointsToPathData(points) {
    if (!points || points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const bulge = p1.bulge || 0;

        if (bulge === 0) {
            d += ` L ${p2.x} ${p2.y}`;
        } else {
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const r = (dist / 2) * (1 + bulge * bulge) / (2 * Math.abs(bulge));
            const largeArc = Math.abs(bulge) > 1 ? 1 : 0;
            const sweep = bulge > 0 ? 1 : 0;
            d += ` A ${r} ${r} 0 ${largeArc} ${sweep} ${p2.x} ${p2.y}`;
        }
    }
    return d + ' Z';
}


/**
 * Calculates the shortest distance from a point to a line segment.
 */
export function distToSegment(p, v, w) {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

/**
 * Creates a robust inward offset of a polygon by creating two offsets and
 * returning the one with the smaller area.
 * @param {Array} points The points of the polygon to offset.
 * @param {number} offsetDistance The positive distance to offset.
 * @returns {Array} The points of the new inner polygon.
 */
export function createInwardOffsetPolygon(points, offsetDistance) {
    // Generate both possible offset polygons
    const poly1_pts = offsetPolyline(points, offsetDistance, true);
    const poly2_pts = offsetPolyline(points, -offsetDistance, true);

    // If either failed to produce a valid polygon, return the other or an empty array
    if (poly1_pts.length < 3) return poly2_pts;
    if (poly2_pts.length < 3) return poly1_pts;

    // Calculate the area of each
    const area1 = polygonArea(poly1_pts);
    const area2 = polygonArea(poly2_pts);

    // Return the points of the polygon with the smaller area
    return area1 < area2 ? poly1_pts : poly2_pts;
}


/**
 * Creates an offset (parallel) polyline by offsetting each segment one-by-one
 * and intersecting them. This ensures perfect parallelism.
 */
export function offsetPolyline(points, offset, isClosed) {
    const segments = [];
    const pointCount = points.length;
    if (pointCount < 2) return points;

    // 1. Create offset segments
    for (let i = 0; i < (isClosed ? pointCount : pointCount - 1); i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % pointCount];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;

        // Normal vector
        const nx = -dy / len;
        const ny = dx / len;

        segments.push({
            a: { x: p1.x + nx * offset, y: p1.y + ny * offset },
            b: { x: p2.x + nx * offset, y: p2.y + ny * offset }
        });
    }

    if (segments.length === 0) return [];

    // 2. Intersect adjacent segments to find new vertices
    const newPoints = [];
    for (let i = 0; i < segments.length; i++) {
        const s1 = segments[(i + segments.length - 1) % segments.length];
        const s2 = segments[i];

        const intersect = getLineIntersection(s1.a, s1.b, s2.a, s2.b);
        if (intersect) {
            newPoints.push(intersect);
        } else {
            // Parallel or nearly parallel: just use the common point
            newPoints.push(s2.a);
        }
    }

    if (isClosed && newPoints.length > 0) {
        newPoints.push({ ...newPoints[0] });
    }
    return newPoints;
}

/**
 * Basic line-line intersection (infinite lines).
 */
export function getLineIntersection(p1, p2, p3, p4) {
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 1e-10) return null; // Parallel
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    return {
        x: x1 + ua * (x2 - x1),
        y: y1 + ua * (y2 - y1)
    };
}

/**
 * Line segment intersection.
 */
export function getSegmentIntersection(p1, p2, p3, p4) {
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 1e-10) return null;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return {
            x: x1 + ua * (x2 - x1),
            y: y1 + ua * (y2 - y1)
        };
    }
    return null;
}

/**
 * Clips a polygon against an infinite line defined by p1 and p2.
 * @param {Array} polyPoints - Points of the polygon
 * @param {Object} lineP1 - First point of the line
 * @param {Object} lineP2 - Second point of the line
 * @param {Number} side - Which side to keep (1 or -1)
 */
export function clipPolygon(polyPoints, lineP1, lineP2, side) {
    const newPts = [];
    const dx = lineP2.x - lineP1.x;
    const dy = lineP2.y - lineP1.y;
    const nx = -dy;
    const ny = dx;

    const isInside = (p) => {
        const dot = (p.x - lineP1.x) * nx + (p.y - lineP1.y) * ny;
        return (side * dot) >= 0;
    };

    for (let i = 0; i < polyPoints.length; i++) {
        const curr = polyPoints[i];
        const prev = polyPoints[(i - 1 + polyPoints.length) % polyPoints.length];

        const currIn = isInside(curr);
        const prevIn = isInside(prev);

        if (currIn) {
            if (!prevIn) {
                const inter = getLineIntersection(prev, curr, lineP1, lineP2);
                if (inter) newPts.push(inter);
            }
            newPts.push(curr);
        } else if (prevIn) {
            const inter = getLineIntersection(prev, curr, lineP1, lineP2);
            if (inter) newPts.push(inter);
        }
    }
    return newPts;
}

/**
 * Splits a polygon by a segment with a gap.
 * @param {Array} points - Polygon points
 * @param {Object} p1 - Start of segment
 * @param {Object} p2 - End of segment
 * @param {Number} gap - Gap width
 */
export function splitPolygonGeneral(points, p1, p2, gap) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return [points, []];

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const halfGap = gap / 2;
    const l1_p1 = { x: p1.x + nx * halfGap, y: p1.y + ny * halfGap };
    const l1_p2 = { x: p2.x + nx * halfGap, y: p2.y + ny * halfGap };
    const l2_p1 = { x: p1.x - nx * halfGap, y: p1.y - ny * halfGap };
    const l2_p2 = { x: p2.x - nx * halfGap, y: p2.y - ny * halfGap };

    const sub1 = clipPolygon(points, l1_p1, l1_p2, 1);
    const sub2 = clipPolygon(points, l2_p1, l2_p2, -1);

    return [sub1, sub2];
}
