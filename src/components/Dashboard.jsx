// src/components/Dashboard.jsx

import React, { useState, useEffect } from "react";
import { Container, Card, ListGroup, Badge, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { PersonCircle, Map } from "react-bootstrap-icons";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";

const Dashboard = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <Container style={{ paddingTop: "2rem", maxWidth: "800px" }}>
      <Card className="shadow-sm">
        <Card.Header as="h3" className="text-center p-3 fw-bold">
          Employee Tracking Dashboard
        </Card.Header>
        <Card.Body>
          <p className="text-center text-muted">
            Select an employee to view their live location and travel history.
          </p>
          {loading ? (
            <div className="text-center p-4">
              <Spinner animation="border" />
              <p className="mt-2">Loading Employees...</p>
            </div>
          ) : employees.length > 0 ? (
            <ListGroup variant="flush">
              {employees.map((employee) => (
                <ListGroup.Item
                  key={employee.uid}
                  action
                  onClick={() => handleTrackEmployee(employee.uid)}
                  className="d-flex justify-content-between align-items-center p-3"
                >
                  <div className="d-flex align-items-center">
                    <PersonCircle size={30} className="me-3 text-primary" />
                    <div>
                      {/* Display the auto-generated name */}
                      <h5 className="mb-0 text-capitalize">{employee.name}</h5>
                      <small className="text-muted">{employee.email}</small>
                    </div>
                  </div>
                  <Badge
                    bg={employee.isTrackingLive ? "success" : "secondary"}
                    pill
                  >
                    {employee.isTrackingLive ? "Live" : "Offline"}{" "}
                    <Map className="ms-1" />
                  </Badge>
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <div className="text-center p-4 text-muted">
              No employees have logged in yet. <br />
              Once an employee logs in for the first time, they will appear
              here.
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Dashboard;
