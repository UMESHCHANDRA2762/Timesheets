// src/components/Login.jsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, database } from "../firebase";
import { ref, get } from "firebase/database";
import { Container, Card, Form, Button, Spinner, Alert } from "react-bootstrap";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        const adminRef = ref(database, "admins/" + user.uid);

        get(adminRef).then((snapshot) => {
          setLoading(false);
          if (snapshot.exists()) {
            // User is an admin, send them to the new /dashboard route
            navigate("/dashboard");
          } else {
            // User is a regular employee
            navigate("/workday");
          }
        });
      })
      .catch((err) => {
        setLoading(false);
        setError(`Failed to log in: ${err.message}`);
      });
  };

  return (
    <Container
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: "80vh" }}
    >
      <Card style={{ width: "25rem" }} className="shadow-sm">
        <Card.Body className="p-4">
          <h2 className="text-center mb-4 fw-bold">Company Login</h2>
          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Email address</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formBasicPassword">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>

            {error && <Alert variant="danger">{error}</Alert>}

            <Button
              variant="primary"
              type="submit"
              className="w-100"
              disabled={loading}
            >
              {loading ? (
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                />
              ) : (
                "Log In"
              )}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Login;
