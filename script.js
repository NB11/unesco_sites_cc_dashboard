// App State
let routes = [];
let map = null;
let addedRouteIds = []; // Track IDs of routes added to the map for cleanup
let selectedRoutes = new Set(); // Track which routes are selected
let isLoadingDefaultRoute = false; // Flag to track default route loading
let unescoSitesLoaded = false; // Track if UNESCO sites are loaded
window.unescoSitesLoaded = false; // Also track globally
const routeColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
let unescoSitesData = []; // Store complete site data objects

// Initialize Map with Maplibre GL JS
function initMap() {
    console.log('initMap called');
    
    // Check if map container exists
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container #map not found!');
        return;
    }
    
    // Ensure map container is visible
    const mapContainerParent = document.querySelector('.map-container');
    if (mapContainerParent) {
        mapContainerParent.style.display = 'block';
        mapContainerParent.style.visibility = 'visible';
        console.log('Map container parent found and made visible');
    }
    
    map = window.map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                'osm-tiles': {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                },
                'satellite-tiles': {
                    type: 'raster',
                    tiles: [
                        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    ],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
                }
            },
            layers: [
                {
                    id: 'osm-tiles-layer',
                    type: 'raster',
                    source: 'osm-tiles',
                    minzoom: 0,
                    maxzoom: 19
                }
            ]
        },
        center: [0, 20], // [lng, lat] - Center of the world
        zoom: 1.5, // Zoom level to show the whole world
        antialias: true // Smooth rendering
    });
    
    console.log('Map instance created');
    
    // Force map to resize after a delay to ensure it renders
    setTimeout(() => {
        if (map) {
            map.resize();
            console.log('Map resized');
            // Also trigger repaint
            map.triggerRepaint();
        }
    }, 100);
    
    // Additional resize on window load
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (map) {
                map.resize();
                map.triggerRepaint();
                console.log('Map resized on window load');
            }
        }, 200);
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Hide map placeholder immediately
    const mapPlaceholder = document.getElementById('map-placeholder');
    if (mapPlaceholder) {
        mapPlaceholder.classList.add('hidden');
    }

    // Wait for map to load AND style to load before loading default GPX
    map.on('load', function() {
        console.log('Map load event fired');
        // Ensure placeholder is hidden
        if (mapPlaceholder) {
            mapPlaceholder.classList.add('hidden');
        }
        
        // Force another resize after load
        setTimeout(() => {
            if (map) {
                map.resize();
                console.log('Map resized after load');
            }
        }, 100);
        
        if (!map.isStyleLoaded()) {
            // If style isn't loaded yet, wait for it
            console.log('Style not loaded, waiting for style.load...');
            map.once('style.load', function() {
                console.log('Style loaded, calling data loading functions...');
                // Ensure placeholder is hidden
                if (mapPlaceholder) {
                    mapPlaceholder.classList.add('hidden');
                }
                try {
                    loadDefaultGPX();
                    loadUnescoSites();
                    console.log('About to call loadWhc001CSV...');
                    console.log('loadWhc001CSV function exists?', typeof loadWhc001CSV);
                    if (typeof loadWhc001CSV === 'function') {
                        loadWhc001CSV();
                    } else {
                        console.error('loadWhc001CSV is not a function!', typeof loadWhc001CSV);
                    }
                } catch (error) {
                    console.error('Error in data loading functions:', error);
                }
            });
        } else {
            // If style is already loaded, just run it
            console.log('Style already loaded, calling data loading functions...');
            // Ensure placeholder is hidden
            if (mapPlaceholder) {
                mapPlaceholder.classList.add('hidden');
            }
            try {
                loadDefaultGPX();
                loadUnescoSites();
                console.log('About to call loadWhc001CSV...');
                console.log('loadWhc001CSV function exists?', typeof loadWhc001CSV);
                if (typeof loadWhc001CSV === 'function') {
                    loadWhc001CSV();
                } else {
                    console.error('loadWhc001CSV is not a function!', typeof loadWhc001CSV);
                }
            } catch (error) {
                console.error('Error in data loading functions:', error);
            }
        }
    });
}

// Switch Map Layer
function switchMapLayer(layerType) {
    if (!map || !map.loaded()) {
        console.warn('Map not ready for layer switch');
        return;
    }
    
    // Wait for style to be loaded
    if (!map.isStyleLoaded()) {
        map.once('style.load', () => switchMapLayer(layerType));
        return;
    }
    
    // Remove existing base layer if it exists
    const existingLayer = map.getLayer('osm-tiles-layer');
    if (existingLayer) {
        map.removeLayer('osm-tiles-layer');
    }
    
    // Add satellite source if it doesn't exist
    if (!map.getSource('satellite-tiles')) {
        map.addSource('satellite-tiles', {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
        });
    }
    
    // Add the selected layer
    // Check if points layer exists to determine insertion order
    const pointsLayerExists = map.getLayer('whc001-layer');
    const beforeId = pointsLayerExists ? 'whc001-layer' : undefined;
    
    if (layerType === 'satellite') {
        map.addLayer({
            id: 'osm-tiles-layer', // Reuse same ID for simplicity
            type: 'raster',
            source: 'satellite-tiles',
            minzoom: 0,
            maxzoom: 19
        }, beforeId); // Add before points layer if it exists, otherwise at bottom
    } else {
        map.addLayer({
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
        }, beforeId); // Add before points layer if it exists, otherwise at bottom
    }
    
    // Update button states
    document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`layer-${layerType}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    console.log('Switched to', layerType, 'layer');
}

// GPX Parser
function parseGPX(gpxContent, fileName) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
        
        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Invalid XML format');
        }

        const coordinates = [];
        const elevations = [];
        let routeName = fileName.replace('.gpx', '');

        // Extract name from metadata
        const metadataName = xmlDoc.querySelector('metadata > name');
        if (metadataName) {
            routeName = metadataName.textContent.trim();
        }

        // Process tracks
        const tracks = xmlDoc.querySelectorAll('trk');
        if (tracks.length > 0) {
            const track = tracks[0];
            const trackName = track.querySelector('name');
            if (trackName) {
                routeName = trackName.textContent.trim();
            }

            const segments = track.querySelectorAll('trkseg');
            segments.forEach(segment => {
                const points = segment.querySelectorAll('trkpt');
                points.forEach(point => {
                    const lat = parseFloat(point.getAttribute('lat'));
                    const lon = parseFloat(point.getAttribute('lon'));
                    
                    if (!isNaN(lat) && !isNaN(lon)) {
                        coordinates.push([lon, lat]);
                        
                        const ele = point.querySelector('ele');
                        if (ele) {
                            const elevation = parseFloat(ele.textContent);
                            if (!isNaN(elevation)) {
                                elevations.push(elevation);
                            }
                        }
                    }
                });
            });
        }

        // Process routes if no tracks found
        if (coordinates.length === 0) {
            const routes = xmlDoc.querySelectorAll('rte');
            if (routes.length > 0) {
                const route = routes[0];
                const routeNameEl = route.querySelector('name');
                if (routeNameEl) {
                    routeName = routeNameEl.textContent.trim();
                }

                const points = route.querySelectorAll('rtept');
                points.forEach(point => {
                    const lat = parseFloat(point.getAttribute('lat'));
                    const lon = parseFloat(point.getAttribute('lon'));
                    
                    if (!isNaN(lat) && !isNaN(lon)) {
                        coordinates.push([lon, lat]);
                        
                        const ele = point.querySelector('ele');
                        if (ele) {
                            const elevation = parseFloat(ele.textContent);
                            if (!isNaN(elevation)) {
                                elevations.push(elevation);
                            }
                        }
                    }
                });
            }
        }

        if (coordinates.length === 0) {
            return null;
        }

        // Calculate distance using Haversine formula
        function calculateDistance(coords) {
            let totalDistance = 0;
            const R = 6371000; // Earth's radius in meters
            
            for (let i = 1; i < coords.length; i++) {
                const [lon1, lat1] = coords[i - 1];
                const [lon2, lat2] = coords[i];
                
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = 
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = R * c;
                
                totalDistance += distance;
            }
            
            return totalDistance;
        }

        const distance = calculateDistance(coordinates);
        const maxElevation = elevations.length > 0 ? Math.max(...elevations) : undefined;

        return {
            id: `route-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            coordinates,
            name: routeName,
            distance,
            elevation: maxElevation
        };
    } catch (error) {
        console.error('Error parsing GPX:', error);
        throw error;
    }
}

