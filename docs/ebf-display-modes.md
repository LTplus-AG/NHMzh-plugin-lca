---
id: lca-ebf-display
slug: /lca-ebf
title: EBF & Display Modes
sidebar_label: EBF & Relative View
---

> The *Energiebezugsfläche (EBF)* unlocks the **Relative** display mode. Entering it correctly ensures results are comparable across projects.

---

## 1. What is EBF?

EBF is the Swiss definition of heated gross floor area (SIA 416/1).  LCA results per m² · year use this area as denominator.

---

## 2. Where to Enter EBF

1. Open your project in the LCA plugin.  
2. In the left **Sidebar**, locate the *EBF (m²)* field.  
3. Type the total EBF and hit **Enter**.

The field is valid when a positive number gets entered and all impact tables recalculate immediately.

---

## 3. Display Modes

| Mode | When active | Requirement |
|------|-------------|-------------|
| **Absolute** | Default after upload; shows kg CO₂-eq, points, kWh for the whole life-cycle module A1-A3. | None |
| **Relative** | Divides every absolute value by *(Amortisation × EBF)*. | A valid EBF > 0 |

The toggle is found in the toolbar. It is greyed-out until both conditions are met:

1. **EBF valid** 
2. **All materials mapped** 

---

## 4. How Relative Numbers Are Calculated

```
Relative = Absolute / (EBF × Amortisation years)
```

Example:  
• Element GWPₐᵦₛ = 12 000 kg CO₂-eq  
• Amortisation = 60 years  
• EBF = 500 m²  
→ Relative = 12 000 / (60 × 500) ≈ **0.4 kg CO₂-eq/m²·a**

---

## 5. Editing or Clearing EBF

• Change the number anytime - the plugin recalculates on-the-fly.  
• Clear the field to revert to *Absolute* mode; the toggle becomes inactive.

EBF is stored with the project and pre-filled when you reopen it.

---

### Need help?
Questions about EBF definitions? See SIA 416/1 or email **support@fastbim5.eu**. 