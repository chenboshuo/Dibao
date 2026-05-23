import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { DibaoI18nProvider } from "./i18n.js";
import { registerServiceWorker } from "./pwa.js";
import "./styles/reset.css";
import "./styles/tokens.css";
import "./styles/reader-tokens.css";

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DibaoI18nProvider>
      <App />
    </DibaoI18nProvider>
  </React.StrictMode>
);