// Format distance
function formatDistance(distance) {
    if (!distance) return 'N/A';
    return distance > 1000 
        ? `${(distance / 1000).toFixed(1)} km` 
        : `${Math.round(distance)} m`;
}

// Update Map with Routes
function updateMap() {
    if (!map) return;
    
    // Wait for map to be loaded and style ready before updating
    if (!map.loaded() || !map.isStyleLoaded()) {
        if (map.loaded()) {
            map.once('style.load', updateMap);
        } else {
            map.once('load', updateMap);
        }
        return;
    }

    // Clear existing routes
    addedRouteIds.forEach(routeId => {
        const layerId = `route-layer-${routeId}`;
        const sourceId = `route-${routeId}`;
        
        // IMPORTANT: Remove layer first, then source
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
        }
        if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
        }
    });
    addedRouteIds = []; // Clear the tracking array

    // Always hide placeholder - map should always be visible
    document.getElementById('map-placeholder').classList.add('hidden');

    const allBounds = [];
    
    routes.forEach((route, index) => {
        // Only show selected routes
        if (!selectedRoutes.has(route.id)) {
            return;
        }

        if (route.coordinates.length === 0) {
            return;
        }

        // Convert coordinates to GeoJSON format [lng, lat]
        const coordinates = route.coordinates.map(coord => [coord[0], coord[1]]);
        
        // Collect bounds
        coordinates.forEach(coord => {
            allBounds.push(coord);
        });

        // Create GeoJSON source
        const sourceId = `route-${route.id}`;
        const layerId = `route-layer-${route.id}`;
        
        try {
            // Remove source/layer if they already exist
            if (map.getLayer(layerId)) {
                map.removeLayer(layerId);
            }
            if (map.getSource(sourceId)) {
                map.removeSource(sourceId);
            }
            
            map.addSource(sourceId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    }
                }
            });

            // Add layer
            map.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': routeColors[index % routeColors.length],
                    'line-width': 4,
                    'line-opacity': 1.0
                }
            });
        } catch (error) {
            console.error(`Error adding route ${route.id} to map:`, error);
        }

        // Add the route.id to our tracking array
        addedRouteIds.push(route.id);
    });

    // Fit map to show all selected routes (skip if loading default route)
    if (allBounds.length > 0 && !isLoadingDefaultRoute) {
        // Calculate bounds properly
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        
        allBounds.forEach(coord => {
            const [lng, lat] = coord;
            minLng = Math.min(minLng, lng);
            minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng);
            maxLat = Math.max(maxLat, lat);
        });
        
        const bounds = new maplibregl.LngLatBounds(
            [minLng, minLat],
            [maxLng, maxLat]
        );
        
        // Fit bounds with proper padding - adjust for better view
        map.fitBounds(bounds, {
            padding: { top: 100, bottom: 100, left: 100, right: 100 },
            duration: 2000,
            maxZoom: 14, // Don't zoom in too close
            linear: false // Use easeOut animation for smoother zoom
        });
    }
}

// Update UI
function updateUI() {
    // Update route list
    const routeList = document.getElementById('route-list');
    const routesCard = document.getElementById('routes-card');
    
    if (routes.length > 0) {
        routesCard.style.display = 'block';
        routeList.innerHTML = routes.map((route, index) => `
            <div class="route-item">
                <div class="route-info">
                    <div class="route-color" style="background-color: ${routeColors[index % routeColors.length]}"></div>
                    <div class="route-details">
                        <h4>${route.name}</h4>
                        <p>${formatDistance(route.distance)}${route.elevation ? ` • ${Math.round(route.elevation)}m elevation` : ''}</p>
                    </div>
                </div>
                <button class="btn-remove" onclick="removeRoute('${route.id}')">
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        `).join('');
    } else {
        routesCard.style.display = 'none';
    }

    // Update analytics - only calculate from selected routes
    const selectedRoutesList = routes.filter(route => selectedRoutes.has(route.id));
    const totalDistance = selectedRoutesList.reduce((sum, route) => sum + (route.distance || 0), 0);
    const totalRoutes = selectedRoutesList.length;
    const maxElevation = selectedRoutesList.reduce((max, route) => Math.max(max, route.elevation || 0), 0);

    document.getElementById('route-count').textContent = routes.length; // Total routes loaded
    document.getElementById('total-distance').textContent = formatDistance(totalDistance);
    document.getElementById('total-routes').textContent = totalRoutes; // Selected routes count

    if (maxElevation > 0) {
        document.getElementById('max-elevation-item').style.display = 'flex';
        document.getElementById('max-elevation').textContent = `${Math.round(maxElevation)}m`;
    } else {
        document.getElementById('max-elevation-item').style.display = 'none';
    }

    const statsCard = document.getElementById('stats-card');
    const emptyAnalyticsCard = document.getElementById('empty-analytics-card');
    const routeSelectorCard = document.getElementById('route-selector-card');
    const routeSelectorList = document.getElementById('route-selector-list');
    
    if (routes.length > 0) {
        routeSelectorCard.style.display = 'block';
        
        // Show stats only if there are selected routes
        if (totalRoutes > 0) {
            statsCard.style.display = 'block';
            emptyAnalyticsCard.style.display = 'none';
        } else {
            statsCard.style.display = 'none';
            emptyAnalyticsCard.style.display = 'block';
        }
        
        // Update route selector list
        routeSelectorList.innerHTML = routes.map((route, index) => {
            const isSelected = selectedRoutes.has(route.id);
            // Use HTML entity encoding for route.id to safely store in data attribute
            const encodedRouteId = route.id.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            return `
                <div class="route-selector-item ${isSelected ? 'selected' : ''}" data-route-id="${encodedRouteId}">
                    <div class="route-selector-checkbox">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div class="route-selector-info">
                        <h4>${route.name}</h4>
                        <p>${formatDistance(route.distance)}${route.elevation ? ` • ${Math.round(route.elevation)}m elevation` : ''}</p>
                    </div>
                    <div class="route-color" style="background-color: ${routeColors[index % routeColors.length]}; width: 1rem; height: 1rem; border-radius: 50%; flex-shrink: 0;"></div>
                </div>
            `;
        }).join('');
    } else {
        statsCard.style.display = 'none';
        routeSelectorCard.style.display = 'none';
        emptyAnalyticsCard.style.display = 'block';
    }
}

