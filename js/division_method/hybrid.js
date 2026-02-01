import { App } from '../appState.js';
import { polygonArea, polygonSignedArea, getBounds, splitPolygon, createInwardOffsetPolygon } from '../utils.js';
import { UrbanStandards } from '../standards.js';
import { generatePlotsAlongEdges } from '../generative.js';

/**
 * Hybrid/Recursive Bifurcation: The standard smart subdivision logic.
 */
export function fillInnerArea(points, depth, width, garden, targetGreen, targetAmenity, densityZone, protoChoice = 'mixed', recursionLevel = 0) {
    const scale = App.state.scale;
    const std = UrbanStandards.Roads[document.getElementById('road-type').value || 'local'];
    const roadWidthPx = std.carriage / scale;
    const plotDepthPx = depth / scale;

    if (recursionLevel > 40 || plotDepthPx < 0.1 || points.length < 3) return [];
    const currentArea = polygonArea(points);
    if (currentArea < (plotDepthPx ** 2) * 0.1) return [];

    const bounds = getBounds(points);
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const limit = plotDepthPx * 5 + roadWidthPx;

    if (points.length > 2 && (w > limit || h > limit)) {
        const isVert = w > h;
        const mid = isVert ? (bounds.minX + bounds.maxX) / 2 : (bounds.minY + bounds.maxY) / 2;
        const [sub1, sub2] = splitPolygon(points, isVert, mid, roadWidthPx);

        let results = [];
        if (sub1 && sub1.length > 2) {
            const a1 = polygonArea(sub1);
            if (a1 < currentArea * 0.98) {
                results.push(...fillInnerArea(sub1, depth, width, garden, targetGreen, targetAmenity, densityZone, protoChoice, recursionLevel + 1));
            }
        }
        if (sub2 && sub2.length > 2) {
            const a2 = polygonArea(sub2);
            if (a2 < currentArea * 0.98) {
                results.push(...fillInnerArea(sub2, depth, width, garden, targetGreen, targetAmenity, densityZone, protoChoice, recursionLevel + 1));
            }
        }
        return results;
    }

    const plots = [];
    const row1 = generatePlotsAlongEdges(points, depth, width, polygonSignedArea(points) < 0, [], densityZone, false, protoChoice);
    plots.push(...row1);

    const remainder = createInwardOffsetPolygon(points, (depth * 2 + garden) / scale);
    if (remainder && remainder.length >= 3) {
        const nextArea = polygonArea(remainder);
        if (nextArea > (depth / scale) ** 2 && nextArea < currentArea * 0.9) {
            const subPlots = fillInnerArea(remainder, depth, width, garden, targetGreen, targetAmenity, densityZone, protoChoice, recursionLevel + 1);
            plots.push(...subPlots);
        }
    }

    const blockArea = polygonArea(points) * scale * scale;
    const neededGreen = blockArea * (targetGreen / 100);
    const neededAmenity = blockArea * (targetAmenity / 100);

    const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    plots.sort((a, b) => {
        const pa = a.points ? a.points[0] : { x: 0, y: 0 };
        const pb = b.points ? b.points[0] : { x: 0, y: 0 };
        const da = Math.hypot(pa.x - center.x, pa.y - center.y);
        const db = Math.hypot(pb.x - center.x, pb.y - center.y);
        return da - db;
    });

    let currentGreen = 0, currentAmenity = 0;
    for (const plot of plots) {
        if (plot.isPlot) {
            const pArea = (plot.area || 0);
            if (currentGreen < neededGreen) {
                plot.set({ fill: 'rgba(76, 175, 80, 0.5)', stroke: '#2e7d32', isPlot: false, isGreen: true });
                currentGreen += pArea;
            } else if (currentAmenity < neededAmenity) {
                plot.set({ fill: '#ffcc80', stroke: '#ef6c00', isPlot: false, isAmenity: true });
                currentAmenity += pArea;
            }
        }
    }

    return plots;
}
