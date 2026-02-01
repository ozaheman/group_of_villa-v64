/**
 * Robust DXF Exporter for Fabric.js
 * Fixes: Group recursion, Polygon point offsets, and coordinate transformations.
 */

// Ensure fabric is available. If using ES6 modules for fabric, uncomment line below:
// import { fabric } from 'fabric'; 

export function exportToDXF(canvasOrObjects, filename = 'layout.dxf') {
    
    // Check if input is the canvas instance or an array of objects
    const objects = Array.isArray(canvasOrObjects) ? canvasOrObjects : canvasOrObjects.getObjects();

    // 1. Define DXF Header and Layers
    let dxf = [
        "0", "SECTION", "2", "HEADER", 
        "9", "$ACADVER", "1", "AC1009", // AC1009 = AutoCAD R12 (Most compatible)
        "9", "$INSUNITS", "70", "4",    // 4 = Millimeters
        "0", "ENDSEC",
        "0", "SECTION", "2", "TABLES",
        "0", "TABLE", "2", "LAYER", "70", "6",
        // Layer Definitions
        "0", "LAYER", "2", "0", "70", "0", "62", "7", "6", "CONTINUOUS",
        "0", "LAYER", "2", "PLOTS", "70", "0", "62", "5", "6", "CONTINUOUS",
        "0", "LAYER", "2", "ROADS", "70", "0", "62", "1", "6", "CONTINUOUS",
        "0", "LAYER", "2", "GREEN", "70", "0", "62", "3", "6", "CONTINUOUS",
        "0", "LAYER", "2", "TEXT", "70", "0", "62", "7", "6", "CONTINUOUS",
        "0", "LAYER", "2", "BUILDINGS", "70", "0", "62", "4", "6", "CONTINUOUS",
        "0", "ENDTAB",
        "0", "ENDSEC",
        "0", "SECTION", "2", "ENTITIES"
    ].join("\n") + "\n";

    // 2. Helper Functions

    const formatFloat = (num) => (typeof num === 'number' ? num.toFixed(4) : "0.0");

    // Determine DXF Layer based on object properties
    const getLayer = (obj) => {
        if (obj.isPlot || obj.layer === 'plots') return "PLOTS";
        if (obj.isInfra || obj.isRoad || obj.isPavement || obj.isEntryExitRoad || obj.layer === 'roads') return "ROADS";
        if (obj.isGreen || obj.isGreenArea || obj.subdivisionType === 'green' || obj.layer === 'green') return "GREEN";
        if (obj.type === 'text' || obj.type === 'i-text') return "TEXT";
        if (obj.type === 'rect' || obj.subdivisionType === 'building') return "BUILDINGS";
        return "0";
    };

    /**
     * Transform point to DXF coordinates (Flip Y for CAD)
     */
    const toDxfPt = (pt) => {
        return { x: pt.x, y: -pt.y };
    };

    /**
     * Calculates absolute points based on a provided matrix.
     * Handles specific Fabric.js logic where Polygon points are relative to pathOffset.
     */
    const getAbsolutePoints = (obj, matrix) => {
        // If it's a line
        if (obj.type === 'line') {
            const p1 = new fabric.Point(obj.x1, obj.y1);
            const p2 = new fabric.Point(obj.x2, obj.y2);
            return [
                fabric.util.transformPoint(p1, matrix),
                fabric.util.transformPoint(p2, matrix)
            ];
        }
        
        // If it's a polygon/polyline/path
        if (obj.points) {
            // Fabric Polygons store points relative to the object's internal bounding box.
            // We must subtract the pathOffset before applying the world matrix.
            const offset = obj.pathOffset || { x: 0, y: 0 };
            return obj.points.map(p => {
                const relativePt = new fabric.Point(p.x - offset.x, p.y - offset.y);
                return fabric.util.transformPoint(relativePt, matrix);
            });
        }
        return [];
    };

    /**
     * Main recursive function to process objects
     * @param {Object} obj - Fabric Object
     * @param {Array} parentMatrix - The accumulated matrix from parent groups (optional)
     */
    const processObject = (obj, parentMatrix = null) => {
        if (!obj.visible) return "";

        // Calculate the object's own matrix
        let localMatrix = obj.calcTransformMatrix();
        
        // If we are inside a group (parentMatrix exists), multiply them.
        // totalMatrix = parentMatrix * localMatrix
        let totalMatrix = parentMatrix 
            ? fabric.util.multiplyTransformMatrices(parentMatrix, localMatrix) 
            : localMatrix;

        // --- HANDLE GROUPS RECURSIVELY ---
        if (obj.type === 'group') {
            let groupChunk = "";
            const children = obj.getObjects();
            children.forEach(child => {
                // Pass properties like "isPlot" down to children if needed for Layering
                if (obj.isPlot) child.isPlot = true;
                if (obj.isRoad) child.isRoad = true;
                
                // Recurse with the accumulated matrix
                groupChunk += processObject(child, totalMatrix);
            });
            return groupChunk;
        }

        // --- PROCESS GEOMETRY ---
        let chunk = "";
        const layer = getLayer(obj);

        // 1. Polygons & Polylines
        if (obj.type === 'polygon' || obj.type === 'polyline') {
            const points = getAbsolutePoints(obj, totalMatrix);
            if (points.length < 2) return "";
            
            chunk += "0\nLWPOLYLINE\n";
            chunk += `8\n${layer}\n`;
            chunk += `90\n${points.length}\n`;
            chunk += `70\n${obj.type === 'polygon' ? 1 : 0}\n`; // 1 = Closed
            points.forEach(p => {
                const dp = toDxfPt(p);
                chunk += `10\n${formatFloat(dp.x)}\n20\n${formatFloat(dp.y)}\n`;
            });
        } 
        // 2. Lines
        else if (obj.type === 'line') {
            const points = getAbsolutePoints(obj, totalMatrix);
            if (points.length < 2) return "";
            const p1 = toDxfPt(points[0]);
            const p2 = toDxfPt(points[1]);
            
            chunk += "0\nLINE\n";
            chunk += `8\n${layer}\n`;
            chunk += `10\n${formatFloat(p1.x)}\n20\n${formatFloat(p1.y)}\n`;
            chunk += `11\n${formatFloat(p2.x)}\n21\n${formatFloat(p2.y)}\n`;
        }
        // 3. Circles
        else if (obj.type === 'circle') {
            // Determine center based on origin. Default fabric origin is top-left.
            // We calculate center in local space, then transform.
            let localCx = 0, localCy = 0;
            
            // Adjust local center relative to the Top-Left corner (0,0 of the unrotated box)
            if (obj.originX !== 'center') localCx += obj.radius;
            if (obj.originY !== 'center') localCy += obj.radius;

            const centerPt = new fabric.Point(localCx, localCy);
            // We must subtract origin offsets if fabric handled them differently, 
            // but calcTransformMatrix usually normalizes this. 
            // Safer approach: Transform a point (0,0) offset by radius? 
            // Let's rely on transformPoint logic:
            
            // Actually, for a Circle in fabric, (0,0) local is usually Top-Left.
            // So Center is at (radius, radius).
            const absCenter = fabric.util.transformPoint(
                new fabric.Point(obj.radius, obj.radius), 
                totalMatrix
            );
            
            // Calculate scale roughly (average of X and Y scale from matrix)
            // Matrix structure: [a, b, c, d, tx, ty]
            // scaleX approx sqrt(a*a + b*b)
            const scX = Math.sqrt(totalMatrix[0]*totalMatrix[0] + totalMatrix[1]*totalMatrix[1]);
            const radius = obj.radius * scX;

            const dp = toDxfPt(absCenter);
            
            chunk += "0\nCIRCLE\n";
            chunk += `8\n${layer}\n`;
            chunk += `10\n${formatFloat(dp.x)}\n20\n${formatFloat(dp.y)}\n`;
            chunk += `40\n${formatFloat(radius)}\n`;
        }
        // 4. Rectangles (Convert to Polyline)
        else if (obj.type === 'rect') {
             const w = obj.width;
             const h = obj.height;
             
             // Define 4 corners relative to (0,0) top-left
             const corners = [
                 {x: 0, y: 0},
                 {x: w, y: 0},
                 {x: w, y: h},
                 {x: 0, y: h}
             ];

             chunk += "0\nLWPOLYLINE\n";
             chunk += `8\n${layer}\n`;
             chunk += "90\n4\n";
             chunk += "70\n1\n"; // Closed
             
             corners.forEach(c => {
                 const pt = new fabric.Point(c.x, c.y);
                 const absPt = fabric.util.transformPoint(pt, totalMatrix);
                 const dp = toDxfPt(absPt);
                 chunk += `10\n${formatFloat(dp.x)}\n20\n${formatFloat(dp.y)}\n`;
             });
        }
        // 5. Text
        else if (obj.type === 'text' || obj.type === 'i-text') {
            const absCenter = fabric.util.transformPoint(new fabric.Point(0,0), totalMatrix);
            const dp = toDxfPt(absCenter);
            // Approx height based on scale Y
            const scY = Math.sqrt(totalMatrix[2]*totalMatrix[2] + totalMatrix[3]*totalMatrix[3]);
            const height = obj.fontSize * scY; 
            
            // Sanitize text (remove newlines/commas that break basic DXF)
            const cleanText = obj.text ? obj.text.replace(/\n/g, " ") : "";

            chunk += "0\nTEXT\n";
            chunk += `8\n${layer}\n`;
            chunk += `10\n${formatFloat(dp.x)}\n20\n${formatFloat(dp.y)}\n`;
            chunk += `40\n${formatFloat(height)}\n`;
            chunk += `1\n${cleanText}\n`;
        }

        return chunk;
    };

    // 3. Main Loop
    objects.forEach(obj => {
        dxf += processObject(obj, null); // Start with no parent matrix
    });

    // 4. Footer
    dxf += "0\nENDSEC\n0\nEOF\n";

    // 5. Download
    try {
        const blob = new Blob([dxf], { type: 'application/dxf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Error downloading DXF:", e);
    }
}