// Toggle Route Selection
function toggleRouteSelection(routeId) {
    if (selectedRoutes.has(routeId)) {
        selectedRoutes.delete(routeId);
    } else {
        selectedRoutes.add(routeId);
    }
    
    updateMap();
    updateUI();
}

// Handle File Upload
async function handleFileUpload(files) {
    const browseText = document.getElementById('browse-text');
    browseText.textContent = 'Loading...';
    
    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (!file.name.toLowerCase().endsWith('.gpx')) {
                alert(`${file.name} is not a GPX file`);
                continue;
            }

            const text = await file.text();
            const parsedRoute = parseGPX(text, file.name);
            
            if (parsedRoute) {
                routes.push(parsedRoute);
                // Automatically select new routes
                selectedRoutes.add(parsedRoute.id);
            }
        }

        updateMap();
        updateUI();
    } catch (error) {
        alert('Error loading GPX file. Please check the file format and try again.');
        console.error(error);
    } finally {
        browseText.textContent = 'Browse Files';
    }
}

// Remove Route
function removeRoute(routeId) {
    routes = routes.filter(route => route.id !== routeId);
    selectedRoutes.delete(routeId);
    updateMap();
    updateUI();
}

// Tab Switching
document.querySelectorAll('.tab-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
        const tabName = trigger.dataset.tab;
        
        // Update active tab
        document.querySelectorAll('.tab-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        trigger.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// Layer Control Event Listeners
document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const layerType = btn.dataset.layer;
        switchMapLayer(layerType);
    });
});

// Sentinel Control Event Listeners
document.querySelectorAll('.sentinel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const sentinelType = btn.dataset.sentinel;
        
        // Update button states
        document.querySelectorAll('.sentinel-btn').forEach(b => {
            b.classList.remove('active');
        });
        btn.classList.add('active');
        
        // Switch to Data tab and show date range selector
        switchToDataTab(sentinelType);
    });
});

// Calendar functionality
let currentStartCalendarDate = new Date();
let currentEndCalendarDate = new Date();
currentEndCalendarDate.setMonth(currentEndCalendarDate.getMonth() + 1); // Default end date is next month
let selectedSentinel = null;
let selectedStartDate = null;
let selectedEndDate = null;

function switchToDataTab(sentinelType) {
    selectedSentinel = sentinelType;
    
    // Show compact calendar
    const compactCalendar = document.getElementById('compact-calendar');
    if (compactCalendar) {
        compactCalendar.style.display = 'block';
    }
    
    // Switch to Data tab
    document.querySelectorAll('.tab-trigger').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    const dataTab = document.getElementById('data-tab');
    const dataTrigger = document.querySelector('[data-tab="data"]');
    
    if (dataTab && dataTrigger) {
        dataTrigger.classList.add('active');
        dataTab.classList.add('active');
    }
    
    // Update UI
    const emptyState = document.getElementById('data-empty-state');
    const selectionContent = document.getElementById('data-selection-content');
    const sentinelNumber = document.getElementById('selected-sentinel-number');
    
    if (emptyState) emptyState.style.display = 'none';
    if (selectionContent) selectionContent.style.display = 'block';
    if (sentinelNumber) sentinelNumber.textContent = sentinelType;
    
    // Render compact calendar
    renderCompactCalendar();
    updateDateRangeSummary();
}

