import React from "react";
import ReactDOM from "react-dom/client";
import Sur01Page from "./Sur01Page";
import "../stylesheets/all.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div className="container py-5">
      <div className="row justify-content-center">
        <main className="col-12 col-lg-10">
          <Sur01Page />
        </main>
      </div>
    </div>
  </React.StrictMode>
);