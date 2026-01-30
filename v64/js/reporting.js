//--- START OF FILE js/reporting.js ---

import { App } from './appState.js';
import { polygonArea } from './utils.js';
import { UrbanStandards } from './standards.js';

/**
 * Generate comprehensive project report data
 */
export function generateReportData() {
    if (!App.objects.masterPolygon) {
        alert("Please create a site layout first.");
        return null;
    }

    const scale = App.state.scale;
    const totalSiteAreaM2 = polygonArea(App.objects.masterPolygon.points) * scale * scale;
    const plots = App.data.generatedObjects.filter(o => o.isPlot);

    // Calculate plot statistics by type
    const plotsByType = {};
    const plotsBySocial = { 'EWS/LIG': 0, 'MIG': 0, 'HIG': 0 };
    let totalPlotArea = 0;
    let totalBuiltupArea = 0;

    plots.forEach(plot => {
        const protoType = plot.protoType || 'Unknown';
        const socialType = plot.socialType || 'HIG';
        const plotArea = plot.area || 0;

        if (!plotsByType[protoType]) {
            plotsByType[protoType] = { count: 0, area: 0 };
        }
        plotsByType[protoType].count++;
        plotsByType[protoType].area += plotArea;

        plotsBySocial[socialType] = (plotsBySocial[socialType] || 0) + 1;
        totalPlotArea += plotArea;

        // Estimate built-up area (assuming 40% ground coverage)
        totalBuiltupArea += plotArea * 0.4;
    });

    // Infrastructure calculations
    const roads = App.data.generatedObjects.filter(o => o.isInfra || (o.fill && o.fill.includes('#444')));
    const pavements = App.data.generatedObjects.filter(o => o.fill && o.fill.includes('#ccc'));
    const greenSpaces = App.data.generatedObjects.filter(o => o.isGreen || o.isGreenArea);
    const parkingSpaces = App.data.generatedObjects.filter(o => o.isParking);

    let roadArea = 0, pavementArea = 0, greenArea = 0;

    roads.forEach(r => { if (r.points) roadArea += polygonArea(r.points) * scale * scale; });
    pavements.forEach(p => { if (p.points) pavementArea += polygonArea(p.points) * scale * scale; });
    greenSpaces.forEach(g => { if (g.points) greenArea += polygonArea(g.points) * scale * scale; });

    // Urban planning metrics
    const plotCoverage = (totalPlotArea / totalSiteAreaM2) * 100;
    const greenPercentage = (greenArea / totalSiteAreaM2) * 100;
    const infraPercentage = ((roadArea + pavementArea) / totalSiteAreaM2) * 100;
    const density = (plots.length / (totalSiteAreaM2 / 10000)); // plots per hectare
    const far = totalBuiltupArea / totalSiteAreaM2;

    // Electrical load calculation (assuming 5 kW per plot)
    const electricalLoad = plots.length * 5;
    const connectedLoad = parseFloat(document.getElementById('load')?.value || 1500);
    const demandFactor = Math.min(1, connectedLoad / electricalLoad);

    // Parking calculations
    const requiredParking = plots.length * 2; // 2 per plot
    const visitorParking = parkingSpaces.length;
    const totalParking = requiredParking + visitorParking;

    // Setback compliance (from standards)
    const setbacks = UrbanStandards.Setbacks;

    return {
        // Site Information
        site: {
            totalArea: totalSiteAreaM2,
            scale: scale,
            gfa: parseFloat(document.getElementById('gfa')?.value || 0)
        },

        // Plot Statistics
        plots: {
            total: plots.length,
            byType: plotsByType,
            bySocial: plotsBySocial,
            totalArea: totalPlotArea,
            averageArea: totalPlotArea / plots.length || 0
        },

        // Built-up Area
        builtup: {
            total: totalBuiltupArea,
            groundCoverage: (totalBuiltupArea / totalPlotArea) * 100,
            far: far
        },

        // Infrastructure
        infrastructure: {
            roadArea: roadArea,
            pavementArea: pavementArea,
            totalInfra: roadArea + pavementArea,
            percentage: infraPercentage
        },

        // Green Space
        green: {
            area: greenArea,
            percentage: greenPercentage
        },

        // Parking
        parking: {
            required: requiredParking,
            visitor: visitorParking,
            total: totalParking,
            ratio: totalParking / plots.length
        },

        // Electrical
        electrical: {
            loadPerPlot: 5,
            totalLoad: electricalLoad,
            connectedLoad: connectedLoad,
            demandFactor: demandFactor
        },

        // Urban Metrics
        metrics: {
            density: density,
            plotCoverage: plotCoverage,
            far: far,
            openSpaceRatio: (greenArea + pavementArea) / totalSiteAreaM2
        },

        // Setbacks
        setbacks: setbacks
    };
}

