import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, redirect } from "react-router-dom";
import App from "./App";
import "./index.css";

// Pages
import Browse from "@/pages/Browse";
import Favorites from "@/pages/Favorites";
import Create from "@/pages/Create";
import Guided from "@/pages/Guided";
import Lessons from "@/pages/Lessons";
import Studio from "@/pages/Studio";
import TestMode from "@/pages/TestMode";
import AuthCallback from "@/pages/AuthCallback";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, loader: () => redirect("/student/browse") },
      // Student
      { path: "student/browse", element: <Browse /> },
      { path: "student/guided/:id", element: <Guided /> },
      { path: "student/test/:id", element: <TestMode /> },
      // Teacher
      { path: "teacher/create", element: <Create /> },
      // Media
      { path: "studio", element: <Studio /> },
      { path: "lessons", element: <Lessons /> },
      // Auth callback
      { path: "auth/callback", element: <AuthCallback /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
