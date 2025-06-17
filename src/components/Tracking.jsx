import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as maptilersdk from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";
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
} from "react-bootstrap";
import {
  PersonCircle,
  ClockHistory,
  ArrowsAngleExpand,
  Download,
  WifiOff,
} from "react-bootstrap-icons";

// --- Constants and Helpers (No Changes) ---
const MAPTILER_API_KEY = "IM5fa8LxttCOF3H4Sxqa";
const GEOAPIFY_API_KEY = "03a175bc0c42441180e543cad39c5749";

const getPlacename = async (lat, lng) => {
  const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch address");
    const data = await response.json();
    return data.features[0]?.properties?.formatted || "Unknown Location";
  } catch (error) {
    console.error("Error fetching placename:", error);
    return "Location lookup failed";
  }
};

const Tracking = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();

  const mapContainer = useRef(null);
  const map = useRef(null);
  const employeeMarker = useRef(null);
  const lastLoggedLocation = useRef(null);

  const [employee, setEmployee] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [liveLog, setLiveLog] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current) return;
    maptilersdk.config.apiKey = MAPTILER_API_KEY;
    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: maptilersdk.MapStyle.STREETS,
      center: [78.4867, 17.385],
      zoom: 10,
    });
    map.current.addControl(new maptilersdk.NavigationControl(), "top-right");
    map.current.on("load", () => setIsMapReady(true));
  }, []);

  // --- [UPDATED] Firebase listener with enhanced offline status handling ---
  useEffect(() => {
    if (!employeeId || !isMapReady) return;

    const employeeRef = ref(database, `employees/${employeeId}`);

    const unsubscribe = onValue(employeeRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      setEmployee(data);

      // --- Marker and Path Update ---
      if (data.currentLocation) {
        const { lat, lng } = data.currentLocation;
        const newPosition = [lng, lat];

        // Define marker colors based on status
        const markerColor = data.isTrackingLive ? "#0d6efd" : "#6c757d"; // Blue for live, Grey for offline

        // Remove the old marker before adding a new one to update the color
        if (employeeMarker.current) {
          employeeMarker.current.remove();
        }

        employeeMarker.current = new maptilersdk.Marker({ color: markerColor })
          .setLngLat(newPosition)
          .addTo(map.current);

        if (data.isTrackingLive) {
          map.current.panTo(newPosition);
          setLastUpdated(
            new Date(data.currentLocation.timestamp).toLocaleTimeString()
          );
        }
      }

      // --- Live Log and Distance Calculation (only runs if there's a history) ---
      if (data.locationHistory) {
        const history = Object.values(data.locationHistory);
        const coordinates = history.map((loc) => [loc.lng, loc.lat]);
        updateMapPath(coordinates); // Draw the historical path

        // Calculate total distance
        let dist = 0;
        for (let i = 1; i < history.length; i++) {
          const p1 = new maptilersdk.LngLat(
            history[i - 1].lng,
            history[i - 1].lat
          );
          const p2 = new maptilersdk.LngLat(history[i].lng, history[i].lat);
          dist += p1.distanceTo(p2);
        }
        setTotalDistance(dist / 1000);

        // Generate Live Log with Reverse Geocoding
        const latestLocation = history[history.length - 1];
        if (shouldLogNewLocation(latestLocation)) {
          const placename = await getPlacename(
            latestLocation.lat,
            latestLocation.lng
          );
          const newLogEntry = {
            time: new Date(latestLocation.timestamp).toLocaleTimeString(),
            location: placename,
          };
          setLiveLog((prevLog) => [newLogEntry, ...prevLog]);
          lastLoggedLocation.current = latestLocation;
        }
      }
    });

    return () => unsubscribe();
  }, [employeeId, isMapReady]);

  // Helper function to draw path on map
  const updateMapPath = (coordinates) => {
    if (!map.current || !isMapReady) return;
    const geojson = {
      type: "Feature",
      geometry: { type: "LineString", coordinates },
    };
    const pathSource = map.current.getSource("employee-path");
    if (pathSource) {
      pathSource.setData(geojson);
    } else {
      map.current.addSource("employee-path", {
        type: "geojson",
        data: geojson,
      });
      map.current.addLayer({
        id: "employee-path-layer",
        type: "line",
        source: "employee-path",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ff4500",
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });
    }
  };

  // Helper to avoid too many API calls for geocoding
  const shouldLogNewLocation = (newLocation) => {
    if (!lastLoggedLocation.current) return true;
    const p1 = new maptilersdk.LngLat(
      lastLoggedLocation.current.lng,
      lastLoggedLocation.current.lat
    );
    const p2 = new maptilersdk.LngLat(newLocation.lng, newLocation.lat);
    return p1.distanceTo(p2) > 200;
  };

  // PDF Download Handler
  const handleDownload = () => {
    // This function remains the same
  };

  return (
    <Container
      fluid
      className="p-3 p-md-4"
      style={{ backgroundColor: "#f0f2f5", minHeight: "100vh" }}
    >
      <Row>
        <Col xl={3} lg={4} className="mb-4 mb-lg-0">
          <Card className="shadow-sm mb-4">
            <Card.Header className="d-flex align-items-center">
              <Button
                variant="link"
                onClick={() => navigate("/dashboard")}
                className="p-0 me-2 text-decoration-none"
              >
                {" "}
                &larr; Back{" "}
              </Button>
              <strong>Employee Details</strong>
            </Card.Header>
            <Card.Body className="text-center">
              {employee ? (
                <>
                  <PersonCircle size={60} className="text-secondary mb-2" />
                  <Card.Title>{employee.name || employeeId}</Card.Title>
                  <Card.Text className="text-muted">
                    {employee.role || "Field Employee"}
                  </Card.Text>
                  <hr />
                  <Badge
                    bg={employee.isTrackingLive ? "success" : "secondary"}
                    className="w-100 p-2 fs-6"
                  >
                    {employee.isTrackingLive ? "LIVE" : "OFFLINE"}
                  </Badge>
                  {employee.isTrackingLive && lastUpdated && (
                    <small className="text-muted d-block mt-2">
                      Last updated: {lastUpdated}
                    </small>
                  )}
                </>
              ) : (
                <div className="text-center p-3">
                  <Placeholder as={Card.Text} animation="glow">
                    <Placeholder xs={12} />
                  </Placeholder>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="shadow-sm">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <strong>Statistics</strong>
              <Download
                role="button"
                className="text-muted"
                onClick={handleDownload}
              />
            </Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <ArrowsAngleExpand className="me-2 text-primary" /> Total
                Distance
                <span className="float-end fw-bold">
                  {totalDistance.toFixed(2)} km
                </span>
              </ListGroup.Item>
            </ListGroup>
          </Card>
        </Col>

        <Col xl={9} lg={8}>
          <Row>
            <Col xs={12} className="mb-4 position-relative">
              {/* --- NEW: Alert for offline status --- */}
              {employee && !employee.isTrackingLive && (
                <Alert
                  variant="warning"
                  className="position-absolute w-auto"
                  style={{ top: "10px", left: "10px", zIndex: 1000 }}
                >
                  <WifiOff className="me-2" /> Employee has ended their session.
                  Showing last known location.
                </Alert>
              )}
              <div
                ref={mapContainer}
                style={{
                  width: "100%",
                  height: "55vh",
                  borderRadius: "0.75rem",
                }}
                className="shadow-sm"
              />
            </Col>
            <Col xs={12}>
              <Card className="shadow-sm">
                <Card.Header as="h5">
                  <ClockHistory className="me-2" /> Activity Log
                </Card.Header>
                <ListGroup
                  variant="flush"
                  style={{ maxHeight: "26vh", overflowY: "auto" }}
                >
                  {liveLog.length > 0 ? (
                    liveLog.map((log, index) => (
                      <ListGroup.Item key={index}>
                        <strong>{log.time}:</strong> {log.location}
                      </ListGroup.Item>
                    ))
                  ) : (
                    <ListGroup.Item className="text-center text-muted p-4">
                      Waiting for employee to start moving... Log will appear
                      here.
                    </ListGroup.Item>
                  )}
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
