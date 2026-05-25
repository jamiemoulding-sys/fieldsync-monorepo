import "leaflet/dist/leaflet.css";
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

/* =====================================
ROOT RENDER
===================================== */

const root = ReactDOM.createRoot(
  document.getElementById("root")
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/* =====================================
PRODUCTION PWA / OFFLINE FIX
Stops blank screen
Stops old JS 404
Auto updates service worker
Safe for Vercel
===================================== */

if (
  "serviceWorker" in navigator &&
  process.env.NODE_ENV === "production"
) {
  window.addEventListener(
    "load",
    async () => {
      try {
        const reg =
          await navigator.serviceWorker.register(
            "/service-worker.js",
            {
              scope: "/",
            }
          );

        console.log(
          "SW registered"
        );

        /* force fresh deploy check */
        reg.update();

        /* if new version waiting */
        if (reg.waiting) {
          reg.waiting.postMessage({
            type: "SKIP_WAITING",
          });
        }

        /* detect future updates */
        reg.addEventListener(
          "updatefound",
          () => {
            const worker =
              reg.installing;

            if (!worker) return;

            worker.addEventListener(
              "statechange",
              () => {
                if (
                  worker.state ===
                    "installed" &&
                  navigator.serviceWorker
                    .controller
                ) {
                  window.location.reload();
                }
              }
            );
          }
        );

        navigator.serviceWorker.ready.then(
          () => {
            console.log(
              "SW ready"
            );
          }
        );

        /* if controller changes */
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            window.location.reload();
          }
        );
      } catch (err) {
        console.log(
          "SW error",
          err
        );
      }
    }
  );
}