//--- START OF FILE js/standards.js ---

/**
 * Urban Planning Standards & Constants
 * Based on the Principles of Plot Division in Urban Planning.
 */
export const UrbanStandards = {
    // 1. Road Hierarchy
    Roads: {
        arterial: { row: 40, carriage: 20, footpath: 4, cycle: 3 },
        collector: { row: 25, carriage: 14, footpath: 3, cycle: 2 },
        local: { row: 15, carriage: 9, footpath: 2, cycle: 0 },
        access: { row: 8, carriage: 5, footpath: 1, cycle: 0 }
    },

    // 2. Plot Standards
    Zones: {
        highDensity: { minFrontage: 7.5, minDepth: 13.5, minArea: 100, fsi: 2.0, color: '#FFEBEE' },
        mediumDensity: { minFrontage: 10.5, minDepth: 17.5, minArea: 200, fsi: 1.4, color: '#E3F2FD' },
        lowDensity: { minFrontage: 15, minDepth: 25, minArea: 400, fsi: 0.75, color: '#E8F5E9' },
        commercial: { minFrontage: 13.5, minDepth: 21, minArea: 325, fsi: 2.5, color: '#FFF3E0' }
    },

    // 3. Setbacks
    Setbacks: {
        front: 4.5, // meters
        side: 2,    // meters
        rear: 3.5   // meters
    },

    // 4. Public Realm Targets
    PublicRealm: {
        greenBeltPct: 0.12, // 10-15%
        amenityPct: 0.07,   // 5-10%
        perviousPct: 0.30   // 30% of individual plots
    },

    // 5. Social Equity / Affordability Mix
    SocialMix: {
        affordable: 0.25, // EWS/LIG
        midIncome: 0.45,  // MIG
        highIncome: 0.30  // HIG
    },

    // 6. Plot Prototypes (Building Footprints)
    Prototypes: {
        'Courtyard': {
            getFootprints: (w, d, fSet, rSet, sSet) => {
                const iw = w - 2 * sSet;
                const id = d - fSet - rSet;
                const th = Math.min(iw, id) * 0.25;
                return [
                    [{ x: sSet, y: fSet }, { x: w - sSet, y: fSet }, { x: w - sSet, y: fSet + th }, { x: sSet, y: fSet + th }],
                    [{ x: sSet, y: d - rSet - th }, { x: w - sSet, y: d - rSet - th }, { x: w - sSet, y: d - rSet }, { x: sSet, y: d - rSet }],
                    [{ x: sSet, y: fSet + th }, { x: sSet + th, y: fSet + th }, { x: sSet + th, y: d - rSet - th }, { x: sSet, y: d - rSet - th }],
                    [{ x: w - sSet - th, y: fSet + th }, { x: w - sSet, y: fSet + th }, { x: w - sSet, y: d - rSet - th }, { x: w - sSet - th, y: d - rSet - th }]
                ];
            },
            color: '#E1F5FE'
        },
        'L-Shape': {
            getFootprints: (w, d, fSet, rSet, sSet) => {
                const iw = w - 2 * sSet;
                const id = d - fSet - rSet;
                return [[
                    { x: sSet, y: fSet }, { x: w - sSet, y: fSet }, { x: w - sSet, y: fSet + id * 0.4 },
                    { x: sSet + iw * 0.4, y: fSet + id * 0.4 }, { x: sSet + iw * 0.4, y: d - rSet }, { x: sSet, y: d - rSet }
                ]];
            },
            color: '#F3E5F5'
        },
        'U-Shape': {
            getFootprints: (w, d, fSet, rSet, sSet) => {
                const iw = w - 2 * sSet;
                const id = d - fSet - rSet;
                const th = iw * 0.3;
                return [[
                    { x: sSet, y: d - rSet }, { x: sSet, y: fSet }, { x: w - sSet, y: fSet },
                    { x: w - sSet, y: d - rSet }, { x: w - sSet - th, y: d - rSet }, { x: w - sSet - th, y: fSet + id * 0.3 },
                    { x: sSet + th, y: fSet + id * 0.3 }, { x: sSet + th, y: d - rSet }
                ]];
            },
            color: '#E8F5E9'
        },
        'Twin': {
            getFootprints: (w, d, fSet, rSet, sSet) => {
                const iw = w - 2 * sSet;
                const gap = iw * 0.1;
                const unitW = (iw - gap) / 2;
                return [
                    [{ x: sSet, y: fSet }, { x: sSet + unitW, y: fSet }, { x: sSet + unitW, y: d - rSet }, { x: sSet, y: d - rSet }],
                    [{ x: w - sSet - unitW, y: fSet }, { x: w - sSet, y: fSet }, { x: w - sSet, y: d - rSet }, { x: w - sSet - unitW, y: d - rSet }]
                ];
            },
            color: '#FFFDE7'
        },
        'Compact': {
            getFootprints: (w, d, fSet, rSet, sSet) => [[
                { x: sSet, y: fSet }, { x: w - sSet, y: fSet }, { x: w - sSet, y: d - rSet }, { x: sSet, y: d - rSet }
            ]],
            color: '#FFF3E0'
        },
        'Townhouse-Mid': {
            getFootprints: (w, d, fSet, rSet, sSet) => [[
                { x: 0, y: fSet }, { x: w, y: fSet }, { x: w, y: d - rSet }, { x: 0, y: d - rSet }
            ]],
            color: '#F1F8E9'
        },
        'Townhouse-End': {
            getFootprints: (w, d, fSet, rSet, sSet) => {
                // Determine if it's left or right end by some heuristic? 
                // For now, just use one side setback
                return [[
                    { x: sSet, y: fSet }, { x: w, y: fSet }, { x: w, y: d - rSet }, { x: sSet, y: d - rSet }
                ]];
            },
            color: '#FFF3E0'
        }
    }
};

/**
 * Calculates KPIs for a generated solution.
 */
export function calculateKPIs(solution, siteArea) {
    const plots = solution.objects.filter(o => o.isPlot);
    const plotArea = plots.reduce((sum, p) => sum + (p.area || 0), 0);
    const infraArea = solution.objects.filter(o => o.isInfra).reduce((sum, o) => sum + (o.area || 0), 0);
    const greenArea = solution.objects.filter(o => o.isGreen).reduce((sum, o) => sum + (o.area || 0), 0);
    const amenityArea = solution.objects.filter(o => o.isAmenity).reduce((sum, o) => sum + (o.area || 0), 0);

    // Estimate road length from area and standard width
    const avgRoadWidth = solution.params ? solution.params.roadWidth : 10;
    const estimatedRoadLength = infraArea / (avgRoadWidth || 1);

    const socialCounts = plots.reduce((acc, p) => {
        const type = p.socialType || 'MIG';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    return {
        densityEfficiency: plots.length / (siteArea / 10000 || 1), // Plots per hectare
        roadLengthPerPlot: estimatedRoadLength / (plots.length || 1),
        openSpaceRatio: (greenArea + amenityArea) / (plotArea || 1),
        infrastructureCostIndex: infraArea / (plotArea || 1),
        greenPercentage: (greenArea / siteArea) * 100,
        socialMix: socialCounts
    };
}