function renderCompactCalendar() {
    const monthYearEl = document.getElementById('compact-calendar-month-year');
    const weekdaysEl = document.getElementById('compact-calendar-weekdays');
    const daysEl = document.getElementById('compact-calendar-days');
    
    if (!monthYearEl || !weekdaysEl || !daysEl) return;
    
    const year = currentStartCalendarDate.getFullYear();
    const month = currentStartCalendarDate.getMonth();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Month names
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    // Update month/year header
    monthYearEl.textContent = `${monthNames[month]} ${year}`;
    
    // Weekday headers
    let weekdaysHtml = '';
    dayNames.forEach(day => {
        weekdaysHtml += `<div class="compact-calendar-weekday">${day}</div>`;
    });
    weekdaysEl.innerHTML = weekdaysHtml;
    
    // Get today's date for highlighting
    const today = new Date();
    const isToday = (day) => {
        return day === today.getDate() && 
               month === today.getMonth() && 
               year === today.getFullYear();
    };
    
    // Check if date is in selected range
    const isInRange = (day) => {
        if (!selectedStartDate || !selectedEndDate) return false;
        const date = new Date(year, month, day);
        return date >= selectedStartDate && date <= selectedEndDate;
    };
    
    // Check if date is selected (start or end)
    const isSelected = (day) => {
        if (!selectedStartDate && !selectedEndDate) return false;
        const date = new Date(year, month, day);
        if (selectedStartDate && date.getTime() === selectedStartDate.getTime()) return true;
        if (selectedEndDate && date.getTime() === selectedEndDate.getTime()) return true;
        return false;
    };
    
    let daysHtml = '';
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        daysHtml += `<div class="compact-calendar-day other-month">${day}</div>`;
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const todayClass = isToday(day) ? 'today' : '';
        const selectedClass = isSelected(day) ? 'selected' : '';
        const inRangeClass = isInRange(day) && !selectedClass ? 'in-range' : '';
        daysHtml += `<div class="compact-calendar-day ${todayClass} ${selectedClass} ${inRangeClass}" data-day="${day}" data-month="${month}" data-year="${year}">${day}</div>`;
    }
    
    // Next month days (fill remaining cells)
    const totalCells = firstDay + daysInMonth;
    const remainingCells = 42 - totalCells; // 6 rows * 7 days
    for (let day = 1; day <= remainingCells; day++) {
        daysHtml += `<div class="compact-calendar-day other-month">${day}</div>`;
    }
    
    daysEl.innerHTML = daysHtml;
    
    // Add navigation event listeners
    const prevBtn = document.getElementById('compact-calendar-prev');
    const nextBtn = document.getElementById('compact-calendar-next');
    
    if (prevBtn) {
        prevBtn.onclick = () => {
            currentStartCalendarDate.setMonth(month - 1);
            renderCompactCalendar();
        };
    }
    
    if (nextBtn) {
        nextBtn.onclick = () => {
            currentStartCalendarDate.setMonth(month + 1);
            renderCompactCalendar();
        };
    }
    
    // Day click handlers
    daysEl.querySelectorAll('.compact-calendar-day:not(.other-month)').forEach(dayEl => {
        dayEl.addEventListener('click', () => {
            const day = parseInt(dayEl.dataset.day);
            const selectedMonth = parseInt(dayEl.dataset.month);
            const selectedYear = parseInt(dayEl.dataset.year);
            const clickedDate = new Date(selectedYear, selectedMonth, day);
            
            // If no dates selected, set as start
            if (!selectedStartDate && !selectedEndDate) {
                selectedStartDate = clickedDate;
            }
            // If only start date selected
            else if (selectedStartDate && !selectedEndDate) {
                if (clickedDate < selectedStartDate) {
                    // Clicked date is before start, swap them
                    selectedEndDate = selectedStartDate;
                    selectedStartDate = clickedDate;
                } else {
                    selectedEndDate = clickedDate;
                }
            }
            // If both dates selected, start new selection
            else {
                selectedStartDate = clickedDate;
                selectedEndDate = null;
            }
            
            renderCompactCalendar();
            updateDateRangeSummary();
        });
    });
}

function updateDateRangeSummary() {
    const value = document.getElementById('date-range-value');
    const rangeStartValue = document.getElementById('range-start-value');
    const rangeEndValue = document.getElementById('range-end-value');
    const mockViz = document.getElementById('mock-visualizations');
    
    if (selectedStartDate && selectedEndDate) {
        const startStr = selectedStartDate.toISOString().split('T')[0];
        const endStr = selectedEndDate.toISOString().split('T')[0];
        if (value) value.textContent = `${startStr} to ${endStr}`;
        if (rangeStartValue) rangeStartValue.textContent = startStr;
        if (rangeEndValue) rangeEndValue.textContent = endStr;
        if (mockViz) {
            mockViz.style.display = 'block';
            renderMockVisualizations();
        }
        console.log('Date range selected:', startStr, 'to', endStr, 'for Sentinel', selectedSentinel);
    } else if (selectedStartDate) {
        const startStr = selectedStartDate.toISOString().split('T')[0];
        if (value) value.textContent = `Start: ${startStr} (select end date)`;
        if (rangeStartValue) rangeStartValue.textContent = startStr;
        if (rangeEndValue) rangeEndValue.textContent = '-';
        if (mockViz) mockViz.style.display = 'none';
    } else {
        if (value) value.textContent = 'No dates selected';
        if (rangeStartValue) rangeStartValue.textContent = '-';
        if (rangeEndValue) rangeEndValue.textContent = '-';
        if (mockViz) mockViz.style.display = 'none';
    }
}

function renderMockVisualizations() {
    renderTouristHistogram();
    renderClimateLinePlot();
}

function renderTouristHistogram() {
    const svg = document.getElementById('tourist-histogram');
    if (!svg) return;
    
    // Mock data: 12 months of tourist visits
    const data = [120, 150, 180, 220, 280, 320, 350, 330, 280, 200, 150, 130];
    const maxValue = Math.max(...data);
    const barWidth = 280 / data.length;
    const chartHeight = 120;
    const chartWidth = 280;
    const padding = 10;
    
    let html = '';
    
    // Draw bars
    data.forEach((value, index) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding + index * barWidth;
        const y = chartHeight + padding - barHeight;
        
        html += `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barHeight}" 
                fill="#3b82f6" opacity="0.8" rx="2"></rect>`;
    });
    
    // Draw axis line
    html += `<line x1="${padding}" y1="${padding + chartHeight}" x2="${padding + chartWidth}" y2="${padding + chartHeight}" 
            stroke="#e5e7eb" stroke-width="1"></line>`;
    
    svg.innerHTML = html;
}

