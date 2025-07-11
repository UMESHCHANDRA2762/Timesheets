import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, MarkerF, Polyline } from "@react-google-maps/api";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";
import { Container, Row, Col, Card, Badge, Button, ListGroup, Placeholder, Alert, Spinner } from "react-bootstrap";
import { PersonCircle, ClockHistory, ArrowsAngleExpand, WifiOff } from "react-bootstrap-icons";

const getTodaysDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Maps_API_KEY = "AIzaSyBmlybkhtQxnipZkUjG2rnzFG39bEDKOgE"; // Your Google Maps API Key

const Tracking = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const today = getTodaysDateString();

  const [employee, setEmployee] = useState(null);
  const [liveLog, setLiveLog] = useState([]);
  const [path, setPath] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: Maps_API_KEY,
    libraries: ["geocoding"],
  });

  const mapOptions = useMemo(() => ({
    disableDefaultUI: true,
    clickableIcons: false,
    zoomControl: true,
  }), []);

  useEffect(() => {
    if (!employeeId || !isLoaded) return;

    const employeeRef = ref(database, `employees/${employeeId}`);
    const dailyDataRef = ref(database, `employees/${employeeId}/dailyData/${today}`);

    const unsubscribeEmployee = onValue(employeeRef, (snapshot) => {
      setEmployee(snapshot.val());
    });

    const unsubscribeDailyData = onValue(dailyDataRef, async (snapshot) => {
      const dailyData = snapshot.val();
      if (!dailyData || !dailyData.locationHistory) {
        setPath([]);
        setLiveLog([]);
        setTotalDistance(0);
        return;
      }
      
      const history = Object.values(dailyData.locationHistory);
      const coordinates = history.map(loc => ({ lat: loc.lat, lng: loc.lng }));
      setPath(coordinates);
      setTotalDistance(dailyData.totalDistance || 0);

      // Create activity log
      const geocoder = new window.google.maps.Geocoder();
      const logPromises = history.slice(-5).reverse().map(loc => 
        geocoder.geocode({ location: loc }).then(({ results }) => ({
            time: new Date(loc.timestamp).toLocaleTimeString(),
            location: results[0] ? results[0].formatted_address : "Unknown",
        }))
      );
      Promise.all(logPromises).then(logs => setLiveLog(logs));
    });

    return () => {
      unsubscribeEmployee();
      unsubscribeDailyData();
    };
  }, [employeeId, isLoaded, today]);

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div className="text-center p-5"><Spinner animation="border" /></div>;

  return (
    <Container fluid className="p-3 p-md-4" style={{ backgroundColor: "#f0f2f5", minHeight: "100vh" }}>
      <Row>
        <Col xl={3} lg={4} className="mb-4 mb-lg-0">
          <Card className="shadow-sm mb-4">
            <Card.Header className="d-flex align-items-center">
              <Button variant="link" onClick={() => navigate("/dashboard")} className="p-0 me-2 text-decoration-none">&larr; Back</Button>
              <strong>Employee Details</strong>
            </Card.Header>
            <Card.Body className="text-center">
              {employee ? (
                <>
                  <PersonCircle size={60} className="text-secondary mb-2" />
                  <Card.Title>{employee.name || employeeId}</Card.Title>
                  <hr />
                  <Badge bg={employee.isTrackingLive ? "success" : "secondary"} className="w-100 p-2 fs-6">
                    {employee.isTrackingLive ? "LIVE" : "OFFLINE"}
                  </Badge>
                </>
              ) : <Placeholder as={Card.Text} animation="glow"><Placeholder xs={12} /></Placeholder>}
            </Card.Body>
          </Card>
          <Card className="shadow-sm">
            <Card.Header><strong>Today's Statistics</strong></Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item><ArrowsAngleExpand className="me-2 text-primary" />Total Distance<span className="float-end fw-bold">{(totalDistance / 1000).toFixed(2)} km</span></ListGroup.Item>
            </ListGroup>
          </Card>
        </Col>
        <Col xl={9} lg={8}>
          <Row>
            <Col xs={12} className="mb-4 position-relative" style={{ height: "55vh" }}>
              {employee && !employee.isTrackingLive && (<Alert variant="warning" className="position-absolute w-auto" style={{ top: "10px", left: "10px", zIndex: 1 }}><WifiOff className="me-2" /> Employee has ended their session.</Alert>)}
               <GoogleMap
                  mapContainerStyle={{height: "100%", width: "100%", borderRadius: "0.75rem"}}
                  center={employee?.currentLocation || path[path.length -1] || {lat: 17.385, lng: 78.4867}}
                  zoom={15}
                  options={mapOptions}
               >
                 {employee?.currentLocation && <MarkerF position={employee.currentLocation} />}
                 <Polyline path={path} options={{strokeColor: '#4285F4', strokeWeight: 5,}}/>
               </GoogleMap>
            </Col>
            <Col xs={12}>
              <Card className="shadow-sm">
                <Card.Header as="h5"><ClockHistory className="me-2" /> Today's Activity Log</Card.Header>
                <ListGroup variant="flush" style={{ maxHeight: "26vh", overflowY: "auto" }}>
                  {liveLog.length > 0 ? liveLog.map((log, index) => <ListGroup.Item key={index}><strong>{log.time}:</strong> {log.location}</ListGroup.Item>) : <ListGroup.Item className="text-center text-muted p-4">No activity recorded for today yet.</ListGroup.Item>}
                </ListGroup>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default Tracking;