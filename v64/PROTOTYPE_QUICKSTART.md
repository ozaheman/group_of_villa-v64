# Quick Start Guide - Prototype Management

## How to Use Prototypes

### Step 1: Enable Manual Mode
1. Go to section **3a. Building Prototypes**
2. Check the **"Manual Override"** checkbox
3. All prototype sliders and input fields become active

### Step 2: Assign Percentages

#### Option A: Using Sliders
- Drag each prototype slider (0-100%)
- See percentage update in real-time
- Input field auto-syncs

#### Option B: Using Numeric Input
- Click the percentage input field
- Type exact value (0-100)
- Press Enter to confirm
- Slider auto-syncs

### Step 3: Monitor Total Percentage
- **Remaining %** shows how much more you need to allocate
- **Color Indicator**:
  - 🟢 Green (100%) = Complete and valid
  - 🟡 Orange (<100%) = Incomplete, add more
  - 🔴 Red (>100%) = Over-allocation, reduce

### Step 4: View Statistics
1. Click **"View Stats"** button
2. Panel expands showing:
   - Total estimated plots
   - Average plot size, built-up, and floor area
   - Breakdown by building type
3. Click again to collapse

### Step 5: Apply Configuration
- Once mix totals 100%, system is ready
- Generate layouts - they will respect your mix
- Sliders distribute plots according to percentages

## Example Configurations

### Balanced Mixed Development (50/50)
- Villas: 50%
  - Compact: 10%
  - L-Shaped: 20%
  - Courtyard: 10%
  - U-Shaped: 10%
- Townhouses: 50%
  - End Units: 20%
  - Mid Units: 25%
  - Twin Units: 5%

### Luxury Focus
- Villas: 80%
  - Courtyard: 30%
  - U-Shaped: 50%
- Townhouses: 20%
  - Twin Units: 20%

### Affordable Housing
- Townhouses: 70%
  - End Units: 35%
  - Mid Units: 35%
- Villas: 30%
  - Compact: 30%

## Prototype Specifications Reference

### Villas
| Type | Plot (m²) | Built-up (m²) | Floor (m²) |
|------|-----------|---------------|-----------|
| Compact | 150-200 | 100-120 | 120-160 |
| L-Shaped | 200-300 | 140-170 | 180-240 |
| Courtyard | 250-350 | 160-200 | 200-300 |
| U-Shaped | 300-450 | 200-250 | 280-400 |

### Townhouses
| Type | Plot (m²) | Built-up (m²) | Floor (m²) | Units |
|------|-----------|---------------|-----------|-------|
| End Unit | 80-120 | 60-80 | 100-140 | 1 |
| Mid Unit | 70-100 | 50-70 | 80-120 | 1 |
| Twin Unit | 150-200 | 110-140 | 180-240 | 2 |

### Apartments
| Type | Plot (m²) | Built-up (m²) | Floor (m²) | Units |
|------|-----------|---------------|-----------|-------|
| Low-Rise | 500-800 | 300-500 | 1000-2000 | 8 |

## Tips & Tricks

1. **Quick Reset**: Click "Reset Mix" to clear all and start over
2. **Synced Inputs**: Slider and numeric inputs always stay synchronized
3. **Type Breakdown**: View stats to see your chosen mix by building type
4. **Validation**: System prevents layouts until you reach exactly 100%
5. **Flexibility**: Switch between slider and input methods anytime
6. **Override Mode**: When off, values are locked to prevent accidental changes

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Sliders are disabled | Enable "Manual Override" checkbox |
| Can't reach exactly 100% | Use numeric inputs for precision |
| Total shows as red (>100%) | Reduce any percentage values |
| Stats not showing | Click "View Stats" button again |
| Values not syncing | Refresh page and re-enter values |

## Data Storage

- All prototype percentages stored in application state
- Configurations can be exported from browser console:
  ```javascript
  exportMixConfiguration() // Returns current mix object
  ```
- Import configurations similarly through the API

## Next Steps

Once you've configured your prototype mix:
1. Use **Generate Layout Solutions** to create designs
2. Run **Step-by-Step Wizard** for guided layout
3. **Subdivide Plots** to create house lots
4. **Download Report** to see compliance analysis
