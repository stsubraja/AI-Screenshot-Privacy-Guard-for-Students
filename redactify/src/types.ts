export enum PIIType {
  PHONE = "phone",
  EMAIL = "email",
  STUDENT_ID = "student_id",
  ADDRESS = "address",
  NAME = "name",
  CREDIT_CARD = "credit_card",
  SSN = "ssn",
  PASSWORD = "password",
  IP_ADDRESS = "ip_address",
  USERNAME = "username",
  OTHER = "other"
}

export interface BoundingBox {
  ymin: number; // 0-1000
  xmin: number; // 0-1000
  ymax: number; // 0-1000
  xmax: number; // 0-1000
}

export interface PIIDetection {
  id: string;
  type: PIIType;
  text: string;
  box: BoundingBox;
  redacted: boolean;
}

export interface ScanResult {
  detections: PIIDetection[];
  riskScore: "Low" | "Medium" | "High";
  summary: string;
}