/**
 * Export report as CSV
 */
export function exportCSV() {
    const data = generateReportData();
    if (!data) return;

    let csv = "Master Plan Report\n\n";

    // Site Information
    csv += "SITE INFORMATION\n";
    csv += `Total Site Area,${data.site.totalArea.toFixed(2)} m²\n`;
    csv += `Scale,1px = ${data.site.scale.toFixed(2)}m\n`;
    csv += `Target GFA,${data.site.gfa.toFixed(2)} m²\n\n`;

    // Plot Summary
    csv += "PLOT SUMMARY\n";
    csv += `Total Plots,${data.plots.total}\n`;
    csv += `Total Plot Area,${data.plots.totalArea.toFixed(2)} m²\n`;
    csv += `Average Plot Area,${data.plots.averageArea.toFixed(2)} m²\n\n`;

    // Plots by Type
    csv += "PLOTS BY TYPE\n";
    csv += "Type,Count,Total Area (m²)\n";
    Object.entries(data.plots.byType).forEach(([type, info]) => {
        csv += `${type},${info.count},${info.area.toFixed(2)}\n`;
    });
    csv += "\n";

    // Social Mix
    csv += "SOCIAL MIX\n";
    csv += "Category,Count\n";
    Object.entries(data.plots.bySocial).forEach(([type, count]) => {
        csv += `${type},${count}\n`;
    });
    csv += "\n";

    // Built-up Area
    csv += "BUILT-UP AREA\n";
    csv += `Total Built-up Area,${data.builtup.total.toFixed(2)} m²\n`;
    csv += `Ground Coverage,${data.builtup.groundCoverage.toFixed(2)}%\n`;
    csv += `FAR,${data.builtup.far.toFixed(2)}\n\n`;

    // Infrastructure
    csv += "INFRASTRUCTURE\n";
    csv += `Road Area,${data.infrastructure.roadArea.toFixed(2)} m²\n`;
    csv += `Pavement Area,${data.infrastructure.pavementArea.toFixed(2)} m²\n`;
    csv += `Total Infrastructure,${data.infrastructure.totalInfra.toFixed(2)} m²\n`;
    csv += `Infrastructure %,${data.infrastructure.percentage.toFixed(2)}%\n\n`;

    // Green Space
    csv += "GREEN SPACE\n";
    csv += `Green Area,${data.green.area.toFixed(2)} m²\n`;
    csv += `Green %,${data.green.percentage.toFixed(2)}%\n\n`;

    // Parking
    csv += "PARKING\n";
    csv += `Required Parking,${data.parking.required}\n`;
    csv += `Visitor Parking,${data.parking.visitor}\n`;
    csv += `Total Parking,${data.parking.total}\n`;
    csv += `Parking Ratio,${data.parking.ratio.toFixed(2)} per plot\n\n`;

    // Electrical
    csv += "ELECTRICAL LOAD\n";
    csv += `Load per Plot,${data.electrical.loadPerPlot} kW\n`;
    csv += `Total Load,${data.electrical.totalLoad} kW\n`;
    csv += `Connected Load,${data.electrical.connectedLoad} kW\n`;
    csv += `Demand Factor,${data.electrical.demandFactor.toFixed(2)}\n\n`;

    // Urban Metrics
    csv += "URBAN PLANNING METRICS\n";
    csv += `Density,${data.metrics.density.toFixed(2)} plots/ha\n`;
    csv += `Plot Coverage,${data.metrics.plotCoverage.toFixed(2)}%\n`;
    csv += `FAR,${data.metrics.far.toFixed(2)}\n`;
    csv += `Open Space Ratio,${data.metrics.openSpaceRatio.toFixed(2)}\n\n`;

    // Setbacks
    csv += "SETBACK REQUIREMENTS\n";
    csv += `Front Setback,${data.setbacks.front}m\n`;
    csv += `Rear Setback,${data.setbacks.rear}m\n`;
    csv += `Side Setback,${data.setbacks.side}m\n`;

    // Download
    downloadFile(csv, 'master-plan-report.csv', 'text/csv');
}