function renderClimateLinePlot() {
    const svg = document.getElementById('climate-lineplot');
    if (!svg) return;
    
    // Mock data: 12 data points for sea level and temperature
    const seaLevelData = [45, 48, 52, 55, 58, 62, 65, 68, 70, 72, 75, 78];
    const tempData = [18.5, 19.2, 20.1, 21.5, 22.8, 24.2, 25.5, 26.1, 25.8, 24.5, 22.3, 20.1];
    
    const chartWidth = 280;
    const chartHeight = 150;
    const padding = 15;
    
    const seaLevelMax = Math.max(...seaLevelData);
    const seaLevelMin = Math.min(...seaLevelData);
    const tempMax = Math.max(...tempData);
    const tempMin = Math.min(...tempData);
    
    let html = '';
    
    // Draw grid lines
    for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        html += `<line x1="${padding}" y1="${y}" x2="${padding + chartWidth}" y2="${y}" 
                stroke="#f3f4f6" stroke-width="0.5"></line>`;
    }
    
    // Draw sea level line
    let seaLevelPath = '';
    seaLevelData.forEach((value, index) => {
        const x = padding + (chartWidth / (seaLevelData.length - 1)) * index;
        const y = padding + chartHeight - ((value - seaLevelMin) / (seaLevelMax - seaLevelMin)) * chartHeight;
        seaLevelPath += (index === 0 ? 'M' : 'L') + ` ${x} ${y}`;
    });
    html += `<path d="${seaLevelPath}" fill="none" stroke="#3b82f6" stroke-width="2"></path>`;
    
    // Draw temperature line
    let tempPath = '';
    tempData.forEach((value, index) => {
        const x = padding + (chartWidth / (tempData.length - 1)) * index;
        const y = padding + chartHeight - ((value - tempMin) / (tempMax - tempMin)) * chartHeight;
        tempPath += (index === 0 ? 'M' : 'L') + ` ${x} ${y}`;
    });
    html += `<path d="${tempPath}" fill="none" stroke="#ef4444" stroke-width="2"></path>`;
    
    // Draw axis line
    html += `<line x1="${padding}" y1="${padding + chartHeight}" x2="${padding + chartWidth}" y2="${padding + chartHeight}" 
            stroke="#e5e7eb" stroke-width="1"></line>`;
    html += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + chartHeight}" 
            stroke="#e5e7eb" stroke-width="1"></line>`;
    
    svg.innerHTML = html;
}

// File Input Handlers (only if elements exist - they were removed from HTML)
const fileInput = document.getElementById('file-input');
const uploadArea = document.getElementById('upload-area');
const browseBtn = document.getElementById('browse-btn');

if (browseBtn) {
    browseBtn.addEventListener('click', () => {
        if (fileInput) fileInput.click();
    });
}

if (uploadArea) {
    uploadArea.addEventListener('click', () => {
        if (fileInput) fileInput.click();
    });

    // Drag and Drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files);
        }
    });
}

// Load Default GPX Files
async function loadDefaultGPX() {
    const defaultFiles = [
        'sample_gpx/2025-06-27_2320624248_Velotour.gpx',
        'sample_gpx/2025-06-27_2320622316_Velotour - Thusis - Samaden.gpx'
    ];
    
    // Set flag to skip fitBounds *inside* updateMap
    isLoadingDefaultRoute = true;
    
    try {
        // 1. Load all GPX files and select them
        for (const filePath of defaultFiles) {
            try {
                const response = await fetch(filePath);
                if (!response.ok) {
                    console.warn(`Default GPX file not found: ${filePath}, skipping...`);
                    continue;
                }
                const gpxContent = await response.text();
                const fileName = filePath.split('/').pop();
                const parsedRoute = parseGPX(gpxContent, fileName);
                
                if (parsedRoute) {
                    routes.push(parsedRoute);
                    // Automatically select all default routes
                    selectedRoutes.add(parsedRoute.id);
                    console.log(`Loaded default route: ${parsedRoute.name} (ID: ${parsedRoute.id})`);
                }
            } catch (error) {
                console.error(`Error loading default GPX file ${filePath}:`, error);
            }
        }
        
        // 2. Update the UI (Checkboxes will now be checked)
        updateUI();
        
        // 3. Update the Map (Layers will be drawn)
        // We can call this directly. We know the map is ready.
        updateMap();
        
        // 4. Manually fit bounds *after* a 'tick' (setTimeout 0)
        // This yields to the event loop, letting the map
        // process the updateMap() call before we animate the zoom.
        setTimeout(() => {
            if (map && map.loaded() && routes.length > 0) {
                const allBounds = [];
                routes.forEach(route => {
                    if (selectedRoutes.has(route.id) && route.coordinates.length > 0) {
                        route.coordinates.forEach(coord => {
                            allBounds.push(coord);
                        });
                    }
                });
                
                if (allBounds.length > 0) {
                    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
                    allBounds.forEach(coord => {
                        const [lng, lat] = coord;
                        minLng = Math.min(minLng, lng);
                        minLat = Math.min(minLat, lat);
                        maxLng = Math.max(maxLng, lng);
                        maxLat = Math.max(maxLat, lat);
                    });
                    
                    const bounds = new maplibregl.LngLatBounds(
                        [minLng, minLat],
                        [maxLng, maxLat]
                    );
                    
                    map.fitBounds(bounds, {
                        padding: { top: 100, bottom: 100, left: 100, right: 100 },
                        duration: 1500, // Animate the zoom
                        maxZoom: 14
                    });
                }
            }
        }, 0); // A 0ms timeout is all that's needed.
        
        // DEBUG: Toggle routes off after 2 seconds to verify they were visible
        setTimeout(() => {
            console.log('DEBUG: Toggling routes off after 2 seconds');
            const routeIds = Array.from(selectedRoutes);
            routeIds.forEach(routeId => {
                selectedRoutes.delete(routeId);
            });
            updateMap();
            updateUI();
            console.log('DEBUG: Routes toggled off. Check if they were visible before this.');
            
            // DEBUG: Toggle routes back on after another 2 seconds (4 seconds total)
            setTimeout(() => {
                console.log('DEBUG: Toggling routes back ON after 4 seconds total');
                // Get all route IDs from the routes array
                routes.forEach(route => {
                    selectedRoutes.add(route.id);
                });
                updateMap();
                updateUI();
                console.log('DEBUG: Routes toggled back on.');
            }, 1000);
        }, 1000);
        
    } catch (error) {
        console.error('Error in loadDefaultGPX:', error);
    } finally {
        // 5. Reset the flag immediately (don't wait for the timeout)
        isLoadingDefaultRoute = false;
    }
}

// Event Delegation for Route Selector
// Use document-level delegation to handle dynamically created elements
document.addEventListener('click', function(e) {
    const item = e.target.closest('.route-selector-item');
    if (item) {
        const routeId = item.getAttribute('data-route-id');
        if (routeId) {
            // Decode HTML entities back to original route ID
            const decodedRouteId = routeId.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            toggleRouteSelection(decodedRouteId);
        }
    }
});

// Load UNESCO Sites from Parquet File
async function loadUnescoSites() {
    if (unescoSitesLoaded || window.unescoSitesLoaded || !map) return;
    
    // Wait for parquet-wasm to be available
    if (typeof window.parquetWasm === 'undefined' || !window.parquetWasm.readParquet) {
        // Retry after a short delay
        setTimeout(() => loadUnescoSites(), 100);
        return;
    }
    
    try {
        // Fetch the parquet file
        const response = await fetch('data/unesco_sites.parquet');
        if (!response.ok) {
            console.warn('UNESCO sites parquet file not found');
            return;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Read parquet file using parquet-wasm
        const parquetFile = await window.parquetWasm.readParquet(arrayBuffer);
        
        // Get column names - parquet-wasm returns an array directly
        let columns;
        try {
            columns = parquetFile.columnNames();
        } catch (e) {
            // Alternative API: try getting schema first
            const schema = parquetFile.schema();
            columns = schema.fields.map(f => f.name);
        }
        
        // Find longitude and latitude columns
        let lonCol = columns.find(col => {
            const lower = col.toLowerCase();
            return lower.includes('lon') || lower.includes('lng') || lower.includes('longitude') || lower === 'x';
        });
        let latCol = columns.find(col => {
            const lower = col.toLowerCase();
            return lower.includes('lat') || lower.includes('latitude') || lower === 'y';
        });
        
        if (!lonCol || !latCol) {
            // Try common variations
            lonCol = columns.find(col => {
                const lower = col.toLowerCase();
                return ['longitude', 'lng', 'lon', 'x', 'long'].includes(lower);
            }) || columns[0];
            latCol = columns.find(col => {
                const lower = col.toLowerCase();
                return ['latitude', 'lat', 'y'].includes(lower);
            }) || columns[1];
        }
        
        if (!lonCol || !latCol) {
            console.error('Could not find longitude/latitude columns. Available columns:', columns);
            return;
        }
        
        // Get the data for longitude and latitude columns
        // Try different API methods
        let lonData, latData;
        try {
            lonData = parquetFile.getColumn(lonCol);
            latData = parquetFile.getColumn(latCol);
        } catch (e) {
            // Alternative: try toArray() or toJSON()
            try {
                const data = parquetFile.toArray ? parquetFile.toArray() : parquetFile.toJSON();
                lonData = data.map(row => row[lonCol]);
                latData = data.map(row => row[latCol]);
            } catch (e2) {
                console.error('Error reading parquet columns:', e2);
                return;
            }
        }
        
        const points = [];
        const length = Math.min(
            lonData.length !== undefined ? lonData.length : lonData.size,
            latData.length !== undefined ? latData.length : latData.size
        );
        
        for (let i = 0; i < length; i++) {
            const lon = lonData.get ? lonData.get(i) : lonData[i];
            const lat = latData.get ? latData.get(i) : latData[i];
            
            // Validate coordinates
            if (typeof lon === 'number' && typeof lat === 'number' && 
                !isNaN(lon) && !isNaN(lat) &&
                lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
                points.push([lon, lat]);
            }
        }
        
        if (points.length === 0) {
            console.warn('No valid points found in UNESCO sites parquet file');
            return;
        }
        
        // Wait for map to be ready
        if (!map.loaded() || !map.isStyleLoaded()) {
            map.once('style.load', () => addUnescoSitesToMap(points));
        } else {
            addUnescoSitesToMap(points);
        }
        
        unescoSitesLoaded = window.unescoSitesLoaded = true;
        console.log(`Loaded ${points.length} UNESCO sites`);
        
    } catch (error) {
        console.error('Error loading UNESCO sites:', error);
    }
}

// Make loadUnescoSites available globally for the module script
window.loadUnescoSites = loadUnescoSites;
window.map = null; // Will be set when map initializes
window.unescoSitesLoaded = false; // Track loading state globally

// Add UNESCO Sites Points to Map
function addUnescoSitesToMap(points) {
    if (!map || !map.loaded() || !map.isStyleLoaded()) {
        map.once('style.load', () => addUnescoSitesToMap(points));
        return;
    }
    
    // Remove existing UNESCO sites layer if it exists
    if (map.getLayer('unesco-sites-layer')) {
        map.removeLayer('unesco-sites-layer');
    }
    if (map.getSource('unesco-sites')) {
        map.removeSource('unesco-sites');
    }
    
    // Create GeoJSON FeatureCollection from points
    const geojson = {
        type: 'FeatureCollection',
        features: points.map((point, index) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: point
            },
            properties: {
                id: index
            }
        }))
    };
    
    // Add source
    map.addSource('unesco-sites', {
        type: 'geojson',
        data: geojson
    });
    
    // Add circle layer for points
    map.addLayer({
        id: 'unesco-sites-layer',
        type: 'circle',
        source: 'unesco-sites',
        paint: {
            'circle-radius': 5,
            'circle-color': '#ef4444',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.8
        }
    });
    
    // Fit map to show all points if no routes are loaded
    if (routes.length === 0 && points.length > 0) {
        const bounds = points.reduce((bounds, point) => {
            return bounds.extend(point);
        }, new maplibregl.LngLatBounds(points[0], points[0]));
        
        map.fitBounds(bounds, {
            padding: { top: 100, bottom: 100, left: 100, right: 100 },
            duration: 2000,
            maxZoom: 14
        });
    }
}

// Load WHC001 CSV File
async function loadWhc001CSV() {
    console.log('loadWhc001CSV called');
    if (!map) {
        console.error('Map not initialized when loadWhc001CSV called');
        return;
    }
    
    try {
        console.log('Fetching WHC001 CSV file...');
        // Fetch the CSV file
        const response = await fetch('data/whc001.csv');
        if (!response.ok) {
            console.warn('WHC001 CSV file not found:', response.status, response.statusText);
            return;
        }
        
        const csvText = await response.text();
        console.log('CSV file fetched, length:', csvText.length);
        
        // Parse CSV
        const lines = csvText.split('\n');
        if (lines.length < 2) {
            console.warn('CSV file is empty or has no data rows');
            return;
        }
        
        // Get header row to find the Coordinates column index
        // Parse header with CSV parser to handle quoted fields
        const headerValues = parseCSVLine(lines[0]);
        const coordIndex = headerValues.findIndex(h => h.trim() === 'Coordinates');
        
        console.log('Coordinates column index:', coordIndex, 'Total columns:', headerValues.length);
        
        if (coordIndex === -1) {
            console.error('Could not find Coordinates column in CSV. Available columns:', headerValues.slice(0, 10));
            return;
        }
        
        const points = [];
        const sitesData = [];
        
        // Find column indices for all needed fields
        const nameIndex = headerValues.findIndex(h => h.trim() === 'Name EN');
        const descIndex = headerValues.findIndex(h => h.trim() === 'Short Description EN');
        const dateIndex = headerValues.findIndex(h => h.trim() === 'Date inscribed');
        const dangerIndex = headerValues.findIndex(h => h.trim() === 'Danger');
        const categoryIndex = headerValues.findIndex(h => h.trim() === 'Category');
        const imageIndex = headerValues.findIndex(h => h.trim() === 'Main Image');
        
        // Parse each data row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Parse CSV line (handling quoted fields)
            const values = parseCSVLine(line);
            
            if (values.length > coordIndex) {
                const coordStr = values[coordIndex].trim();
                
                // Parse coordinates - format appears to be "lat, lon"
                if (coordStr && coordStr !== '') {
                    const coords = coordStr.split(',').map(c => parseFloat(c.trim()));
                    
                    if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                        const lat = coords[0];
                        const lon = coords[1];
                        
                        // Validate coordinates
                        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                            // Convert to [lng, lat] format for map
                            points.push([lon, lat]);
                            
                            // Extract all site data
                            const siteData = {
                                coordinates: [lon, lat],
                                name: (nameIndex !== -1 && values.length > nameIndex) ? values[nameIndex].trim() : `Site ${i}`,
                                shortDescription: (descIndex !== -1 && values.length > descIndex) ? values[descIndex].trim() : '',
                                dateInscribed: (dateIndex !== -1 && values.length > dateIndex) ? values[dateIndex].trim() : '',
                                danger: (dangerIndex !== -1 && values.length > dangerIndex) ? values[dangerIndex].trim().toLowerCase() === 'true' : false,
                                category: (categoryIndex !== -1 && values.length > categoryIndex) ? values[categoryIndex].trim() : '',
                                mainImage: (imageIndex !== -1 && values.length > imageIndex) ? values[imageIndex].trim() : ''
                            };
                            
                            sitesData.push(siteData);
                        }
                    }
                }
            }
        }
        
        console.log(`Parsed ${points.length} points from WHC001 CSV`);
        
        if (points.length === 0) {
            console.warn('No valid points found in WHC001 CSV file');
            return;
        }
        
        // Store sites data globally
        unescoSitesData = sitesData;
        
        // Update analytics
        initializeSearch();
        
        // Wait for map to be ready - check immediately and use retry mechanism
        const tryAddPoints = () => {
            if (map && map.loaded() && map.isStyleLoaded()) {
                console.log('Map is ready, adding points immediately...');
                addWhc001PointsToMap(sitesData);
            } else {
                console.log('Map not ready yet, will retry...');
                // Retry after a short delay
                setTimeout(tryAddPoints, 200);
            }
        };
        
        // Start trying to add points
        tryAddPoints();
        
    } catch (error) {
        console.error('Error loading WHC001 CSV:', error);
    }
}

// Make loadWhc001CSV available globally (after function definition)
window.loadWhc001CSV = loadWhc001CSV;

// Helper function to parse CSV line handling quoted fields
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Field separator
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add last field
    values.push(current);
    
    return values;
}

// Add WHC001 Points to Map
function addWhc001PointsToMap(sitesData) {
    console.log('addWhc001PointsToMap called with', sitesData.length, 'sites');
    
    if (!map) {
        console.error('Map not available in addWhc001PointsToMap');
        return;
    }
    
    // Check if map is ready - if not, wait a bit and retry
    if (!map.loaded()) {
        console.log('Map not loaded yet, waiting...');
        setTimeout(() => addWhc001PointsToMap(sitesData), 100);
        return;
    }
    
    // Check if style is loaded - if not, wait for it or retry
    if (!map.isStyleLoaded()) {
        console.log('Map style not loaded yet, waiting...');
        // Try waiting for style.load event, but also set a timeout fallback
        const styleHandler = () => {
            console.log('Style loaded event fired, adding points...');
            addWhc001PointsToMap(sitesData);
        };
        map.once('style.load', styleHandler);
        // Fallback: if style doesn't load in 2 seconds, try anyway
        setTimeout(() => {
            if (map.isStyleLoaded()) {
                map.off('style.load', styleHandler);
                addWhc001PointsToMap(sitesData);
            }
        }, 2000);
        return;
    }
    
    console.log('Map is ready, adding layer...');
    
    // Remove existing WHC001 layer if it exists
    if (map.getLayer('whc001-layer')) {
        map.removeLayer('whc001-layer');
    }
    if (map.getSource('whc001')) {
        map.removeSource('whc001');
    }
    
    // Create GeoJSON FeatureCollection from sites data
    const geojson = {
        type: 'FeatureCollection',
        features: sitesData.map((site, index) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: site.coordinates
            },
            properties: {
                id: index,
                name: site.name,
                shortDescription: site.shortDescription,
                dateInscribed: site.dateInscribed,
                danger: site.danger,
                category: site.category,
                mainImage: site.mainImage
            }
        }))
    };
    
    console.log('Created GeoJSON with', geojson.features.length, 'features');
    console.log('First point:', geojson.features[0]);
    
    try {
        // Add source
        map.addSource('whc001', {
            type: 'geojson',
            data: geojson
        });
        console.log('Source added successfully');
        
        // Add circle layer for points with dynamic colors based on danger
        map.addLayer({
            id: 'whc001-layer',
            type: 'circle',
            source: 'whc001',
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0, 3,
                    2, 5,
                    4, 8
                ],
                'circle-color': [
                    'case',
                    ['get', 'danger'],
                    '#ef4444', // Red for danger=true
                    '#3b82f6'  // Blue for danger=false
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 1.0
            }
        });
        console.log('Layer added successfully');
        console.log('Map should now show', geojson.features.length, 'points');
        
        // Verify layer was added
        if (map.getLayer('whc001-layer')) {
            console.log('✓ Layer whc001-layer exists on map');
        } else {
            console.error('✗ Layer whc001-layer NOT found on map!');
        }
        
        // Verify source was added
        if (map.getSource('whc001')) {
            console.log('✓ Source whc001 exists on map');
            const source = map.getSource('whc001');
            console.log('Source data features:', source._data ? source._data.features.length : 'unknown');
        } else {
            console.error('✗ Source whc001 NOT found on map!');
        }
        
        // Force map to repaint
        map.triggerRepaint();
        
        // Verify map canvas exists and is visible
        const mapCanvas = map.getCanvasContainer();
        if (mapCanvas) {
            console.log('✓ Map canvas container found');
            console.log('Canvas dimensions:', mapCanvas.offsetWidth, 'x', mapCanvas.offsetHeight);
        } else {
            console.error('✗ Map canvas container NOT found!');
        }
        
        // Add click handler for points
        map.on('click', 'whc001-layer', (e) => {
            const feature = e.features[0];
            if (feature) {
                // Get coordinates from the feature
                const coordinates = feature.geometry.coordinates;
                
                // Zoom to the point
                map.flyTo({
                    center: coordinates,
                    zoom: 12,
                    duration: 1500,
                    essential: true
                });
                
                const siteData = {
                    name: feature.properties.name,
                    shortDescription: feature.properties.shortDescription,
                    dateInscribed: feature.properties.dateInscribed,
                    danger: feature.properties.danger,
                    category: feature.properties.category,
                    mainImage: feature.properties.mainImage
                };
                displaySiteDetails(siteData);
            }
        });
        
        // Change cursor on hover
        map.on('mouseenter', 'whc001-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', 'whc001-layer', () => {
            map.getCanvas().style.cursor = '';
        });
        
        // Fit map to show all points with world view
        if (sitesData.length > 0) {
            const bounds = sitesData.reduce((bounds, site) => {
                return bounds.extend(site.coordinates);
            }, new maplibregl.LngLatBounds(sitesData[0].coordinates, sitesData[0].coordinates));
            
            // Fit bounds but keep zoomed out to show whole world
            map.fitBounds(bounds, {
                padding: { top: 50, bottom: 50, left: 50, right: 50 },
                duration: 2000,
                maxZoom: 1.5 // Keep zoomed out to show whole world
            });
            console.log('Map bounds fitted');
            
            // Force another resize and repaint after fitting bounds
            setTimeout(() => {
                if (map) {
                    map.resize();
                    map.triggerRepaint();
                    console.log('Map resized and repainted after fitBounds');
                }
            }, 500);
        }
    } catch (error) {
        console.error('Error adding points to map:', error);
    }
}

// Update Analytics
// Search and Filter functionality
let currentCategoryFilter = 'all';
let currentDangerFilter = 'all';
let currentSearchQuery = '';

function initializeSearch() {
    // Set up search input
    const searchInput = document.getElementById('site-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.toLowerCase().trim();
            filterAndDisplayResults();
        });
    }
    
    // Set up category filter buttons
    document.querySelectorAll('[data-category]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategoryFilter = btn.dataset.category;
            filterAndDisplayResults();
        });
    });
    
    // Set up danger filter buttons
    document.querySelectorAll('[data-danger]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-danger]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDangerFilter = btn.dataset.danger;
            filterAndDisplayResults();
        });
    });
    
    // Initial filter
    filterAndDisplayResults();
}

function filterAndDisplayResults() {
    if (unescoSitesData.length === 0) return;
    
    let filtered = unescoSitesData.filter(site => {
        // Category filter
        if (currentCategoryFilter !== 'all') {
            const siteCategory = (site.category || '').toLowerCase();
            if (siteCategory !== currentCategoryFilter) {
                return false;
            }
        }
        
        // Danger filter
        if (currentDangerFilter !== 'all') {
            const siteDanger = site.danger === true || site.danger === 'true' || site.danger === 'True';
            const filterDanger = currentDangerFilter === 'true';
            if (siteDanger !== filterDanger) {
                return false;
            }
        }
        
        // Search query filter
        if (currentSearchQuery) {
            const siteName = (site.name || '').toLowerCase();
            if (!siteName.includes(currentSearchQuery)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Update map visibility
    updateMapVisibility(filtered);
    
    // Display results
    displaySearchResults(filtered);
}

function updateMapVisibility(filteredSites) {
    if (!map || !map.loaded() || !map.getLayer('whc001-layer')) return;
    
    // Create a set of filtered site names for quick lookup
    const filteredNames = new Set(filteredSites.map(site => site.name));
    
    // Update layer filter to show only filtered sites
    // Use 'in' expression to check if name is in the filtered names array
    if (filteredNames.size === 0) {
        // Hide all points if no results
        map.setFilter('whc001-layer', ['==', ['get', 'name'], '']);
    } else {
        map.setFilter('whc001-layer', [
            'in',
            ['get', 'name'],
            ['literal', Array.from(filteredNames)]
        ]);
    }
}

function displaySearchResults(filtered) {
    const resultsList = document.getElementById('results-list');
    const resultsCount = document.getElementById('results-count');
    
    if (!resultsList || !resultsCount) return;
    
    // Update count
    resultsCount.textContent = `${filtered.length} site${filtered.length !== 1 ? 's' : ''} found`;
    
    // Clear previous results
    resultsList.innerHTML = '';
    
    if (filtered.length === 0) {
        resultsList.innerHTML = '<div class="no-results">No sites match your search criteria</div>';
        return;
    }
    
    // Display results
    filtered.forEach(site => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.addEventListener('click', () => {
            // Zoom to site and show details
            if (site.coordinates && site.coordinates.length === 2 && map) {
                map.flyTo({
                    center: site.coordinates,
                    zoom: 12,
                    duration: 1500
                });
            }
            displaySiteDetails(site);
            // Switch to Information tab
            document.querySelectorAll('.tab-trigger').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector('[data-tab="information"]')?.classList.add('active');
            document.getElementById('information-tab')?.classList.add('active');
        });
        
        const dangerBadge = site.danger === true || site.danger === 'true' || site.danger === 'True' 
            ? '<span class="danger-badge danger-true">In Danger</span>' 
            : '<span class="danger-badge danger-false">Safe</span>';
        
        resultItem.innerHTML = `
            <div class="result-item-header">
                <h4 class="result-item-name">${site.name || 'Unknown Site'}</h4>
                ${dangerBadge}
            </div>
            <div class="result-item-info">
                <span class="result-item-category">${site.category || 'Unknown'}</span>
                ${site.dateInscribed ? `<span class="result-item-date">${site.dateInscribed}</span>` : ''}
            </div>
        `;
        
        resultsList.appendChild(resultItem);
    });
}

// Display Site Details in Sidebar
function displaySiteDetails(siteData) {
    console.log('Displaying site details:', siteData);
    
    // Hide empty state, show site details
    const emptyState = document.getElementById('empty-site-state');
    const siteDetails = document.getElementById('site-details');
    
    if (emptyState) emptyState.style.display = 'none';
    if (siteDetails) siteDetails.style.display = 'block';
    
    // Populate site name
    const siteNameEl = document.getElementById('site-name');
    if (siteNameEl) {
        siteNameEl.textContent = siteData.name || 'Unknown Site';
    }
    
    // Populate main image
    const siteImageEl = document.getElementById('site-image');
    if (siteImageEl) {
        if (siteData.mainImage && siteData.mainImage.trim() !== '') {
            siteImageEl.src = siteData.mainImage;
            siteImageEl.alt = siteData.name || 'Site image';
            siteImageEl.style.display = 'block';
        } else {
            siteImageEl.style.display = 'none';
        }
    }
    
    // Populate date inscribed
    const dateInscribedEl = document.getElementById('site-date-inscribed');
    if (dateInscribedEl) {
        dateInscribedEl.textContent = siteData.dateInscribed || 'Not available';
    }
    
    // Populate danger status with colored badge
    const dangerEl = document.getElementById('danger-badge');
    if (dangerEl) {
        const isDanger = siteData.danger === true || siteData.danger === 'true' || siteData.danger === 'True';
        dangerEl.textContent = isDanger ? 'In Danger' : 'Safe';
        dangerEl.className = 'danger-badge ' + (isDanger ? 'danger-true' : 'danger-false');
    }
    
    // Populate category
    const categoryEl = document.getElementById('site-category');
    if (categoryEl) {
        categoryEl.textContent = siteData.category || 'Not available';
    }
    
    // Populate short description
    const descriptionEl = document.getElementById('site-description-text');
    if (descriptionEl) {
        descriptionEl.textContent = siteData.shortDescription || 'No description available.';
    }
    
    // Scroll to top of sidebar
    const sidebarContent = document.querySelector('.sidebar-content');
    if (sidebarContent) {
        sidebarContent.scrollTop = 0;
    }
}

// Initialize App
initMap();

