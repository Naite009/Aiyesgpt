import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

import App from "./App";
import Browse from "./pages/Browse";
import Create from "./pages/Create";
import Studio from "./pages/Studio";
import Guided from "./pages/Guided";
import TestMode from "./pages/TestMode";
import Favorites from "./pages/Favorites";
import Auth from "./pages/Auth";
import Lessons from "./pages/Lessons"; // 👈 added

import ToastProvider from "./components/ToastProvider";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Browse /> },
      { path: "browse", element: <Browse /> },
      { path: "create", element: <Create /> },
      { path: "studio", element: <Studio /> },
      { path: "guided/:id", element: <Guided /> },
      { path: "test/:id", element: <TestMode /> },
      { path: "favorites", element: <Favorites /> },
      { path: "lessons", element: <Lessons /> }, // 👈 added
      { path: "auth", element: <Auth /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </React.StrictMode>
);
import ErrorBoundary from "./components/ErrorBoundary";
// ...
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
import { Analytics } from "@vercel/analytics/react";
// ...
<ErrorBoundary>
  <ToastProvider>
    <RouterProvider router={router} />
    <Analytics /> {/* tracks page views, web vitals */}
  </ToastProvider>
</ErrorBoundary>
