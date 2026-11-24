import "./traceboard";
import "./styles.css";
import { createRoot } from "react-dom/client";
import OrderEdit from "./OrderEdit.jsx";

// The SDK is initialized by ./traceboard before ./OrderEdit.jsx is evaluated, which keeps the
// module-level wrapped validateForm active for case B.
const container = document.getElementById("root");
const root = createRoot(container);
root.render(<OrderEdit />);