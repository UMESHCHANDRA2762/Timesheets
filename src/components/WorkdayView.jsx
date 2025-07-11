import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, database } from "../firebase";
import { ref, update, push, serverTimestamp, set } from "firebase/database";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Container,
  Card,
  Alert,
  Button,
  Row,
  Col,
  Stack,
} from "react-bootstrap";
import { GeoAltFill, PersonCircle, DoorOpenFill, HourglassSplit } from "react-bootstrap-icons";

// --- Helper to get date in YYYY-MM-DD format ---
const getTodaysDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- API Keys & Constants ---
const OPENCAGE_API_KEY = "fa506c460bc64fbd870fd0a8a88728b8";
const OFFICE_LOCATION = { lat: 17.4355, lng: 78.4574 };
const GEOFENCE_RADIUS_METERS = 200;
const ADDRESS_UPDATE_DISTANCE_METERS = 50;

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
    return "Could not retrieve address.";
  }
};

// --- Leaflet Icon Fix ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const WorkdayView = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [canStartDay, setCanStartDay] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("Finding your location...");

  const passiveWatcherId = useRef(null);
  const watcherId = useRef(null);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const userMarker = useRef(null);
  const userPath = useRef(null);
  const lastGeocodedPos = useRef(null);

  const today = getTodaysDateString();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
      else navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  // Effect to CREATE the map
  useEffect(() => {
    // FIX: Check if the container exists before creating the map.
    if (user && !map.current && mapContainer.current) {
      map.current = L.map(mapContainer.current, { zoomControl: false }).setView([OFFICE_LOCATION.lat, OFFICE_LOCATION.lng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      L.control.zoom({ position: 'topright' }).addTo(map.current);
      L.circle([OFFICE_LOCATION.lat, OFFICE_LOCATION.lng], {
        color: '#0d6efd',
        fillColor: '#0d6efd',
        fillOpacity: 0.2,
        radius: GEOFENCE_RADIUS_METERS,
      }).addTo(map.current).bindPopup("Office Location");
    }
  }, [user]);

  const handleAddressUpdate = (latitude, longitude) => {
    const currentPos = L.latLng(latitude, longitude);
    if (!lastGeocodedPos.current || currentPos.distanceTo(lastGeocodedPos.current) > ADDRESS_UPDATE_DISTANCE_METERS) {
        lastGeocodedPos.current = currentPos;
        getPlacename(latitude, longitude).then(address => {
            setCurrentAddress(address);
        });
    }
  };

  // Passive location check (before tracking starts)
  useEffect(() => {
    if (isTracking || !user || !map.current) {
      if(passiveWatcherId.current) navigator.geolocation.clearWatch(passiveWatcherId.current);
      return;
    }
    setStatus("Verifying your location...");
    const onPassiveUpdate = (position) => {
      const { latitude, longitude } = position.coords;
      handleAddressUpdate(latitude, longitude);
      const userLatLng = L.latLng(latitude, longitude);
      if (!userMarker.current) {
        userMarker.current = L.marker(userLatLng).addTo(map.current).bindPopup("This is you!");
      } else {
        userMarker.current.setLatLng(userLatLng);
      }
      const officeLatLng = L.latLng(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
      map.current.fitBounds(L.latLngBounds(userLatLng, officeLatLng), { padding: [50, 50] });
      const distance = Math.round(userLatLng.distanceTo(officeLatLng));
      if (distance <= GEOFENCE_RADIUS_METERS) {
        setCanStartDay(true);
        setStatus("✅ You are at the office. You can now Check-In!");
        if(passiveWatcherId.current) navigator.geolocation.clearWatch(passiveWatcherId.current);
      } else {
        setCanStartDay(false);
        setStatus(`❌ You must be at the office to Check-In. You are ~${distance} meters away.`);
      }
    };
    const onError = (err) => setError(`Could not get location: ${err.message}.`);
    passiveWatcherId.current = navigator.geolocation.watchPosition(onPassiveUpdate, onError, { enableHighAccuracy: false });
    return () => { if (passiveWatcherId.current) navigator.geolocation.clearWatch(passiveWatcherId.current); };
  }, [isTracking, user, map.current]);

  // ACTIVE location tracking (after "Check-In" is clicked)
  useEffect(() => {
    if (!isTracking || !map.current || !user) return;
    const onPositionUpdate = (position) => {
      const { latitude, longitude } = position.coords;
      handleAddressUpdate(latitude, longitude);
      const newCoords = { lat: latitude, lng: longitude };
      const employeeRef = ref(database, `employees/${user.uid}`);
      const dailyHistoryRef = ref(database, `employees/${user.uid}/dailyData/${today}/locationHistory`);
      update(employeeRef, { currentLocation: { ...newCoords, timestamp: serverTimestamp() }, isTrackingLive: true });
      push(dailyHistoryRef, newCoords);
      userMarker.current.setLatLng([latitude, longitude]);
      map.current.panTo([latitude, longitude]);
      if (!userPath.current) {
        userPath.current = L.polyline([], { color: '#FF0000', weight: 4 }).addTo(map.current);
      }
      userPath.current.addLatLng([latitude, longitude]);
    };
    const onError = (err) => setError(`Location Error: ${err.message}`);
    watcherId.current = navigator.geolocation.watchPosition(onPositionUpdate, onError, { enableHighAccuracy: true });
    return () => { if (watcherId.current) navigator.geolocation.clearWatch(watcherId.current); };
  }, [isTracking, map.current, user, today]);

  const startTracking = () => {
    if (!user || !canStartDay) return;
    const employeeRef = ref(database, `employees/${user.uid}`);
    const dailyDataRef = ref(database, `employees/${user.uid}/dailyData/${today}`);
    set(dailyDataRef, { startTime: serverTimestamp(), locationHistory: null, checkIns: null, totalDistance: 0 });
    update(employeeRef, { email: user.email, name: user.email.split("@")[0] });
    setIsTracking(true);
    setStatus("Checked-In! Tracking is now active.");
  };

  const simpleLogout = () => {
      signOut(auth).then(() => navigate("/login"));
  };

  const stopTrackingAndLogout = () => {
    setIsTracking(false);
    if (watcherId.current) navigator.geolocation.clearWatch(watcherId.current);
    if (user) update(ref(database, `employees/${user.uid}`), { isTrackingLive: false });
    signOut(auth).then(() => navigate("/login"));
  };

  return (
    <Container fluid className="p-3 p-md-4" style={{ backgroundColor: "#f8f9fa" }}>
      <Row>
        <Col md={7} lg={8} className="mb-3 mb-md-0">
          <Card className="shadow-sm" style={{ height: "calc(100vh - 2rem)"}}>
            <div id="map" ref={mapContainer} style={{ height: "100%", borderRadius: "0.375rem" }} />
          </Card>
        </Col>
        <Col md={5} lg={4}>
          <Stack gap={3}>
            <Card className="shadow-sm">
              <Card.Body className="d-flex flex-column align-items-center text-center">
                <PersonCircle size={60} className="text-secondary mb-2" />
                <Card.Title className="mb-0">Welcome, {user ? user.email.split("@")[0] : "Employee"}!</Card.Title>
                <Card.Text className="text-muted">{user?.email}</Card.Text>
              </Card.Body>
            </Card>
            <Card className="shadow-sm">
              <Card.Body>
                <Card.Title><HourglassSplit className="me-2"/>Status</Card.Title>
                 <Alert variant={isTracking ? "primary" : (canStartDay ? "success" : "info")} className="text-center mb-0">
                    {status}
                 </Alert>
                 {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
              </Card.Body>
            </Card>
            <Card className="shadow-sm">
              <Card.Body>
                <Card.Title><GeoAltFill className="me-2"/>Current Address</Card.Title>
                <Card.Text className="text-muted">{currentAddress}</Card.Text>
              </Card.Body>
            </Card>
            <Card className="shadow-sm">
                <Card.Body>
                    <Card.Title>Actions</Card.Title>
                    {isTracking ? (
                         <Button variant="danger" size="lg" className="w-100" onClick={stopTrackingAndLogout}>End Day & Log Out</Button>
                    ) : (
                        <Stack gap={2}>
                            <Button variant="primary" size="lg" onClick={startTracking} disabled={!canStartDay}>Check-In</Button>
                            <Button variant="outline-secondary" onClick={simpleLogout}><DoorOpenFill className="me-2"/>Log Out</Button>
                        </Stack>
                    )}
                </Card.Body>
            </Card>
          </Stack>
        </Col>
      </Row>
    </Container>
  );
};

export default WorkdayView;