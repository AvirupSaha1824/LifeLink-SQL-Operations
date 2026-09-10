import {
  boolean,
  date,
  double,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const portalAccounts = mysqlTable(
  "portalAccounts",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    fullName: varchar("fullName", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 48 }),
    role: mysqlEnum("role", ["patient", "hospital", "ambulance", "admin"])
      .default("patient")
      .notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedInAt: timestamp("lastSignedInAt"),
  },
  table => [
    uniqueIndex("portal_accounts_email_unique").on(table.email),
    index("portal_accounts_role_idx").on(table.role),
  ]
);

export const registeredPatients = mysqlTable(
  "registeredPatients",
  {
    id: int("id").autoincrement().primaryKey(),
    accountId: int("accountId")
      .references(() => portalAccounts.id, { onDelete: "cascade" })
      .notNull(),
    dateOfBirth: date("dateOfBirth"),
    bloodGroup: mysqlEnum("bloodGroup", [
      "A+",
      "A-",
      "B+",
      "B-",
      "AB+",
      "AB-",
      "O+",
      "O-",
    ]),
    address: varchar("address", { length: 500 }),
    city: varchar("city", { length: 120 }),
    state: varchar("state", { length: 120 }),
    emergencyContactName: varchar("emergencyContactName", { length: 160 }),
    emergencyContactPhone: varchar("emergencyContactPhone", { length: 48 }),
    allergies: text("allergies"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("registered_patients_account_unique").on(table.accountId),
    index("registered_patients_city_idx").on(table.city),
  ]
);

export const careHospitals = mysqlTable(
  "careHospitals",
  {
    id: int("id").autoincrement().primaryKey(),
    accountId: int("accountId").references(() => portalAccounts.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 180 }).notNull(),
    licenseNumber: varchar("licenseNumber", { length: 100 }),
    address: varchar("address", { length: 500 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    state: varchar("state", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 48 }).notNull(),
    emergencyPhone: varchar("emergencyPhone", { length: 48 }),
    isVerified: boolean("isVerified").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("care_hospitals_account_unique").on(table.accountId),
    index("care_hospitals_city_idx").on(table.city),
  ]
);

export const hospitalBeds = mysqlTable(
  "hospitalBeds",
  {
    id: int("id").autoincrement().primaryKey(),
    hospitalId: int("hospitalId")
      .references(() => careHospitals.id, { onDelete: "cascade" })
      .notNull(),
    ward: varchar("ward", { length: 120 }).notNull(),
    bedType: mysqlEnum("bedType", [
      "general",
      "icu",
      "nicu",
      "picu",
      "emergency",
      "ventilator",
    ]).notNull(),
    totalBeds: int("totalBeds").notNull(),
    occupiedBeds: int("occupiedBeds").default(0).notNull(),
    reservedBeds: int("reservedBeds").default(0).notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("hospital_beds_unique").on(
      table.hospitalId,
      table.ward,
      table.bedType
    ),
    index("hospital_beds_type_idx").on(table.bedType),
  ]
);

export const patientHospitalRecords = mysqlTable(
  "patientHospitalRecords",
  {
    id: int("id").autoincrement().primaryKey(),
    patientId: int("patientId")
      .references(() => registeredPatients.id, { onDelete: "cascade" })
      .notNull(),
    hospitalId: int("hospitalId")
      .references(() => careHospitals.id, { onDelete: "restrict" })
      .notNull(),
    createdByAccountId: int("createdByAccountId")
      .references(() => portalAccounts.id, { onDelete: "restrict" })
      .notNull(),
    recordType: mysqlEnum("recordType", [
      "admission",
      "discharge",
      "diagnostic",
      "treatment",
      "prescription",
      "note",
    ]).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    details: text("details").notNull(),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("patient_records_patient_idx").on(table.patientId),
    index("patient_records_hospital_idx").on(table.hospitalId),
    index("patient_records_recorded_idx").on(table.recordedAt),
  ]
);

export const ambulanceProviders = mysqlTable(
  "ambulanceProviders",
  {
    id: int("id").autoincrement().primaryKey(),
    accountId: int("accountId").references(() => portalAccounts.id, {
      onDelete: "set null",
    }),
    providerName: varchar("providerName", { length: 180 }).notNull(),
    vehicleNumber: varchar("vehicleNumber", { length: 40 }).notNull(),
    driverPhone: varchar("driverPhone", { length: 48 }).notNull(),
    currentCity: varchar("currentCity", { length: 120 }).notNull(),
    latitude: double("latitude"),
    longitude: double("longitude"),
    status: mysqlEnum("status", ["available", "assigned", "offline"])
      .default("available")
      .notNull(),
    isVerified: boolean("isVerified").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("ambulance_vehicle_unique").on(table.vehicleNumber),
    uniqueIndex("ambulance_account_unique").on(table.accountId),
    index("ambulance_city_status_idx").on(table.currentCity, table.status),
  ]
);

export const ambulanceRequests = mysqlTable(
  "ambulanceRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    referenceCode: varchar("referenceCode", { length: 40 }).notNull(),
    patientId: int("patientId")
      .references(() => registeredPatients.id, { onDelete: "restrict" })
      .notNull(),
    providerId: int("providerId").references(() => ambulanceProviders.id, {
      onDelete: "set null",
    }),
    destinationHospitalId: int("destinationHospitalId").references(
      () => careHospitals.id,
      { onDelete: "set null" }
    ),
    pickupAddress: varchar("pickupAddress", { length: 500 }).notNull(),
    pickupCity: varchar("pickupCity", { length: 120 }).notNull(),
    emergencyLevel: mysqlEnum("emergencyLevel", [
      "standard",
      "urgent",
      "critical",
    ])
      .default("urgent")
      .notNull(),
    status: mysqlEnum("status", [
      "requested",
      "assigned",
      "en_route",
      "arrived",
      "completed",
      "cancelled",
    ])
      .default("requested")
      .notNull(),
    notes: text("notes"),
    requestedAt: timestamp("requestedAt").defaultNow().notNull(),
    acceptedAt: timestamp("acceptedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("ambulance_requests_reference_unique").on(table.referenceCode),
    index("ambulance_requests_patient_idx").on(table.patientId),
    index("ambulance_requests_status_idx").on(table.status),
  ]
);

export const portalAuditEvents = mysqlTable(
  "portalAuditEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    actorAccountId: int("actorAccountId").references(() => portalAccounts.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: int("entityId"),
    outcome: mysqlEnum("outcome", ["success", "denied", "failed"])
      .default("success")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("portal_audit_actor_idx").on(table.actorAccountId),
    index("portal_audit_created_idx").on(table.createdAt),
  ]
);

export type PortalAccount = typeof portalAccounts.$inferSelect;
export type RegisteredPatient = typeof registeredPatients.$inferSelect;
export type CareHospital = typeof careHospitals.$inferSelect;
export type HospitalBed = typeof hospitalBeds.$inferSelect;
export type PatientHospitalRecord = typeof patientHospitalRecords.$inferSelect;
export type AmbulanceProvider = typeof ambulanceProviders.$inferSelect;
export type AmbulanceRequest = typeof ambulanceRequests.$inferSelect;
