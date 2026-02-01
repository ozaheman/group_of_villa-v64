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
 * Calculates the oriented bounding box (tight bounding box) for a set of points.
 * @param {Array<{x: number, y: number}>} points - The vertices of the polygon.
 * @returns {{width: number, height: number, area: number, angle: number}} - The OBB properties.
 */
export function getOrientedBoundingRect(points) {
    if (!points || points.length < 3) return null;
    let minArea = Infinity;
    let bestOBB = null;

    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;

        const angle = Math.atan2(dy, dx);
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const p of points) {
            const rx = (p.x * cos - p.y * sin);
            const ry = (p.x * sin + p.y * cos);
            if (rx < minX) minX = rx;
            if (rx > maxX) maxX = rx;
            if (ry < minY) minY = ry;
            if (ry > maxY) maxY = ry;
        }

        const width = maxX - minX;
        const height = maxY - minY;
        const area = width * height;

        if (area < minArea) {
            minArea = area;
            bestOBB = { width, height, area, angle };
        }
    }
    return bestOBB;
}

/**
 * Splits a polygon by a general line defined by two points, with an optional gap.
 * @param {Array<{x: number, y: number}>} points - The vertices of the polygon.
 * @param {{x: number, y: number}} p1 - Start point of the splitting line.
 * @param {{x: number, y: number}} p2 - End point of the splitting line.
 * @param {number} gap - The width of the gap between the resulting polygons.
 * @returns {Array<Array<{x: number, y: number}>>} - Two resulting polygons (as point arrays).
 */
export function splitPolygonGeneral(points, p1, p2, gap = 0) {
    const halfGap = gap / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return [points, []];

    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;

    // Helper to clip polygon by a line
    function clipByLine(pts, lp1, lp2, side) {
        const newPts = [];
        const ldx = lp2.x - lp1.x, ldy = lp2.y - lp1.y;
        for (let i = 0; i < pts.length; i++) {
            const curr = pts[i];
            const prev = pts[(i - 1 + pts.length) % pts.length];

            // Cross product to find side: (x - x1)(y2 - y1) - (y - y1)(x2 - x1)
            const currSide = (curr.x - lp1.x) * ldy - (curr.y - lp1.y) * ldx;
            const prevSide = (prev.x - lp1.x) * ldy - (prev.y - lp1.y) * ldx;

            const currIn = (side > 0) ? currSide >= -1e-6 : currSide <= 1e-6;
            const prevIn = (side > 0) ? prevSide >= -1e-6 : prevSide <= 1e-6;

            if (currIn) {
                if (!prevIn) {
                    const inter = getLineIntersection(prev, curr, lp1, lp2);
                    if (inter) newPts.push(inter);
                }
                newPts.push(curr);
            } else if (prevIn) {
                const inter = getLineIntersection(prev, curr, lp1, lp2);
                if (inter) newPts.push(inter);
            }
        }
        return newPts;
    }

    const line1P1 = { x: p1.x + nx * halfGap, y: p1.y + ny * halfGap };
    const line1P2 = { x: p2.x + nx * halfGap, y: p2.y + ny * halfGap };
    const line2P1 = { x: p1.x - nx * halfGap, y: p1.y - ny * halfGap };
    const line2P2 = { x: p2.x - nx * halfGap, y: p2.y - ny * halfGap };

    const sub1 = clipByLine(points, line1P1, line1P2, 1);
    const sub2 = clipByLine(points, line2P1, line2P2, -1);

    // If clipping failed or produced invalid results, return the original or empty
    return [sub1.length >= 3 ? sub1 : [], sub2.length >= 3 ? sub2 : []];
}

/**
 * Gets the axis-aligned bounding box of a set of points.
 */
export function getBounds(points) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    return { minX, maxX, minY, maxY };
}

/**
 * Splits a polygon by an axis-aligned line with a gap.
 */
export function splitPolygon(points, isVert, mid, gap) {
    const halfGap = gap / 2;
    const limit1 = mid - halfGap;
    const limit2 = mid + halfGap;

    function clip(polyPoints, sign, limit) {
        const newPts = [];
        for (let i = 0; i < polyPoints.length; i++) {
            const curr = polyPoints[i];
            const prev = polyPoints[(i - 1 + polyPoints.length) % polyPoints.length];
            const currVal = isVert ? curr.x : curr.y;
            const prevVal = isVert ? prev.x : prev.y;
            const currIn = sign > 0 ? currVal >= limit : currVal <= limit;
            const prevIn = sign > 0 ? prevVal >= limit : prevVal <= limit;

            if (currIn) {
                if (!prevIn) {
                    const t = (limit - prevVal) / (currVal - prevVal);
                    newPts.push({ x: prev.x + t * (curr.x - prev.x), y: prev.y + t * (curr.y - prev.y) });
                }
                newPts.push(curr);
            } else if (prevIn) {
                const t = (limit - prevVal) / (currVal - prevVal);
                newPts.push({ x: prev.x + t * (curr.x - prev.x), y: prev.y + t * (curr.y - prev.y) });
            }
        }
        return newPts;
    }

    return [clip(points, -1, limit1), clip(points, 1, limit2)];
}
