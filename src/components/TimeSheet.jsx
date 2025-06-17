import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Card,
  Accordion,
  ListGroup,
  Badge,
  Row,
  Col,
  Button,
  Spinner,
} from "react-bootstrap";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";
import * as maptilersdk from "@maptiler/sdk"; // <-- ADDED THIS IMPORT

const TimeSheet = () => {
  const [employeesData, setEmployeesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const employeesRef = ref(database, "employees/");
    const unsubscribe = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const employeeList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setEmployeesData(employeeList.reverse());
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const calculateTotalDistance = (history) => {
    if (!history) return 0;
    const coords = Object.values(history);
    if (coords.length < 2) return 0; // Cannot calculate distance with less than 2 points

    let totalDist = 0;
    for (let i = 1; i < coords.length; i++) {
      // Use the maptilersdk library, which is now imported
      const p1 = new maptilersdk.LngLat(coords[i - 1].lng, coords[i - 1].lat);
      const p2 = new maptilersdk.LngLat(coords[i].lng, coords[i].lat);
      totalDist += p1.distanceTo(p2);
    }
    return (totalDist / 1000).toFixed(2);
  };

  return (
    <Container className="p-4">
      <h1 className="mb-4">Employee Activity History</h1>
      {loading ? (
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      ) : employeesData.length === 0 ? (
        <Card className="text-center p-4">
          <Card.Body>
            <Card.Title>No Employee History Found</Card.Title>
            <Card.Text>
              No employee data has been recorded yet. An employee must log in
              and start their day.
            </Card.Text>
            <Button as={Link} to="/" variant="primary">
              ← Go to Dashboard
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Accordion defaultActiveKey="0">
          {employeesData.map((employee, index) => (
            <Accordion.Item eventKey={index.toString()} key={employee.id}>
              <Accordion.Header>
                <div className="w-100 d-flex justify-content-between align-items-center pe-3">
                  <span className="fw-bold">
                    {employee.email || employee.id}
                  </span>
                  <Badge bg={employee.isTrackingLive ? "success" : "secondary"}>
                    {employee.isTrackingLive ? "Live" : "Offline"}
                  </Badge>
                </div>
              </Accordion.Header>
              <Accordion.Body>
                <Row className="mb-3">
                  <Col>
                    <strong>Total Distance Traveled:</strong>{" "}
                    {calculateTotalDistance(employee.locationHistory)} km
                  </Col>
                </Row>
                {employee.locationHistory ? (
                  <div>
                    <h5 className="border-top pt-3">
                      Location Log (Most Recent First):
                    </h5>
                    <ListGroup
                      variant="flush"
                      style={{ maxHeight: "300px", overflowY: "auto" }}
                    >
                      {Object.values(employee.locationHistory)
                        .reverse()
                        .map((entry, idx) => (
                          <ListGroup.Item key={idx}>
                            <span>
                              {new Date(entry.timestamp).toLocaleTimeString()} -
                              Lat: {entry.lat.toFixed(4)}, Lng:{" "}
                              {entry.lng.toFixed(4)}
                            </span>
                          </ListGroup.Item>
                        ))}
                    </ListGroup>
                  </div>
                ) : (
                  <p className="text-muted">
                    No location data recorded for this employee.
                  </p>
                )}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
      <div className="text-center mt-4">
        <Link to="/" className="text-primary">
          ← Back to Dashboard
        </Link>
      </div>
    </Container>
  );
};

export default TimeSheet;
