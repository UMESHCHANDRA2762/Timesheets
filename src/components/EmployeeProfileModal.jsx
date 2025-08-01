import React from "react";
import { Modal, Button, Badge } from "react-bootstrap";
import { PersonCircle, Envelope, Map, Bell, PencilSquare } from "react-bootstrap-icons";

const EmployeeProfileModal = ({ show, employee, onHide, onTrack }) => {
  if (!employee) return null;

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      className="profile-modal-glass"
      aria-labelledby="employee-profile-modal"
    >
      <Modal.Header closeButton className="border-0 pb-2">
        <Modal.Title id="employee-profile-modal" className="d-flex align-items-center gap-3 fw-bold fs-4 text-primary">
          <PersonCircle size={50} />
          {employee.name}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="text-secondary">
        <div className="mb-3 d-flex align-items-center gap-2 flex-wrap">
          <Badge
            bg={employee.isTrackingLive ? "success" : "secondary"}
            className="status-badge d-flex align-items-center gap-1"
          >
            {employee.isTrackingLive ? "Live" : "Offline"} <Map />
          </Badge>
          {employee.role && (
            <Badge bg="info" text="dark" className="employee-role fs-6">
              {employee.role}
            </Badge>
          )}
        </div>

        <div className="mb-3 d-flex align-items-center gap-2">
          <Envelope className="text-primary" />
          <a href={`mailto:${employee.email}`} className="text-decoration-none text-secondary">
            {employee.email}
          </a>
        </div>

        {employee.lastSeen && (
          <div className="mb-3 fst-italic text-muted small">
            Last seen: {new Date(employee.lastSeen).toLocaleString()}
          </div>
        )}

        {employee.location && (
          <div className="mb-3">
            <strong>Location:</strong> {employee.location}
          </div>
        )}

        {/* Future Extensible Info here */}
      </Modal.Body>

      <Modal.Footer className="border-0 pt-2">
        <Button variant="outline-primary" className="d-flex align-items-center gap-2" onClick={onTrack}>
          <Map /> Track Location
        </Button>
        <Button
          variant="outline-success"
          className="d-flex align-items-center gap-2"
          onClick={() => alert("Edit feature coming soon!")}
        >
          <PencilSquare /> Edit Profile
        </Button>
        <Button
          variant="outline-warning"
          className="d-flex align-items-center gap-2"
          onClick={() => alert("Notification sent!")}
        >
          <Bell /> Send Notification
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EmployeeProfileModal;
