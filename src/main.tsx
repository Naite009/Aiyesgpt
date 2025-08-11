import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";

// Layouts
import StudentLayout from "./layouts/StudentLayout";
import TeacherLayout from "./layouts/TeacherLayout";

// Pages
import Browse from "./pages/Browse";
import Favorites from "./pages/Favorites";
import Create from "./pages/Create";
import Studio from "./pages/Studio";
import Lessons from "./pages/Lessons";
import Guided from "./pages/Guided";
import TestMode from "./pages/TestMode";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          {/* Default → student browse */}
          <Route index element={<Navigate to="/student/browse" replace />} />

          {/* Student area */}
          <Route path="student" element={<StudentLayout />}>
            <Route index element={<Navigate to="browse" replace />} />
            <Route path="browse" element={<Browse />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="guided/:id" element={<Guided />} />
            <Route path="test/:id" element={<TestMode />} />
          </Route>

          {/* Teacher area */}
          <Route path="teacher" element={<TeacherLayout />}>
            <Route index element={<Navigate to="create" replace />} />
            <Route path="create" element={<Create />} />
            <Route path="studio" element={<Studio />} />
            <Route path="lessons" element={<Lessons />} />
          </Route>

          {/* Support legacy direct paths too */}
          <Route path="guided/:id" element={<Guided />} />
          <Route path="test/:id" element={<TestMode />} />
          <Route path="browse" element={<Navigate to="/student/browse" replace />} />
          <Route path="favorites" element={<Navigate to="/student/favorites" replace />} />
          <Route path="create" element={<Navigate to="/teacher/create" replace />} />
          <Route path="studio" element={<Navigate to="/teacher/studio" replace />} />
          <Route path="lessons" element={<Navigate to="/teacher/lessons" replace />} />

          {/* 404 */}
          <Route path="*" element={<div className="card p-4">404 · Not Found</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
