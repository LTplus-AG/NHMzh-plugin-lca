import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { StandaloneApp } from "./StandaloneApp";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

createRoot(rootElement).render(
  <React.StrictMode>
    <StandaloneApp />
  </React.StrictMode>
);
