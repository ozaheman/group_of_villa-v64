//--- START OF FILE js/tools.js ---

import { App } from './appState.js';
import { setMode } from './ui.js';
export function handleMeasurementx(pointer) {
                 measurePoints.push(pointer);
                 const pointCircle = new fabric.Circle({ radius: 4, fill: '#00aaff', left: pointer.x - 4, top: pointer.y - 4, selectable: false });
                 tempPoints.push(pointCircle); canvas.add(pointCircle);
                 if (measurePoints.length === 2) {
                    const p1 = measurePoints[0], p2 = measurePoints[1];
                    const pixelDist = Math.sqrt(Math.pow(p2.x-p1.x, 2) + Math.pow(p2.y-p1.y, 2));
                    const realDist = pixelDist * scale;
                    const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], { stroke: '#00aaff', strokeWidth: 2, selectable: false });
                    const text = new fabric.Text(`${realDist.toFixed(2)} m`, { left: (p1.x+p2.x)/2, top: (p1.y+p2.y)/2, fontSize: 14, fill: '#004466', backgroundColor: 'rgba(255,255,255,0.7)' });
                    tempLines.push(line, text); canvas.add(line, text);
                    isMeasuring = false; measureToolBtn.style.backgroundColor = '';
                    measurePoints = [];
                 }
            }
export function handleMeasurement(pointer) {
    App.data.measurePoints.push(pointer);
    const pointCircle = new fabric.Circle({
        radius: 4, fill: '#00aaff', left: pointer.x - 4, top: pointer.y - 4, selectable: false
    });
    App.data.tempPoints.push(pointCircle);
    App.canvas.add(pointCircle);

    if (App.data.measurePoints.length === 2) {
        const p1 = App.data.measurePoints[0], p2 = App.data.measurePoints[1];
        const pixelDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const realDist = pixelDist * App.state.scale;
        const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], { stroke: '#00aaff', strokeWidth: 2, selectable: false });
        const text = new fabric.Text(`${realDist.toFixed(2)} m`, {
            left: (p1.x + p2.x) / 2, top: (p1.y + p2.y) / 2,
            fontSize: 14, fill: '#004466', backgroundColor: 'rgba(255,255,255,0.7)'
        });
        App.data.tempLines.push(line, text);
        App.canvas.add(line, text);
        App.data.measurePoints = [];
        //setMode('none');
    }
}

export function handleCalibration(pointer) {
    App.data.calibrationPoints.push(pointer);
    const pointCircle = new fabric.Circle({
        radius: 4, fill: '#28a745', left: pointer.x - 4, top: pointer.y - 4, selectable: false
    });
    App.data.tempPoints.push(pointCircle);
    App.canvas.add(pointCircle);

    if (App.data.calibrationPoints.length === 2) {
        const p1 = App.data.calibrationPoints[0], p2 = App.data.calibrationPoints[1];
        const pixelDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        
        // Use value from input field if available, otherwise prompt
        const manualInput = document.getElementById('manual-scale-input');
        let realDist = manualInput ? parseFloat(manualInput.value) : NaN;

        if (isNaN(realDist) || realDist <= 0) {
            const realDistStr = prompt(`Enter real-world distance for the selected line in meters:`);
            realDist = parseFloat(realDistStr);
        }

        if (!isNaN(realDist) && realDist > 0) {
            App.state.scale = realDist / pixelDist;
            App.elements.scaleInfo.textContent = `1px = ${App.state.scale.toFixed(3)}m`;
            if (manualInput) manualInput.value = ''; // Clear input after successful calibration
        } else {
            alert("Invalid distance entered.");
        }
        setMode('none');
    }
}

export function placeEntryMarker(pointer) {
    const radius = (20 / 2) / App.state.scale;
    const circle = new fabric.Circle({
        radius: radius, fill: 'rgba(255, 255, 0, 0.6)', stroke: '#cca300',
        left: pointer.x, top: pointer.y, originX: 'center', originY: 'center', hasControls: true
    });
    const label = new fabric.Text('', {
        left: pointer.x, top: pointer.y + radius + 10,
        originX: 'center', fontSize: 14, fill: '#333'
    });
    const group = new fabric.Group([circle, label], {
        left: pointer.x, top: pointer.y, isEntryCircle: true,
        hasControls: false, subTargetCheck: true
    });
    App.data.generatedObjects.push(group);
    App.canvas.add(group);
    updateEntryCircleLabel(group);
    setMode('none');
}

export function updateEntryCircleLabel(group) {
    const circle = group._objects[0];
    const label = group._objects[1];
    const diameter = circle.getScaledWidth() * App.state.scale;
    label.text = `D: ${diameter.toFixed(2)} m`;
    group.setCoords();
    App.canvas.renderAll();
}