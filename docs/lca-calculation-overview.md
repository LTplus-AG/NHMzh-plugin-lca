---
id: lca-calculation-overview
slug: /lca-calculation
title: How LCA Results Are Calculated
sidebar_label: Calculation Logic
---

> This page explains **where the numbers come from** so you can trust (and, if necessary, challenge) the results you see in the LCA plugin.

---

## 1. Data Pipeline

```
IFC → QTO quantities & materials → Cost plugin (amortisation years) → LCA plugin
```

1. **QTO plugin** provides element volumes, areas, lengths + material names.
2. **Cost plugin** confirms eBKP codes, which the LCA plugin uses to decide amortisation.
3. **LCA plugin** matches materials to the Swiss **KBOB v6** library and performs the math below.

---

## 2. Core Formula

For each material instance:

```
Absolute impact = Volume × Density × Indicator per-kg
```

| Symbol | Source |
|--------|--------|
| **Volume (m³)** | NetVolume (preferred) or GrossVolume from IFC. |
| **Density (kg/m³)** | From KBOB; editable in the UI if missing/atypical. |
| **Indicator per-kg** | GWP, UBP, PENR values from KBOB v6. |

Absolute results are summed over the project to give totals.

### Relative results

```
Relative impact = Absolute / (EBF × Amortisation years)
```

Where **EBF** is the *Energiebezugsfläche* you enter once per project.

---

## 3. Which Quantities Are Used?

| IFC Quantity | Used for | Priority |
|--------------|----------|----------|
| **NetVolume** | All elements | 1 (best) |
| **GrossVolume** | Fallback when NetVolume missing | 2 |

Surface or area quantities are **not** used directly—they matter only for cost, not LCA.

If both NetVolume & GrossVolume are zero or absent, the element is skipped and appears with *Warning* highlight.

---

## 4. eBKP → Amortisation Mapping

Amortisation determines how the absolute impact is converted to annualised values.

| eBKP group | Default years |
|------------|--------------|
| **C01 - C04 (Structure)** | 60 |
| **E02.03 (Façade cladding)** | 40 |
| **D- / G- groups (Fit-out & MEP)** | 30 |
| **D05.02 (Special heating systems)** | 20 |
| *Nearly anything else* | 30 |

You can find the full list on the next page *Amortisation Rules*.

---

## 5. What If Data Is Missing?

1. **Missing density** → row turns red; enter a custom value or pick another KBOB material.
2. **Material not in KBOB** → map it to the closest equivalent.
3. **Unclassified element (no eBKP)** → falls back to 30-year amortisation.

---

### Quick recap

1. Volumes come from IFC quantities.
2. Densities & indicators from KBOB.
3. Amortisation years from SIA 2032 (2020) and are mapped to model elements per eBKP group.

Together they produce the numbers you see in the dashboard. 