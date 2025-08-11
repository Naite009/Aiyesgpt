import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("aiyes-theme");
    const preferLight = saved ? saved === "light" : false;
    setIsLight(preferLight);
    document.documentElement.classList.toggle("theme-light", preferLight);
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle("theme-light", next);
    localStorage.setItem("aiyes-theme", next ? "light" : "dark");
  }

  return (
    <button className="btn btn-outline" onClick={toggle} title="Toggle theme">
      {isLight ? "Dark" : "Light"}
    </button>
  );
}