
import { App } from './appState.js';
import { generateReportData } from './reporting.js';
import { setMode, updateAreaInfo, clearGeneratedLayout } from './ui.js';
import { clearCanvas } from './canvas.js';

export function handleBackgroundLoad(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
        loadPdfAsBackground(file);
    } else {
        const reader = new FileReader();
        reader.onload = (f) => setBackground(f.target.result);
        reader.readAsDataURL(file);
    }
}

export function setBackground(source) {
    if (!source) return;

    const applyToCanvas = (img) => {
        const canvasW = App.canvas.width;
        const canvasH = App.canvas.height;
        const imgW = img.width;
        const imgH = img.height;

        const scale = Math.min(canvasW / imgW, canvasH / imgH);

        const left = (canvasW - imgW * scale) / 2;
        const top = (canvasH - imgH * scale) / 2;

        console.log(`[IO] Applying background to canvas. Scale: ${scale.toFixed(4)}, Pos: (${left.toFixed(0)}, ${top.toFixed(0)})`);

        App.canvas.setBackgroundImage(img, () => {
            App.canvas.renderAll();
            console.log("[IO] Background image applied and refreshed.");
        }, {
            scaleX: scale,
            scaleY: scale,
            left: left,
            top: top,
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
            // Ensure background image is always behind objects
            erasable: false
        });
    };

    if (typeof source === 'string') {
        console.log("[IO] Loading background from string source...");
        fabric.Image.fromURL(source, (img) => {
            if (img) {
                console.log("[IO] Image element created from string source.");
                applyToCanvas(img);
            } else {
                console.error("[IO] Failed to create Image element from string source.");
            }
        }, { crossOrigin: 'anonymous' });
    } else {
        console.log("[IO] Loading background from element source...");
        const img = new fabric.Image(source);
        applyToCanvas(img);
    }
}

async function loadPdfAsBackground(file) {
    const fileReader = new FileReader();
    fileReader.onload = async function () {
        try {
            console.log("[IO] PDF file read started...");
            const typedarray = new Uint8Array(this.result);

            // Initialization
            const pdfjsLib = window.pdfjsLib;
            if (!pdfjsLib) throw new Error("PDF.js library not found on window.");

            const loadingTask = pdfjsLib.getDocument({
                data: typedarray,
                disableFontFace: true, // Prevent browser font errors for malformed PDF fonts
                cMapPacked: true,       // Better support for CJK/complex character maps
                verbosity: 1
            });

            const pdf = await loadingTask.promise;
            console.log(`[IO] PDF loaded. Pages: ${pdf.numPages}`);

            const page = await pdf.getPage(1);
            let viewport = page.getViewport({ scale: 2.0 }); // High res initial

            // Safety cap: ensure canvas doesn't exceed browser limits (approx 4000px for stability)
            const MAX_DIMENSION = 4000;
            if (viewport.width > MAX_DIMENSION || viewport.height > MAX_DIMENSION) {
                const scale = MAX_DIMENSION / Math.max(viewport.width / 2.0, viewport.height / 2.0);
                viewport = page.getViewport({ scale: scale });
                console.log(`[IO] Scaling down PDF to ${viewport.width}x${viewport.height} to fit limits.`);
            }

            const tempCanvas = document.createElement('canvas');
            const context = tempCanvas.getContext('2d');
            tempCanvas.height = viewport.height;
            tempCanvas.width = viewport.width;

            // Ensure background is opaque
            context.fillStyle = 'white';
            context.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            console.log(`[IO] Rendering page 1 at ${tempCanvas.width}x${tempCanvas.height}`);

            const renderTask = page.render({
                canvasContext: context,
                viewport: viewport
            });

            await renderTask.promise;
            console.log("[IO] PDF Page rendered to temp canvas.");

            // Verification
            if (tempCanvas.width === 0 || tempCanvas.height === 0) {
                throw new Error("Rendered canvas has 0 dimensions.");
            }

            // Convert to DataURL for maximum compatibility with the setBackground logic
            const dataUrl = tempCanvas.toDataURL('image/png');
            console.log(`[IO] PDF DataURL generated. Length: ${dataUrl.length}`);
            setBackground(dataUrl);

            // Force a few renders to be sure
            setTimeout(() => App.canvas.renderAll(), 100);
            setTimeout(() => App.canvas.renderAll(), 500);

        } catch (error) {
            console.error("[IO] Error loading PDF:", error);
            alert("Failed to load or render the PDF file. Check the console. Error: " + error.message);
        }
    };
    fileReader.readAsArrayBuffer(file);
}

