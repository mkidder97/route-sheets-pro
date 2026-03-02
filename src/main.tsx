import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Enforce dark mode on every load — prevents browser/extensions from stripping it
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(<App />);
