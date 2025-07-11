import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Accordion, Card, Container, ListGroup, Spinner, Badge, Button } from "react-bootstrap";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";

const TimeSheet = () => {
  const [employeesData, setEmployeesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const employeesRef = ref(database, "employees/");
    const unsubscribe = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setEmployeesData(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
  };

  return (
    <Container className="p-4">
      <h1 className="mb-4">Employee Activity History</h1>
      {loading ? (
        <div className="text-center p-5"><Spinner animation="border" /></div>
      ) : employeesData.length === 0 ? (
        <Card className="text-center p-4">
          <Card.Body>
            <Card.Title>No Employee History Found</Card.Title>
            <Button as={Link} to="/dashboard" variant="primary">← Back to Dashboard</Button>
          </Card.Body>
        </Card>
      ) : (
        <Accordion defaultActiveKey="0">
          {employeesData.map((employee, index) => (
            <Accordion.Item eventKey={String(index)} key={employee.id}>
              <Accordion.Header>
                 <span className="fw-bold">{employee.name || employee.email}</span>
                 <Badge bg={employee.isTrackingLive ? "success" : "secondary"} className="ms-auto me-2">
                    {employee.isTrackingLive ? "Live" : "Offline"}
                 </Badge>
              </Accordion.Header>
              <Accordion.Body>
                {employee.dailyData ? (
                  <Accordion>
                    {Object.keys(employee.dailyData).reverse().map((date, dateIndex) => {
                      const dayData = employee.dailyData[date];
                      return (
                        <Accordion.Item eventKey={String(dateIndex)} key={date}>
                          <Accordion.Header>{formatDate(date)}</Accordion.Header>
                          <Accordion.Body>
                              <strong>Total Distance Traveled:</strong> {(dayData.totalDistance / 1000).toFixed(2)} km
                              
                              {dayData.locationHistory && (
                                <>
                                  <h5 className="border-top pt-3 mt-3">Location Log:</h5>
                                  <ListGroup variant="flush" style={{ maxHeight: "300px", overflowY: "auto" }}>
                                    {Object.values(dayData.locationHistory).reverse().map((entry, idx) => (
                                      <ListGroup.Item key={idx}>
                                        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'N/A'} - Lat: {entry.lat.toFixed(4)}, Lng: {entry.lng.toFixed(4)}
                                      </ListGroup.Item>
                                    ))}
                                  </ListGroup>
                                </>
                              )}
                          </Accordion.Body>
                        </Accordion.Item>
                      )
                    })}
                  </Accordion>
                ) : <p className="text-muted text-center p-3">No historical data found for this employee.</p>}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </Container>
  );
};

export default TimeSheet;