import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Scan from "./pages/Scan.jsx";
import Compare from "./pages/Compare.jsx";
import Interactions from "./pages/Interactions.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";
import History from "./pages/History.jsx";
import About from "./pages/About.jsx";
import "./App.css";

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/interactions" element={<Interactions />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/history" element={<History />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
