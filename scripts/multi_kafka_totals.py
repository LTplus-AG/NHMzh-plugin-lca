#!/usr/bin/env python3
"""
multi_kafka_totals.py - Processes multiple Kafka export files and calculates totals

USAGE
    python multi_kafka_totals.py <directory_path> <file_pattern>

Example:
    python multi_kafka_totals.py "C:/Users/LouisTrümpler/Downloads" "topic-message"

The script will find all files matching the pattern in the specified directory
and calculate environmental indicators across all of them.

Requires only the Python 3 standard library.
"""

import json
import sys
import os
import re
from collections import defaultdict
from pathlib import Path

METRICS = (
    "gwp_relative", "gwp_absolute",
    "penr_relative", "penr_absolute",
    "ubp_relative", "ubp_absolute",
)

def process_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            kafka_message = json.load(f)
        
        # Handle nested JSON structure - the actual data is in the "Value" field as a JSON string
        if "Value" in kafka_message and isinstance(kafka_message["Value"], str):
            try:
                inner_payload = json.loads(kafka_message["Value"])
                rows = inner_payload.get("data", [])
                if not rows:
                    print(f"Warning: No data rows found in inner JSON of {file_path}")
                return rows
            except json.JSONDecodeError:
                print(f"Error: Could not parse inner JSON in {file_path}")
                return []
        else:
            # Try standard format like kafkLLCAexport.json
            rows = kafka_message.get("data", [])
            if not rows:
                print(f"Warning: No data rows found in {file_path}")
            return rows
    except Exception as e:
        print(f"Error processing {file_path}: {str(e)}")
        return []

def main():
    if len(sys.argv) < 3:
        sys.exit("Usage: python multi_kafka_totals.py <directory_path> <file_pattern>")
    
    directory = Path(sys.argv[1])
    file_pattern = sys.argv[2]
    
    # Find all matching files
    all_files = []
    for file in os.listdir(directory):
        if file_pattern in file:
            file_path = directory / file
            if file_path.is_file():
                all_files.append(file_path)
    
    if not all_files:
        sys.exit(f"No files matching pattern '{file_pattern}' found in {directory}")
    
    print(f"Found {len(all_files)} files to process")
    
    # Process all files and collect rows
    all_rows = []
    for file_path in all_files:
        print(f"Processing: {file_path.name}")
        rows = process_file(file_path)
        all_rows.extend(rows)
        print(f"  - Added {len(rows)} rows")
    
    print(f"\nTotal rows processed: {len(all_rows)}")
    
    # Calculate grand totals
    grand = defaultdict(float)
    for row in all_rows:
        for m in METRICS:
            grand[m] += row.get(m, 0.0)
    
    print("\n=== GRAND TOTALS ACROSS ALL FILES ===")
    for m in METRICS:
        print(f"{m:15}: {grand[m]:,.6f}")
    
    # Calculate per-material breakdown
    per_material = defaultdict(lambda: defaultdict(float))
    for row in all_rows:
        mat = row.get("mat_kbob", "UNKNOWN")
        for m in METRICS:
            per_material[mat][m] += row.get(m, 0.0)
    
    print("\n=== BREAKDOWN BY MATERIAL (mat_kbob) ===")
    for mat, metrics in per_material.items():
        print(f"\n{mat}")
        for m in METRICS:
            print(f"  {m:13}: {metrics[m]:,.6f}")

if __name__ == "__main__":
    main()