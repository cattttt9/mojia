import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// StrictMode 在开发环境主动暴露不安全副作用，生产构建不会重复渲染组件。
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
