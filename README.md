# 🌱 NHMzh Plugin LCA (Life Cycle Assessment)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-38B2AC.svg?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Version](https://img.shields.io/badge/Version-0.0.1-brightgreen.svg?style=for-the-badge)](https://github.com/LTplus-AG/NHMzh-plugin-lca)

Web interface for the Life Cycle Assessment (LCA) module of the Sustainability Monitoring System for the City of Zurich (Nachhaltigkeitsmonitoring der Stadt Zürich).

## 📋 Table of Contents

- [Features](#-features)
- [Context](#-context)
- [Installation](#-installation)
- [Kafka Topics](#-kafka-topics)
- [Data Models](#-data-models)
- [Project Structure](#-project-structure)
- [Environment Variables](#-environment-variables)
- [Tech Stack](#-tech-stack)
- [API Integration](#-api-integration)
- [Integration](#-integration)
- [License](#-license)

## ✨ Features

- Material management and LCA calculations
- KBOB material database integration via [lcadata.ch](https://www.lcadata.ch/)
- Comprehensive material database with environmental impact data
- Interactive visualization of LCA results
- Integration with BIM workflows through NHMzh ecosystem

## 🔍 Context

This UI works in conjunction with the NHMzh ecosystem, particularly integrating with:

- **QTO Plugin**: Gathers material quantities and element data
- **Cost Plugin**: Uses cost data for economic impact assessment
- **Central Database**: Stores and retrieves environmental impact data

## 🚀 Installation

First, start the development server:

```bash
# Clone the repository
git clone https://github.com/LTplus-AG/NHMzh-plugin-lca.git
cd NHMzh-plugin-lca

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to see the result.

## 📡 Kafka Topics

The LCA plugin interfaces with Kafka as follows:

- **Consumes from**: QTO elements topic (default: "qto-elements") to receive building element data
- **Publishes to**: LCA data topic (default: "lca-data") 

When sending LCA calculation results downstream, the plugin publishes batched material instances with:

```json
{
  "project": "Project Name",
  "filename": "original.ifc",
  "timestamp": "2023-01-01T12:00:00Z",
  "fileId": "unique-file-identifier",
  "data": [
    {
      "id": "element-global-id",
      "sequence": 0,
      "mat_kbob": "Material Name",
      "gwp_relative": 0.15,
      "gwp_absolute": 25.5,
      "penr_relative": 0.12,
      "penr_absolute": 150.3,
      "ubp_relative": 0.18,
      "ubp_absolute": 1250.4
    }
    // Additional materials...
  ]
}
```

The environmental impact values include:
- **GWP**: Global Warming Potential (CO₂ equivalent)
- **PENR**: Primary Energy Non-Renewable
- **UBP**: Environmental Impact Points (Umweltbelastungspunkte)

## 💾 Data Models

The LCA plugin uses MongoDB to store environmental impact data. The primary data models include:

### LCA Impact Model

```typescript
{
  gwp: number,     // Global Warming Potential (kg CO2-eq)
  ubp: number,     // Environmental Impact Points (UBP points)
  penr: number     // Primary Energy Non-Renewable (kWh)
}
```

### LCA Element Data

```typescript
{
  id: string,               // Element identifier from IFC
  category: string,         // Element category (e.g., "IfcWall")
  level: string,            // Building level/story
  is_structural: boolean,   // Whether element is structural
  materials: [              // Array of materials
    {
      name: string,         // Material name
      volume: number,       // Material volume (m³)
      impact?: {            // Environmental impact
        gwp: number,
        ubp: number,
        penr: number
      }
    }
  ],
  impact: {                 // Total element impact
    gwp: number,
    ubp: number,
    penr: number
  },
  sequence?: number,        // Sequence number
  primaryKbobId?: string    // Reference to KBOB database
}
```

### KBOB Material Data

Stored in the materialLibrary collection, containing environmental impact coefficients for different materials:

```typescript
{
  id: string,               // KBOB material identifier
  nameDE: string,           // German name
  nameEN: string,           // English name
  category: string,         // Material category
  subcategory: string,      // Material subcategory
  density: number,          // Material density (kg/m³)
  gwp: number,              // Global Warming Potential per kg
  ubp: number,              // Environmental Impact Points per kg
  penr: number,             // Primary Energy Non-Renewable per kg
  metadata: {               // Additional information
    source: string,
    date: Date,
    version: string
  }
}
```

### LCA Results

Stored results of LCA calculations for projects:

```typescript
{
  projectId: string,         // Project identifier
  ifcData: {                 // Original IFC data information
    materials: [],           // Material list
    totalImpact: {           // Aggregated impact values
      gwp: number,
      ubp: number,
      penr: number
    }
  },
  materialMappings: {        // Maps IFC materials to KBOB
    [materialName: string]: string  // KBOB ID
  },
  ebf: number,               // Energy reference area (m²)
  lastUpdated: Date          // Last calculation timestamp
}
```

## 🗂️ Project Structure

```
app/
├── components/
│   └── ui/
├── data/
├── lib/
├── services/
├── types/
└── utils/
```

## 🔧 Environment Variables

Create a `.env.local` file in the root directory with:

```
IFC_API_KEY=your_api_key
```

The API key can be obtained from [lcadata.ch](https://www.lcadata.ch/).

## 🛠️ Tech Stack

- **React 18** - UI library
- **Tailwind CSS** - Styling framework
- **TypeScript** - Type-safe JavaScript
- **Radix UI** - Accessible component primitives
- **Vite** - Build tool and development environment

## 🔌 API Integration

The application integrates with:

- **KBOB Material Database API** via [lcadata.ch](https://www.lcadata.ch/) for environmental impact data:
  - Extensive database of building materials
  - Environmental impact data from KBOB
  - Manufacturer-specific data

## 🔗 Integration

The LCA plugin integrates with other NHMzh modules:

- **QTO Plugin**: Receives material quantities from IFC models (see [NHMzh-plugin-qto](https://github.com/LTplus-AG/NHMzh-plugin-qto))
- **Cost Plugin**: Uses cost data for economic-ecological comparisons (see [NHMzh-plugin-cost](https://github.com/LTplus-AG/NHMzh-plugin-cost))
- **Central Database**: Stores assessment results for reporting

## 📄 License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

GNU Affero General Public License v3.0 (AGPL-3.0): This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See <https://www.gnu.org/licenses/agpl-3.0.html> for details.