// --- ZIP SAVE / LOAD ---

export async function saveProjectToZip() {
    if (!window.JSZip) return alert("JSZip library not loaded.");
    const zip = new JSZip();

    // 1. Project State
    const state = {
        appState: App.state,
        parking: App.parking,
        ui: {
            plotDepth: App.elements.plotDepth.value,
            plotWidth: App.elements.plotWidth.value,
            roadType: document.getElementById('road-type')?.value,
            greenAreaPct: document.getElementById('green-area')?.value,
            amenitiesPct: document.getElementById('amenities-area')?.value
        },
        objects: {
            masterPolygon: App.objects.masterPolygon ? App.objects.masterPolygon.points : null,
            roadCenterline: App.objects.roadCenterline ? App.objects.roadCenterline.points : null,
            manualInnerBoundary: App.objects.manualInnerBoundary || null,
            generatedObjects: App.data.generatedObjects.map(o => {
                let data = {
                    type: o.type, left: o.left, top: o.top,
                    fill: o.fill, stroke: o.stroke, strokeWidth: o.strokeWidth,
                    strokeDashArray: o.strokeDashArray, opacity: o.opacity
                };
                ['isPlot', 'isInfra', 'isGreen', 'isGreenArea', 'isAmenity', 'socialType', 'protoType', 'isParking', 'isEntryExitRoad', 'roadType'].forEach(k => {
                    if (o[k] !== undefined) data[k] = o[k];
                });
                if (o.type === 'polygon' || o.type === 'polyline') data.points = o.points;
                if (o.type === 'line') { data.x1 = o.x1; data.y1 = o.y1; data.x2 = o.x2; data.y2 = o.y2; }
                if (o.type === 'path') { data.path = o.path; data.points = o.points; }
                if (o.type === 'group') {
                    if (o.points) data.points = o.points;
                    data.objects = o.getObjects().map(child => ({ type: child.type, text: child.text, fill: child.fill }));
                }
                return data;
            })
        }
    };
    zip.file("project_state.json", JSON.stringify(state, null, 2));

    // 2. Affection Plan (Background)
    if (App.canvas.backgroundImage) {
        const bg = App.canvas.backgroundImage;
        let dataUrl = bg.getSrc(); // Fabric Image src
        if (dataUrl.startsWith('data:image')) {
            const base64Data = dataUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
            const ext = dataUrl.includes('jpeg') || dataUrl.includes('jpg') ? 'jpg' : 'png';
            zip.file(`affection_plan.${ext}`, base64Data, { base64: true });
        }
    }

    // 3. Report
    try {
        const report = generateReportData();
        if (report) {
            zip.file("report_data.json", JSON.stringify(report, null, 2));

            let txt = "PROJECT REPORT SUMMARY\n======================\n";
            txt += `Generated: ${new Date().toLocaleString()}\n\n`;
            txt += `Total Site Area: ${(report.site.totalArea || 0).toFixed(2)} m²\n`;
            txt += `Total Plots: ${report.plots.total}\n`;
            txt += `GFA: ${report.site.gfa} m²\n`;
            txt += `Plot Coverage: ${(report.builtup.groundCoverage || 0).toFixed(2)}%\n`;
            txt += `Green Area: ${(report.urban.greenPercentage || 0).toFixed(2)}%\n`;
            zip.file("report_summary.txt", txt);
        }
    } catch (e) { console.warn("Report generation failed during save", e); }

    // 4. Save
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "master_plan_project.zip");
}

