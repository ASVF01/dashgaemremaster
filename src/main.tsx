import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyTic80Cursors } from "./game/cursorTheme.ts";
import "./index.css";

applyTic80Cursors();

createRoot(document.getElementById("root")!).render(<App />);
