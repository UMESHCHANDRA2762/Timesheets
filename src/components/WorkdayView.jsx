// src/components/WorkdayView.jsx

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, database } from "../firebase";
import { ref, update, push, serverTimestamp, set } from "firebase/database";
import { Container, Card, Spinner, Alert, Button } from "react-bootstrap";

const WorkdayView = () => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const watcherId = useRef(null);
  const navigate = useNavigate();

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

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    if (!user) {
      setError("User not found. Please log in again.");
      return;
    }

    // --- NEW: Create or update the employee's profile in the database ---
    const employeeRef = ref(database, `employees/${user.uid}`);
    const employeeName = user.email.split("@")[0]; // Get name from email as requested

    update(employeeRef, {
      email: user.email,
      name: employeeName,
    });

    // Ask for permission and start watching
    navigator.geolocation.getCurrentPosition(
      () => {
        setIsTracking(true);
        setStatus("Broadcasting live location...");
        setError(null);

        if (watcherId.current) {
          navigator.geolocation.clearWatch(watcherId.current);
        }

        watcherId.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const newLocation = {
              lat: latitude,
              lng: longitude,
              timestamp: serverTimestamp(),
            };

            const locationHistoryRef = ref(
              database,
              `employees/${user.uid}/locationHistory`
            );

            // Update current location and push to history
            update(employeeRef, {
              currentLocation: newLocation,
              isTrackingLive: true,
            });
            push(locationHistoryRef, newLocation);
          },
          (err) => {
            setError(`Location Error: ${err.message}`);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      },
      (err) => {
        setError(
          `Permission Denied: You must allow location access to start your day.`
        );
      }
    );
  };

  const stopTracking = () => {
    if (watcherId.current) {
      navigator.geolocation.clearWatch(watcherId.current);
    }
    if (user) {
      const employeeRef = ref(database, `employees/${user.uid}`);
      update(employeeRef, { isTrackingLive: false });
    }
    setIsTracking(false);
    setStatus("Tracking stopped. Logging out...");
    signOut(auth).then(() => navigate("/login"));
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (watcherId.current) {
        navigator.geolocation.clearWatch(watcherId.current);
      }
    };
  }, []);

  return (
    <Container
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: "100vh", backgroundColor: "#f0f2f5" }}
    >
      <Card style={{ width: "24rem" }} className="text-center shadow-lg">
        <Card.Header as="h5">Employee Workday</Card.Header>
        <Card.Body className="p-4">
          <Card.Title>
            Welcome, {user ? user.email.split("@")[0] : "Employee"}!
          </Card.Title>
          <Card.Text className="text-muted mb-4">{status}</Card.Text>

          {isTracking && (
            <Spinner animation="border" variant="primary" className="my-3" />
          )}

          {!isTracking && (
            <Button
              variant="primary"
              size="lg"
              className="w-100"
              onClick={startTracking}
            >
              Start Day
            </Button>
          )}

          {isTracking && (
            <Button
              variant="danger"
              size="lg"
              className="w-100 mt-3"
              onClick={stopTracking}
            >
              End Day & Log Out
            </Button>
          )}

          {error && (
            <Alert variant="danger" className="mt-3">
              {error}
            </Alert>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default WorkdayView;
