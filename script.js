// App State
let map = null;
let unescoSitesLoaded = false; // Track if UNESCO sites are loaded
window.unescoSitesLoaded = false; // Also track globally
const routeColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
let unescoSitesData = []; // Store complete site data objects

// Climate data globals
let climateData = null;
let climateBoundaries = null;

// Initialize Map with Maplibre GL JS
function initMap() {
    console.log('initMap called');

    // Check if map container exists
    const mapContainer = document.getElementById('map-view');
    if (!mapContainer) {
        console.error('Map container #map-view not found!');
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
        container: 'map-view',
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
    map.on('load', function () {
        console.log('[DEBUG] Map load event fired');
        console.log('[DEBUG] Map loaded:', map.loaded());
        console.log('[DEBUG] Map style loaded:', map.isStyleLoaded());
        // Ensure placeholder is hidden
        if (mapPlaceholder) {
            mapPlaceholder.classList.add('hidden');
        }

        // Ensure map is visible
        ensureMapVisible();

        // Force another resize after load
        setTimeout(() => {
            if (map) {
                map.resize();
                console.log('Map resized after load');
                ensureMapVisible();
            }
        }, 100);

        if (!map.isStyleLoaded()) {
            // If style isn't loaded yet, wait for it
            console.log('Style not loaded, waiting for style.load...');
            map.once('style.load', function () {
                console.log('Style loaded, calling data loading functions...');
                // Ensure placeholder is hidden
                if (mapPlaceholder) {
                    mapPlaceholder.classList.add('hidden');
                }
                try {
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
                loadUnescoSites();
                console.log('About to call loadWhc001CSV...');
                console.log('loadWhc001CSV function exists?', typeof loadWhc001CSV);
                if (typeof loadWhc001CSV === 'function') {
                    loadWhc001CSV();
                } else {
                    console.error('loadWhc001CSV is not a function!', typeof loadWhc001CSV);
                }

                // Load Climate Data and Boundaries
                loadClimateData();
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

    // Ensure choropleth layer remains visible if climate control is expanded
    const climateControl = document.getElementById('climate-control');
    if (climateControl && climateControl.classList.contains('expanded')) {
        // Check if choropleth layer exists and should be visible
        if (map.getLayer('climate-choropleth')) {
            const currentVisibility = map.getLayoutProperty('climate-choropleth', 'visibility');
            // If it was visible before, ensure it stays visible
            if (currentVisibility === 'visible') {
                // Ensure proper layer ordering: choropleth should be above satellite tiles but below points
                const choroplethLayer = map.getLayer('climate-choropleth');
                const pointsLayer = map.getLayer('whc001-layer');
                if (choroplethLayer && pointsLayer) {
                    // Move choropleth to be just before points layer (above satellite tiles)
                    try {
                        map.moveLayer('climate-choropleth', 'whc001-layer');
                        console.log('[DEBUG] Moved choropleth layer to correct position for', layerType, 'view');
                    } catch (e) {
                        console.warn('[DEBUG] Could not move choropleth layer:', e);
                    }
                }
                // Ensure visibility is maintained
                map.setLayoutProperty('climate-choropleth', 'visibility', 'visible');
                console.log('[DEBUG] Maintained choropleth visibility in', layerType, 'view');
            }
        } else {
            // If choropleth doesn't exist yet but should be visible, create it
            if (climateBoundaries) {
                console.log('[DEBUG] Creating choropleth layer for', layerType, 'view');
                createChoroplethMap();
                if (map.getLayer('climate-choropleth')) {
                    map.setLayoutProperty('climate-choropleth', 'visibility', 'visible');
                }
            }
        }
    }

    console.log('Switched to', layerType, 'layer');
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

        // Set up edit date range button if switching to Data tab
        if (tabName === 'data') {
            // Show calendar when Data tab is active
            const compactCalendar = document.getElementById('compact-calendar');
            if (compactCalendar) {
                compactCalendar.style.display = 'block';
            }
            renderCompactCalendar();
            setupDateInputs();
            setupDataTabCalendar();
            updateDateRangeSummary();
        } else {
            // Hide calendar when switching away from Data tab (unless Sentinel is selected)
            const compactCalendar = document.getElementById('compact-calendar');
            if (compactCalendar && !selectedSentinel) {
                compactCalendar.style.display = 'none';
            }
        }
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
    selectedProduct = null; // Reset product selection

    // Expand Sentinel control if not already expanded
    const sentinelControl = document.getElementById('sentinel-control');
    const sentinelToggleBtn = document.getElementById('sentinel-toggle-btn');
    const sentinelControlsContent = document.getElementById('sentinel-controls-content');

    if (sentinelControl && !sentinelControl.classList.contains('expanded')) {
        sentinelControl.classList.add('expanded');
        if (sentinelToggleBtn) sentinelToggleBtn.classList.add('active');
        if (sentinelControlsContent) sentinelControlsContent.style.display = 'flex';
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

    // Render compact calendar
    renderCompactCalendar();
    updateDateRangeSummary();

    // If dates are already selected, show product selector
    if (selectedStartDate && selectedEndDate && selectedSentinel) {
        showProductSelector();
    }

    // Set up date inputs and calendar button
    setupDateInputs();
    setupDataTabCalendar();
}


function renderCompactCalendar() {
    const compactCalendar = document.getElementById('compact-calendar');
    if (!compactCalendar) return;

    // Show calendar if Sentinel is selected and Sentinel control is expanded
    const sentinelControl = document.getElementById('sentinel-control');
    const isSentinelExpanded = sentinelControl && sentinelControl.classList.contains('expanded');

    // Show calendar if Sentinel is selected, or if we're in Data tab
    const dataTab = document.getElementById('data-tab');
    const isDataTabActive = dataTab && dataTab.classList.contains('active');

    // Only show calendar if Sentinel is expanded or Data tab is active
    if (!isSentinelExpanded && !isDataTabActive) {
        compactCalendar.style.display = 'none';
        return;
    }

    const monthYearEl = document.getElementById('compact-calendar-month-year');
    const weekdaysEl = document.getElementById('compact-calendar-weekdays');
    const daysEl = document.getElementById('compact-calendar-days');

    if (!monthYearEl || !weekdaysEl || !daysEl) return;

    // Show calendar if Sentinel is selected and expanded, or if Data tab is active
    if ((selectedSentinel && isSentinelExpanded) || isDataTabActive) {
        compactCalendar.style.display = 'block';
    } else {
        compactCalendar.style.display = 'none';
    }

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

    // Compact calendar (right side) shows Sentinel dates
    const startDate = selectedStartDate;
    const endDate = selectedEndDate;

    // Check if date is in selected range
    const isInRange = (day) => {
        if (!startDate || !endDate) return false;
        const date = new Date(year, month, day);
        return date >= startDate && date <= endDate;
    };

    // Check if date is selected (start or end)
    const isSelected = (day) => {
        if (!startDate && !endDate) return false;
        const date = new Date(year, month, day);
        if (startDate && date.getTime() === startDate.getTime()) return true;
        if (endDate && date.getTime() === endDate.getTime()) return true;
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

            // Compact calendar (right side) - updates Sentinel dates only
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

            // Show product selector when both Sentinel dates and Sentinel are selected
            if (selectedStartDate && selectedEndDate && selectedSentinel) {
                showProductSelector();
            } else {
                hideProductSelector();
            }
        });
    });
}

// Independent date range for Data tab plots
let independentStartDate = null;
let independentEndDate = null;

function updateDateRangeSummary() {
    const startInput = document.getElementById('start-date-input');
    const endInput = document.getElementById('end-date-input');
    const mockViz = document.getElementById('mock-visualizations');

    // Always use independent dates for the Data tab (disconnected from Sentinel unless coupled)
    const startDate = independentStartDate;
    const endDate = independentEndDate;

    if (startDate && endDate) {
        const startStr = formatDateForInput(startDate);
        const endStr = formatDateForInput(endDate);

        if (startInput) startInput.value = startStr;
        if (endInput) endInput.value = endStr;

        // Show visualizations based on independent dates (for plots)
        if (mockViz) {
            mockViz.style.display = 'block';
            renderMockVisualizations();
        }
        // Product selector is controlled by Sentinel calendar dates, not Data tab dates
        // So we don't show it here
        console.log('Date range selected:', startStr, 'to', endStr, 'for plots');
    } else if (startDate) {
        const startStr = formatDateForInput(startDate);
        if (startInput) startInput.value = startStr;
        if (endInput) endInput.value = '';
        if (mockViz) mockViz.style.display = 'none';
        hideProductSelector();
    } else {
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        if (mockViz) mockViz.style.display = 'none';
        hideProductSelector();
    }

    // Set up date inputs and calendar button if in Data tab
    const dataTab = document.getElementById('data-tab');
    if (dataTab && dataTab.classList.contains('active')) {
        setupDateInputs();
        setupDataTabCalendar();
    }
}

function formatDateForInput(date) {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function parseDateInput(dateStr) {
    if (!dateStr || !dateStr.trim()) return null;
    // Parse dd/mm/yyyy format
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    const date = new Date(year, month, day);
    // Validate date
    if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
        return null;
    }
    return date;
}

function setupDateInputs() {
    const startInput = document.getElementById('start-date-input');
    const endInput = document.getElementById('end-date-input');

    if (startInput) {
        // Remove existing listeners
        const newStartInput = startInput.cloneNode(true);
        startInput.parentNode.replaceChild(newStartInput, startInput);

        newStartInput.addEventListener('blur', () => {
            const date = parseDateInput(newStartInput.value);
            if (date) {
                independentStartDate = date;
                updateDateRangeSummary();
            } else if (newStartInput.value.trim() === '') {
                independentStartDate = null;
                updateDateRangeSummary();
            }
        });
    }

    if (endInput) {
        // Remove existing listeners
        const newEndInput = endInput.cloneNode(true);
        endInput.parentNode.replaceChild(newEndInput, endInput);

        newEndInput.addEventListener('blur', () => {
            const date = parseDateInput(newEndInput.value);
            if (date) {
                independentEndDate = date;
                updateDateRangeSummary();
            } else if (newEndInput.value.trim() === '') {
                independentEndDate = null;
                updateDateRangeSummary();
            }
        });
    }
}

function setupDataTabCalendar() {
    console.log('=== setupDataTabCalendar called ===');
    const dataCalendarBtn = document.getElementById('data-range-calendar-btn');

    console.log('Button element:', dataCalendarBtn);

    if (!dataCalendarBtn) {
        console.error('ERROR: data-range-calendar-btn not found in DOM!');
        return;
    }

    // Remove ALL existing event listeners by cloning
    const newBtn = dataCalendarBtn.cloneNode(true);
    dataCalendarBtn.parentNode.replaceChild(newBtn, dataCalendarBtn);

    // Add click listener
    newBtn.addEventListener('click', function (e) {
        console.log('=== CALENDAR BUTTON CLICKED ===');
        e.stopPropagation();
        e.preventDefault();
        toggleDataTabCalendar();
    });

    console.log('Event listener attached successfully to button');
}

// Data tab calendar state
let currentDataCalendarDate = new Date();

function toggleDataTabCalendar() {
    const calendar = document.getElementById('data-tab-calendar');
    console.log('toggleDataTabCalendar called, calendar element found:', !!calendar);

    if (!calendar) {
        console.error('Data tab calendar element not found! Check if element with id "data-tab-calendar" exists in HTML');
        return;
    }

    const currentDisplay = calendar.style.display || window.getComputedStyle(calendar).display;
    const isVisible = currentDisplay === 'block' || currentDisplay === 'flex';

    console.log('Calendar current display:', currentDisplay, 'isVisible:', isVisible);

    if (!isVisible) {
        // Show calendar
        if (independentStartDate) {
            currentDataCalendarDate = new Date(independentStartDate);
        } else if (independentEndDate) {
            currentDataCalendarDate = new Date(independentEndDate);
        } else {
            currentDataCalendarDate = new Date();
        }

        // Position calendar next to the button (to the right) - use fixed positioning to overlap map
        const button = document.getElementById('data-range-calendar-btn');
        if (button) {
            const buttonRect = button.getBoundingClientRect();

            // Use fixed positioning relative to viewport so it can overlap the map
            const leftOffset = buttonRect.right + 8; // 8px spacing from button
            const topOffset = buttonRect.top; // Align top with button

            // Set position relative to viewport
            calendar.style.left = `${leftOffset}px`;
            calendar.style.top = `${topOffset}px`;
            calendar.style.transform = 'none';
        }

        // Set display and ensure it's visible - use fixed positioning to overlap map
        calendar.style.display = 'block';
        calendar.style.visibility = 'visible';
        calendar.style.opacity = '1';
        calendar.style.position = 'fixed'; // Fixed to viewport, not sidebar
        calendar.style.zIndex = '2000'; // High z-index to appear above map

        // Force a reflow to ensure display is applied
        calendar.offsetHeight;

        console.log('About to render calendar...');

        // Render the calendar
        renderDataTabCalendar();

        console.log('Calendar shown, display:', calendar.style.display);
    } else {
        // Hide calendar
        calendar.style.display = 'none';
        console.log('Calendar hidden');
    }
}

function renderDataTabCalendar() {
    const calendar = document.getElementById('data-tab-calendar');
    const monthYearEl = document.getElementById('data-calendar-month-year');
    const weekdaysEl = document.getElementById('data-calendar-weekdays');
    const daysEl = document.getElementById('data-calendar-days');

    console.log('renderDataTabCalendar called');
    console.log('Elements found - monthYear:', !!monthYearEl, 'weekdays:', !!weekdaysEl, 'days:', !!daysEl);

    // Preserve calendar visibility when re-rendering
    const wasVisible = calendar && (calendar.style.display === 'block' || window.getComputedStyle(calendar).display === 'block');

    if (!monthYearEl || !weekdaysEl || !daysEl) {
        console.error('Calendar elements not found!');
        console.error('Missing: ', {
            monthYear: !monthYearEl ? 'data-calendar-month-year' : 'ok',
            weekdays: !weekdaysEl ? 'data-calendar-weekdays' : 'ok',
            days: !daysEl ? 'data-calendar-days' : 'ok'
        });
        return;
    }

    const year = currentDataCalendarDate.getFullYear();
    const month = currentDataCalendarDate.getMonth();

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

    // Show independent dates (for plots)
    const startDate = independentStartDate;
    const endDate = independentEndDate;

    // Check if date is in selected range
    const isInRange = (day) => {
        if (!startDate || !endDate) return false;
        const date = new Date(year, month, day);
        return date >= startDate && date <= endDate;
    };

    // Check if date is selected (start or end)
    const isSelected = (day) => {
        if (!startDate && !endDate) return false;
        const date = new Date(year, month, day);
        if (startDate && date.getTime() === startDate.getTime()) return true;
        if (endDate && date.getTime() === endDate.getTime()) return true;
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
    const remainingCells = 42 - totalCells;
    for (let day = 1; day <= remainingCells; day++) {
        daysHtml += `<div class="compact-calendar-day other-month">${day}</div>`;
    }

    daysEl.innerHTML = daysHtml;

    console.log('Calendar rendered with', daysInMonth, 'days');

    // Restore calendar visibility if it was visible before re-render
    if (wasVisible && calendar) {
        calendar.style.display = 'block';
        calendar.style.visibility = 'visible';
        calendar.style.opacity = '1';
    }

    // Add navigation event listeners
    const prevBtn = document.getElementById('data-calendar-prev');
    const nextBtn = document.getElementById('data-calendar-next');

    if (prevBtn) {
        prevBtn.onclick = () => {
            currentDataCalendarDate.setMonth(month - 1);
            renderDataTabCalendar();
        };
    }

    if (nextBtn) {
        nextBtn.onclick = () => {
            currentDataCalendarDate.setMonth(month + 1);
            renderDataTabCalendar();
        };
    }

    // Day click handlers for range selection
    daysEl.querySelectorAll('.compact-calendar-day:not(.other-month)').forEach(dayEl => {
        dayEl.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            const day = parseInt(dayEl.dataset.day);
            const selectedMonth = parseInt(dayEl.dataset.month);
            const selectedYear = parseInt(dayEl.dataset.year);
            const clickedDate = new Date(selectedYear, selectedMonth, day);
            
            // Normalize time to midnight for accurate comparison
            clickedDate.setHours(0, 0, 0, 0);

            // Update independent dates (for plots)
            // If no dates selected, set as start
            if (!independentStartDate && !independentEndDate) {
                independentStartDate = clickedDate;
                console.log('Start date set:', clickedDate);
            }
            // If only start date selected
            else if (independentStartDate && !independentEndDate) {
                // Normalize start date for comparison
                const startDate = new Date(independentStartDate);
                startDate.setHours(0, 0, 0, 0);
                
                if (clickedDate.getTime() === startDate.getTime()) {
                    // Clicked same date as start, do nothing (allow user to change their mind)
                    console.log('Same date clicked, keeping start date');
                } else if (clickedDate < startDate) {
                    // Clicked date is before start, swap them
                    independentEndDate = new Date(independentStartDate);
                    independentStartDate = clickedDate;
                    console.log('End date set (swapped):', clickedDate);
                } else {
                    independentEndDate = clickedDate;
                    console.log('End date set:', clickedDate);
                }
            }
            // If both dates selected, start new selection
            else {
                independentStartDate = clickedDate;
                independentEndDate = null;
                console.log('Restarting selection, start date set:', clickedDate);
            }

            updateDateRangeSummary();
            renderDataTabCalendar(); // Re-render to show updated selection

            // Close calendar after selecting both dates (with a small delay to show the selection)
            if (independentStartDate && independentEndDate) {
                setTimeout(() => {
                    const calendarEl = document.getElementById('data-tab-calendar');
                    if (calendarEl) {
                        calendarEl.style.display = 'none';
                        console.log('Calendar closed after range selection');
                    }
                }, 500); // Slightly longer delay to see the selection
            }
        });
    });
}

// Close data tab calendar when clicking outside
document.addEventListener('click', (e) => {
    const calendar = document.getElementById('data-tab-calendar');
    const calendarBtn = document.getElementById('data-range-calendar-btn');

    if (calendar && calendar.style.display === 'block') {
        // Don't close if clicking inside calendar or on the button
        if (!calendar.contains(e.target) && 
            e.target !== calendarBtn && 
            !calendarBtn?.contains(e.target)) {
            calendar.style.display = 'none';
            console.log('Calendar closed - clicked outside');
        }
    }
});

// Small calendar popup functionality
let currentSmallCalendarDate = new Date();
let smallCalendarMode = 'range'; // 'range' for date range selection

function showSmallCalendar(mode, button) {
    smallCalendarMode = mode;
    const popup = document.getElementById('small-calendar-popup');
    if (!popup) return;

    // Always use independent dates for the calendar button (allows two different ranges)
    // When coupled, changes will sync; when uncoupled, they remain independent
    if (independentStartDate) {
        currentSmallCalendarDate = new Date(independentStartDate);
    } else if (independentEndDate) {
        currentSmallCalendarDate = new Date(independentEndDate);
    } else {
        currentSmallCalendarDate = new Date();
    }

    popup.style.display = 'block';
    renderSmallCalendar();
}

function hideSmallCalendar() {
    const popup = document.getElementById('small-calendar-popup');
    if (popup) {
        popup.style.display = 'none';
    }
}

function renderSmallCalendar() {
    const monthYearEl = document.getElementById('small-calendar-month-year');
    const weekdaysEl = document.getElementById('small-calendar-weekdays');
    const daysEl = document.getElementById('small-calendar-days');

    if (!monthYearEl || !weekdaysEl || !daysEl) return;

    const year = currentSmallCalendarDate.getFullYear();
    const month = currentSmallCalendarDate.getMonth();

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
        weekdaysHtml += `<div class="small-calendar-weekday">${day}</div>`;
    });
    weekdaysEl.innerHTML = weekdaysHtml;

    // Get today's date for highlighting
    const today = new Date();
    const isToday = (day) => {
        return day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();
    };

    // Small calendar popup (Data tab) - always shows independent dates for plots
    const startDate = independentStartDate;
    const endDate = independentEndDate;

    // Check if date is in selected range
    const isInRange = (day) => {
        if (!startDate || !endDate) return false;
        const date = new Date(year, month, day);
        return date >= startDate && date <= endDate;
    };

    // Check if date is selected (start or end)
    const isSelected = (day) => {
        if (!startDate && !endDate) return false;
        const date = new Date(year, month, day);
        if (startDate && date.getTime() === startDate.getTime()) return true;
        if (endDate && date.getTime() === endDate.getTime()) return true;
        return false;
    };

    let daysHtml = '';

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        daysHtml += `<div class="small-calendar-day other-month">${day}</div>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const todayClass = isToday(day) ? 'today' : '';
        const selectedClass = isSelected(day) ? 'selected' : '';
        const inRangeClass = isInRange(day) && !selectedClass ? 'in-range' : '';
        daysHtml += `<div class="small-calendar-day ${todayClass} ${selectedClass} ${inRangeClass}" data-day="${day}" data-month="${month}" data-year="${year}">${day}</div>`;
    }

    // Next month days (fill remaining cells)
    const totalCells = firstDay + daysInMonth;
    const remainingCells = 42 - totalCells;
    for (let day = 1; day <= remainingCells; day++) {
        daysHtml += `<div class="small-calendar-day other-month">${day}</div>`;
    }

    daysEl.innerHTML = daysHtml;

    // Add navigation event listeners
    const prevBtn = document.getElementById('small-calendar-prev');
    const nextBtn = document.getElementById('small-calendar-next');

    if (prevBtn) {
        prevBtn.onclick = () => {
            currentSmallCalendarDate.setMonth(month - 1);
            renderSmallCalendar();
        };
    }

    if (nextBtn) {
        nextBtn.onclick = () => {
            currentSmallCalendarDate.setMonth(month + 1);
            renderSmallCalendar();
        };
    }

    // Day click handlers for range selection
    daysEl.querySelectorAll('.small-calendar-day:not(.other-month)').forEach(dayEl => {
        dayEl.addEventListener('click', () => {
            const day = parseInt(dayEl.dataset.day);
            const selectedMonth = parseInt(dayEl.dataset.month);
            const selectedYear = parseInt(dayEl.dataset.year);
            const clickedDate = new Date(selectedYear, selectedMonth, day);

            // Small calendar popup (Data tab) - updates independent dates for plots
            // If no dates selected, set as start
            if (!independentStartDate && !independentEndDate) {
                independentStartDate = clickedDate;
            }
            // If only start date selected
            else if (independentStartDate && !independentEndDate) {
                if (clickedDate < independentStartDate) {
                    // Clicked date is before start, swap them
                    independentEndDate = independentStartDate;
                    independentStartDate = clickedDate;
                } else {
                    independentEndDate = clickedDate;
                }
            }
            // If both dates selected, start new selection
            else {
                independentStartDate = clickedDate;
                independentEndDate = null;
            }

            updateDateRangeSummary();
            renderSmallCalendar(); // Re-render to show updated selection
        });
    });
}

// Close calendar when clicking outside
document.addEventListener('click', (e) => {
    const popup = document.getElementById('small-calendar-popup');
    const rangeBtn = document.getElementById('range-calendar-btn');

    if (popup && !popup.contains(e.target) &&
        e.target !== rangeBtn && !rangeBtn?.contains(e.target)) {
        hideSmallCalendar();
    }
});

// Product selector functionality
let selectedProduct = null;

const sentinelProducts = {
    '1': [
        { id: 'sar', name: 'SAR', description: 'Synthetic Aperture Radar' },
        { id: 'vv', name: 'VV Polarization', description: 'Vertical-Vertical' },
        { id: 'vh', name: 'VH Polarization', description: 'Vertical-Horizontal' },
        { id: 'coherence', name: 'Coherence', description: 'Interferometric coherence' }
    ],
    '2': [
        { id: 'ndvi', name: 'NDVI', description: 'Normalized Difference Vegetation Index' },
        { id: 'evi', name: 'EVI', description: 'Enhanced Vegetation Index' },
        { id: 'ndwi', name: 'NDWI', description: 'Normalized Difference Water Index' },
        { id: 'savi', name: 'SAVI', description: 'Soil-Adjusted Vegetation Index' },
        { id: 'ndbi', name: 'NDBI', description: 'Normalized Difference Built-up Index' },
        { id: 'true_color', name: 'True Color', description: 'RGB composite' }
    ],
    '3': [
        { id: 'sst', name: 'Sea Surface Temperature', description: 'SST' },
        { id: 'chl', name: 'Chlorophyll-a', description: 'Ocean color' },
        { id: 'sla', name: 'Sea Level Anomaly', description: 'SLA' },
        { id: 'sst_anomaly', name: 'SST Anomaly', description: 'Temperature anomaly' }
    ],
    '5': [
        { id: 'no2', name: 'NO₂', description: 'Nitrogen Dioxide' },
        { id: 'co', name: 'CO', description: 'Carbon Monoxide' },
        { id: 'o3', name: 'O₃', description: 'Ozone' },
        { id: 'so2', name: 'SO₂', description: 'Sulfur Dioxide' },
        { id: 'ch4', name: 'CH₄', description: 'Methane' },
        { id: 'hcho', name: 'HCHO', description: 'Formaldehyde' },
        { id: 'aerosol', name: 'Aerosol Index', description: 'AI' }
    ],
    '6': [
        { id: 'sea_level', name: 'Sea Level', description: 'Altimetry' },
        { id: 'significant_wave_height', name: 'Significant Wave Height', description: 'SWH' },
        { id: 'wind_speed', name: 'Wind Speed', description: 'Ocean surface wind' }
    ]
};

function showProductSelector() {
    if (!selectedSentinel) return;

    const modal = document.getElementById('product-selector-modal');
    const title = document.getElementById('product-selector-title');
    // Use integrated body (inside Sentinel) if available, otherwise fallback to regular body
    const body = document.getElementById('product-selector-body-integrated') || document.getElementById('product-selector-body');

    if (!modal || !title || !body) return;

    const products = sentinelProducts[selectedSentinel] || [];
    title.textContent = 'Select Product';

    // Clear previous content
    body.innerHTML = '';

    if (products.length === 0) {
        body.innerHTML = '<div class="no-products" style="padding: 0.5rem; text-align: center; color: var(--muted-foreground); font-size: 0.75rem;">No products available for this Sentinel</div>';
    } else {
        products.forEach(product => {
            const productBtn = document.createElement('button');
            productBtn.className = 'product-btn';
            productBtn.dataset.product = product.id;
            productBtn.innerHTML = `
                <div class="product-btn-content">
                    <span class="product-btn-name">${product.name}</span>
                    <span class="product-btn-desc">${product.description}</span>
                </div>
            `;
            productBtn.addEventListener('click', () => {
                selectProduct(product.id, product.name);
            });
            body.appendChild(productBtn);
        });
    }

    // Show the product selector
    modal.style.display = 'block';

    // Ensure Sentinel control is expanded to show the product selector
    const sentinelControl = document.getElementById('sentinel-control');
    const sentinelToggleBtn = document.getElementById('sentinel-toggle-btn');
    const sentinelControlsContent = document.getElementById('sentinel-controls-content');

    if (sentinelControl && !sentinelControl.classList.contains('expanded')) {
        sentinelControl.classList.add('expanded');
        if (sentinelToggleBtn) sentinelToggleBtn.classList.add('active');
        if (sentinelControlsContent) sentinelControlsContent.style.display = 'flex';
    }
}

function hideProductSelector() {
    const modal = document.getElementById('product-selector-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function selectProduct(productId, productName) {
    selectedProduct = { id: productId, name: productName };

    // Update button states
    document.querySelectorAll('.product-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.product === productId) {
            btn.classList.add('active');
        }
    });

    console.log('Product selected:', productName, 'for Sentinel', selectedSentinel);
    // Here you would typically load the actual data for this product
}

function renderMockVisualizations() {
    renderTouristHistogram();
    renderClimateLinePlot();
    initializeSubTabs();
}

// Initialize sub-tabs functionality
function initializeSubTabs() {
    const subTabTriggers = document.querySelectorAll('.sub-tab-trigger');

    subTabTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const subTabId = trigger.dataset.subtab;

            // Remove active class from all triggers and contents
            document.querySelectorAll('.sub-tab-trigger').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));

            // Add active class to clicked trigger and corresponding content
            trigger.classList.add('active');
            const subTabContent = document.getElementById(`subtab-${subTabId}`);
            if (subTabContent) {
                subTabContent.classList.add('active');
            }
        });
    });
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

    // Fit map to show all points
    if (points.length > 0) {
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
        
        // Ensure choropleth layer (if it exists) is below the points layer
        if (map.getLayer('climate-choropleth')) {
            // Move choropleth before points layer to ensure points render on top
            try {
                map.moveLayer('climate-choropleth', 'whc001-layer');
                console.log('[DEBUG] Moved climate-choropleth below whc001-layer');
            } catch (error) {
                console.warn('[DEBUG] Could not reorder choropleth layer:', error);
            }
        }

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

                // Query climate layer for temperature at this location
                let climateData = null;
                if (map.getLayer('climate-choropleth') && map.getLayoutProperty('climate-choropleth', 'visibility') === 'visible') {
                    const climateFeatures = map.queryRenderedFeatures(e.point, { layers: ['climate-choropleth'] });
                    if (climateFeatures.length > 0) {
                        const temp = climateFeatures[0].properties.temperature;
                        if (temp !== null && temp !== undefined) {
                            climateData = {
                                temperature: temp,
                                country: climateFeatures[0].properties.name
                            };
                        }
                    }
                }

                // Zoom to the point
                map.flyTo({
                    center: coordinates,
                    zoom: 12,
                    duration: 1500,
                    essential: true,
                    offset: [-140, 0] // Offset to account for 360px sidebar (shift left, adjusted ~1cm to the right)
                });

                // Switch to Information tab FIRST
                document.querySelectorAll('.tab-trigger').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                const infoTrigger = document.querySelector('[data-tab="information"]');
                const infoTab = document.getElementById('information-tab');

                if (infoTrigger) {
                    infoTrigger.classList.add('active');
                }
                if (infoTab) {
                    infoTab.classList.add('active');
                }

                const siteData = {
                    name: feature.properties.name,
                    shortDescription: feature.properties.shortDescription,
                    dateInscribed: feature.properties.dateInscribed,
                    danger: feature.properties.danger,
                    category: feature.properties.category,
                    mainImage: feature.properties.mainImage
                };

                // Then display site details
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
                    duration: 1500,
                    offset: [-140, 0] // Offset to account for 360px sidebar (shift left, adjusted ~1cm to the right)
                });
            }

            // Switch to Information tab FIRST
            document.querySelectorAll('.tab-trigger').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            const infoTrigger = document.querySelector('[data-tab="information"]');
            const infoTab = document.getElementById('information-tab');

            if (infoTrigger) {
                infoTrigger.classList.add('active');
            }
            if (infoTab) {
                infoTab.classList.add('active');
            }

            // Then display site details
            displaySiteDetails(site);
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
function displaySiteDetails(siteData, climateData = null) {
    console.log('Displaying site details:', siteData, 'Climate:', climateData);

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

    // Populate Climate Data if available
    const climateContainer = document.getElementById('site-climate-data');
    if (climateContainer) {
        if (climateData) {
            climateContainer.style.display = 'block';
            climateContainer.innerHTML = `
                <div class="climate-metric">
                    <span class="metric-label">Projected Annual Temp</span>
                    <span class="metric-value">${fahrenheitToCelsius(climateData.temperature).toFixed(1)}°C</span>
                </div>
                <div class="climate-context">
                    Based on current selection (${climateData.country || 'Region'})
                </div>
            `;
        } else {
            climateContainer.style.display = 'none';
        }
    } else if (climateData) {
        // Create container if it doesn't exist (insert after category)
        const categoryEl = document.getElementById('site-category');
        if (categoryEl && categoryEl.parentNode) {
            const container = document.createElement('div');
            container.id = 'site-climate-data';
            container.className = 'site-climate-section';
            container.style.marginTop = '1rem';
            container.style.padding = '1rem';
            container.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            container.style.borderRadius = '0.5rem';
            container.innerHTML = `
                <h4 style="margin-top:0; margin-bottom:0.5rem; font-size:0.9rem; color:var(--primary);">Climate Projection</h4>
                <div class="climate-metric" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="metric-label" style="font-size:0.85rem; color:var(--muted-foreground);">Annual Avg Temp</span>
                    <span class="metric-value" style="font-weight:600; font-size:1.1rem;">${fahrenheitToCelsius(climateData.temperature).toFixed(1)}°C</span>
                </div>
            `;
            categoryEl.parentNode.parentNode.insertBefore(container, categoryEl.parentNode.parentNode.children[2]); // Insert after header section
        }
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

// Initialize calendar button on page load if Data tab is active
document.addEventListener('DOMContentLoaded', () => {
    // Check if Data tab is active on page load
    const dataTab = document.getElementById('data-tab');
    if (dataTab && dataTab.classList.contains('active')) {
        setupDataTabCalendar();
    }

    // Also set up the button regardless (it will be re-setup when switching tabs)
    setTimeout(() => {
        setupDataTabCalendar();
    }, 100);

    // Initialize Climate Control
    initializeClimateControl();

    // Initialize Sentinel Control
    initializeSentinelControl();

    // Initialize Info Button
    initializeInfoButton();
});

// Climate Control State
// climateData and climateBoundaries are declared at top of file
let climateLayer = null;
let selectedTimePeriod = '1986-2005';
let selectedPercentile = 5;

// Initialize Climate Control Toggle
function initializeClimateControl() {
    const toggleBtn = document.getElementById('climate-toggle-btn');
    const controlsContent = document.getElementById('climate-controls-content');
    const climateControl = document.getElementById('climate-control');

    if (!toggleBtn || !controlsContent || !climateControl) return;

    toggleBtn.addEventListener('click', () => {
        const isExpanded = climateControl.classList.contains('expanded');
        console.log('[DEBUG] Climate toggle clicked, isExpanded:', isExpanded);

        if (isExpanded) {
            // Collapse controls panel
            console.log('[DEBUG] Collapsing climate control');
            climateControl.classList.remove('expanded');
            controlsContent.style.display = 'none';

            // Update sentinel position (moves up when collapsed)
            updateSentinelPosition(false);
        } else {
            // Expand controls panel
            console.log('[DEBUG] Expanding climate control');
            climateControl.classList.add('expanded');
            controlsContent.style.display = 'flex';

            // Update sentinel position (moves down when expanded)
            updateSentinelPosition(true);
        }
        
        // Color map visibility is controlled by active state, not expanded state
        // Active state is toggled separately or can be changed here if needed
        // For now, we keep active state independent - color map stays visible when active
    });

    // Setup percentile buttons
    document.querySelectorAll('.percentile-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.percentile-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPercentile = parseInt(btn.dataset.percentile);
            updateClimateVisualization();
        });
    });

    // Setup time period buttons
    document.querySelectorAll('.time-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            document.querySelectorAll('.time-period-btn').forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            // Update selected time period
            selectedTimePeriod = btn.dataset.period;
            console.log('[DEBUG] Time period changed to:', selectedTimePeriod);
            // Update visualization
            updateClimateVisualization();
        });
    });

    // Debug logging
    if (!window.debugLogs) window.debugLogs = [];
    const log = (msg) => {
        console.log(msg);
        window.debugLogs.push(msg);
    };

    // Automatically load climate data on initialization - REMOVED duplicate call
    // log('Calling loadClimateData from initMap');
    // loadClimateData();

    // If temperature button is active (toggled on), show choropleth layer
    // The choropleth visibility is set when the layer is created, but we ensure it's shown here too
    if (toggleBtn.classList.contains('active')) {
        console.log('[DEBUG] Temperature button is active by default, choropleth will be visible');
        // Try multiple times to ensure choropleth is shown after data loads
        const tryShowChoropleth = (attempt = 0) => {
            if (attempt > 10) {
                console.warn('[DEBUG] Max attempts reached, giving up on showing choropleth');
                return;
            }
            if (map && map.loaded() && climateBoundaries) {
                console.log('[DEBUG] Conditions met, showing choropleth layer (attempt', attempt + 1, ')');
                showChoroplethLayer();
            } else {
                console.log('[DEBUG] Waiting for conditions (attempt', attempt + 1, '):', {
                    map: !!map,
                    loaded: map ? map.loaded() : false,
                    boundaries: !!climateBoundaries
                });
                setTimeout(() => tryShowChoropleth(attempt + 1), 500);
            }
        };
        // Start trying after a short delay
        setTimeout(() => tryShowChoropleth(), 500);
    }

    // Initialize sentinel position based on initial climate control state
    const isExpanded = climateControl.classList.contains('expanded');
    updateSentinelPosition(isExpanded);

    // Ensure map is visible after initialization
    setTimeout(() => {
        ensureMapVisible();
    }, 500);
}

// Load Climate Data from CSV and GeoJSON
async function loadClimateData() {
    console.log('[DEBUG] ===== loadClimateData() called =====');
    console.log('[DEBUG] Timestamp:', new Date().toISOString());
    console.log('[DEBUG] Current URL:', window.location.href);
    try {
        // Load CSV data
        const csvUrl = 'data/climate_impact_data.csv';
        console.log('[DEBUG] Fetching CSV from:', csvUrl);
        const csvResponse = await fetch(csvUrl);
        if (!csvResponse.ok) {
            console.error('[DEBUG] CSV fetch failed:', csvResponse.status, csvResponse.statusText);
            console.error('[DEBUG] Response URL:', csvResponse.url);
            throw new Error(`Failed to load climate CSV: ${csvResponse.status} ${csvResponse.statusText}. URL: ${csvResponse.url}`);
        }
        const csvText = await csvResponse.text();
        console.log('[DEBUG] CSV loaded successfully, length:', csvText.length);

        // Parse CSV
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        const csvData = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, idx) => {
                    row[header.trim()] = values[idx].trim();
                });
                // Only include tas_annual metric (annual average temperature)
                if (row.Metric && row.Metric.trim() === 'tas_annual') {
                    csvData.push(row);
                }
            }
        }

        console.log('[DEBUG] Climate CSV data loaded:', csvData.length, 'rows (filtered for tas_annual)');
        console.log('[DEBUG] Sample CSV data:', csvData[0]);
        console.log('[DEBUG] Sample CSV ISO codes (first 10):', csvData.slice(0, 10).map(r => r.ISO.trim()));

        // Validate that only tas_annual metric is included
        const metrics = new Set(csvData.map(r => r.Metric));
        console.log('[DEBUG] Metrics in filtered data:', Array.from(metrics));

        // Load GeoJSON boundaries
        // Try multiple potential paths including CDN for large files
        // jsDelivr CDN can serve files directly from GitHub, bypassing Git LFS limitations
        const geoJsonUrls = [
            'https://cdn.jsdelivr.net/gh/NB11/unesco_sites_cc_dashboard@main/data/world-administrative-boundaries.geojson',
            'data/world-administrative-boundaries.geojson',
            './data/world-administrative-boundaries.geojson',
            '/unesco_sites_cc_dashboard/data/world-administrative-boundaries.geojson'
        ];
        
        let geoJsonResponse = null;
        let geoJsonUrl = null;
        let lastError = null;
        
        // Try each URL until one works
        for (const url of geoJsonUrls) {
            try {
                console.log('[DEBUG] Trying GeoJSON URL:', url);
                geoJsonResponse = await fetch(url);
                
                if (geoJsonResponse.ok) {
                    geoJsonUrl = url;
                    console.log('[DEBUG] Successfully fetched GeoJSON from:', url);
                    break;
                } else if (geoJsonResponse.status === 404) {
                    console.warn('[DEBUG] 404 for URL:', url);
                    lastError = `404 Not Found: ${url}`;
                    continue;
                } else {
                    console.warn('[DEBUG] Non-200 status for URL:', url, geoJsonResponse.status);
                    lastError = `Status ${geoJsonResponse.status}: ${url}`;
                    continue;
                }
            } catch (fetchError) {
                console.warn('[DEBUG] Fetch error for URL:', url, fetchError);
                lastError = fetchError.message;
                continue;
            }
        }
        
        if (!geoJsonResponse || !geoJsonResponse.ok) {
            console.error('[DEBUG] All GeoJSON URLs failed. Last error:', lastError);
            console.error('[DEBUG] This usually means:');
            console.error('[DEBUG]   1. File not pushed to GitHub repository');
            console.error('[DEBUG]   2. GitHub Pages needs to be rebuilt');
            console.error('[DEBUG]   3. File path is incorrect');
            console.error('[DEBUG] Please check: https://github.com/NB11/unesco_sites_cc_dashboard/tree/main/data');
            throw new Error(`Failed to load GeoJSON from all attempted URLs. Last error: ${lastError}`);
        }
        
        // Check if response is actually JSON (not HTML error page)
        const contentType = geoJsonResponse.headers.get('content-type');
        console.log('[DEBUG] Response content-type:', contentType);
        
        let geoJsonData;
        try {
            geoJsonData = await geoJsonResponse.json();
        } catch (jsonError) {
            // If JSON parsing fails, the response might be an HTML error page
            const responseText = await geoJsonResponse.clone().text();
            if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
                console.error('[DEBUG] Server returned HTML instead of JSON. This usually means:');
                console.error('[DEBUG]   - File not found (404 page)');
                console.error('[DEBUG]   - Server error page');
                console.error('[DEBUG] Response preview:', responseText.substring(0, 500));
                throw new Error('Server returned HTML error page instead of GeoJSON. File may not be available on GitHub Pages.');
            }
            throw new Error(`Failed to parse GeoJSON: ${jsonError.message}`);
        }
        console.log('[DEBUG] GeoJSON loaded successfully from', geoJsonUrl, '- features:', geoJsonData.features?.length || 0);

        console.log('[DEBUG] GeoJSON boundaries loaded:', geoJsonData.features.length, 'features');
        console.log('[DEBUG] Sample GeoJSON feature:', geoJsonData.features[0]);
        console.log('[DEBUG] Sample GeoJSON color_code values (first 10):', 
            geoJsonData.features.slice(0, 10).map(f => f.properties.color_code));
        
        // Check for unique ISO codes in CSV
        const csvIsoCodes = new Set(csvData.map(r => r.ISO.trim()));
        console.log('[DEBUG] Unique ISO codes in CSV:', csvIsoCodes.size);
        
        // Check for unique color_codes in GeoJSON
        const geoJsonIsoCodes = new Set(geoJsonData.features.map(f => f.properties.color_code));
        console.log('[DEBUG] Unique color_code values in GeoJSON:', geoJsonIsoCodes.size);

        // Store data
        climateData = csvData;
        climateBoundaries = geoJsonData;

        // Process and visualize data
        processClimateData();

        console.log('[DEBUG] Checking map state for choropleth creation:');
        console.log('[DEBUG]   map exists:', !!map);
        console.log('[DEBUG]   map.loaded():', map ? map.loaded() : 'N/A');
        console.log('[DEBUG]   map.isStyleLoaded():', map ? map.isStyleLoaded() : 'N/A');

        // If map is already loaded, create the choropleth layer immediately
        if (map && map.loaded() && map.isStyleLoaded()) {
            console.log('[DEBUG] Map is ready, creating choropleth layer immediately');
            setTimeout(() => {
                console.log('[DEBUG] Executing delayed choropleth creation (map ready path)');
                createChoroplethMap();
                updateClimateVisualization();
                // Ensure layer is visible if button is active
                const climateToggleBtn = document.getElementById('climate-toggle-btn');
                if (climateToggleBtn && climateToggleBtn.classList.contains('active')) {
                    // Small delay to ensure layer is fully created
                    setTimeout(() => {
                        showChoroplethLayer();
                    }, 100);
                }
            }, 500);
        } else if (map) {
            console.log('[DEBUG] Map not ready, waiting for load event');
            // Otherwise wait for map to load
            map.once('load', () => {
                console.log('[DEBUG] Map load event received, creating choropleth layer');
                setTimeout(() => {
                    console.log('[DEBUG] Executing delayed choropleth creation (load event path)');
                    createChoroplethMap();
                    updateClimateVisualization();
                    // Ensure layer is visible if button is active
                    const climateToggleBtn = document.getElementById('climate-toggle-btn');
                    if (climateToggleBtn && climateToggleBtn.classList.contains('active')) {
                        // Small delay to ensure layer is fully created
                        setTimeout(() => {
                            showChoroplethLayer();
                        }, 100);
                    }
                }, 500);
            });
        } else {
            console.warn('[DEBUG] Map not available, cannot create choropleth layer');
        }
    } catch (error) {
        console.error('Error loading climate data:', error);
        // Don't show alert - just log the error and continue
        // The app can still function without climate data
        console.warn('Climate data not available. Temperature visualization will be disabled.');
    }
}

// Process Climate Data
function processClimateData() {
    console.log('[DEBUG] ===== processClimateData() called =====');
    if (!climateData || !climateBoundaries || !map) {
        console.log('[DEBUG] Waiting for climate data and boundaries...', {
            hasData: !!climateData,
            hasBoundaries: !!climateBoundaries,
            hasMap: !!map
        });
        return;
    }

    console.log('[DEBUG] Processing climate data...');

    // Create a lookup map: ISO -> { timePeriod -> { percentile -> value } }
    const dataLookup = {};

    climateData.forEach(row => {
        const identifier = row.ISO.trim(); // Can be country code (e.g., "USA") or regional code (e.g., "USA-CA")
        const timePeriod = row.Period.trim();

        if (!dataLookup[identifier]) {
            dataLookup[identifier] = {};
        }
        if (!dataLookup[identifier][timePeriod]) {
            dataLookup[identifier][timePeriod] = {};
        }

        // Store percentiles: 0.05 (Low), 0.5 (Median), 0.95 (High)
        dataLookup[identifier][timePeriod][0.05] = parseFloat(row.Value_Low);
        dataLookup[identifier][timePeriod][0.5] = parseFloat(row.Value_Median);
        dataLookup[identifier][timePeriod][0.95] = parseFloat(row.Value_High);
    });
    
    // Log statistics about data types
    const identifiers = Object.keys(dataLookup);
    const regionalIdentifiers = identifiers.filter(id => id.includes('-') || id.length > 3);
    const countryIdentifiers = identifiers.filter(id => !id.includes('-') && id.length === 3);
    
    console.log('[DEBUG] Data lookup statistics:');
    console.log('[DEBUG]   - Total identifiers:', identifiers.length);
    console.log('[DEBUG]   - Country-level identifiers:', countryIdentifiers.length);
    console.log('[DEBUG]   - Regional-level identifiers:', regionalIdentifiers.length);
    if (regionalIdentifiers.length > 0) {
        console.log('[DEBUG]   - Sample regional identifiers:', regionalIdentifiers.slice(0, 10));
    }

    console.log('[DEBUG] Data lookup created for', Object.keys(dataLookup).length, 'countries');
    
    // Debug: Log sample lookup structure
    const sampleIso = Object.keys(dataLookup)[0];
    if (sampleIso) {
        console.log('[DEBUG] Sample lookup structure for', sampleIso + ':', dataLookup[sampleIso]);
    }
    
    // Debug: Log all ISO codes in lookup
    console.log('[DEBUG] ISO codes in lookup:', Object.keys(dataLookup).slice(0, 20), '... (showing first 20)');

    // Store lookup for use in visualization
    window.climateDataLookup = dataLookup;

    // Choropleth map creation is handled in loadClimateData after map loads
}

// Create Choropleth Map Layer
function createChoroplethMap() {
    console.log('[DEBUG] createChoroplethMap called', {
        hasBoundaries: !!climateBoundaries,
        hasMap: !!map,
        mapLoaded: map ? map.loaded() : false,
        mapStyleLoaded: map ? map.isStyleLoaded() : false
    });

    if (!climateBoundaries || !map) {
        console.warn('[DEBUG] Missing climateBoundaries or map');
        return;
    }

    if (!map.loaded()) {
        console.warn('[DEBUG] Map not loaded yet');
        return;
    }
    
    if (!map.isStyleLoaded()) {
        console.warn('[DEBUG] Map style not loaded yet');
        return;
    }

    try {
        // Add source if it doesn't exist
        if (!map.getSource('climate-boundaries')) {
            console.log('[DEBUG] Adding climate-boundaries source');
            map.addSource('climate-boundaries', {
                type: 'geojson',
                data: climateBoundaries
            });
            console.log('[DEBUG] Source added successfully');
        } else {
            console.log('[DEBUG] Source climate-boundaries already exists');
        }
        
        // Verify source exists
        const source = map.getSource('climate-boundaries');
        if (source) {
            console.log('[DEBUG] Source verified:', source.type);
        } else {
            console.error('[DEBUG] Source verification failed!');
        }

        // Remove layer if it exists to ensure fresh creation
        if (map.getLayer('climate-choropleth')) {
            console.log('[DEBUG] Removing existing climate-choropleth layer');
            map.removeLayer('climate-choropleth');
        }

        // Find where to place the choropleth layer
        // Priority: 1) Before points layer (whc001-layer), 2) Before symbol layers
        let beforeId;
        
        // First, check if the points layer exists - we want choropleth BELOW points
        if (map.getLayer('whc001-layer')) {
            beforeId = 'whc001-layer';
            console.log('[DEBUG] Placing choropleth before whc001-layer (points layer)');
        } else {
            // Fall back to symbol layers if points layer doesn't exist yet
            const layers = map.getStyle().layers;
            for (let i = 0; i < layers.length; i++) {
                if (layers[i].type === 'symbol') {
                    beforeId = layers[i].id;
                    console.log('[DEBUG] Placing choropleth before symbol layer:', beforeId);
                    break;
                }
            }
        }

        // Check if temperature button is active (toggled on) - color map should be visible when active
        const climateToggleBtn = document.getElementById('climate-toggle-btn');
        const isActive = climateToggleBtn && climateToggleBtn.classList.contains('active');
        // Always set to visible initially if button is active, will be controlled by showChoroplethLayer/hideChoroplethLayer
        const initialVisibility = isActive ? 'visible' : 'none';
        console.log('[DEBUG] Creating choropleth layer with visibility:', initialVisibility, '(active:', isActive, ')');
        
        map.addLayer({
            id: 'climate-choropleth',
            type: 'fill',
            source: 'climate-boundaries',
            layout: {
                visibility: initialVisibility // Visible when button is active (toggled on)
            },
            minzoom: 0,
            maxzoom: 24,
            paint: {
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'temperature'],
                    -7, '#2b83ba',    // Deep Teal (Cold) - ~20°F = -6.7°C
                    2, '#80bfab',     // Teal-Green - ~35°F = 1.7°C
                    10, '#c7e9ad',    // Light Green - ~50°F = 10°C
                    18, '#ffffbf',     // Yellow - ~65°F = 18.3°C
                    27, '#fdae61',    // Orange - ~80°F = 26.7°C
                    35, '#d7191c'     // Red (Hot) - ~95°F = 35°C
                ],
                'fill-opacity': [
                    'case',
                    ['==', ['get', 'temperature'], 0],
                    0,  // Transparent for missing data
                    0.7  // Slightly more opaque
                ],
                'fill-outline-color': '#ffffff'
            }
        }, beforeId); // Add before points layer so it's visible

        console.log('[DEBUG] Choropleth map layer created successfully');

        // Verify layer was added
        const layer = map.getLayer('climate-choropleth');
        if (layer) {
            console.log('[DEBUG] ✓ Climate choropleth layer verified on map');
            console.log('[DEBUG]   Layer ID:', layer.id);
            console.log('[DEBUG]   Layer type:', layer.type);
            console.log('[DEBUG]   Layer visibility:', map.getLayoutProperty('climate-choropleth', 'visibility'));
        } else {
            console.error('[DEBUG] ✗ Climate choropleth layer NOT found on map!');
        }
    } catch (error) {
        console.error('[DEBUG] Error adding choropleth layer:', error);
        console.error('[DEBUG] Error stack:', error.stack);
    }

    // Add hover event listeners for climate choropleth layer
    setupClimateChoroplethHover();

}

// Setup hover events for climate choropleth layer
function setupClimateChoroplethHover() {
    if (!map || !map.loaded()) {
        console.log('[DEBUG] Map not ready for hover setup, will retry');
        return;
    }

    // Check if layer exists
    if (!map.getLayer('climate-choropleth')) {
        console.log('[DEBUG] Climate choropleth layer does not exist yet for hover setup');
        return;
    }

    // Remove existing listeners if any
    map.off('mouseenter', 'climate-choropleth', onClimateChoroplethEnter);
    map.off('mouseleave', 'climate-choropleth', onClimateChoroplethLeave);
    map.off('mousemove', 'climate-choropleth', onClimateChoroplethMove);

    // Add hover event listeners
    map.on('mouseenter', 'climate-choropleth', onClimateChoroplethEnter);
    map.on('mouseleave', 'climate-choropleth', onClimateChoroplethLeave);
    map.on('mousemove', 'climate-choropleth', onClimateChoroplethMove);
    
    console.log('[DEBUG] Hover events set up for climate-choropleth layer');
}

// Handle mouse enter on climate choropleth
function onClimateChoroplethEnter(e) {
    console.log('[DEBUG] Mouse entered climate choropleth');
    map.getCanvas().style.cursor = 'pointer';
    updateHoverDisplay(e);
}

// Handle mouse move on climate choropleth
function onClimateChoroplethMove(e) {
    updateHoverDisplay(e);
}

// Handle mouse leave on climate choropleth
function onClimateChoroplethLeave() {
    map.getCanvas().style.cursor = '';
    hideHoverDisplay();
}

// Update hover display with country and temperature
function updateHoverDisplay(e) {
    const feature = e.features && e.features[0];
    if (!feature) {
        hideHoverDisplay();
        return;
    }

    const properties = feature.properties;
    const countryName = properties.name || 'Unknown';
    const temp = properties.temperature;

    if (temp === null || temp === undefined || temp === 0) {
        hideHoverDisplay();
        return;
    }

    // Format temperature: show + sign for positive values
    const tempFormatted = temp >= 0 ? `+${temp.toFixed(1)}` : temp.toFixed(1);
    
    // Update display elements
    const hoverInfoGroup = document.getElementById('hover-info-group');
    const hoverCountryName = document.getElementById('hover-country-name');
    const hoverTemperature = document.getElementById('hover-temperature');

    if (hoverInfoGroup && hoverCountryName && hoverTemperature) {
        hoverCountryName.textContent = countryName;
        hoverTemperature.textContent = `${tempFormatted}°C`;
        hoverInfoGroup.style.display = 'block';
        console.log('[DEBUG] Hover display updated:', countryName, tempFormatted + '°C');
    } else {
        console.warn('[DEBUG] Hover display elements not found');
    }
}

// Hide hover display
function hideHoverDisplay() {
    const hoverInfoGroup = document.getElementById('hover-info-group');
    if (hoverInfoGroup) {
        hoverInfoGroup.style.display = 'none';
    }
}

// Convert Fahrenheit to Celsius
function fahrenheitToCelsius(f) {
    return (f - 32) * 5 / 9;
}

// Update Climate Visualization
function updateClimateVisualization() {
    console.log('[DEBUG] ===== updateClimateVisualization() called =====');
    if (!climateData || !climateBoundaries || !map || !window.climateDataLookup) {
        console.log('[DEBUG] Cannot update visualization - missing data', {
            hasClimateData: !!climateData,
            hasBoundaries: !!climateBoundaries,
            hasMap: !!map,
            hasLookup: !!window.climateDataLookup
        });
        return;
    }

    // Map selectedTimePeriod to CSV time period key format
    let timePeriodKey = '';
    if (selectedTimePeriod === '1986-2005') {
        timePeriodKey = 'Historical 1986-2005';
    } else if (selectedTimePeriod === '2020-2039') {
        timePeriodKey = 'Next decades 2020-2039';
    } else if (selectedTimePeriod === '2040-2059') {
        timePeriodKey = 'Midcentury 2040-2059';
    } else if (selectedTimePeriod === '2080-2099') {
        timePeriodKey = 'End of century 2080-2099';
    } else {
        // Default fallback
        timePeriodKey = 'Historical 1986-2005';
    }
    
    console.log('[DEBUG] Time period selected:', {
        selectedTimePeriod: selectedTimePeriod,
        timePeriodKey: timePeriodKey
    });

    // Map percentile
    const percentileKey = selectedPercentile === 5 ? 0.05 : selectedPercentile === 50 ? 0.5 : 0.95;

    // Update GeoJSON features with temperature values
    // Support hierarchical matching: regional data → country data → default
    let matchedCount = 0;
    let regionalMatches = 0;
    let countryMatches = 0;
    let unmatchedIsos = [];
    const updatedFeatures = climateBoundaries.features.map(feature => {
        const dataLookup = window.climateDataLookup;
        
        // Try to get regional identifier first (e.g., from admin_code, region_code, or similar properties)
        // Then fall back to country code (color_code)
        const regionalId = feature.properties.admin_code || 
                          feature.properties.region_code || 
                          feature.properties.subdivision_code || 
                          null;
        const countryCode = feature.properties.color_code; // ISO3 country code
        
        // Create a new feature object (don't mutate original)
        const newFeature = {
            ...feature,
            properties: {
                ...feature.properties
            }
        };

        let tempValue = null;
        let matchedAtLevel = null;

        // Try regional match first (if regional identifier exists)
        if (regionalId && dataLookup && dataLookup[regionalId] && dataLookup[regionalId][timePeriodKey]) {
            tempValue = dataLookup[regionalId][timePeriodKey][percentileKey];
            if (tempValue !== undefined && tempValue !== null) {
                matchedAtLevel = 'regional';
                regionalMatches++;
            }
        }
        
        // Fall back to country-level match if regional match failed
        if (!matchedAtLevel && countryCode && dataLookup && dataLookup[countryCode] && dataLookup[countryCode][timePeriodKey]) {
            tempValue = dataLookup[countryCode][timePeriodKey][percentileKey];
            if (tempValue !== undefined && tempValue !== null) {
                matchedAtLevel = 'country';
                countryMatches++;
            }
        }

        // Assign temperature value (convert from Fahrenheit to Celsius) or default to 0
        if (matchedAtLevel) {
            // Convert from Fahrenheit to Celsius for display
            newFeature.properties.temperature = fahrenheitToCelsius(tempValue);
            matchedCount++;
        } else {
            newFeature.properties.temperature = 0; // Default to 0 for missing data
            const identifier = regionalId || countryCode;
            if (identifier && !unmatchedIsos.includes(identifier)) {
                unmatchedIsos.push(identifier);
            }
        }

        return newFeature;
    });
    
    console.log('[DEBUG] Data Matching Results:');
    console.log('[DEBUG]   - Total features with matched temperature data:', matchedCount, 'out of', updatedFeatures.length);
    console.log('[DEBUG]   - Regional-level matches:', regionalMatches);
    console.log('[DEBUG]   - Country-level matches:', countryMatches);
    console.log('[DEBUG]   - Unmatched identifiers (first 20):', unmatchedIsos.slice(0, 20));
    if (unmatchedIsos.length > 0) {
        console.log('[DEBUG]   - Sample unmatched identifier:', unmatchedIsos[0], 
            '- Available in lookup?', window.climateDataLookup && window.climateDataLookup[unmatchedIsos[0]] ? 'YES' : 'NO');
    }

    // Update the source data
    const source = map.getSource('climate-boundaries');
    if (source) {
        source.setData({
            type: 'FeatureCollection',
            features: updatedFeatures
        });

        // Count features with valid temperature data
        const validTemps = updatedFeatures.filter(f => f.properties.temperature > 0);
        console.log(`[DEBUG] Updated ${validTemps.length} features with temperature data (out of ${updatedFeatures.length} total)`);

        if (validTemps.length > 0) {
            const temps = validTemps.map(f => f.properties.temperature);
            const minTemp = Math.min(...temps);
            const maxTemp = Math.max(...temps);
            console.log(`[DEBUG] Temperature range: ${minTemp.toFixed(1)}°C - ${maxTemp.toFixed(1)}°C`);
            
            // Check if values are within color scale range (-7 to 35°C, converted from 20-95°F)
            const colorScaleMin = -7;
            const colorScaleMax = 35;
            console.log(`[DEBUG] Color scale range: ${colorScaleMin}°C - ${colorScaleMax}°C`);
            
            const belowRange = temps.filter(t => t < colorScaleMin).length;
            const aboveRange = temps.filter(t => t > colorScaleMax).length;
            const inRange = temps.filter(t => t >= colorScaleMin && t <= colorScaleMax).length;
            
            console.log(`[DEBUG] Temperature values: ${belowRange} below range, ${inRange} in range, ${aboveRange} above range`);
            
            if (belowRange > 0) {
                const belowTemps = temps.filter(t => t < colorScaleMin);
                console.warn(`[DEBUG] ⚠️ ${belowRange} values below color scale minimum:`, 
                    `min=${Math.min(...belowTemps).toFixed(1)}°C`);
            }
            if (aboveRange > 0) {
                const aboveTemps = temps.filter(t => t > colorScaleMax);
                console.warn(`[DEBUG] ⚠️ ${aboveRange} values above color scale maximum:`, 
                    `max=${Math.max(...aboveTemps).toFixed(1)}°C`);
            }
            
            // Log sample temperature values
            console.log('[DEBUG] Sample temperature values (first 10):', 
                validTemps.slice(0, 10).map(f => ({iso: f.properties.color_code, temp: f.properties.temperature.toFixed(1)})));
        } else {
            console.warn('[DEBUG] ⚠️ No features with valid temperature data!');
        }
    } else {
        console.warn('Climate boundaries source not found - layer may not be created yet');
    }

    // Update color scale legend
    updateColorScaleLegend();

    // Recalculate validTemps for logging (it was defined in the source.setData block)
    const validTempsForLog = updatedFeatures.filter(f => f.properties.temperature > 0);
    console.log('[DEBUG] Visualization updated:', {
        timePeriod: timePeriodKey,
        percentile: percentileKey,
        featuresUpdated: updatedFeatures.length,
        featuresWithData: validTempsForLog.length
    });
}

// Update Color Scale Legend
function updateColorScaleLegend() {
    if (!window.climateDataLookup) return;

    // Calculate min/max temperatures from current data
    const allTemps = [];
    const dataLookup = window.climateDataLookup;

    Object.keys(dataLookup).forEach(iso => {
        const timePeriodKey = selectedTimePeriod === '1986-2005' ? 'Historical 1986-2005' :
            selectedTimePeriod === '2020-2039' ? 'Next decades 2020-2039' :
                selectedTimePeriod === '2040-2059' ? 'Midcentury 2040-2059' :
                    'End of century 2080-2099';
        const percentileKey = selectedPercentile === 5 ? 0.05 : selectedPercentile === 50 ? 0.5 : 0.95;

        if (dataLookup[iso][timePeriodKey] && dataLookup[iso][timePeriodKey][percentileKey]) {
            allTemps.push(dataLookup[iso][timePeriodKey][percentileKey]);
        }
    });

    if (allTemps.length > 0) {
        const minTemp = Math.min(...allTemps);
        const maxTemp = Math.max(...allTemps);

        const scaleMin = document.getElementById('scale-min');
        const scaleMax = document.getElementById('scale-max');

        // Convert from Fahrenheit to Celsius for display
        const minTempC = fahrenheitToCelsius(minTemp);
        const maxTempC = fahrenheitToCelsius(maxTemp);
        if (scaleMin) scaleMin.textContent = `${minTempC.toFixed(1)}°C`;
        if (scaleMax) scaleMax.textContent = `${maxTempC.toFixed(1)}°C`;
    }
}

// Show Country Tooltip on Hover
function showCountryTooltip(e) {
    const feature = e.features[0];
    if (!feature) return;

    const properties = feature.properties;
    const iso3 = properties.color_code;
    const countryName = properties.name || 'Unknown';
    const temp = feature.properties.temperature;

    // Create or update tooltip
    let tooltip = document.getElementById('climate-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'climate-tooltip';
        tooltip.className = 'climate-tooltip';
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
        <div class="tooltip-country">${countryName}</div>
        <div class="tooltip-iso">ISO: ${iso3}</div>
        <div class="tooltip-temp">Temperature: ${temp !== null && temp !== undefined ? temp.toFixed(2) + '°C' : 'N/A'}</div>
    `;

    // Position tooltip relative to map container
    const mapContainer = map.getContainer();
    const rect = mapContainer.getBoundingClientRect();
    const point = map.project(e.lngLat);

    tooltip.style.left = (rect.left + point.x + 10) + 'px';
    tooltip.style.top = (rect.top + point.y - 10) + 'px';
    tooltip.style.display = 'block';
}

// Hide Country Tooltip
function hideCountryTooltip() {
    const tooltip = document.getElementById('climate-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

// Show Choropleth Layer
function showChoroplethLayer() {
    console.log('[DEBUG] showChoroplethLayer called');
    if (!map || !map.loaded()) {
        console.warn('[DEBUG] Map not available or not loaded');
        return;
    }

    const layer = map.getLayer('climate-choropleth');
    if (layer) {
        console.log('[DEBUG] Layer exists, setting visibility to visible');
        const currentVisibility = map.getLayoutProperty('climate-choropleth', 'visibility');
        console.log('[DEBUG]   Current visibility:', currentVisibility);
        map.setLayoutProperty('climate-choropleth', 'visibility', 'visible');
        const newVisibility = map.getLayoutProperty('climate-choropleth', 'visibility');
        console.log('[DEBUG]   New visibility:', newVisibility);
        
        // Setup hover events when layer becomes visible
        setupClimateChoroplethHover();
    } else {
        console.log('[DEBUG] Layer does not exist, creating it');
        // Layer doesn't exist yet, create it
        if (climateBoundaries) {
            createChoroplethMap();
            // Ensure it's visible
            if (map.getLayer('climate-choropleth')) {
                console.log('[DEBUG] Layer created, setting visibility to visible');
                map.setLayoutProperty('climate-choropleth', 'visibility', 'visible');
                // Setup hover events after layer is created
                setupClimateChoroplethHover();
            } else {
                console.error('[DEBUG] Failed to create layer');
            }
            updateClimateVisualization();
        } else {
            console.warn('[DEBUG] climateBoundaries not available');
        }
    }

    // Ensure map is visible
    ensureMapVisible();
}

// Hide Choropleth Layer
function hideChoroplethLayer() {
    console.log('[DEBUG] hideChoroplethLayer called');
    if (!map || !map.loaded()) {
        console.warn('[DEBUG] Map not available or not loaded');
        return;
    }

    const layer = map.getLayer('climate-choropleth');
    if (layer) {
        const currentVisibility = map.getLayoutProperty('climate-choropleth', 'visibility');
        console.log('[DEBUG]   Current visibility:', currentVisibility);
        map.setLayoutProperty('climate-choropleth', 'visibility', 'none');
        const newVisibility = map.getLayoutProperty('climate-choropleth', 'visibility');
        console.log('[DEBUG]   New visibility:', newVisibility);
        console.log('[DEBUG] Choropleth layer hidden');
    } else {
        console.warn('[DEBUG] Layer does not exist, cannot hide');
    }

    // Ensure map is visible
    ensureMapVisible();
}

// Ensure Map is Visible
function ensureMapVisible() {
    if (!map) return;

    const mapContainer = document.getElementById('map');
    const mapContainerParent = document.querySelector('.map-container');
    const mapCanvas = map.getCanvasContainer();

    if (mapContainer) {
        mapContainer.style.display = 'block';
        mapContainer.style.visibility = 'visible';
        mapContainer.style.opacity = '1';
    }

    if (mapContainerParent) {
        mapContainerParent.style.display = 'block';
        mapContainerParent.style.visibility = 'visible';
        mapContainerParent.style.opacity = '1';
    }

    if (mapCanvas) {
        mapCanvas.style.display = 'block';
        mapCanvas.style.visibility = 'visible';
        mapCanvas.style.opacity = '1';
    }

    // Force map resize and repaint
    setTimeout(() => {
        if (map && map.loaded()) {
            map.resize();
            map.triggerRepaint();
        }
    }, 100);
}


// Initialize Sentinel Control Toggle
function initializeSentinelControl() {
    const toggleBtn = document.getElementById('sentinel-toggle-btn');
    const controlsContent = document.getElementById('sentinel-controls-content');
    const sentinelControl = document.getElementById('sentinel-control');

    if (!toggleBtn || !controlsContent || !sentinelControl) return;

    toggleBtn.addEventListener('click', () => {
        const isExpanded = sentinelControl.classList.contains('expanded');

        if (isExpanded) {
            // Collapse
            sentinelControl.classList.remove('expanded');
            toggleBtn.classList.remove('active');
            controlsContent.style.display = 'none';
        } else {
            // Expand
            sentinelControl.classList.add('expanded');
            toggleBtn.classList.add('active');
            controlsContent.style.display = 'flex';

            // Render calendar if Sentinel is selected
            if (selectedSentinel) {
                renderCompactCalendar();
            }
        }
    });
}

// Update Sentinel Position based on Climate widget state
function updateSentinelPosition(climateExpanded) {
    const sentinelControl = document.getElementById('sentinel-control');
    const climateControl = document.getElementById('climate-control');

    if (!sentinelControl || !climateControl) return;

    // Use requestAnimationFrame to ensure DOM has updated, but do it immediately for faster response
    requestAnimationFrame(() => {
        // Get the map container's position for relative calculations
        const mapContainer = document.querySelector('.map-container');
        if (!mapContainer) return;
        const mapRect = mapContainer.getBoundingClientRect();

        if (climateExpanded) {
            // Calculate the bottom of the expanded climate control widget
            const climateRect = climateControl.getBoundingClientRect();
            const climateBottom = climateRect.bottom;

            // Calculate offset from top of map container
            const offsetFromTop = climateBottom - mapRect.top + 10; // 10px spacing

            // Update Sentinel position
            sentinelControl.style.top = `${offsetFromTop}px`;
        } else {
            // When collapsed, calculate position based on the collapsed climate button
            const climateRect = climateControl.getBoundingClientRect();
            const climateBottom = climateRect.bottom;

            // Calculate offset from top of map container (below collapsed climate button)
            const offsetFromTop = climateBottom - mapRect.top + 10; // 10px spacing

            // Update Sentinel position to be below the collapsed climate button
            sentinelControl.style.top = `${offsetFromTop}px`;
        }
    });
}

// Ensure Map is Visible
function ensureMapVisible() {
    const mapContainer = document.getElementById('map-view');
    const mapContainerParent = document.querySelector('.map-container');

    if (mapContainerParent) {
        mapContainerParent.style.display = 'block';
        mapContainerParent.style.visibility = 'visible';
    }

    if (map) {
        map.resize();
    }
}

// Initialize Info Button
function initializeInfoButton() {
    const infoButton = document.getElementById('info-button');
    const infoModal = document.getElementById('info-modal');
    const closeButton = document.getElementById('info-modal-close');

    if (!infoButton || !infoModal) return;

    // Open modal on button click
    infoButton.addEventListener('click', (e) => {
        e.stopPropagation();
        infoModal.style.display = 'flex';
    });

    // Close modal on close button click
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            infoModal.style.display = 'none';
        });
    }

    // Close modal when clicking outside
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.style.display = 'none';
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && infoModal.style.display === 'flex') {
            infoModal.style.display = 'none';
        }
    });
}

