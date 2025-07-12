---
id: lca-material-handling
slug: /lca-materials
title: How Materials Are Matched & Scored
sidebar_label: Material Matching
---

> Understanding material matching will help you speed-up the review process and avoid surprises in the impact numbers.

---

## 1. The KBOB Library We Use

• **Version:** KBOB v6.2 (December 2025) - the latest release as of July 2025.  
• **We use:** >300 material datasets, each with:
  - `Name` (German),  
  - `KBOB_ID` (numeric or hierarchical),  
  - Indicators `GWP`, `UBP`, `PENRE`,  
  - *Optional* density (`kg/unit`) or min / max density range.



---

## 2. Automatic Matching Logic

1. **Exact name match** - Case-insensitive comparison between IFC material name and KBOB `Name`.
2. **Fuzzy match** - If no exact match, we run a Levenshtein-based search (≤ 25 % distance).  The best score is pre-selected but stays *blue* until you confirm.
3. **Hierarchy fallback** - If the material looks generic (e.g. *"Concrete"*) we fall back to a parent KBOB category *(e.g. "Hochbaubeton")*.
4. **Unmatched** - Anything still unmapped appears *highlighted* and must be assigned manually.

> **Tip:** Type a few letters of the desired material in the *Material Picker* to filter the list.

---

## 3. Densities - Where They Come From

• **Pre-filled:** Most KBOB rows include `kg/unit` (mass per m³) - we copy this automatically.  
• **Ranges:** If only a range is available (`min density`/`max density`) we take the median.  You can override it in-app.  
• **Missing:** Rows without any density cannot be used and show a red warning ⚠️ until a value is supplied.

---

## 4. Customisation Options

| Scenario | Action |
|----------|--------|
| Project-specific concrete mix | Pick nearest KBOB concrete, and note discrepancy in your project report. |
| Material not in KBOB | Map to the *closest* environmental proxy; note the discrepancy. |
| Experimental material with EPD | Map to the closest KBOB equivalent and document the substitution in your project notes. |

All materials must use existing KBOB entries - custom materials are not supported to ensure consistency across projects.

---

## 5. What Happens During Re-Upload?

When you re-upload a corrected IFC:

• **GlobalId anchoring** keeps previous mappings if the material name is unchanged.  
• New materials go through the matching pipeline.  
• Deleted elements are archived but their mappings remain in history for audit.

---

### Need help?
As always, reach **support@fastbim5.eu** if you hit an edge case. 