#!/usr/bin/env python3
"""
totals.py – quick-and-dirty helper to sum the environmental indicators
in the export you pasted into ChatGPT.

USAGE
    python plugin-lca\\scripts\\kafkatotals.py "<directory_path>" "<file_pattern>"

The script prints

1. the grand total for each indicator across all rows
2. an optional breakdown by material (mat_kbob)
3. duplicate id/sequence combinations (if any found)

Requires only the Python 3 standard library.
"""

import json
import sys
from collections import defaultdict
from pathlib import Path


METRICS = (
    "gwp_relative", "gwp_absolute",
    "penr_relative", "penr_absolute",
    "ubp_relative", "ubp_absolute",
)

def process_file(file_path):
    """Reads a Kafka export file, parses the inner JSON, and returns the data list."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            payload = json.load(f)

        # Handle nested Kafka message format
        if "Value" in payload and isinstance(payload["Value"], str):
            try:
                inner_payload = json.loads(payload["Value"])
                rows = inner_payload.get("data", [])
                if not rows:
                    print(f"Warning: No data rows found in inner JSON of {file_path.name}")
                return rows
            except json.JSONDecodeError:
                print(f"Error: Could not parse inner JSON in {file_path.name}")
                return []
        else:
            rows = payload.get("data", [])
            if not rows:
                 print(f"Warning: No data rows found directly in {file_path.name}")
            return rows

    except Exception as e:
        print(f"Error processing {file_path.name}: {str(e)}")
        return []


def main() -> None:
    if len(sys.argv) < 3:
        print("ERROR: Missing arguments for directory and file pattern.")
        sys.exit(__doc__)

    directory = Path(sys.argv[1])
    file_pattern = sys.argv[2]

    if not directory.is_dir():
        sys.exit(f"Error: Directory not found: {directory}")

    all_files = sorted([
        item for item in directory.iterdir()
        if item.is_file() and file_pattern.lower() in item.name.lower()
    ], key=lambda f: f.name)

    if not all_files:
        sys.exit(f"No files matching pattern '{file_pattern}' found in {directory}")

    print(f"Found {len(all_files)} files to process:")
    for file_path in all_files:
        print(f"- {file_path.name}")

    all_rows = []
    for file_path in all_files:
        print(f"\nProcessing: {file_path.name}...")
        rows = process_file(file_path)
        all_rows.extend(rows)
        print(f"  -> Found {len(rows)} items.")

    if not all_rows:
        sys.exit("No items found in any processed file.")

    # Check for duplicate id/sequence combinations
    id_sequence_counts = defaultdict(int)
    duplicate_combinations = []
    
    for row in all_rows:
        row_id = row.get("id", "UNKNOWN")
        sequence = row.get("sequence", "UNKNOWN")
        mat_kbob = row.get("mat_kbob", "UNKNOWN")
        key = f"{row_id}_{sequence}"
        id_sequence_counts[key] += 1
        
        if id_sequence_counts[key] > 1:
            duplicate_combinations.append({
                "id": row_id,
                "sequence": sequence,
                "mat_kbob": mat_kbob,
                "count": id_sequence_counts[key]
            })

    # 2 – grand totals --------------------------------------------------------
    grand = defaultdict(float)
    for row in all_rows:
        for m in METRICS:
            grand[m] += row.get(m, 0.0)

    print("=== GRAND TOTALS ===")
    for m in METRICS:
        print(f"{m:15}: {grand[m]:,.6f}")

    # 3 – per-material breakdown (optional) -----------------------------------
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

    # 4 – duplicate id/sequence combinations ----------------------------------
    if duplicate_combinations:
        print("\n=== DUPLICATE ID/SEQUENCE COMBINATIONS ===")
        # Group by the combination and show unique entries
        seen_combinations = set()
        for dup in duplicate_combinations:
            key = f"{dup['id']}_{dup['sequence']}"
            if key not in seen_combinations:
                seen_combinations.add(key)
                print(f"ID: {dup['id']}, Sequence: {dup['sequence']}, Material: {dup['mat_kbob']}, Count: {dup['count']}")
        print(f"\nTotal duplicate combinations found: {len(seen_combinations)}")
    else:
        print("\n=== DUPLICATE CHECK ===")
        print("No duplicate id/sequence combinations found.")


if __name__ == "__main__":
    main()
