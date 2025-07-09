# 🌱 NHMzh Plugin-LCA: Ökobilanzierung (Life Cycle Assessment)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)

Modul zur Ökobilanzierung (LCA) im Nachhaltigkeitsmonitoring der Stadt Zürich (NHMzh).

## 📋 Inhaltsverzeichnis

- [Architektur und Kontext](#-architektur-und-kontext)
- [Funktionsumfang](#-funktionsumfang)
- [Datenbank-Schema](#-datenbank-schema)
- [Kommunikation](#-kommunikation)
- [Installation](#-installation)
- [Umgebungsvariablen](#-umgebungsvariablen)
- [Lizenz](#-lizenz)

---

### 🏛️ Architektur und Kontext

Dieses Plugin ist die Weboberfläche für das LCA-Modul und ist Teil des NHMzh-Ökosystems. Die Architektur basiert auf einem dedizierten Backend, das für die Berechnungen zuständig ist.

- **Frontend**: Eine in React und TypeScript entwickelte Single-Page-Application (SPA) zur Visualisierung von LCA-Daten und zur Interaktion mit dem Benutzer.
- **Backend**: Ein in `backend/` enthaltener Node.js/Express-Server, der als API für das Frontend dient.
- **Datenfluss**:
    1. Das **LCA-Backend** fragt die `elements`-Sammlung aus der **MongoDB-Datenbank des QTO-Plugins** ab, um Material- und Mengendaten zu erhalten.
    2. Es berechnet die Umweltauswirkungen (GWP, UBP, PENR) basierend auf Materialvolumen und KBOB-Ökokennwerten.
    3. Die Ergebnisse werden in der eigenen `lca`-MongoDB-Datenbank gespeichert.
    4. Das **LCA-Frontend** ruft die berechneten Daten über eine **REST-API** vom LCA-Backend ab und stellt sie dar.

Die Kommunikation zwischen Frontend und Backend erfolgt zustandslos über HTTP-Anfragen. 

### ✨ Funktionsumfang

- **Material-Mapping**: Zuordnung von IFC-Materialien zu KBOB-Materialdaten.
- **LCA-Berechnungen**: Automatische Berechnung von GWP, UBP und PENR.
- **Amortisationslogik**: EBKP-basierte Zuweisung von Amortisationsdauern für Bauteile.
- **KBOB-Integration**: Anbindung an die KBOB-Datenbank zur Nutzung von Ökokennwerten.
- **Interaktive Visualisierung**: Grafische Aufbereitung der LCA-Ergebnisse.
- **Projektverwaltung**: Auswahl und Bearbeitung von verschiedenen Projekten.

### 💾 Datenbank-Schema

Das LCA-Plugin speichert seine Ergebnisse in einer `lca`-MongoDB-Datenbank. Die zentrale Sammlung ist `materialInstances`.

**`lca.materialInstances`**
```json
{
  "_id": "ObjectId",
  "element_id": "ObjectId", // Referenz zu qto.elements
  "material_name": "Beton C30/37",
  "volume": 45.2,
  "density": 2400,
  "mass": 108480,
  "environmental_impact": {
    "GWP_absolute": 32544.0,
    "UBP_absolute": 1084800,
    "PENR_absolute": 54240.0,
    "GWP_relative": 10.85,
    "UBP_relative": 361.6,
    "PENR_relative": 18.08
  },
  "amortization_period": 60,
  "ebkp_code": "C2.01",
  "project_id": "project_001",
  "calculated_at": "ISODate"
}
```
*   `GWP_relative`: kg CO₂-eq/(m²·a)
*   `UBP_relative`: UBP/(m²·a)
*   `PENR_relative`: kWh/(m²·a)

### 📞 Kommunikation

#### Interne Kommunikation (Frontend ↔ Backend)
Die Kommunikation zwischen dem React-Frontend und dem Node.js-Backend erfolgt über eine **REST-API**. Das Frontend sendet HTTP-Anfragen an das Backend, um Projektdaten abzurufen oder Materialzuordnungen zu speichern.

#### Externe Kommunikation (Backend → Externe Systeme)
Das Backend kann **zusammengefasste Endergebnisse** an **Kafka** publizieren. Dies dient der Anbindung von externen Systemen wie Dashboards. Die direkte Kommunikation zwischen den Modulen (QTO, Cost, LCA) findet über die gemeinsame MongoDB-Instanz statt, nicht über Kafka.

---

### 🚀 Installation

Server für die Entwicklungsumgebung starten:

```bash
# Repository klonen
git clone https://github.com/LTplus-AG/NHMzh-plugin-lca.git
cd NHMzh-plugin-lca

# Frontend-Abhängigkeiten installieren
npm install

# Backend-Abhängigkeiten installieren
cd backend
npm install
cd ..

# Frontend-Entwicklungsserver starten
npm run dev
```

Die Anwendung ist unter [http://localhost:5173](http://localhost:5173) erreichbar. Das Backend muss separat gestartet werden.

### 🔧 Umgebungsvariablen

Für die Konfiguration des Frontends wird eine `.env`-Datei im Stammverzeichnis verwendet:

```
# URL des LCA-Backends
VITE_API_URL=http://localhost:8002
```

Das Backend verwendet ebenfalls Umgebungsvariablen zur Konfiguration der Datenbankverbindung und anderer Dienste.

### 📄 Lizenz

Dieses Projekt ist unter der GNU Affero General Public License v3.0 (AGPL-3.0) lizenziert. Details finden Sie in der [Lizenzdatei](https://www.gnu.org/licenses/agpl-3.0.html).
