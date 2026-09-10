-- LifeLink operational schema for MySQL 8 / TiDB.
-- Apply this once to the same database referenced by DATABASE_URL.

CREATE TABLE IF NOT EXISTS `portalAccounts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `email` varchar(320) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `fullName` varchar(160) NOT NULL,
  `phone` varchar(48),
  `role` enum('patient','hospital','ambulance','admin') NOT NULL DEFAULT 'patient',
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedInAt` timestamp NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `portal_accounts_email_unique` (`email`),
  KEY `portal_accounts_role_idx` (`role`)
);

CREATE TABLE IF NOT EXISTS `registeredPatients` (
  `id` int AUTO_INCREMENT NOT NULL,
  `accountId` int NOT NULL,
  `dateOfBirth` date,
  `bloodGroup` enum('A+','A-','B+','B-','AB+','AB-','O+','O-'),
  `address` varchar(500),
  `city` varchar(120),
  `state` varchar(120),
  `emergencyContactName` varchar(160),
  `emergencyContactPhone` varchar(48),
  `allergies` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `registered_patients_account_unique` (`accountId`),
  KEY `registered_patients_city_idx` (`city`),
  CONSTRAINT `registered_patients_account_fk` FOREIGN KEY (`accountId`) REFERENCES `portalAccounts` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `careHospitals` (
  `id` int AUTO_INCREMENT NOT NULL,
  `accountId` int,
  `name` varchar(180) NOT NULL,
  `licenseNumber` varchar(100),
  `address` varchar(500) NOT NULL,
  `city` varchar(120) NOT NULL,
  `state` varchar(120) NOT NULL,
  `phone` varchar(48) NOT NULL,
  `emergencyPhone` varchar(48),
  `isVerified` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `care_hospitals_account_unique` (`accountId`),
  KEY `care_hospitals_city_idx` (`city`),
  CONSTRAINT `care_hospitals_account_fk` FOREIGN KEY (`accountId`) REFERENCES `portalAccounts` (`id`) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS `hospitalBeds` (
  `id` int AUTO_INCREMENT NOT NULL,
  `hospitalId` int NOT NULL,
  `ward` varchar(120) NOT NULL,
  `bedType` enum('general','icu','nicu','picu','emergency','ventilator') NOT NULL,
  `totalBeds` int NOT NULL,
  `occupiedBeds` int NOT NULL DEFAULT 0,
  `reservedBeds` int NOT NULL DEFAULT 0,
  `lastVerifiedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hospital_beds_unique` (`hospitalId`,`ward`,`bedType`),
  KEY `hospital_beds_type_idx` (`bedType`),
  CONSTRAINT `hospital_beds_hospital_fk` FOREIGN KEY (`hospitalId`) REFERENCES `careHospitals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `hospital_beds_counts_check` CHECK (`totalBeds` >= 0 AND `occupiedBeds` >= 0 AND `reservedBeds` >= 0 AND (`occupiedBeds` + `reservedBeds`) <= `totalBeds`)
);

CREATE TABLE IF NOT EXISTS `patientHospitalRecords` (
  `id` int AUTO_INCREMENT NOT NULL,
  `patientId` int NOT NULL,
  `hospitalId` int NOT NULL,
  `createdByAccountId` int NOT NULL,
  `recordType` enum('admission','discharge','diagnostic','treatment','prescription','note') NOT NULL,
  `title` varchar(200) NOT NULL,
  `details` text NOT NULL,
  `recordedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_records_patient_idx` (`patientId`),
  KEY `patient_records_hospital_idx` (`hospitalId`),
  KEY `patient_records_recorded_idx` (`recordedAt`),
  CONSTRAINT `patient_records_patient_fk` FOREIGN KEY (`patientId`) REFERENCES `registeredPatients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `patient_records_hospital_fk` FOREIGN KEY (`hospitalId`) REFERENCES `careHospitals` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `patient_records_creator_fk` FOREIGN KEY (`createdByAccountId`) REFERENCES `portalAccounts` (`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `ambulanceProviders` (
  `id` int AUTO_INCREMENT NOT NULL,
  `accountId` int,
  `providerName` varchar(180) NOT NULL,
  `vehicleNumber` varchar(40) NOT NULL,
  `driverPhone` varchar(48) NOT NULL,
  `currentCity` varchar(120) NOT NULL,
  `latitude` double,
  `longitude` double,
  `status` enum('available','assigned','offline') NOT NULL DEFAULT 'available',
  `isVerified` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ambulance_vehicle_unique` (`vehicleNumber`),
  UNIQUE KEY `ambulance_account_unique` (`accountId`),
  KEY `ambulance_city_status_idx` (`currentCity`,`status`),
  CONSTRAINT `ambulance_account_fk` FOREIGN KEY (`accountId`) REFERENCES `portalAccounts` (`id`) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS `ambulanceRequests` (
  `id` int AUTO_INCREMENT NOT NULL,
  `referenceCode` varchar(40) NOT NULL,
  `patientId` int NOT NULL,
  `providerId` int,
  `destinationHospitalId` int,
  `pickupAddress` varchar(500) NOT NULL,
  `pickupCity` varchar(120) NOT NULL,
  `emergencyLevel` enum('standard','urgent','critical') NOT NULL DEFAULT 'urgent',
  `status` enum('requested','assigned','en_route','arrived','completed','cancelled') NOT NULL DEFAULT 'requested',
  `notes` text,
  `requestedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `acceptedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ambulance_requests_reference_unique` (`referenceCode`),
  KEY `ambulance_requests_patient_idx` (`patientId`),
  KEY `ambulance_requests_status_idx` (`status`),
  CONSTRAINT `ambulance_requests_patient_fk` FOREIGN KEY (`patientId`) REFERENCES `registeredPatients` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ambulance_requests_provider_fk` FOREIGN KEY (`providerId`) REFERENCES `ambulanceProviders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ambulance_requests_hospital_fk` FOREIGN KEY (`destinationHospitalId`) REFERENCES `careHospitals` (`id`) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS `portalAuditEvents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `actorAccountId` int,
  `action` varchar(120) NOT NULL,
  `entityType` varchar(80) NOT NULL,
  `entityId` int,
  `outcome` enum('success','denied','failed') NOT NULL DEFAULT 'success',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `portal_audit_actor_idx` (`actorAccountId`),
  KEY `portal_audit_created_idx` (`createdAt`),
  CONSTRAINT `portal_audit_actor_fk` FOREIGN KEY (`actorAccountId`) REFERENCES `portalAccounts` (`id`) ON DELETE SET NULL
);
