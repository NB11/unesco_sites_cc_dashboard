# UNESCO Heritage Sites Climate Change Dashboard

Interactive web map visualizing climate change impacts on UNESCO World Heritage Sites with temperature projections and satellite imagery.

[Live Demo](https://nb11.github.io/unesco_sites_cc_dashboard/)

## Features

- **Interactive Map**: Explore UNESCO World Heritage Sites with clickable markers
- **Climate Visualization**: Temperature change choropleth map with multiple time periods (Historical, 2020-2039, 2040-2059, 2080-2099)
- **Search & Filter**: Find sites by name, category (Cultural/Natural/Mixed), and danger status
- **Satellite View**: Toggle between map and satellite imagery
- **Sentinel Integration**: Access Sentinel satellite data products (will add)
- **Site Details**: View detailed information, images, and climate metrics for each site

## Quick Start

1. Clone the repository
2. Ensure all data files are present in the `data/` directory:
   - `unesco_sites.parquet`
   - `whc001.csv`
   - `climate_impact_data.csv`
   - `world-administrative-boundaries.geojson`
3. Serve the files using a local web server (required for CORS):
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   ```
4. Open `http://localhost:8000` in a modern browser

## Data Sources

- **UNESCO Sites**: UNESCO World Heritage Centre
- **Climate Data**: Climate Impact Lab - Annual Average Temperature (tas_annual) projections (CMIP6, SSP2-4.5)
- **Administrative Boundaries**: World Administrative Boundaries GeoJSON
- **Satellite Imagery**: Esri World Imagery
- **Sentinel Data**: Copernicus Sentinel missions

## Technology Stack

- **MapLibre GL JS** - Interactive map rendering
- **Vanilla JavaScript** - Application logic
- **parquet-wasm** - Parquet file parsing
- **SheetJS** - Excel file parsing

## Browser Requirements

Modern browser with WebAssembly support (Chrome, Firefox, Safari, Edge).
