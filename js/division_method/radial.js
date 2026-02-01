import { App } from '../appState.js';
import { isPointInPolygon, polygonArea } from '../utils.js';

/**
 * Radial Bifurcation: Creates roads radiating from center
 */
export function fillInnerAreaWithRadialBifurcation(points, depth, width, garden, densityZone, protoChoice = 'mixed') {
    const plots = [], scale = App.state.scale;

    // Find centroid
    let cx = 0, cy = 0;
    points.forEach(p => { cx += p.x; cy += p.y; });
    cx /= points.length; cy /= points.length;

    // Create radial sectors (8 sectors)
    const sectors = 8;
    for (let i = 0; i < sectors; i++) {
        const angle1 = (i / sectors) * Math.PI * 2;
        const angle2 = ((i + 1) / sectors) * Math.PI * 2;

        // Place plots along each sector
        for (let r = depth / scale; r < 2000 / scale; r += depth / scale) {
            const plotCenter = {
                x: cx + Math.cos((angle1 + angle2) / 2) * (r + depth / (2 * scale)),
                y: cy + Math.sin((angle1 + angle2) / 2) * (r + depth / (2 * scale))
            };

            if (isPointInPolygon(plotCenter, points)) {
                const plotPoints = [
                    { x: cx + Math.cos(angle1) * r, y: cy + Math.sin(angle1) * r },
                    { x: cx + Math.cos(angle2) * r, y: cy + Math.sin(angle2) * r },
                    { x: cx + Math.cos(angle2) * (r + depth / scale), y: cy + Math.sin(angle2) * (r + depth / scale) },
                    { x: cx + Math.cos(angle1) * (r + depth / scale), y: cy + Math.sin(angle1) * (r + depth / scale) }
                ];
                const plot = new fabric.Polygon(plotPoints, {
                    fill: '#FFF9C4', stroke: '#666', strokeWidth: 0.5, isPlot: true,
                    area: polygonArea(plotPoints) * scale * scale, selectable: false
                });
                plot.points = plotPoints;
                plots.push(plot);
            }
        }
    }
    return plots;
}
