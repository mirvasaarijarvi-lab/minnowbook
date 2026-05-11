import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installStorageRejectionTelemetry } from "./lib/storage-rejection-telemetry";

// Forward storage-path rejection events to the spike-detection
// edge function. Must run before any code that could trigger
// assertSafeStorageObjectPath, so it sits above the React render.
installStorageRejectionTelemetry();

createRoot(document.getElementById("root")!).render(<App />);
