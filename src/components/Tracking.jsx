import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Button,
  ListGroup,
  Placeholder,
  Alert,
  Spinner,
} from "react-bootstrap";
import {
  PersonCircle,
  ClockHistory,
  ArrowsAngleExpand,
  Download,
  WifiOff,
} from "react-bootstrap-icons";

// --- Helper to get date in YYYY-MM-DD format ---
const getTodaysDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- API Key for OpenCage Geocoding ---
const OPENCAGE_API_KEY = "fa506c460bc64fbd870fd0a8a88728b8";

// --- Helper for Reverse Geocoding using OpenCage ---
const getPlacename = async (lat, lng) => {
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${OPENCAGE_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch address");
    const data = await response.json();
    return data.results[0]?.formatted || "Unknown Location";
  } catch (error) {
    console.error("Error fetching placename:", error);
    return "Location lookup failed";
  }
};

// --- Leaflet Icon Fix ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// --- Custom Icons for Live/Offline status ---
const createColoredIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const liveIcon = createColoredIcon('blue');
const offlineIcon = createColoredIcon('grey');

// --- Style definitions for the Google-style Polyline ---
const POLYLINE_CASING_STYLE = { color: '#1a5ab5', weight: 8, opacity: 1 };
const POLYLINE_FILL_STYLE = { color: '#4285F4', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' };


const Tracking = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const today = getTodaysDateString();

  const mapContainer = useRef(null);
  const map = useRef(null);
  const employeeMarker = useRef(null);
  const employeePathCasing = useRef(null);
  const employeePath = useRef(null);

  const [employee, setEmployee] = useState(null);
  const [liveLog, setLiveLog] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Initialize Leaflet map
  useEffect(() => {
    // FIX: This effect now depends on the 'loading' state.
    // It will only attempt to create the map AFTER loading is false
    // and the map container div exists.
    if (loading || map.current) return;
    
    if (mapContainer.current) {
      map.current = L.map(mapContainer.current, { zoomControl: false }).setView([17.385, 78.4867], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.current);
      L.control.zoom({ position: 'topright' }).addTo(map.current);
    }
  }, [loading]); // The dependency on `loading` is the key part of the fix.

  // Firebase listeners
  useEffect(() => {
    if (!employeeId) return;

    // We can set loading to false after the first check,
    // assuming employee data will stream in.
    setLoading(false);

    const employeeRef = ref(database, `employees/${employeeId}`);
    const dailyDataRef = ref(database, `employees/${employeeId}/dailyData/${today}`);

    const unsubscribeEmployee = onValue(employeeRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || !map.current) return;
      setEmployee(data);

      if (data.currentLocation) {
        const { lat, lng } = data.currentLocation;
        const newPosition = [lat, lng];
        const currentIcon = data.isTrackingLive ? liveIcon : offlineIcon;
        if (!employeeMarker.current) {
          employeeMarker.current = L.marker(newPosition, { icon: currentIcon }).addTo(map.current);
        } else {
          employeeMarker.current.setLatLng(newPosition).setIcon(currentIcon);
        }
        if (data.isTrackingLive) {
          map.current.panTo(newPosition);
        }
      }
    });

    const unsubscribeDailyData = onValue(dailyDataRef, async (snapshot) => {
        const dailyData = snapshot.val();
        if (!dailyData || !dailyData.locationHistory || !map.current) {
          // Clear previous data if any
          setLiveLog([]);
          setTotalDistance(0);
          if (employeePath.current) employeePath.current.setLatLngs([]);
          if (employeePathCasing.current) employeePathCasing.current.setLatLngs([]);
          return;
        }

        const history = Object.values(dailyData.locationHistory);
        const coordinates = history.map((loc) => [loc.lat, loc.lng]);

        if (!employeePath.current) {
          employeePathCasing.current = L.polyline(coordinates, POLYLINE_CASING_STYLE).addTo(map.current);
          employeePath.current = L.polyline(coordinates, POLYLINE_FILL_STYLE).addTo(map.current);
        } else {
          employeePathCasing.current.setLatLngs(coordinates);
          employeePath.current.setLatLngs(coordinates);
        }
        
        if (coordinates.length > 1) map.current.fitBounds(coordinates, { padding: [25, 25] });

        let dist = 0;
        for (let i = 1; i < history.length; i++) {
          dist += L.latLng(history[i-1].lat, history[i-1].lng).distanceTo(L.latLng(history[i].lat, history[i].lng));
        }
        setTotalDistance(dist);

        const logPromises = history.slice(-5).reverse().map(loc => 
          getPlacename(loc.lat, loc.lng).then(placename => ({
              time: new Date(loc.timestamp).toLocaleTimeString(),
              location: placename,
          }))
        );
        Promise.all(logPromises).then(logs => setLiveLog(logs));
    });

    return () => {
      unsubscribeEmployee();
      unsubscribeDailyData();
    };
  }, [employeeId, today]);

  if (loading) return <div className="text-center p-5"><Spinner animation="border" /></div>;

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
            <Card.Header className="d-flex justify-content-between align-items-center">
                <strong>Today's Statistics</strong>
                <Download role="button" className="text-muted" onClick={() => {}} />
            </Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item><ArrowsAngleExpand className="me-2 text-primary" />Total Distance<span className="float-end fw-bold">{(totalDistance / 1000).toFixed(2)} km</span></ListGroup.Item>
            </ListGroup>
          </Card>
        </Col>
        <Col xl={9} lg={8}>
          <Row>
            <Col xs={12} className="mb-4 position-relative">
              {employee && !employee.isTrackingLive && (<Alert variant="warning" className="position-absolute w-auto" style={{ top: "10px", left: "10px", zIndex: 1000 }}><WifiOff className="me-2" /> Employee has ended their session.</Alert>)}
              <div ref={mapContainer} style={{width: "100%", height: "55vh", borderRadius: "0.75rem"}} className="shadow-sm"/>
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