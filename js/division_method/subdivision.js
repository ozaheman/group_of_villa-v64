import { App } from '../appState.js';
import { getBounds, splitPolygon, polygonSignedArea } from '../utils.js';
import { UrbanStandards } from '../standards.js';
import { generatePlotsAlongEdges } from '../generative.js';

/**
 * Site Plan 3: Hierarchical Subdivision method
 */
export function fillInnerAreaWithSubdivisionPlan(points, depth, width, garden, densityZone, protoChoice = 'mixed') {
    const plots = [], scale = App.state.scale;
    const std = UrbanStandards.Roads[document.getElementById('road-type').value || 'local'];
    const roadWidthPx = std.carriage / scale;
    const paveWidthPx = std.footpath / scale;
    const totalRoadWidthPx = roadWidthPx + (paveWidthPx * 2);

    const bounds = getBounds(points);
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const isVert = w > h;

    // 1. Create Main Spine Road through center
    const mid = isVert ? (bounds.minX + bounds.maxX) / 2 : (bounds.minY + bounds.maxY) / 2;
    const [ptsL, ptsR] = splitPolygon(points, isVert, mid, totalRoadWidthPx);

    // Add Spine Road visual
    const spineRect = isVert ?
        [{ x: mid - roadWidthPx / 2, y: bounds.minY }, { x: mid + roadWidthPx / 2, y: bounds.minY }, { x: mid + roadWidthPx / 2, y: bounds.maxY }, { x: mid - roadWidthPx / 2, y: bounds.maxY }] :
        [{ x: bounds.minX, y: mid - roadWidthPx / 2 }, { x: bounds.minX, y: mid + roadWidthPx / 2 }, { x: bounds.maxX, y: mid + roadWidthPx / 2 }, { x: bounds.maxX, y: mid - roadWidthPx / 2 }];

    const spine = new fabric.Polygon(spineRect, { fill: '#444', stroke: '#222', strokeWidth: 1, selectable: false, isInfra: true });
    spine.points = spineRect;
    plots.push(spine);

    // 2. Add Feeder Roads and Fill Blocks
    const blocks1 = [ptsL, ptsR].filter(p => p && p.length > 2);
    blocks1.forEach((blockPoints) => {
        const blockBounds = getBounds(blockPoints);
        const interval = (width * 8) / scale;

        let prevPos = (isVert ? blockBounds.minY : blockBounds.minX);
        for (let pos = prevPos + interval; pos < (isVert ? blockBounds.maxY : blockBounds.maxX); pos += interval) {
            const [b1, b2] = splitPolygon(blockPoints, !isVert, pos, totalRoadWidthPx);

            if (b1 && b1.length > 2) {
                const subPlots = generatePlotsAlongEdges(b1, depth, width, polygonSignedArea(b1) < 0, [], densityZone, false, protoChoice);
                plots.push(...subPlots);
            }

            const feederRect = isVert ?
                [{ x: blockBounds.minX, y: pos - roadWidthPx / 2 }, { x: blockBounds.maxX, y: pos - roadWidthPx / 2 }, { x: blockBounds.maxX, y: pos + roadWidthPx / 2 }, { x: blockBounds.minX, y: pos + roadWidthPx / 2 }] :
                [{ x: pos - roadWidthPx / 2, y: blockBounds.minY }, { x: pos + roadWidthPx / 2, y: blockBounds.minY }, { x: pos + roadWidthPx / 2, y: blockBounds.maxY }, { x: pos - roadWidthPx / 2, y: blockBounds.maxY }];

            const feeder = new fabric.Polygon(feederRect, { fill: '#444', stroke: '#222', strokeWidth: 1, selectable: false, isInfra: true });
            feeder.points = feederRect;
            plots.push(feeder);

            blockPoints = b2;
        }

        // Final block
        if (blockPoints && blockPoints.length > 2) {
            const finalPlots = generatePlotsAlongEdges(blockPoints, depth, width, polygonSignedArea(blockPoints) < 0, [], densityZone, false, protoChoice);
            plots.push(...finalPlots);
        }
    });

    return plots;
}