export async function loadProjectFromZip(e) {
    if (!window.JSZip) return alert("JSZip library not loaded.");
    const file = e.target.files[0];
    if (!file) return;

    try {
        const zip = await JSZip.loadAsync(file);

        // Load State
        if (zip.file("project_state.json")) {
            const json = await zip.file("project_state.json").async("string");
            const state = JSON.parse(json);
            restoreProjectState(state);
        }

        // Load Affection Plan
        const imgFiles = Object.keys(zip.files).filter(k => k.startsWith("affection_plan"));
        if (imgFiles.length > 0) {
            const bgData = await zip.file(imgFiles[0]).async("base64");
            const ext = imgFiles[0].split('.').pop();
            const dataUrl = `data:image/${ext};base64,${bgData}`;
            setBackground(dataUrl);
            alert("Project loaded successfully with Affection Plan.");
        } else {
            alert("Project loaded (No affection plan found).");
        }
    } catch (err) {
        console.error(err);
        alert("Error loading ZIP file.");
    }
}

async function restoreProjectState(state) {
    clearCanvas(); // Clear existing

    // Restore UI
    if (state.ui) {
        if (App.elements.plotDepth) App.elements.plotDepth.value = state.ui.plotDepth;
        if (App.elements.plotWidth) App.elements.plotWidth.value = state.ui.plotWidth;
        // ... restore others
    }

    // Restore Objects
    if (state.objects) {
        const { pointsToPathData } = await import('./utils.js');

        // Master Polygon
        if (state.objects.masterPolygon) {
            const mp = new fabric.Polygon(state.objects.masterPolygon, {
                fill: 'rgba(0,0,0,0)', stroke: 'blue', strokeWidth: 2, selectable: true, hasBorders: true, hasControls: true,
                objectCaching: false
            });
            App.objects.masterPolygon = mp;
            App.canvas.add(mp);
        }

        // Road Centerline
        if (state.objects.roadCenterline) {
            const pts = state.objects.roadCenterline;
            const pathData = pointsToPathData(pts);
            const rc = new fabric.Path(pathData, {
                fill: '', stroke: 'blue', strokeWidth: 1, strokeDashArray: [5, 5], opacity: 0.6,
                selectable: true, objectCaching: false
            });
            rc.points = pts;
            App.objects.roadCenterline = rc;
            App.canvas.add(rc);
        }

        // Manual Inner Boundary
        if (state.objects.manualInnerBoundary) {
            App.objects.manualInnerBoundary = state.objects.manualInnerBoundary;
        }

        // Generated Objects
        if (state.objects.generatedObjects) {
            state.objects.generatedObjects.forEach(data => {
                let obj;
                const opts = {
                    fill: data.fill, stroke: data.stroke, strokeWidth: data.strokeWidth || 1,
                    strokeDashArray: data.strokeDashArray, opacity: data.opacity || 1,
                    selectable: false, objectCaching: false
                };

                // Restore custom props
                ['isPlot', 'isInfra', 'isGreen', 'isGreenArea', 'isAmenity', 'socialType', 'protoType', 'isParking', 'isEntryExitRoad', 'roadType'].forEach(k => {
                    if (data[k] !== undefined) opts[k] = data[k];
                });

                if (data.type === 'polygon') {
                    obj = new fabric.Polygon(data.points, opts);
                    obj.points = data.points;
                } else if (data.type === 'polyline') {
                    obj = new fabric.Polyline(data.points, opts);
                } else if (data.type === 'path') {
                    obj = new fabric.Path(data.path, opts);
                    if (data.points) obj.points = data.points;
                } else if (data.type === 'line') {
                    obj = new fabric.Line([data.x1, data.y1, data.x2, data.y2], opts);
                }

                if (obj) {
                    App.canvas.add(obj);
                    App.data.generatedObjects.push(obj);
                    // Re-link manual road if recognized
                    if (obj.isInfra && obj.type === 'polygon' && !obj.isEntryExitRoad && (obj.fill === '#555' || obj.fill === '#444444')) {
                        App.objects.manualRoad = obj;
                    }
                }
            });
        }
    }
    App.canvas.renderAll();
}

// Export data for debug
export function exportData() {
    saveProjectToZip();
}