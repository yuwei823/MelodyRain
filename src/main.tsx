import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.scss";

const root = document.getElementById("app");
if (!root) throw new Error("缺少应用根节点 #app");

createRoot(root).render(<App />);
