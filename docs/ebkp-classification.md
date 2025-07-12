---
id: lca-ebkp-classification
slug: /lca-ebkp
title: eBKP Classification & IFC
sidebar_label: eBKP in IFC
---

> Proper eBKP-H classification is the **switch** that turns absolute impact numbers into meaningful *relative* (per-m²·year) results.

---

## 1. Where We Look for eBKP Codes

The LCA plugin scans each IFC element for a classification reference in this order:

1. **IfcRelAssociatesClassification** → `IfcClassificationReference` where `ReferencedSource.Name == "eBKP"`  
   • We read `Identification` (`C2.01`, `D05`, …) and attach it to the element.
2. **Property fallback** - If no relation is found, we look for an `IfcPropertySet` named *Classification* with a `IfcPropertySingleValue` called `eBKP_Code`.

If both checks fail, the element is marked *unclassified*.

---

## 2. Why It Matters

| Scenario | Result set |
|----------|------------|
| eBKP present & valid | **Absolute** + **Relative** indicators (annualised with amortisation). |
| eBKP missing/invalid | **Absolute only** - the *Relative* columns show `-`. |

The reason: amortisation periods depend on the eBKP group (see *Calculation Logic*). Without it, the system cannot decide whether an element should last 60, 40, 30 or 20 years.

---

## 3. Valid vs. Invalid Codes

• **Valid** - Must follow the full hierarchy, e.g. `C04.01`, `D07.02`.  
• **Too generic** - Codes like `C` or `D05` trigger a warning; we still assign default amortisation for the broader group but advise adding more detail.

> **Tip:** Have a look at the element table to see which amortisation period was applied, this is only visble if in *relative mode*.

---
## 4. Fixing & Adding eBKP Codes - ifcclassify.com

We maintain an open-source helper tool **[ifcclassify.com](https://ifcclassify.com/)** that lets you:

1. Drag-and-drop an IFC file.  
2. Define rule-based mappings (e.g. *IfcWall* + name contains "Aussen" → `C2.01`).  
3. Write the eBKP codes back into the model as proper `IfcClassificationReference` relations.  
4. Download the enriched IFC and re-upload to NHMzh.

The app is free and your data never leaves the browser.

---

## 5. Troubleshooting

| Symptom | Possible cause | Fix |
|---------|----------------|-----|
| *Relative columns empty* | No eBKP codes in IFC or property set | Use ifcclassify.com or BIM authoring tool to add codes, then re-upload. |
| *Code turns yellow* | Hierarchy too broad (`C04`) | Add more digits (`C04.01`). |
| *Amortisation seems wrong* | Wrong eBKP group (e.g., façade classified as structure) | Correct classification and recalculate. |

---

### Need help?
Email **support@fastbim5.eu** or open an issue on the ifcclassify GitHub repo. 