/**
 * Export report as Excel (using CSV with .xlsx extension for simplicity)
 */
export function exportExcel() {
    const data = generateReportData();
    if (!data) return;

    // For a simple implementation, we'll create a tab-delimited format
    let excel = "Master Plan Report\t\t\n\n";

    excel += "SITE INFORMATION\t\t\n";
    excel += `Total Site Area\t${data.site.totalArea.toFixed(2)}\tm²\n`;
    excel += `Scale\t1px = ${data.site.scale.toFixed(2)}\tm\n`;
    excel += `Target GFA\t${data.site.gfa.toFixed(2)}\tm²\n\n`;

    excel += "PLOT SUMMARY\t\t\n";
    excel += `Total Plots\t${data.plots.total}\t\n`;
    excel += `Total Plot Area\t${data.plots.totalArea.toFixed(2)}\tm²\n`;
    excel += `Average Plot Area\t${data.plots.averageArea.toFixed(2)}\tm²\n\n`;

    excel += "PLOTS BY TYPE\t\t\n";
    excel += "Type\tCount\tTotal Area (m²)\n";
    Object.entries(data.plots.byType).forEach(([type, info]) => {
        excel += `${type}\t${info.count}\t${info.area.toFixed(2)}\n`;
    });
    excel += "\n";

    excel += "SOCIAL MIX\t\t\n";
    excel += "Category\tCount\t\n";
    Object.entries(data.plots.bySocial).forEach(([type, count]) => {
        excel += `${type}\t${count}\t\n`;
    });
    excel += "\n";

    excel += "URBAN PLANNING METRICS\t\t\n";
    excel += `Density\t${data.metrics.density.toFixed(2)}\tplots/ha\n`;
    excel += `Plot Coverage\t${data.metrics.plotCoverage.toFixed(2)}\t%\n`;
    excel += `FAR\t${data.metrics.far.toFixed(2)}\t\n`;
    excel += `Green Space\t${data.green.percentage.toFixed(2)}\t%\n`;
    excel += `Infrastructure\t${data.infrastructure.percentage.toFixed(2)}\t%\n\n`;

    excel += "PARKING\t\t\n";
    excel += `Required\t${data.parking.required}\tspaces\n`;
    excel += `Visitor\t${data.parking.visitor}\tspaces\n`;
    excel += `Total\t${data.parking.total}\tspaces\n\n`;

    excel += "ELECTRICAL\t\t\n";
    excel += `Total Load\t${data.electrical.totalLoad}\tkW\n`;
    excel += `Connected Load\t${data.electrical.connectedLoad}\tkW\n`;

    downloadFile(excel, 'master-plan-report.xlsx', 'application/vnd.ms-excel');
}

/**
 * Generate and download PDF report
 */
