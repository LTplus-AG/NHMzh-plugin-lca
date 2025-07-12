---
id: lca-plugin-guide
slug: /lca-plugin-guide
title: Using the LCA Plugin
sidebar_label: Plugin Guide
---

> **Audience:** Sustainability analysts, project managers, and anyone who needs to review the environmental impact numbers in NHMzh. No engineering or coding background required.

---

## 1. At a Glance

The LCA plugin translates your IFC model into carbon-equivalent and other environmental impact figures.  It pulls **quantities** from QTO and combines them with the Swiss KBOB database, this then gives you:

* **GWP (kg CO₂-eq)** - total & relative per m² · year
* **UBP** - ecological scarcity points
* **PENR (kWh)** - non-renewable primary energy

You’ll use the LCA plugin to:

1. Check the automatically detected materials.
2. Link any *unmatched* materials to a KBOB entry.
3. Adjust assumed densities or EBF (Energiebezugsfläche).
4. Confirm the final results so the dashboards can pick them up.

---

## 2. Opening the LCA Workspace

1. Navigate to `https://lca.fastbim5.eu` and log in.
2. Choose a project that already has **confirmed costs**.  The plugin refuses to run if costs are still pending.

> ℹ️ Projects appear greyed-out until both QTO & Cost are finished.

---

## 3. Interface Tour

| Section | What you do here |
|---------|------------------|
| **Sidebar** | Toggle between *Overview*, *Materials*, *Review*, *Report*. |
| **Materials table** | Shows every unique material detected plus its KBOB mapping & density. Implements search & bulk match. |
| **Impact summary** | Big numbers (GWP, UBP, PENR) with green/red trend arrows if you re-calculate. |
| **Review dialog** | Final checklist before confirmation (missing mappings, density warnings, etc.). |

> **Keyboard tip:** Press <kbd>Space</kbd> to expand/collapse material rows.

---

## 4. Typical Workflow

1. **Auto-match pass** - The plugin tries fuzzy matching against the KBOB library.
2. **Bulk match** - Use *Bulk Match* to select remaining materials and assign one KBOB entry in one go.
3. **Fine-tune densities** - Click the density cell to override (e.g. insulation variations).
4. **Set EBF** - Enter the *Energiebezugsfläche* once for the whole project (found in the *Project* tab).
5. **Review** - Hit *Review* to see any blocking issues.
6. **Confirm LCA** - When all checks are green, press **Confirm**. A summary toast shows success.

---

## 5. Understanding the Indicators

| Indicator | Unit | Meaning |
|-----------|------|---------|
| **GWP** | kg CO₂-eq | Global Warming Potential, life-cycle stages A1-A3 (modules per KBOB). |
| **UBP** | points | Ecological scarcity method 2013. |
| **PENR** | kWh | Non-renewable primary energy demand. |

Relative values divide the absolute number by (EBF × amortisation years).

---

## 6. Troubleshooting & Tips

| Symptom | Fix |
|---------|-----|
| *Material still unmatched* | The name may be ambiguous. Click it and type a few letters of the correct KBOB entry. |
| *Red density warning* | Density is missing in KBOB. Enter a custom value. |
| *“Confirm” button disabled* | At least one material unmapped **or** EBF not set. |
| *Numbers seem off* | Double-check QTO volumes first; LCA uses them as-is. |

---

## 7. FAQ

**Q: Can I export a detailed report?**  
A: Yes. After confirmation, click **Export → Excel** in the *Report* section.

**Q: How often can I re-confirm?**  
A: Unlimited. Each confirmation replaces the previous dataset.

**Q: Do I need to worry about amortisation periods?**  
A: No, the plugin assigns default periods per eBKP group automatically (see *Amortisation Rules* doc).

---

### Need help?
Email **support@fastbim5.eu** or consult the in-app tooltips (question-mark icons). 