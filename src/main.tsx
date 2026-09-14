import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { loadActiveZigRate } from "./hooks/useExchangeRate";

// Load the bursar-managed USD → ZiG rate once, before first paint of money values.
loadActiveZigRate();

createRoot(document.getElementById("root")!).render(<App />);
