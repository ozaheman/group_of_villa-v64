import { App } from '../appState.js';
import { isPointInPolygon, polygonArea } from '../utils.js';

/**
 * Organic Bifurcation: Creates irregular, natural-looking subdivisions
 */
export function fillInnerAreaWithOrganicBifurcation(points, depth, width, garden, densityZone, protoChoice = 'mixed') {
    const plots = [], scale = App.state.scale;

    // Use Voronoi-like subdivision (simplified)
    const numSeeds = Math.floor(polygonArea(points) * scale * scale / (depth * width * 2.5));
    const seeds = [];

    // Generate random seed points inside polygon
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });

    for (let i = 0; i < Math.min(numSeeds, 50); i++) {
        let attempts = 0;
        while (attempts < 50) {
            const x = minX + Math.random() * (maxX - minX);
            const y = minY + Math.random() * (maxY - minY);
            if (isPointInPolygon({ x, y }, points)) {
                seeds.push({ x, y });
                break;
            }
            attempts++;
        }
    }

    // Create organic plots around seeds
    seeds.forEach(seed => {
        const size = (depth / scale) * (0.8 + Math.random() * 0.4);
        const rotation = Math.random() * Math.PI * 2;
        const plotPoints = [];
        const sides = 4 + Math.floor(Math.random() * 3); // 4-6 sides

        for (let i = 0; i < sides; i++) {
            const angle = rotation + (i / sides) * Math.PI * 2;
            plotPoints.push({
                x: seed.x + Math.cos(angle) * size,
                y: seed.y + Math.sin(angle) * size
            });
        }

        const plot = new fabric.Polygon(plotPoints, {
            fill: '#C8E6C9', stroke: '#666', strokeWidth: 0.5, isPlot: true,
            area: polygonArea(plotPoints) * scale * scale, selectable: false
        });
        plot.points = plotPoints;
        plots.push(plot);
    });

    return plots;
}
