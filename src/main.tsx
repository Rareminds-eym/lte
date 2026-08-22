import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import "@/app/styles/index.css";
import { getLogger } from "@/shared/config/logging";

const uncaughtLogger = getLogger("UncaughtGlobal");

window.addEventListener("error", (event) => {
  uncaughtLogger.error("Unhandled global window error", event.error || event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  uncaughtLogger.error("Unhandled global promise rejection", event.reason);
});

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
