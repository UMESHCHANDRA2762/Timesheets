

import React, { useState, useEffect } from "react";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { Navbar, Nav, Container, Spinner, Button } from "react-bootstrap";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, database } from "./firebase";
import { ref, get } from "firebase/database";

// Import all components
import Dashboard from "./components/Dashboard";
import Tracking from "./components/Tracking";
import Login from "./components/Login";
import WorkdayView from "./components/WorkdayView";
import TimeSheet from "./components/TimeSheet";

import "bootstrap/dist/css/bootstrap.min.css";

// Custom hook to check user's auth state and role
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const adminRef = ref(database, "admins/" + user.uid);
        const snapshot = await get(adminRef);
        setIsAdmin(snapshot.exists());
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, isAdmin, loading };
};

// Components to protect your routes
const AdminRoute = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  if (loading)
    return (
      <div className="text-center p-5">
        <Spinner animation="border" />
      </div>
    );
  return user && isAdmin ? children : <Navigate to="/" />;
};

const EmployeeRoute = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  if (loading)
    return (
      <div className="text-center p-5">
        <Spinner animation="border" />
      </div>
    );
  return user && !isAdmin ? children : <Navigate to="/" />;
};

const AppNavbar = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate(); // This now works because it's imported above

  const handleLogout = () => {
    signOut(auth).then(() => {
      navigate("/"); // On logout, go back to the login page
    });
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand as={Link} to="/dashboard">
          HR Dashboard
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link as={Link} to="/history">
              Activity History
            </Nav.Link>
            {loading ? (
              <Spinner animation="border" size="sm" variant="light" />
            ) : user ? (
              <Button variant="outline-light" onClick={handleLogout}>
                Logout
              </Button>
            ) : (
              <Nav.Link as={Link} to="/">
                Login
              </Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

function App() {
  return (
    <Router basename="/Timesheets">
      <AppNavbar />
      <div className="App-body">
        <Routes>
          {/* The Login Page is now the default home page */}
          <Route path="/" element={<Login />} />

          {/* HR / Admin Routes are now protected and have their own paths */}
          <Route
            path="/dashboard"
            element={
              <AdminRoute>
                <Dashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/tracking/:employeeId"
            element={
              <AdminRoute>
                <Tracking />
              </AdminRoute>
            }
          />
          <Route
            path="/history"
            element={
              <AdminRoute>
                <TimeSheet />
              </AdminRoute>
            }
          />

          {/* Employee Route is protected */}
          <Route
            path="/workday"
            element={
              <EmployeeRoute>
                <WorkdayView />
              </EmployeeRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