export function exportPDF() {
    const data = generateReportData();
    if (!data) return;

    // Create a printable HTML report
    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Master Plan Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        h1 { color: #0056b3; border-bottom: 3px solid #0056b3; padding-bottom: 10px; }
        h2 { color: #0056b3; margin-top: 30px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .metric { display: inline-block; width: 48%; margin: 10px 1%; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .metric-label { font-size: 12px; color: #666; }
        .metric-value { font-size: 24px; font-weight: bold; color: #0056b3; }
        .metric-unit { font-size: 14px; color: #666; }
        @media print { body { margin: 20px; } }
    </style>
</head>
<body>
    <h1>Master Plan Development Report</h1>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

    <h2>Site Information</h2>
    <table>
        <tr><td>Total Site Area</td><td><strong>${data.site.totalArea.toFixed(2)} m²</strong></td></tr>
        <tr><td>Scale</td><td>1 pixel = ${data.site.scale.toFixed(2)} meters</td></tr>
        <tr><td>Target GFA</td><td>${data.site.gfa.toFixed(2)} m²</td></tr>
    </table>

    <h2>Key Metrics</h2>
    <div class="metric">
        <div class="metric-label">Total Plots</div>
        <div class="metric-value">${data.plots.total}</div>
    </div>
    <div class="metric">
        <div class="metric-label">Density</div>
        <div class="metric-value">${data.metrics.density.toFixed(1)} <span class="metric-unit">plots/ha</span></div>
    </div>
    <div class="metric">
        <div class="metric-label">FAR</div>
        <div class="metric-value">${data.metrics.far.toFixed(2)}</div>
    </div>
    <div class="metric">
        <div class="metric-label">Green Space</div>
        <div class="metric-value">${data.green.percentage.toFixed(1)} <span class="metric-unit">%</span></div>
    </div>

    <h2>Plot Distribution by Type</h2>
    <table>
        <thead>
            <tr><th>Type</th><th>Count</th><th>Total Area (m²)</th><th>Avg Area (m²)</th></tr>
        </thead>
        <tbody>
            ${Object.entries(data.plots.byType).map(([type, info]) => `
                <tr>
                    <td>${type}</td>
                    <td>${info.count}</td>
                    <td>${info.area.toFixed(2)}</td>
                    <td>${(info.area / info.count).toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Social Mix</h2>
    <table>
        <thead>
            <tr><th>Category</th><th>Count</th><th>Percentage</th></tr>
        </thead>
        <tbody>
            ${Object.entries(data.plots.bySocial).map(([type, count]) => `
                <tr>
                    <td>${type}</td>
                    <td>${count}</td>
                    <td>${((count / data.plots.total) * 100).toFixed(1)}%</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Built-up Area Analysis</h2>
    <table>
        <tr><td>Total Built-up Area</td><td><strong>${data.builtup.total.toFixed(2)} m²</strong></td></tr>
        <tr><td>Ground Coverage</td><td>${data.builtup.groundCoverage.toFixed(2)}%</td></tr>
        <tr><td>Floor Area Ratio (FAR)</td><td>${data.builtup.far.toFixed(2)}</td></tr>
    </table>

    <h2>Infrastructure</h2>
    <table>
        <tr><td>Road Area</td><td>${data.infrastructure.roadArea.toFixed(2)} m²</td></tr>
        <tr><td>Pavement Area</td><td>${data.infrastructure.pavementArea.toFixed(2)} m²</td></tr>
        <tr><td>Total Infrastructure</td><td><strong>${data.infrastructure.totalInfra.toFixed(2)} m²</strong></td></tr>
        <tr><td>Infrastructure Coverage</td><td>${data.infrastructure.percentage.toFixed(2)}%</td></tr>
    </table>

    <h2>Parking Provision</h2>
    <table>
        <tr><td>Required Parking (2 per plot)</td><td>${data.parking.required} spaces</td></tr>
        <tr><td>Visitor Parking</td><td>${data.parking.visitor} spaces</td></tr>
        <tr><td>Total Parking</td><td><strong>${data.parking.total} spaces</strong></td></tr>
        <tr><td>Parking Ratio</td><td>${data.parking.ratio.toFixed(2)} per plot</td></tr>
    </table>

    <h2>Electrical Load</h2>
    <table>
        <tr><td>Load per Plot</td><td>${data.electrical.loadPerPlot} kW</td></tr>
        <tr><td>Total Estimated Load</td><td><strong>${data.electrical.totalLoad} kW</strong></td></tr>
        <tr><td>Connected Load</td><td>${data.electrical.connectedLoad} kW</td></tr>
        <tr><td>Demand Factor</td><td>${data.electrical.demandFactor.toFixed(2)}</td></tr>
    </table>

    <h2>Setback Requirements</h2>
    <table>
        <tr><td>Front Setback</td><td>${data.setbacks.front} m</td></tr>
        <tr><td>Rear Setback</td><td>${data.setbacks.rear} m</td></tr>
        <tr><td>Side Setback</td><td>${data.setbacks.side} m</td></tr>
    </table>

    <h2>Urban Planning Compliance</h2>
    <table>
        <tr><td>Density</td><td>${data.metrics.density.toFixed(2)} plots/hectare</td></tr>
        <tr><td>Plot Coverage</td><td>${data.metrics.plotCoverage.toFixed(2)}%</td></tr>
        <tr><td>Open Space Ratio</td><td>${data.metrics.openSpaceRatio.toFixed(2)}</td></tr>
        <tr><td>Green Space</td><td>${data.green.percentage.toFixed(2)}%</td></tr>
    </table>
</body>
</html>
    `;

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportHTML);
    printWindow.document.close();

    // Auto-trigger print dialog
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

/**
 * Show report in UI panel
 */
export function showReportPanel() {
    const data = generateReportData();
    if (!data) return;

    const panel = document.getElementById('report-panel');
    const content = document.getElementById('report-content');

    if (!panel || !content) return;

    content.innerHTML = `
        <div class="report-section">
            <h4>Site Overview</h4>
            <div class="report-item"><span>Total Area:</span><b>${data.site.totalArea.toFixed(2)} m²</b></div>
            <div class="report-item"><span>Total Plots:</span><b>${data.plots.total}</b></div>
            <div class="report-item"><span>Density:</span><b>${data.metrics.density.toFixed(1)} plots/ha</b></div>
        </div>

        <div class="report-section">
            <h4>Plot Distribution</h4>
            ${Object.entries(data.plots.byType).map(([type, info]) => `
                <div class="report-item"><span>${type}:</span><b>${info.count} plots</b></div>
            `).join('')}
        </div>

        <div class="report-section">
            <h4>Social Mix</h4>
            ${Object.entries(data.plots.bySocial).map(([type, count]) => `
                <div class="report-item"><span>${type}:</span><b>${count}</b></div>
            `).join('')}
        </div>

        <div class="report-section">
            <h4>Urban Metrics</h4>
            <div class="report-item"><span>FAR:</span><b>${data.metrics.far.toFixed(2)}</b></div>
            <div class="report-item"><span>Green Space:</span><b>${data.green.percentage.toFixed(1)}%</b></div>
            <div class="report-item"><span>Infrastructure:</span><b>${data.infrastructure.percentage.toFixed(1)}%</b></div>
        </div>

        <div class="report-section">
            <h4>Parking & Electrical</h4>
            <div class="report-item"><span>Total Parking:</span><b>${data.parking.total} spaces</b></div>
            <div class="report-item"><span>Electrical Load:</span><b>${data.electrical.totalLoad} kW</b></div>
        </div>
    `;

    panel.style.display = 'block';
}

/**
 * Generate detailed plot-by-plot report
 */
export function generateDetailedPlotReport() {
    const data = generateReportData();
    if (!data) return;

    const plots = App.data.generatedObjects.filter(o => o.isPlot);

    if (plots.length === 0) {
        alert("No plots found in the current layout.");
        return;
    }

    // Create detailed HTML report
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Detailed Plot Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; font-size: 12px; }
        h1 { color: #0056b3; border-bottom: 3px solid #0056b3; padding-bottom: 10px; }
        h2 { color: #0056b3; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .summary { background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .plot-card { border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px; page-break-inside: avoid; }
        .plot-header { background-color: #0056b3; color: white; padding: 8px; margin: -10px -10px 10px -10px; border-radius: 5px 5px 0 0; }
        .plot-detail { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .plot-detail-item { padding: 5px; }
        .plot-detail-label { font-weight: bold; color: #666; }
        @media print { body { margin: 10px; } .plot-card { page-break-inside: avoid; } }
    </style>
</head>
<body>
    <h1>Detailed Plot-by-Plot Report</h1>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Total Site Area:</strong> ${data.site.totalArea.toFixed(2)} m²</p>

    <div class="summary">
        <h3 style="margin-top: 0;">Summary Statistics</h3>
        <p><strong>Total Plots:</strong> ${plots.length}</p>
        <p><strong>Total Plot Area:</strong> ${data.plots.totalArea.toFixed(2)} m²</p>
        <p><strong>Average Plot Size:</strong> ${data.plots.averageArea.toFixed(2)} m²</p>
        <p><strong>Density:</strong> ${data.metrics.density.toFixed(2)} plots/hectare</p>
    </div>

    <h2>Individual Plot Details</h2>
    <table>
        <thead>
            <tr>
                <th>Plot #</th>
                <th>Type</th>
                <th>Social Category</th>
                <th>Area (m²)</th>
                <th>Frontage (m)</th>
                <th>Depth (m)</th>
                <th>Estimated Built-up (m²)</th>
                <th>Parking Req.</th>
            </tr>
        </thead>
        <tbody>`;

    plots.forEach((plot, index) => {
        const plotArea = plot.area || 0;
        const protoType = plot.protoType || 'Standard';
        const socialType = plot.socialType || 'HIG';
        const builtUp = plotArea * 0.4; // 40% ground coverage
        const parkingReq = 2; // 2 spaces per plot

        // Estimate frontage and depth from plot points
        let frontage = 0, depth = 0;
        if (plot.points && plot.points.length >= 4) {
            const p1 = plot.points[0], p2 = plot.points[1], p3 = plot.points[2];
            frontage = Math.hypot(p2.x - p1.x, p2.y - p1.y) * App.state.scale;
            depth = Math.hypot(p3.x - p2.x, p3.y - p2.y) * App.state.scale;
        }

        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${protoType}</td>
                <td>${socialType}</td>
                <td>${plotArea.toFixed(2)}</td>
                <td>${frontage.toFixed(2)}</td>
                <td>${depth.toFixed(2)}</td>
                <td>${builtUp.toFixed(2)}</td>
                <td>${parkingReq}</td>
            </tr>`;
    });

    html += `
        </tbody>
    </table>

    <h2>Detailed Plot Cards</h2>`;

    plots.forEach((plot, index) => {
        const plotArea = plot.area || 0;
        const protoType = plot.protoType || 'Standard';
        const socialType = plot.socialType || 'HIG';
        const builtUp = plotArea * 0.4;

        let frontage = 0, depth = 0;
        if (plot.points && plot.points.length >= 4) {
            const p1 = plot.points[0], p2 = plot.points[1], p3 = plot.points[2];
            frontage = Math.hypot(p2.x - p1.x, p2.y - p1.y) * App.state.scale;
            depth = Math.hypot(p3.x - p2.x, p3.y - p2.y) * App.state.scale;
        }

        html += `
    <div class="plot-card">
        <div class="plot-header">
            <strong>Plot ${index + 1}</strong> - ${protoType} (${socialType})
        </div>
        <div class="plot-detail">
            <div class="plot-detail-item">
                <div class="plot-detail-label">Plot Area:</div>
                <div>${plotArea.toFixed(2)} m²</div>
            </div>
            <div class="plot-detail-item">
                <div class="plot-detail-label">Frontage:</div>
                <div>${frontage.toFixed(2)} m</div>
            </div>
            <div class="plot-detail-item">
                <div class="plot-detail-label">Depth:</div>
                <div>${depth.toFixed(2)} m</div>
            </div>
            <div class="plot-detail-item">
                <div class="plot-detail-label">Built-up Area (40%):</div>
                <div>${builtUp.toFixed(2)} m²</div>
            </div>
            <div class="plot-detail-item">
                <div class="plot-detail-label">Estimated FAR:</div>
                <div>${(builtUp / plotArea).toFixed(2)}</div>
            </div>
            <div class="plot-detail-item">
                <div class="plot-detail-label">Parking Required:</div>
                <div>2 spaces</div>
            </div>
            <div class="plot-detail-item">
                <div class="plot-detail-label">Electrical Load:</div>
                <div>5 kW</div>
            </div>
            <div class="plot-detail-item">
                <div class="plot-detail-label">Social Category:</div>
                <div>${socialType}</div>
            </div>
        </div>
    </div>`;
    });

    html += `
</body>
</html>`;

    // Open in new window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();

    // Auto-trigger print dialog
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

/**
 * Helper function to download files
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
