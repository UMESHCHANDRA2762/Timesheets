// Dashboard.js
import React, { useState, useEffect } from "react";
import {
  Container,
  Card,
  ListGroup,
  Badge,
  Spinner,
  InputGroup,
  FormControl,
  Button
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { PersonCircle, Map, Search, MoonStars, Sun } from "react-bootstrap-icons";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";
import EmployeeProfileModal from "./EmployeeProfileModal";
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [darkMode, setDarkMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    // Listen to employees changes in Firebase
    const employeesRef = ref(database, "employees/");
    const unsubscribe = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      setLoading(false);
      if (data) {
        const employeeList = Object.keys(data).map((uid) => ({
          uid,
          ...data[uid],
        }));
        setEmployees(employeeList);
      } else {
        setEmployees([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sort helpers
  const sortEmployees = (list) => {
    if (sortKey === "name") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortKey === "status") {
      return [...list].sort((a, b) => Number(b.isTrackingLive) - Number(a.isTrackingLive));
    }
    return list;
  };

  // Filtered & Sorted employees
  const filteredEmployees = sortEmployees(
    employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Statistics
  const onlineCount = employees.filter((e) => e.isTrackingLive).length;

  // Dark mode toggler
  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className={`dashboard-background${darkMode ? " dark" : ""}`}>
      <Container className="dashboard-container">
        {/* Header with stats and dark mode */}
        <div className="dashboard-header text-center position-relative">
          <h1 className="fw-bold">Admin Dashboard</h1>
          <p className="text-muted">
            Track and manage your team in real-time.
          </p>
          <button
            className="darkmode-toggle"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle Dark Mode"
          >
            {darkMode ? <Sun /> : <MoonStars />}
          </button>
        </div>

        <div className="stats-bar-glass d-flex justify-content-around mb-4 flex-wrap gap-3">
          <div>
            <h6 className="stat-title">Total Employees</h6>
            <span className="stat-num">{employees.length}</span>
          </div>
          <div>
            <h6 className="stat-title">Live</h6>
            <span className="stat-badge live">{onlineCount}</span>
          </div>
          <div>
            <h6 className="stat-title">Offline</h6>
            <span className="stat-badge offline">{employees.length - onlineCount}</span>
          </div>
          <div>
            <small className="stat-sync">
              Last sync: {new Date().toLocaleTimeString()}
            </small>
          </div>
        </div>

        <Card className="apple-card shadow-lg">
          <Card.Header className="card-header-glass d-flex flex-wrap justify-content-between align-items-center">
            <h3 className="mb-0">Employees</h3>
            <div className="d-flex gap-2">
              <InputGroup className="search-bar">
                <InputGroup.Text>
                  <Search />
                </InputGroup.Text>
                <FormControl
                  placeholder="Search by name or email..."
                  onChange={(e) => setSearchTerm(e.target.value)}
                  value={searchTerm}
                />
              </InputGroup>
              <select
                className="form-select sort-select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value="name">Sort: Name</option>
                <option value="status">Sort: Status</option>
              </select>
            </div>
          </Card.Header>
          <Card.Body>
            {loading ? (
              <div className="text-center p-5">
                <Spinner animation="border" role="status" />
                <p className="mt-3 text-muted">Fetching employee data...</p>
              </div>
            ) : filteredEmployees.length > 0 ? (
              <ListGroup variant="flush">
                {filteredEmployees.map((employee) => (
                  <ListGroup.Item
                    key={employee.uid}
                    action
                    onClick={() => setSelectedEmployee(employee)}
                    className="employee-item"
                  >
                    <div className="d-flex align-items-center">
                      <PersonCircle
                        size={40}
                        className={`me-4 ${employee.isTrackingLive ? "text-success" : "text-secondary"}`}
                      />
                      <div>
                        <h5 className="mb-0 text-capitalize fw-semibold">
                          {employee.name}
                          {employee.role && (
                            <span className="employee-role badge bg-info ms-2">
                              {employee.role}
                            </span>
                          )}
                        </h5>
                        <small className="text-muted">{employee.email}</small>
                      </div>
                    </div>
                    <div className="d-flex flex-column align-items-end">
                      <Badge
                        bg={employee.isTrackingLive ? "success" : "secondary"}
                        className="status-badge"
                      >
                        {employee.isTrackingLive ? "Live" : "Offline"}
                        <Map className="ms-2" />
                      </Badge>
                      {employee.lastSeen && (
                        <small className="text-muted mt-1">
                          Last seen: {new Date(employee.lastSeen).toLocaleTimeString()}
                        </small>
                      )}
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            ) : (
              <div className="text-center p-5 text-muted">
                <p className="mb-0">
                  {searchTerm
                    ? "No employees match your search."
                    : "No employees found."}
                </p>
                <small>
                  Once an employee logs in, they will appear here.
                </small>
              </div>
            )}
          </Card.Body>
        </Card>
      </Container>

      {/* Profile Modal */}
      <EmployeeProfileModal
        show={!!selectedEmployee}
        employee={selectedEmployee}
        onHide={() => setSelectedEmployee(null)}
        onTrack={() => {
          setSelectedEmployee(null);
          if (selectedEmployee) navigate(`/tracking/${selectedEmployee.uid}`);
        }}
      />
    </div>
  );
};

export default Dashboard;
