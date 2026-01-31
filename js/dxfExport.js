
/**
 * Simple DXF Exporter for Fabric.js Canvases
 */
export function exportToDXF(objects, filename = 'layout.dxf') {
    let dxf = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nENDSEC\n0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";

    const processObject = (obj) => {
        let chunk = "";

        if (obj.type === 'group') {
            obj._objects.forEach(child => {
                // Determine layer based on parent or child props
                if (obj.isPlot) child.isPlot = true;
                chunk += processObject(child);
            });
            return chunk;
        }

        if (obj.points) { // Polygon or Polyline
            chunk += "0\nLWPOLYLINE\n";
            chunk += "8\n" + (obj.isPlot ? "PLOTS" : (obj.isInfra ? "ROADS" : (obj.isGreen ? "GREEN" : "0"))) + "\n";
            chunk += "90\n" + obj.points.length + "\n";
            chunk += "70\n" + (obj.type === 'polygon' ? 1 : 0) + "\n"; // Closed/Open
            obj.points.forEach(p => {
                chunk += "10\n" + p.x + "\n";
                chunk += "20\n" + (-p.y) + "\n"; // Flip Y for CAD
            });
        } else if (obj.type === 'line') {
            chunk += "0\nLINE\n";
            chunk += "8\nINFRA\n";
            chunk += "10\n" + obj.x1 + "\n20\n" + (-obj.y1) + "\n";
            chunk += "11\n" + obj.x2 + "\n21\n" + (-obj.y2) + "\n";
        } else if (obj.type === 'path') {
            // Basic support for Path (convert control points to polyline if possible, else skip)
            // Parsing SVG path 'M x y L x y ...' is complex without a library.
            // If manual points attached (like we did for Step 3), rely on them?
            // Fabric Path object doesn't have simple points array by default.
            // Skip for now unless mocked.
            if (obj.points) {
                // Use mocked points (e.g. bounding or outline)
                chunk += "0\nLWPOLYLINE\n";
                chunk += "8\nROADS_PATH\n";
                chunk += "90\n" + obj.points.length + "\n";
                chunk += "70\n1\n";
                obj.points.forEach(p => {
                    chunk += "10\n" + p.x + "\n";
                    chunk += "20\n" + (-p.y) + "\n";
                });
            }
        }
        return chunk;
    };

    objects.forEach(obj => {
        dxf += processObject(obj);
    });

    dxf += "0\nENDSEC\n0\nEOF\n";

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}
