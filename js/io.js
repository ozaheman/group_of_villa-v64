//--- START OF FILE js/io.js ---

import { App } from './appState.js';

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

function setBackground(url) {
    fabric.Image.fromURL(url, (img) => {
        App.canvas.setBackgroundImage(img, App.canvas.renderAll.bind(App.canvas), {
            scaleX: App.canvas.width / img.width,
            scaleY: App.canvas.height / img.height,
            selectable: false,
            evented: false,
        });
    });
}

async function loadPdfAsBackground(file) {
    const fileReader = new FileReader();
    fileReader.onload = async function() {
        try {
            const typedarray = new Uint8Array(this.result);
            // Use window.pdfjsLib to access the globally loaded library
            const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 });
            const tempCanvas = document.createElement('canvas');
            tempCanvas.height = viewport.height;
            tempCanvas.width = viewport.width;
            const tempContext = tempCanvas.getContext('2d');
            await page.render({ canvasContext: tempContext, viewport: viewport }).promise;
            setBackground(tempCanvas.toDataURL());
        } catch (error) {
            console.error("Error loading PDF:", error);
            alert("Failed to load or render the PDF file. Please check the console for details.");
        }
    };
    fileReader.readAsArrayBuffer(file);
}

// Placeholder for future export functionality
export function exportData() {
    console.log("Exporting data...", {
        state: App.state,
        objects: App.objects,
        data: App.data
    });
    alert("Export functionality not yet implemented. Check the console for data structure.");
}