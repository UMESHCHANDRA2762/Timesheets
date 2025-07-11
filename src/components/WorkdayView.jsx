import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, database } from "../firebase";
import { ref, update, push, serverTimestamp, set } from "firebase/database";
import { GoogleMap, useJsApiLoader, MarkerF, Circle, Polyline } from "@react-google-maps/api";
import { Container, Card, Spinner, Alert, Button, Row, Col } from "react-bootstrap";
import { GeoAltFill, CheckCircleFill, XCircleFill } from "react-bootstrap-icons";

// --- API Keys & Constants ---
const Maps_API_KEY = "AIzaSyBmlybkhtQxnipZkUjG2rnzFG39bEDKOgE"; // For Google Maps display
const OPENCAGE_API_KEY = "fa506c460bc64fbd870fd0a8a88728b8"; // For Reverse Geocoding
const OFFICE_LOCATION = { lat: 17.4355, lng: 78.4574 }; 
const GEOFENCE_RADIUS_METERS = 2;

// --- Helper to get date in YYYY-MM-DD format ---
const getTodaysDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- RESTORED: Helper for Reverse Geocoding using OpenCage ---
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


const WorkdayView = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [canStartDay, setCanStartDay] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [path, setPath] = useState([]);
  const [checkInMessage, setCheckInMessage] = useState({ type: "", text: "" });
  const [currentAddress, setCurrentAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);

  const passiveWatcherId = useRef(null);
  const watcherId = useRef(null);
  const mapRef = useRef(null);
  const today = getTodaysDateString();

  // Load the Google Maps script (removed "geocoding" library)
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: Maps_API_KEY,
    libraries: ["geometry"],
  });

  const mapOptions = useMemo(() => ({
    disableDefaultUI: true,
    clickableIcons: false,
    zoomControl: true,
  }), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setStatus("Ready to start your day.");
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (isTracking || !user || !isLoaded) {
      if(passiveWatcherId.current) navigator.geolocation.clearWatch(passiveWatcherId.current);
      return;
    }
    setStatus("Verifying your location...");
    const onPassiveUpdate = (position) => {
      const { latitude, longitude } = position.coords;
      const userPos = new window.google.maps.LatLng(latitude, longitude);
      const officePos = new window.google.maps.LatLng(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
      const distance = window.google.maps.geometry.spherical.computeDistanceBetween(userPos, officePos);

      if (distance <= GEOFENCE_RADIUS_METERS) {
        setCanStartDay(true);
        setStatus("✅ You are at the office. You can now start your day!");
        if(passiveWatcherId.current) navigator.geolocation.clearWatch(passiveWatcherId.current);
      } else {
        setCanStartDay(false);
        setStatus(`❌ You must be at the office to start. You are ~${Math.round(distance)} meters away.`);
      }
    };
    passiveWatcherId.current = navigator.geolocation.watchPosition(onPassiveUpdate, () => setError("Could not get location."));
    return () => { if (passiveWatcherId.current) navigator.geolocation.clearWatch(passiveWatcherId.current); };
  }, [isTracking, user, isLoaded]);

  useEffect(() => {
    if (!isTracking || !user || !isLoaded) return;
    const onPositionUpdate = (position) => {
      const { latitude, longitude } = position.coords;
      const newCoords = { lat: latitude, lng: longitude };
      setCurrentCoords(newCoords);
      setPath(prevPath => [...prevPath, newCoords]);
      
      const employeeRef = ref(database, `employees/${user.uid}`);
      const dailyHistoryRef = ref(database, `employees/${user.uid}/dailyData/${today}/locationHistory`);
      update(employeeRef, { currentLocation: { ...newCoords, timestamp: serverTimestamp() }, isTrackingLive: true });
      push(dailyHistoryRef, newCoords);
    };
    watcherId.current = navigator.geolocation.watchPosition(onPositionUpdate, () => setError("Location tracking error."), { enableHighAccuracy: true });
    return () => { if (watcherId.current) navigator.geolocation.clearWatch(watcherId.current); };
  }, [isTracking, user, today, isLoaded]);

  const startTracking = () => {
    if (!user || !canStartDay) return;
    const employeeRef = ref(database, `employees/${user.uid}`);
    const dailyDataRef = ref(database, `employees/${user.uid}/dailyData/${today}`);
    set(dailyDataRef, { startTime: serverTimestamp(), locationHistory: null, checkIns: null, totalDistance: 0 });
    update(employeeRef, { email: user.email, name: user.email.split("@")[0] });
    setIsTracking(true);
  };
  
  const handleCheckIn = () => {
    if (!isWithinGeofence) return;
    const checkInRef = ref(database, `employees/${user.uid}/dailyData/${today}/checkIns`);
    push(checkInRef, {
      timestamp: serverTimestamp(),
      location: OFFICE_LOCATION,
    })
    .then(() => setCheckInMessage({ type: "success", text: "Checked in successfully!" }))
    .catch((err) => setCheckInMessage({ type: "danger", text: `Check-in failed: ${err.message}`}));
  };

  // --- UPDATED: Get Address handler now uses OpenCage ---
  const handleGetAddress = async () => {
    if (!currentCoords) {
      setError("Location not yet available.");
      return;
    }
    setAddressLoading(true);
    setCurrentAddress("");
    const address = await getPlacename(currentCoords.lat, currentCoords.lng);
    setCurrentAddress(address);
    setAddressLoading(false);
  };

  const stopTrackingAndLogout = () => {
    if(isLoaded && path.length > 1) {
      let totalDist = 0;
      for (let i = 1; i < path.length; i++) {
        totalDist += window.google.maps.geometry.spherical.computeDistanceBetween(
          new window.google.maps.LatLng(path[i-1]),
          new window.google.maps.LatLng(path[i])
        );
      }
      const dailyDataRef = ref(database, `employees/${user.uid}/dailyData/${today}`);
      update(dailyDataRef, { totalDistance: totalDist });
    }
    setIsTracking(false);
    if (watcherId.current) navigator.geolocation.clearWatch(watcherId.current);
    if (user) update(ref(database, `employees/${user.uid}`), { isTrackingLive: false });
    signOut(auth).then(() => navigate("/login"));
  };
  
  const isWithinGeofence = useMemo(() => {
    if (!currentCoords || !isLoaded) return false;
    const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(currentCoords),
        new window.google.maps.LatLng(OFFICE_LOCATION)
    );
    return distance <= GEOFENCE_RADIUS_METERS;
  }, [currentCoords, isLoaded]);

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div className="text-center p-5"><Spinner animation="border" /></div>;

  return (
    <Container fluid className="p-3 p-md-4" style={{ backgroundColor: "#f0f2f5" }}>
      <Row className="justify-content-center">
        <Col xl={8} lg={10}>
          <Card className="shadow-sm">
            <Card.Header as="h5" className="text-center">Employee Workday Panel</Card.Header>
            <Card.Body className="p-4">
              <Card.Title className="text-center">Welcome, {user ? user.email.split("@")[0] : "Employee"}!</Card.Title>
              {!isTracking && <Alert variant={canStartDay ? "success" : "info"} className="text-center">{status}</Alert>}
              {error && <Alert variant="danger">{error}</Alert>}
              {isTracking ? (
                <>
                  <div style={{ height: "40vh", width: "100%" }}>
                    <GoogleMap
                        mapContainerStyle={{height: "100%", width: "100%", borderRadius: "0.5rem"}}
                        center={currentCoords || OFFICE_LOCATION}
                        zoom={17}
                        options={mapOptions}
                        onLoad={map => mapRef.current = map}
                    >
                        {currentCoords && <MarkerF position={currentCoords} />}
                        <Circle center={OFFICE_LOCATION} radius={GEOFENCE_RADIUS_METERS} options={{strokeColor: '#0d6efd', strokeOpacity: 0.8, strokeWeight: 2, fillColor: '#0d6efd', fillOpacity: 0.2}}/>
                        <Polyline path={path} options={{strokeColor: '#FF0000', strokeWeight: 4}}/>
                    </GoogleMap>
                  </div>
                  <Row className="mt-4">
                    <Col md={6} className="mb-3">
                      <Card><Card.Body>
                        <Card.Title>Location-Based Check-In</Card.Title>
                        <Alert variant={isWithinGeofence ? "success" : "warning"} className="d-flex align-items-center">
                          {isWithinGeofence ? <CheckCircleFill className="me-2" /> : <XCircleFill className="me-2" />}
                          {isWithinGeofence ? "You are in the zone." : "You are outside the zone."}
                        </Alert>
                        <Button onClick={handleCheckIn} disabled={!isWithinGeofence} className="w-100">Check-In at Office</Button>
                        {checkInMessage.text && <Alert variant={checkInMessage.type} className="mt-3">{checkInMessage.text}</Alert>}
                      </Card.Body></Card>
                    </Col>
                    <Col md={6} className="mb-3">
                       <Card><Card.Body>
                         <Card.Title>Reverse Geocoding</Card.Title>
                          <Button onClick={handleGetAddress} disabled={addressLoading || !currentCoords} className="w-100"><GeoAltFill className="me-2"/>{addressLoading ? 'Fetching...' : 'Get My Current Address'}</Button>
                          {currentAddress && <Alert variant="info" className="mt-3">{currentAddress}</Alert>}
                       </Card.Body></Card>
                    </Col>
                  </Row>
                  <Button variant="danger" size="lg" className="w-100 mt-3" onClick={stopTrackingAndLogout}>End Day & Log Out</Button>
                </>
              ) : (
                <div className="text-center">
                  <Button variant="primary" size="lg" className="w-100" onClick={startTracking} disabled={!canStartDay}>Start Day</Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default WorkdayView;