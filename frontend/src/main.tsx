import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PrivacyPolicy from "./PrivacyPolicy";
import "./styles.css";
import "./analysis.css";
import "./route.css";
import "./dark.css";
import "./privacy.css";
import "./ask.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname.replace(/\/$/, "") === "/privacy" ? <PrivacyPolicy /> : <App />}
  </React.StrictMode>,
);
