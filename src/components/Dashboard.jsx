import React, { useState, useEffect } from "react";
import {
  Container,
  Card,
  ListGroup,
  Badge,
  Spinner,
  InputGroup,
  FormControl,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { PersonCircle, Map, Search } from "react-bootstrap-icons";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";
import "./Dashboard.css"; // Import the custom CSS

const Dashboard = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const employeesRef = ref(database, "employees/");

    // onValue listens for any changes to the employees data in Firebase
    const unsubscribe = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert the Firebase object into a list
        const employeeList = Object.keys(data).map((uid) => ({
          uid: uid,
          ...data[uid],
        }));
        setEmployees(employeeList);
      } else {
        setEmployees([]);
      }
      setLoading(false);
    });

    // Cleanup: stop listening when the component unmounts
    return () => unsubscribe();
  }, []);

  const handleTrackEmployee = (employeeId) => {
    navigate(`/tracking/${employeeId}`);
  };

  // Filter employees based on search term (name or email)
  const filteredEmployees = employees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-background">
      <Container className="dashboard-container">
        <div className="dashboard-header text-center">
          <h1 className="fw-bold">Admin Dashboard</h1>
          <p className="text-muted">
            Track and manage your team in real-time.
          </p>
        </div>

        <Card className="apple-card shadow-lg">
          <Card.Header className="card-header-glass d-flex justify-content-between align-items-center">
            <h3 className="mb-0">Employees</h3>
            <InputGroup className="search-bar">
              <InputGroup.Text>
                <Search />
              </InputGroup.Text>
              <FormControl
                placeholder="Search by name or email..."
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
          </Card.Header>
          <Card.Body>
            {loading ? (
              <div className="text-center p-5">
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p className="mt-3 text-muted">Fetching employee data...</p>
              </div>
            ) : filteredEmployees.length > 0 ? (
              <ListGroup variant="flush">
                {filteredEmployees.map((employee) => (
                  <ListGroup.Item
                    key={employee.uid}
                    action
                    onClick={() => handleTrackEmployee(employee.uid)}
                    className="employee-item"
                  >
                    <div className="d-flex align-items-center">
                      <PersonCircle size={40} className="me-4 text-primary" />
                      <div>
                        <h5 className="mb-0 text-capitalize fw-semibold">
                          {employee.name}
                        </h5>
                        <small className="text-muted">{employee.email}</small>
                      </div>
                    </div>
                    <Badge
                      bg={employee.isTrackingLive ? "success" : "secondary"}
                      className="status-badge"
                    >
                      {employee.isTrackingLive ? "Live" : "Offline"}
                      <Map className="ms-2" />
                    </Badge>
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
    </div>
  );
};

export default Dashboard;