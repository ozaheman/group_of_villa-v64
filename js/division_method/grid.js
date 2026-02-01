import { App } from '../appState.js';
import { isPointInPolygon } from '../utils.js';

/**
 * Grid Bifurcation: Creates orthogonal grid pattern
 */
export function fillInnerAreaWithGridBifurcation(points, depth, width, garden, densityZone, protoChoice = 'mixed') {
    const plots = [], scale = App.state.scale;
    const depthPx = depth / scale, widthPx = width / scale;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });

    // Create grid of plots
    for (let y = minY; y < maxY; y += depthPx) {
        for (let x = minX; x < maxX; x += widthPx) {
            const plotPoints = [
                { x, y }, { x: x + widthPx, y },
                { x: x + widthPx, y: y + depthPx }, { x, y: y + depthPx }
            ];
            // Check if plot center is inside polygon
            const center = { x: x + widthPx / 2, y: y + depthPx / 2 };
            if (isPointInPolygon(center, points)) {
                const plot = new fabric.Polygon(plotPoints, {
                    fill: '#E3F2FD', stroke: '#666', strokeWidth: 0.5, isPlot: true,
                    area: widthPx * depthPx * scale * scale, selectable: false
                });
                plot.points = plotPoints;
                plots.push(plot);
            }
        }
    }
    return plots;
}
