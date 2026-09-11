import { promisify } from "node:util";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { and, desc, eq, like, or } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";
import {
  ambulanceProviders,
  ambulanceRequests,
  careHospitals,
  hospitalBeds,
  patientHospitalRecords,
  portalAccounts,
  portalAuditEvents,
  registeredPatients,
  type PortalAccount,
} from "../../drizzle/operationsSchema";

const SESSION_COOKIE = "lifelink_portal_session";
const scrypt = promisify(scryptCallback);
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const roles = ["patient", "hospital", "ambulance"] as const;
const ambulanceStatuses = [
  "requested",
  "assigned",
  "en_route",
  "arrived",
  "completed",
  "cancelled",
] as const;

function database() {
  return getDb().then(db => {
    if (!db)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Database is not configured. Add DATABASE_URL and run the migrations.",
      });
    return db;
  });
}

function jwtKey() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "JWT_SECRET must contain at least 32 characters.",
    });
  return new TextEncoder().encode(value);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function cookieValue(cookieHeader: string | undefined, name: string) {
  return cookieHeader
    ?.split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function createSession(account: PortalAccount) {
  return new SignJWT({ role: account.role, email: account.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(account.id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtKey());
}

async function requireAccount(ctx: { req: { headers: { cookie?: string } } }) {
  const token = cookieValue(ctx.req.headers.cookie, SESSION_COOKIE);
  if (!token)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Please sign in to continue.",
    });
  try {
    const verified = await jwtVerify(token, jwtKey(), {
      algorithms: ["HS256"],
    });
    const accountId = Number(verified.payload.sub);
    if (!Number.isInteger(accountId)) throw new Error("Invalid subject");
    const db = await database();
    const rows = await db
      .select()
      .from(portalAccounts)
      .where(
        and(eq(portalAccounts.id, accountId), eq(portalAccounts.isActive, true))
      )
      .limit(1);
    if (!rows[0]) throw new Error("Account unavailable");
    return rows[0];
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Your session has expired. Please sign in again.",
    });
  }
}

async function audit(
  actorAccountId: number | null,
  action: string,
  entityType: string,
  entityId?: number,
  outcome: "success" | "denied" | "failed" = "success"
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(portalAuditEvents)
    .values({
      actorAccountId,
      action,
      entityType,
      entityId: entityId ?? null,
      outcome,
    });
}

async function patientForAccount(accountId: number) {
  const db = await database();
  const rows = await db
    .select()
    .from(registeredPatients)
    .where(eq(registeredPatients.accountId, accountId))
    .limit(1);
  return rows[0];
}

async function hospitalForAccount(accountId: number) {
  const db = await database();
  const rows = await db
    .select()
    .from(careHospitals)
    .where(eq(careHospitals.accountId, accountId))
    .limit(1);
  return rows[0];
}

async function ambulanceForAccount(accountId: number) {
  const db = await database();
  const rows = await db
    .select()
    .from(ambulanceProviders)
    .where(eq(ambulanceProviders.accountId, accountId))
    .limit(1);
  return rows[0];
}

const registrationInput = z.object({
  role: z.enum(roles),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Use at least one uppercase letter")
    .regex(/[a-z]/, "Use at least one lowercase letter")
    .regex(/[0-9]/, "Use at least one number"),
  phone: z.string().trim().min(7).max(48),
  bloodGroup: z.enum(bloodGroups).optional(),
  dateOfBirth: z.string().date().optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  organizationName: z.string().trim().max(180).optional(),
  licenseNumber: z.string().trim().max(100).optional(),
  vehicleNumber: z.string().trim().max(40).optional(),
});

