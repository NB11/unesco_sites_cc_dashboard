"""
Convert tourism Excel data to JSON format.
"""
import pandas as pd
import json
import os

# Path to the Excel file
excel_path = 'data/statistic_id1228395_travel-and-tourism_-share-of-gdp-in-the-eu-27-and-the-uk-2019-2023-by-country.xlsx'

print(f"Reading Excel file: {excel_path}")

# Read all sheets to understand the structure
xlsx = pd.ExcelFile(excel_path)
print(f"Sheet names: {xlsx.sheet_names}")

# Read each sheet and print info
for sheet_name in xlsx.sheet_names:
    print(f"\n=== Sheet: {sheet_name} ===")
    df = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)
    print(f"Shape: {df.shape}")
    print("First 20 rows:")
    print(df.head(20))

# Now let's try to extract the actual data
# The data sheet is usually named "Data" or similar
tourism_data = []

for sheet_name in xlsx.sheet_names:
    df = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)
    
    # Look for rows with country names
    country_names = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 
                     'Czech Republic', 'Czechia', 'Denmark', 'Estonia', 'Finland', 
                     'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 
                     'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 
                     'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 
                     'Spain', 'Sweden', 'United Kingdom', 'UK']
    
    for idx, row in df.iterrows():
        first_cell = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ''
        
        # Check if this row contains a country name
        if any(country.lower() in first_cell.lower() for country in country_names):
            country = first_cell
            
            # Get numeric values from the row
            numeric_values = []
            for val in row.iloc[1:]:
                if pd.notna(val):
                    try:
                        num = float(val)
                        numeric_values.append(num)
                    except (ValueError, TypeError):
                        pass
            
            if numeric_values:
                # Assume: first value is 2019, last/second is 2023
                value_2019 = numeric_values[0] if len(numeric_values) >= 1 else None
                value_2023 = numeric_values[-1] if len(numeric_values) >= 2 else numeric_values[0]
                
                tourism_data.append({
                    'country': country,
                    'gdp_share_2019': value_2019,
                    'gdp_share_2023': value_2023
                })
                print(f"Found: {country} -> 2019: {value_2019}, 2023: {value_2023}")

# Create final JSON structure
result = {
    'description': 'Travel and tourism share of GDP in EU-27 and UK (2019 and 2023)',
    'source': 'WTTC; Oxford Economics',
    'unit': 'percent',
    'data': tourism_data
}

# Save to JSON file
output_path = 'data/tourism_gdp_share.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print(f"\n=== SAVED TO {output_path} ===")
print(f"Total countries: {len(tourism_data)}")
print(json.dumps(result, indent=2))

