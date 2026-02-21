import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force rebuild to pick up environment variables
createRoot(document.getElementById("root")!).render(<App />);