export const operationsRouter = router({
  auth: router({
    register: publicProcedure
      .input(registrationInput)
      .mutation(async ({ input, ctx }) => {
        const db = await database();
        const email = input.email.toLowerCase();
        const existing = await db
          .select({ id: portalAccounts.id })
          .from(portalAccounts)
          .where(eq(portalAccounts.email, email))
          .limit(1);
        if (existing[0])
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account already exists for this email.",
          });
        if (input.role === "hospital" && !input.organizationName)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Hospital name is required.",
          });
        if (
          input.role === "ambulance" &&
          (!input.organizationName || !input.vehicleNumber)
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Provider and vehicle details are required.",
          });

        const passwordHash = await hashPassword(input.password);
        await db
          .insert(portalAccounts)
          .values({
            email,
            passwordHash,
            fullName: input.fullName,
            phone: input.phone,
            role: input.role,
          });
        const account = (
          await db
            .select()
            .from(portalAccounts)
            .where(eq(portalAccounts.email, email))
            .limit(1)
        )[0];
        if (!account)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Account creation failed.",
          });

        if (input.role === "patient") {
          await db
            .insert(registeredPatients)
            .values({
              accountId: account.id,
              bloodGroup: input.bloodGroup ?? null,
              dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
              address: input.address ?? null,
              city: input.city,
              state: input.state,
            });
        } else if (input.role === "hospital") {
          await db
            .insert(careHospitals)
            .values({
              accountId: account.id,
              name: input.organizationName!,
              licenseNumber: input.licenseNumber ?? null,
              address: input.address ?? `${input.city}, ${input.state}`,
              city: input.city,
              state: input.state,
              phone: input.phone,
              emergencyPhone: input.phone,
            });
        } else {
          await db
            .insert(ambulanceProviders)
            .values({
              accountId: account.id,
              providerName: input.organizationName!,
              vehicleNumber: input.vehicleNumber!,
              driverPhone: input.phone,
              currentCity: input.city,
            });
        }

        const token = await createSession(account);
        ctx.res.cookie(SESSION_COOKIE, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        await audit(
          account.id,
          "account.register",
          "portalAccount",
          account.id
        );
        return {
          id: account.id,
          fullName: account.fullName,
          email: account.email,
          role: account.role,
        };
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email(),
          password: z.string().min(1).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await database();
        const account = (
          await db
            .select()
            .from(portalAccounts)
            .where(eq(portalAccounts.email, input.email.toLowerCase()))
            .limit(1)
        )[0];
        if (
          !account ||
          !account.isActive ||
          !(await verifyPassword(input.password, account.passwordHash))
        ) {
          await audit(
            account?.id ?? null,
            "account.login",
            "portalAccount",
            account?.id,
            "denied"
          );
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Incorrect email or password.",
          });
        }
        await db
          .update(portalAccounts)
          .set({ lastSignedInAt: new Date() })
          .where(eq(portalAccounts.id, account.id));
        const token = await createSession(account);
        ctx.res.cookie(SESSION_COOKIE, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        await audit(account.id, "account.login", "portalAccount", account.id);
        return {
          id: account.id,
          fullName: account.fullName,
          email: account.email,
          role: account.role,
        };
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const token = cookieValue(ctx.req.headers.cookie, SESSION_COOKIE);
      let accountId: number | null = null;
      if (token)
        try {
          accountId =
            Number((await jwtVerify(token, jwtKey())).payload.sub) || null;
        } catch {
          /* expired token */
        }
      ctx.res.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      await audit(
        accountId,
        "account.logout",
        "portalAccount",
        accountId ?? undefined
      );
      return { success: true as const };
    }),
    me: publicProcedure.query(async ({ ctx }) => {
      const account = await requireAccount(ctx);
      const [patient, hospital, ambulance] = await Promise.all([
        patientForAccount(account.id),
        hospitalForAccount(account.id),
        ambulanceForAccount(account.id),
      ]);
      return {
        account: {
          id: account.id,
          email: account.email,
          fullName: account.fullName,
          phone: account.phone,
          role: account.role,
        },
        patient: patient ?? null,
        hospital: hospital ?? null,
        ambulance: ambulance ?? null,
      };
    }),
  }),

  patients: router({
    updateProfile: publicProcedure
      .input(
        z.object({
          dateOfBirth: z.string().date().nullable().optional(),
          bloodGroup: z.enum(bloodGroups).nullable().optional(),
          address: z.string().trim().max(500).nullable().optional(),
          city: z.string().trim().max(120).nullable().optional(),
          state: z.string().trim().max(120).nullable().optional(),
          emergencyContactName: z
            .string()
            .trim()
            .max(160)
            .nullable()
            .optional(),
          emergencyContactPhone: z
            .string()
            .trim()
            .max(48)
            .nullable()
            .optional(),
          allergies: z.string().trim().max(2000).nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const account = await requireAccount(ctx);
        if (account.role !== "patient" && account.role !== "admin")
          throw new TRPCError({ code: "FORBIDDEN" });
        const patient = await patientForAccount(account.id);
        if (!patient)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Patient profile not found.",
          });
        const db = await database();
        const { dateOfBirth, ...rest } = input;
        const update = {
          ...rest,
          ...(dateOfBirth !== undefined
            ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }
            : {}),
        };
        await db
          .update(registeredPatients)
          .set(update)
          .where(eq(registeredPatients.id, patient.id));
        await audit(
          account.id,
          "patient.update",
          "registeredPatient",
          patient.id
        );
        return { success: true as const };
      }),
  }),

  hospitals: router({
    list: publicProcedure
      .input(
        z.object({ query: z.string().trim().max(120).optional() }).default({})
      )
      .query(async ({ input, ctx }) => {
        await requireAccount(ctx);
        const db = await database();
        const pattern = input.query ? `%${input.query}%` : undefined;
        return db
          .select()
          .from(careHospitals)
          .where(
            pattern
              ? or(
                  like(careHospitals.name, pattern),
                  like(careHospitals.city, pattern),
                  like(careHospitals.state, pattern)
                )
              : undefined
          )
          .orderBy(careHospitals.name);
      }),
    records: publicProcedure.query(async ({ ctx }) => {
      const account = await requireAccount(ctx);
      const db = await database();
      if (account.role === "patient") {
        const patient = await patientForAccount(account.id);
        if (!patient) return [];
        return db
          .select({
            id: patientHospitalRecords.id,
            recordType: patientHospitalRecords.recordType,
            title: patientHospitalRecords.title,
            details: patientHospitalRecords.details,
            recordedAt: patientHospitalRecords.recordedAt,
            hospitalName: careHospitals.name,
          })
          .from(patientHospitalRecords)
          .innerJoin(
            careHospitals,
            eq(patientHospitalRecords.hospitalId, careHospitals.id)
          )
          .where(eq(patientHospitalRecords.patientId, patient.id))
          .orderBy(desc(patientHospitalRecords.recordedAt));
      }
      if (account.role !== "hospital" && account.role !== "admin")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Hospital records are not available to this role.",
        });
      const hospital =
        account.role === "hospital"
          ? await hospitalForAccount(account.id)
          : null;
      if (account.role === "hospital" && !hospital)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hospital profile not found.",
        });
      return db
        .select({
          id: patientHospitalRecords.id,
          patientId: patientHospitalRecords.patientId,
          recordType: patientHospitalRecords.recordType,
          title: patientHospitalRecords.title,
          details: patientHospitalRecords.details,
          recordedAt: patientHospitalRecords.recordedAt,
          hospitalName: careHospitals.name,
        })
        .from(patientHospitalRecords)
        .innerJoin(
          careHospitals,
          eq(patientHospitalRecords.hospitalId, careHospitals.id)
        )
        .where(
          hospital
            ? eq(patientHospitalRecords.hospitalId, hospital.id)
            : undefined
        )
        .orderBy(desc(patientHospitalRecords.recordedAt));
    }),
    addRecord: publicProcedure
      .input(
        z.object({
          patientId: z.number().int().positive(),
          recordType: z.enum([
            "admission",
            "discharge",
            "diagnostic",
            "treatment",
            "prescription",
            "note",
          ]),
          title: z.string().trim().min(2).max(200),
          details: z.string().trim().min(2).max(5000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const account = await requireAccount(ctx);
        if (account.role !== "hospital" && account.role !== "admin")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only hospital staff can add records.",
          });
        const hospital = await hospitalForAccount(account.id);
        if (!hospital)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Hospital profile not found.",
          });
        const db = await database();
        await db
          .insert(patientHospitalRecords)
          .values({
            ...input,
            hospitalId: hospital.id,
            createdByAccountId: account.id,
          });
        await audit(
          account.id,
          "hospitalRecord.create",
          "patientHospitalRecord"
        );
        return { success: true as const };
      }),
  }),

  beds: router({
    list: publicProcedure
      .input(
        z
          .object({
            city: z.string().trim().max(120).optional(),
            bedType: z
              .enum([
                "general",
                "icu",
                "nicu",
                "picu",
                "emergency",
                "ventilator",
              ])
              .optional(),
          })
          .default({})
      )
      .query(async ({ input, ctx }) => {
        await requireAccount(ctx);
        const db = await database();
        const conditions = [
          input.city ? like(careHospitals.city, `%${input.city}%`) : undefined,
          input.bedType ? eq(hospitalBeds.bedType, input.bedType) : undefined,
        ].filter(Boolean) as any[];
        const rows = await db
          .select({
            id: hospitalBeds.id,
            hospitalId: careHospitals.id,
            hospitalName: careHospitals.name,
            city: careHospitals.city,
            state: careHospitals.state,
            phone: careHospitals.phone,
            ward: hospitalBeds.ward,
            bedType: hospitalBeds.bedType,
            totalBeds: hospitalBeds.totalBeds,
            occupiedBeds: hospitalBeds.occupiedBeds,
            reservedBeds: hospitalBeds.reservedBeds,
            lastVerifiedAt: hospitalBeds.lastVerifiedAt,
          })
          .from(hospitalBeds)
          .innerJoin(
            careHospitals,
            eq(hospitalBeds.hospitalId, careHospitals.id)
          )
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(careHospitals.name, hospitalBeds.bedType);
        return rows.map(row => ({
          ...row,
          availableBeds: Math.max(
            0,
            row.totalBeds - row.occupiedBeds - row.reservedBeds
          ),
        }));
      }),
    upsert: publicProcedure
      .input(
        z
          .object({
            ward: z.string().trim().min(1).max(120),
            bedType: z.enum([
              "general",
              "icu",
              "nicu",
              "picu",
              "emergency",
              "ventilator",
            ]),
            totalBeds: z.number().int().min(0).max(10000),
            occupiedBeds: z.number().int().min(0).max(10000),
            reservedBeds: z.number().int().min(0).max(10000),
          })
          .refine(
            value => value.occupiedBeds + value.reservedBeds <= value.totalBeds,
            "Occupied and reserved beds cannot exceed total beds."
          )
      )
      .mutation(async ({ input, ctx }) => {
        const account = await requireAccount(ctx);
        if (account.role !== "hospital" && account.role !== "admin")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only hospital staff can update beds.",
          });
        const hospital = await hospitalForAccount(account.id);
        if (!hospital)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Hospital profile not found.",
          });
        const db = await database();
        await db
          .insert(hospitalBeds)
          .values({
            hospitalId: hospital.id,
            ...input,
            lastVerifiedAt: new Date(),
          })
          .onDuplicateKeyUpdate({
            set: {
              totalBeds: input.totalBeds,
              occupiedBeds: input.occupiedBeds,
              reservedBeds: input.reservedBeds,
              lastVerifiedAt: new Date(),
            },
          });
        await audit(account.id, "beds.upsert", "hospitalBed");
        return { success: true as const };
      }),
  }),

  ambulances: router({
    providers: publicProcedure
      .input(
        z.object({ city: z.string().trim().max(120).optional() }).default({})
      )
      .query(async ({ input, ctx }) => {
        await requireAccount(ctx);
        const db = await database();
        return db
          .select()
          .from(ambulanceProviders)
          .where(
            input.city
              ? like(ambulanceProviders.currentCity, `%${input.city}%`)
              : undefined
          )
          .orderBy(
            desc(ambulanceProviders.status),
            ambulanceProviders.providerName
          );
      }),
    requests: publicProcedure.query(async ({ ctx }) => {
      const account = await requireAccount(ctx);
      const db = await database();
      if (account.role === "patient") {
        const patient = await patientForAccount(account.id);
        if (!patient) return [];
        return db
          .select()
          .from(ambulanceRequests)
          .where(eq(ambulanceRequests.patientId, patient.id))
          .orderBy(desc(ambulanceRequests.requestedAt));
      }
      if (account.role === "ambulance") {
        const provider = await ambulanceForAccount(account.id);
        if (!provider) return [];
        return db
          .select()
          .from(ambulanceRequests)
          .where(
            or(
              eq(ambulanceRequests.providerId, provider.id),
              eq(ambulanceRequests.status, "requested")
            )
          )
          .orderBy(desc(ambulanceRequests.requestedAt));
      }
      if (account.role === "hospital") {
        const hospital = await hospitalForAccount(account.id);
        if (!hospital) return [];
        return db
          .select()
          .from(ambulanceRequests)
          .where(eq(ambulanceRequests.destinationHospitalId, hospital.id))
          .orderBy(desc(ambulanceRequests.requestedAt));
      }
      if (account.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return db
        .select()
        .from(ambulanceRequests)
        .orderBy(desc(ambulanceRequests.requestedAt));
    }),
    request: publicProcedure
      .input(
        z.object({
          pickupAddress: z.string().trim().min(5).max(500),
          pickupCity: z.string().trim().min(2).max(120),
          destinationHospitalId: z
            .number()
            .int()
            .positive()
            .nullable()
            .optional(),
          emergencyLevel: z.enum(["standard", "urgent", "critical"]),
          notes: z.string().trim().max(2000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const account = await requireAccount(ctx);
        if (account.role !== "patient")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only a patient account can request an ambulance.",
          });
        const patient = await patientForAccount(account.id);
        if (!patient)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Patient profile not found.",
          });
        const db = await database();
        const referenceCode = `AMB-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
        await db
          .insert(ambulanceRequests)
          .values({
            ...input,
            destinationHospitalId: input.destinationHospitalId ?? null,
            patientId: patient.id,
            referenceCode,
          });
        const request = (
          await db
            .select()
            .from(ambulanceRequests)
            .where(eq(ambulanceRequests.referenceCode, referenceCode))
            .limit(1)
        )[0];
        await audit(
          account.id,
          "ambulance.request",
          "ambulanceRequest",
          request?.id
        );
        return { referenceCode };
      }),
    updateStatus: publicProcedure
      .input(
        z.object({
          requestId: z.number().int().positive(),
          status: z.enum(ambulanceStatuses),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const account = await requireAccount(ctx);
        if (account.role !== "ambulance" && account.role !== "admin")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only ambulance staff can update a request.",
          });
        const db = await database();
        const provider =
          account.role === "ambulance"
            ? await ambulanceForAccount(account.id)
            : null;
        if (account.role === "ambulance" && !provider)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Ambulance provider profile not found.",
          });
        const existing = (
          await db
            .select()
            .from(ambulanceRequests)
            .where(eq(ambulanceRequests.id, input.requestId))
            .limit(1)
        )[0];
        if (!existing)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Ambulance request not found.",
          });
        if (
          provider &&
          existing.providerId &&
          existing.providerId !== provider.id
        )
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This request is assigned to another provider.",
          });
        const update: Record<string, unknown> = { status: input.status };
        if (provider && input.status !== "requested")
          update.providerId = provider.id;
        if (input.status === "assigned") update.acceptedAt = new Date();
        if (input.status === "completed") update.completedAt = new Date();
        await db
          .update(ambulanceRequests)
          .set(update)
          .where(eq(ambulanceRequests.id, input.requestId));
        if (provider)
          await db
            .update(ambulanceProviders)
            .set({
              status:
                input.status === "completed" || input.status === "cancelled"
                  ? "available"
                  : "assigned",
            })
            .where(eq(ambulanceProviders.id, provider.id));
        await audit(
          account.id,
          "ambulance.status",
          "ambulanceRequest",
          input.requestId
        );
        return { success: true as const };
      }),
  }),
});
