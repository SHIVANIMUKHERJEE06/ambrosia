import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import "./Navbar.css";

export default function Navbar() {
  const { loggedIn, logout, profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand" onClick={close}>
          {/* Bug Fix 1: Use actual Ambrosia logo PNG instead of generic SVG leaf */}
          <img
            src="/logo.png"
            alt="Ambrosia logo"
            className="nav-logo-img"
            width="40"
            height="40"
          />
          <span className="nav-brand-text">Ambrosia</span>
        </Link>

        <button
          className="nav-hamburger"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span /><span /><span />
        </button>

        <nav className={`nav-links ${menuOpen ? "nav-links-open" : ""}`}>
          {[
            ["/scan", "Scan"],
            ["/compare", "Compare"],
            ["/interactions", "Interactions"],
            ...(loggedIn ? [["/history", "History"]] : []),
            ["/about", "About"],
          ].map(([to, label]) => (
            <NavLink key={to} to={to} onClick={close}
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              {label}
            </NavLink>
          ))}
          <div className="nav-mobile-auth">
            {loggedIn ? (
              <>
                <Link to="/profile" className="nav-profile-pill" onClick={close}>
                  {profile?.skinType ? profile.skinType.replace("-", " ") : "Set up profile"}
                </Link>
                <button className="nav-logout" onClick={() => { logout(); close(); }}>Log out</button>
              </>
            ) : (
              <Link to="/login" className="nav-cta" onClick={close}>Log in</Link>
            )}
          </div>
        </nav>

        <div className="nav-auth nav-auth-desktop">
          {loggedIn ? (
            <>
              <Link to="/profile" className="nav-profile-pill">
                {profile?.skinType ? profile.skinType.replace("-", " ") : "Set up profile"}
              </Link>
              <button className="nav-logout" onClick={logout}>Log out</button>
            </>
          ) : (
            <Link to="/login" className="nav-cta">Log in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
