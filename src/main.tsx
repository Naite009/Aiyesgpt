import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import Browse from "./pages/Browse";
import Create from "./pages/Create";
import Favorites from "./pages/Favorites";
import Guided from "./pages/Guided";
import Lessons from "./pages/Lessons";
import Studio from "./pages/Studio";
import StudentPractice from "./pages/StudentPractice";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Browse /> },
      { path: "browse", element: <Browse /> },
      { path: "create", element: <Create /> },
      { path: "favorites", element: <Favorites /> },
      { path: "guided/:id", element: <Guided /> },
      { path: "lessons", element: <Lessons /> },
      { path: "studio", element: <Studio /> },

      // New: student practice tied to a specific lesson
      { path: "student/practice/:lessonId", element: <StudentPractice /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
