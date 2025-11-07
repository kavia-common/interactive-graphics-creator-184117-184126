import React, { useState, useEffect } from "react";
import "./App.css";
import CanvasWorkspace from "./components/CanvasWorkspace";

/**
 * PUBLIC_INTERFACE
 * App
 * Entry point for the Interactive Graphics Creator frontend.
 * Displays a themed header with theme toggle and the CanvasWorkspace component for image placement.
 *
 * Usage:
 * npm start -> open http://localhost:3000
 * - Click "Upload Images" to select PNG/JPG/JPEG or drag & drop images into the workspace.
 * - Click and drag images to reposition.
 * - Use "Clear Canvas" to remove all images.
 */
function App() {
  const [theme, setTheme] = useState("light");

  // Apply theme to document element for global CSS vars
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <div className="App">
      <header className="App-header">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>

        <div
          style={{
            maxWidth: 1200,
            width: "100%",
            margin: "0 auto",
            textAlign: "left",
          }}
        >
          <h1
            style={{
              margin: "8px 0 4px",
              fontSize: 24,
              color: "var(--text)",
            }}
          >
            Interactive Graphics Creator
          </h1>
          <p
            style={{
              margin: 0,
              opacity: 0.75,
              fontSize: 14,
              color: "var(--text)",
            }}
          >
            Upload photos and position them on the canvas. Styled with the Ocean
            Professional theme.
          </p>
        </div>

        <CanvasWorkspace />
      </header>
    </div>
  );
}

export default App;
