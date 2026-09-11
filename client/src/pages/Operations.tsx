import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Ambulance,
  ArrowLeft,
  BedDouble,
  Building2,
  FileHeart,
  HeartPulse,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type Role = "patient" | "hospital" | "ambulance";
type Section = "overview" | "beds" | "records" | "ambulance" | "profile";
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const bedTypes = [
  "general",
  "icu",
  "nicu",
  "picu",
  "emergency",
  "ventilator",
] as const;

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-950/55 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400";
const areaClass =
  "mt-1 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950/55 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-400">
      {label}
      {children}
    </label>
  );
}

function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-xs leading-5 ${tone === "warning" ? "border-amber-300/20 bg-amber-300/[.07] text-amber-100/85" : "border-cyan-300/20 bg-cyan-300/[.06] text-cyan-100/80"}`}
    >
      {children}
    </div>
  );
}

export function AuthPanel() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    role: "patient" as Role,
    fullName: "",
    email: "",
    password: "",
    phone: "",
    bloodGroup: "B+",
    dateOfBirth: "",
    address: "",
    city: "Kolkata",
    state: "West Bengal",
    organizationName: "",
    licenseNumber: "",
    vehicleNumber: "",
  });
  const login = trpc.operations.auth.login.useMutation({
    onSuccess: async () => {
      await utils.operations.auth.me.invalidate();
      toast.success("Signed in successfully.");
    },
    onError: error => toast.error(error.message),
  });
  const register = trpc.operations.auth.register.useMutation({
    onSuccess: async () => {
      await utils.operations.auth.me.invalidate();
      toast.success("Account created.");
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "login")
      login.mutate({ email: form.email, password: form.password });
    else
      register.mutate({
        role: form.role,
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        bloodGroup:
          form.role === "patient" ? (form.bloodGroup as any) : undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        address: form.address || undefined,
        city: form.city,
        state: form.state,
        organizationName: form.organizationName || undefined,
        licenseNumber: form.licenseNumber || undefined,
        vehicleNumber: form.vehicleNumber || undefined,
      });
  };
  const pending = login.isPending || register.isPending;

  return (
    <div className="min-h-screen bg-[#080d1a] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to LifeLink
        </Link>
        <div className="mt-7 grid overflow-hidden rounded-2xl border border-slate-700/70 bg-[#101a31] shadow-2xl lg:grid-cols-[.85fr_1.15fr]">
          <div className="bg-gradient-to-br from-indigo-600/90 via-indigo-700/75 to-cyan-700/70 p-7 sm:p-10">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">
              <HeartPulse className="h-6 w-6" />
            </span>
            <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-cyan-100">
              LifeLink secure portal
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">
              Critical-care operations, connected.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-indigo-100/80">
              Register patients, publish hospital bed availability, maintain
              care records, and coordinate ambulance requests through one
              SQL-backed workflow.
            </p>
            <div className="mt-8 space-y-3 text-xs text-indigo-50/85">
              {[
                "Encrypted password authentication",
                "Role-scoped data operations",
                "Auditable status changes",
              ].map(item => (
                <p key={item} className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-200" /> {item}
                </p>
              ))}
            </div>
          </div>
          <form onSubmit={submit} className="p-6 sm:p-9">
            <div className="flex rounded-lg bg-slate-950/40 p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${mode === "login" ? "bg-indigo-500 text-white" : "text-slate-400"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${mode === "register" ? "bg-indigo-500 text-white" : "text-slate-400"}`}
              >
                Register
              </button>
            </div>
            <h2 className="mt-6 text-xl font-extrabold">
              {mode === "login" ? "Welcome back" : "Create portal account"}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {mode === "register" && (
                <>
                  <Field label="Portal role">
                    <select
                      className={inputClass}
                      value={form.role}
                      onChange={e =>
                        setForm({ ...form, role: e.target.value as Role })
                      }
                    >
                      <option value="patient">Patient</option>
                      <option value="hospital">Hospital staff</option>
                      <option value="ambulance">Ambulance team</option>
                    </select>
                  </Field>
                  <Field label="Full name">
                    <input
                      required
                      className={inputClass}
                      value={form.fullName}
                      onChange={e =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                    />
                  </Field>
                </>
              )}
              <Field label="Email">
                <input
                  required
                  type="email"
                  autoComplete="email"
                  className={inputClass}
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Password">
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  className={inputClass}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
                <span className="mt-1 block text-[10px] text-slate-600">
                  8+ characters with uppercase, lowercase and number
                </span>
              </Field>
              {mode === "register" && (
                <>
                  <Field label="Phone">
                    <input
                      required
                      className={inputClass}
                      value={form.phone}
                      onChange={e =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="City">
                    <input
                      required
                      className={inputClass}
                      value={form.city}
                      onChange={e => setForm({ ...form, city: e.target.value })}
                    />
                  </Field>
                  <Field label="State">
                    <input
                      required
                      className={inputClass}
                      value={form.state}
                      onChange={e =>
                        setForm({ ...form, state: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Address">
                    <input
                      className={inputClass}
                      value={form.address}
                      onChange={e =>
                        setForm({ ...form, address: e.target.value })
                      }
                    />
                  </Field>
                  {form.role === "patient" && (
                    <>
                      <Field label="Blood group">
                        <select
                          className={inputClass}
                          value={form.bloodGroup}
                          onChange={e =>
                            setForm({ ...form, bloodGroup: e.target.value })
                          }
                        >
                          {bloodGroups.map(group => (
                            <option key={group}>{group}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Date of birth">
                        <input
                          type="date"
                          className={inputClass}
                          value={form.dateOfBirth}
                          onChange={e =>
                            setForm({ ...form, dateOfBirth: e.target.value })
                          }
                        />
                      </Field>
                    </>
                  )}
                  {form.role !== "patient" && (
                    <>
                      <Field
                        label={
                          form.role === "hospital"
                            ? "Hospital name"
                            : "Provider name"
                        }
                      >
                        <input
                          required
                          className={inputClass}
                          value={form.organizationName}
                          onChange={e =>
                            setForm({
                              ...form,
                              organizationName: e.target.value,
                            })
                          }
                        />
                      </Field>
                      {form.role === "hospital" ? (
                        <Field label="License number">
                          <input
                            className={inputClass}
                            value={form.licenseNumber}
                            onChange={e =>
                              setForm({
                                ...form,
                                licenseNumber: e.target.value,
                              })
                            }
                          />
                        </Field>
                      ) : (
                        <Field label="Vehicle number">
                          <input
                            required
                            className={inputClass}
                            value={form.vehicleNumber}
                            onChange={e =>
                              setForm({
                                ...form,
                                vehicleNumber: e.target.value,
                              })
                            }
                          />
                        </Field>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            {mode === "register" && (
              <div className="mt-4">
                <Notice tone="warning">
                  Hospital and ambulance accounts must be verified by an
                  administrator before handling real patient information. Keep
                  this deployment limited to demonstration data until security
                  and regulatory review is complete.
                </Notice>
              </div>
            )}
            <Button
              disabled={pending}
              className="mt-5 w-full bg-rose-500 font-bold hover:bg-rose-400"
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : mode === "register" ? (
                <UserPlus className="mr-2 h-4 w-4" />
              ) : null}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function BedPanel({ role }: { role: string }) {
  const utils = trpc.useUtils();
  const [city, setCity] = useState("");
  const [type, setType] = useState<"" | (typeof bedTypes)[number]>("");
  const [form, setForm] = useState({
    ward: "Critical Care",
    bedType: "icu" as (typeof bedTypes)[number],
    totalBeds: 10,
    occupiedBeds: 0,
    reservedBeds: 0,
  });
  const beds = trpc.operations.beds.list.useQuery({
    city: city || undefined,
    bedType: type || undefined,
  });
  const upsert = trpc.operations.beds.upsert.useMutation({
    onSuccess: async () => {
      await beds.refetch();
      toast.success("Bed availability updated.");
    },
    onError: error => toast.error(error.message),
  });
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold">Live bed availability</h2>
        <p className="mt-1 text-sm text-slate-500">
          Verified inventory is calculated as total minus occupied and reserved
          beds.
        </p>
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-700/70 bg-[#101a31] p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className={inputClass}
          placeholder="Filter city"
          value={city}
          onChange={e => setCity(e.target.value)}
        />
        <select
          className={inputClass}
          value={type}
          onChange={e => setType(e.target.value as any)}
        >
          <option value="">All bed types</option>
          {bedTypes.map(value => (
            <option key={value} value={value}>
              {value.toUpperCase()}
            </option>
          ))}
        </select>
        <Button
          onClick={() => void beds.refetch()}
          variant="outline"
          className="self-end border-slate-600"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>
      {role === "hospital" && (
        <form
          onSubmit={e => {
            e.preventDefault();
            upsert.mutate(form);
          }}
          className="grid gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[.05] p-4 sm:grid-cols-2 lg:grid-cols-6"
        >
          <Field label="Ward">
            <input
              className={inputClass}
              value={form.ward}
              onChange={e => setForm({ ...form, ward: e.target.value })}
            />
          </Field>
          <Field label="Bed type">
            <select
              className={inputClass}
              value={form.bedType}
              onChange={e =>
                setForm({ ...form, bedType: e.target.value as any })
              }
            >
              {bedTypes.map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          {(["totalBeds", "occupiedBeds", "reservedBeds"] as const).map(key => (
            <Field key={key} label={key.replace("Beds", " beds")}>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form[key]}
                onChange={e =>
                  setForm({ ...form, [key]: Number(e.target.value) })
                }
              />
            </Field>
          ))}
          <Button
            disabled={upsert.isPending}
            className="self-end bg-cyan-600 hover:bg-cyan-500"
          >
            Publish
          </Button>
        </form>
      )}
      {beds.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : beds.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {beds.data.map(bed => (
            <article
              key={bed.id}
              className="rounded-xl border border-slate-700/70 bg-[#111b32] p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{bed.hospitalName}</p>
                  <p className="text-xs text-slate-500">
                    {bed.city}, {bed.state} · {bed.ward}
                  </p>
                </div>
                <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-200">
                  {bed.availableBeds} available
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-lg font-bold">{bed.totalBeds}</p>
                  <p className="text-slate-600">Total</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{bed.occupiedBeds}</p>
                  <p className="text-slate-600">Occupied</p>
                </div>
                <div>
                  <p className="text-lg font-bold uppercase">{bed.bedType}</p>
                  <p className="text-slate-600">Type</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Notice>No matching bed records have been published.</Notice>
      )}
    </section>
  );
}

function RecordsPanel({ role }: { role: string }) {
  const records = trpc.operations.hospitals.records.useQuery();
  const [form, setForm] = useState({
    patientId: 1,
    recordType: "note" as
      | "admission"
      | "discharge"
      | "diagnostic"
      | "treatment"
      | "prescription"
      | "note",
    title: "",
    details: "",
  });
  const add = trpc.operations.hospitals.addRecord.useMutation({
    onSuccess: async () => {
      await records.refetch();
      setForm({ ...form, title: "", details: "" });
      toast.success("Hospital record saved.");
    },
    onError: error => toast.error(error.message),
  });
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold">Hospital records</h2>
        <p className="mt-1 text-sm text-slate-500">
          Patient accounts see their own records. Hospital accounts see records
          created by their facility.
        </p>
      </div>
      {role === "hospital" && (
        <form
          onSubmit={e => {
            e.preventDefault();
            add.mutate(form);
          }}
          className="grid gap-3 rounded-xl border border-violet-300/20 bg-violet-300/[.05] p-4 sm:grid-cols-2"
        >
          <Field label="Patient ID">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.patientId}
              onChange={e =>
                setForm({ ...form, patientId: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Record type">
            <select
              className={inputClass}
              value={form.recordType}
              onChange={e =>
                setForm({ ...form, recordType: e.target.value as any })
              }
            >
              {[
                "admission",
                "discharge",
                "diagnostic",
                "treatment",
                "prescription",
                "note",
              ].map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input
              required
              className={inputClass}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Details">
            <textarea
              required
              className={areaClass}
              value={form.details}
              onChange={e => setForm({ ...form, details: e.target.value })}
            />
          </Field>
          <Button
            disabled={add.isPending}
            className="bg-violet-600 hover:bg-violet-500 sm:col-span-2"
          >
            Save record
          </Button>
        </form>
      )}
      <div className="space-y-3">
        {records.data?.map(record => (
          <article
            key={record.id}
            className="rounded-xl border border-slate-700/70 bg-[#111b32] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">{record.title}</h3>
              <span className="rounded-full border border-slate-600 px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                {record.recordType}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {record.details}
            </p>
            <p className="mt-3 text-xs text-slate-600">
              {record.hospitalName} ·{" "}
              {new Date(record.recordedAt).toLocaleString("en-IN")}
            </p>
          </article>
        ))}
        {!records.isLoading && !records.data?.length && (
          <Notice>No hospital records are available for this account.</Notice>
        )}
      </div>
    </section>
  );
}

function AmbulancePanel({ role }: { role: string }) {
  const utils = trpc.useUtils();
  const hospitals = trpc.operations.hospitals.list.useQuery({});
  const requests = trpc.operations.ambulances.requests.useQuery();
  const providers = trpc.operations.ambulances.providers.useQuery({});
  const [form, setForm] = useState({
    pickupAddress: "",
    pickupCity: "Kolkata",
    destinationHospitalId: null as number | null,
    emergencyLevel: "urgent" as "standard" | "urgent" | "critical",
    notes: "",
  });
  const request = trpc.operations.ambulances.request.useMutation({
    onSuccess: async result => {
      await requests.refetch();
      toast.success(`Request ${result.referenceCode} created.`);
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.operations.ambulances.updateStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([requests.refetch(), providers.refetch()]);
      toast.success("Ambulance status updated.");
    },
    onError: error => toast.error(error.message),
  });
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold">Ambulance coordination</h2>
        <p className="mt-1 text-sm text-slate-500">
          Request transport and follow each dispatch from requested to
          completed.
        </p>
      </div>
      <Notice tone="warning">
        <strong>Emergency notice:</strong> LifeLink is not an emergency service.
        For an immediate life-threatening emergency in India, call 112 or your
        local emergency provider.
      </Notice>
      {role === "patient" && (
        <form
          onSubmit={e => {
            e.preventDefault();
            request.mutate(form);
          }}
          className="grid gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[.05] p-4 sm:grid-cols-2"
        >
          <Field label="Pickup address">
            <input
              required
              className={inputClass}
              value={form.pickupAddress}
              onChange={e =>
                setForm({ ...form, pickupAddress: e.target.value })
              }
            />
          </Field>
          <Field label="Pickup city">
            <input
              required
              className={inputClass}
              value={form.pickupCity}
              onChange={e => setForm({ ...form, pickupCity: e.target.value })}
            />
          </Field>
          <Field label="Destination hospital">
            <select
              className={inputClass}
              value={form.destinationHospitalId ?? ""}
              onChange={e =>
                setForm({
                  ...form,
                  destinationHospitalId: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
            >
              <option value="">Not selected</option>
              {hospitals.data?.map(hospital => (
                <option key={hospital.id} value={hospital.id}>
                  {hospital.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Emergency level">
            <select
              className={inputClass}
              value={form.emergencyLevel}
              onChange={e =>
                setForm({ ...form, emergencyLevel: e.target.value as any })
              }
            >
              <option value="standard">Standard</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              className={areaClass}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <Button
            disabled={request.isPending}
            className="self-end bg-rose-500 hover:bg-rose-400"
          >
            Request ambulance
          </Button>
        </form>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {requests.data?.map(item => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-700/70 bg-[#111b32] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{item.referenceCode}</p>
              <span className="rounded-md bg-cyan-400/10 px-2 py-1 text-xs font-bold uppercase text-cyan-200">
                {item.status.replace("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Pickup: {item.pickupAddress}, {item.pickupCity}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase text-rose-300">
              {item.emergencyLevel}
            </p>
            {role === "ambulance" && (
              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    "assigned",
                    "en_route",
                    "arrived",
                    "completed",
                    "cancelled",
                  ] as const
                ).map(status => (
                  <Button
                    key={status}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update.mutate({ requestId: item.id, status })
                    }
                    className="border-slate-600 text-xs"
                  >
                    {status.replace("_", " ")}
                  </Button>
                ))}
              </div>
            )}
          </article>
        ))}
        {!requests.isLoading && !requests.data?.length && (
          <Notice>No ambulance requests are available.</Notice>
        )}
      </div>
    </section>
  );
}

function Portal() {
  const utils = trpc.useUtils();
  const me = trpc.operations.auth.me.useQuery();
  const [section, setSection] = useState<Section>("overview");
  const logout = trpc.operations.auth.logout.useMutation({
    onSuccess: async () => {
      utils.operations.auth.me.setData(undefined, undefined);
      await utils.operations.auth.me.invalidate();
    },
  });
  if (me.isLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#080d1a]">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
      </div>
    );
  const identity = me.data!;
  const role = identity.account.role;
  const sections = [
    { id: "overview" as const, label: "Overview", icon: HeartPulse },
    { id: "beds" as const, label: "Bed availability", icon: BedDouble },
    { id: "records" as const, label: "Hospital records", icon: FileHeart },
    { id: "ambulance" as const, label: "Ambulance", icon: Ambulance },
  ];
  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0d1425]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-rose-500">
              <HeartPulse className="h-5 w-5" />
            </span>
            <div>
              <p className="font-black">LIFELINK OPERATIONS</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                SQL-backed care coordination
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">{identity.account.fullName}</p>
              <p className="text-[10px] uppercase text-cyan-300">{role}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => logout.mutate()}
              className="border-slate-700"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside>
          <Link
            href="/"
            className="mb-4 flex items-center gap-2 text-xs text-slate-500 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Main dashboard
          </Link>
          <nav className="space-y-1">
            {sections.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${section === item.id ? "bg-indigo-500/20 text-indigo-100" : "text-slate-500 hover:bg-slate-800 hover:text-white"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <main>
          {section === "overview" ? (
            <section className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">
                  {role} portal
                </p>
                <h1 className="mt-2 text-3xl font-black">
                  Welcome, {identity.account.fullName}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Manage the operational data available to your account role.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {sections.slice(1).map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSection(item.id)}
                    className="rounded-xl border border-slate-700/70 bg-[#111b32] p-5 text-left transition hover:-translate-y-0.5 hover:border-indigo-400/60"
                  >
                    <item.icon className="h-6 w-6 text-cyan-300" />
                    <p className="mt-6 font-bold">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Open and manage current {item.label.toLowerCase()} data.
                    </p>
                  </button>
                ))}
              </div>
              <Notice tone="warning">
                This build includes privacy-oriented authentication and role
                scoping, but it is not certified for real clinical data.
                Complete legal, security, penetration, retention, and
                operational reviews before production use.
              </Notice>
            </section>
          ) : section === "beds" ? (
            <BedPanel role={role} />
          ) : section === "records" ? (
            <RecordsPanel role={role} />
          ) : (
            <AmbulancePanel role={role} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function Operations() {
  const me = trpc.operations.auth.me.useQuery(undefined, { retry: false });
  if (me.isLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#080d1a]">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
      </div>
    );
  return me.data ? <Portal /> : <AuthPanel />;
}
