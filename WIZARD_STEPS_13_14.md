# Wizard Steps 13 & 14 - Entry/Exit Road Creation

## Overview
Steps 13 and 14 create proper roads from the marked entry and exit points to the ring road, including:
- Full road width (carriage way)
- Pavements on both sides
- Proper connection to ring road
- Automatic removal of conflicting plots
- Color-coded visualization

## Usage

### Prerequisites
Before running steps 13 or 14, you must:
1. Complete steps 1-3 to create the ring road
2. Mark entry point using "📍 Add Entry" button  
3. Mark exit point using "🚪 Add Exit" button

### Step 13: Create Entry Road
**Purpose**: Creates a full road from the entry point on the boundary to the ring road

**What it does**:
1. Finds the nearest point on the ring road to the entry marker
2. Creates a road polygon with full carriage width
3. Adds pavements on both sides
4. Adds a green dashed centerline marking
5. Places "ENTRY ▶" label on the road
6. Removes any plots that conflict with the new road
7. Shows alert with count of removed plots

**Visual indicators**:
- Road surface: Dark gray (#444444)
- Pavements: Light gray (#CCCCCC)
- Centerline: Green (#4CAF50) dashed line
- Label: Green "ENTRY ▶" text

### Step 14: Create Exit Road
**Purpose**: Creates full road from the exit point on boundary to the ring road

**What it does**:
1. Finds the nearest point on the ring road to the exit marker
2. Creates a road polygon with full carriage width
3. Adds pavements on both sides
4. Adds a red dashed centerline marking
5. Places "◀ EXIT" label on the road
6. Removes any plots that conflict with the new road
7. Shows alert with count of removed plots

**Visual indicators**:
- Road surface: Dark gray (#444444)
- Pavements: Light gray (#CCCCCC)
- Centerline: Red (#f44336) dashed line
- Label: Red "◀ EXIT" text

## Technical Details

### Road Dimensions
The road dimensions are based on the selected road type:
- **Access Lane**: 5m carriage, 1m footpaths
- **Local Street**: 9m carriage, 2m footpaths
- **Collector**: 14m carriage, 3m footpaths

### Turning Radius
The default turning radius of 15m is used for smooth transitions at the ring road junction. This can be adjusted in the control panel (10-20m range).

### Plot Conflict Detection
The system automatically detects and removes plots that:
- Overlap with the road surface
- Are within the pavement zones
- Are too close to the road (using clearance buffer)

**Clearance Buffer** = (CarriageWidth + 2 × FootpathWidth) / 2

This ensures adequate space for the road and safe plot setbacks.

### Fillet Curves
Roads connect to the ring road with smooth transitions. The curve radius is calculated based on:
- Turning radius setting (15m default)
- Road approach angle
- Available space

## Workflow Example

### Complete Workflow:
```
1. Draw site boundary
2. Set entry point (📍 Add Entry)
3. Set exit point (🚪 Add Exit)
4. Step 1: Outer Plots
5. Step 2: Outer Pavement
6. Step 3: Road Ring ← Creates ring road
7. Step 4-12: Complete other steps
8. Step 13: Entry Rd ← Creates entry road
9. Step 14: Exit Rd ← Creates exit road
```

### Verification:
After steps 13 and 14, you should see:
- ✅ Roads connecting entry/exit to ring road
- ✅ Pavements on both sides
- ✅ Color-coded centerlines
- ✅ Entry/Exit labels
- ✅ No plot overlaps
- ✅ Alert showing removed plots count

## Benefits

### Accurate Road Network
- Proper road widths per standards
- Complete pavement infrastructure
- Professional visualization

### Automatic Plot Management
- No manual plot deletion needed
- Ensures code compliance
- Maintains setback requirements

### Clear Circulation
- Entry and exit clearly marked
- Colored for easy identification
- Proper connection to internal roads

## File Structure

### Code Files
```
js/
├── generative.js          (Steps 13 & 14 logic)
├── entryExitRoadHelpers.js (Road creation functions)
├── main.js                (Event listeners)
└── ui.js                  (Button states)
```

### Key Functions

**In generative.js**:
- `runWizardStep(13)` - Entry road creation
- `runWizardStep(14)` - Exit road creation

**In entryExitRoadHelpers.js**:
- `createEntryExitRoad()` - Creates road with pavements
- `removeConflictingPlots()` - Detects and removes overlaps
- `closestPointOnLineSegment()` - Finds nearest ring road point
- `doPolygonsOverlap()` - Checks for conflicts

## Troubleshooting

### "Please set entry point first"
**Solution**: Click "📍 Add Entry" button, then click on the boundary where you want the entry.

### "No ring road found"
**Solution**: Complete Step 3 first to create the ring ring.

### Roads not connecting properly
**Possible causes**:
1. Entry/exit markers too far from boundary
2. Ring road incomplete or malformed
3. Turning radius too large for available space

**Solutions**:
1. Re-place entry/exit markers on actual boundary
2. Verify ring road is a closed polygon
3. Reduce turning radius in settings

### Too many plots removed
**Normal behavior**: If plots were placed too close to entry/exit locations, they will be automatically removed to make space for the road infrastructure.

**To minimize**: Place entry/exit points in areas with fewer existing plots.

## Future Enhancements

### Planned Features:
- [ ] Roundabout generation at entry/ring road junction
- [ ] Layby/deceleration lanes
- [ ] Traffic calming features (speed bumps, chicanes)
- [ ] Pedestrian crossings
- [ ] Signage placement
- [ ] Lighting layout

## Engineering Standards

### Road Design Speed: 20 km/h
- Minimum turning radius: 10.5m
- Recommended radius: 15-20m
- Based on: R = V²/127(e+f)

### Pavement Width
- Minimum: 1.0m (Access Lane)
- Standard: 2.0m (Local Street)
- Recommended: 3.0m (Collector)

### Setbacks from Entry/Exit Roads
Same as standard internal roads:
- Front: 4.5m
- Side: 2.0m
- Rear: 3.5m

---

**Last Updated**: 2026-01-31  
**Version**: v64  
**Status**: Implemented & Tested
