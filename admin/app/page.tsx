"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Tab = "overview" | "drivers" | "accounts" | "rides" | "pricing";
type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETION_REQUESTED";
type VerifyStatus = "PENDING" | "APPROVED" | "REJECTED";

interface AdminUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  status: UserStatus;
  phoneVerifiedAt: string | null;
  createdAt: string;
}

interface AdminVehicle {
  id: string;
  make: string;
  model: string;
  vehicleType: string;
  category: string;
  registrationNumber: string;
  chassisNumber: string | null;
  engineNumber: string | null;
  documentExpiresAt: string;
  verificationStatus: VerifyStatus;
  isActive: boolean;
}

interface AdminDriver {
  userId: string;
  verificationStatus: VerifyStatus;
  licenseNumber: string;
  licenseExpiry: string;
  user: { name: string; phone: string; email: string | null; status: UserStatus };
  vehicles: AdminVehicle[];
}

interface AdminRide {
  id: string;
  status: string;
  vehicleType: string;
  vehicleCategory: string;
  pickupLabel: string;
  destinationLabel: string;
  estimatedFarePaisa: number;
  finalFarePaisa: number | null;
  passengerName: string | null;
  driverName: string | null;
  createdAt: string;
  offersSent: number;
  pendingOffers: number;
}

interface Page<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

interface Overview {
  totalUsers: number;
  activeRides: number;
  completedRides: number;
  pendingDrivers: number;
  pendingVehicles: number;
}

interface Pricing {
  baseFarePaisa: number;
  perKmFarePaisa: number;
  perMinuteFarePaisa: number;
  minimumFarePaisa: number;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  user: { role: string; name: string };
}

const apiOrigin = (process.env.NEXT_PUBLIC_API_ORIGIN || "http://localhost:3000")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");
const apiBase = `${apiOrigin}/api/v1`;
const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "drivers", label: "Driver reviews" },
  { key: "accounts", label: "Accounts" },
  { key: "rides", label: "Rides" },
  { key: "pricing", label: "Fare settings" },
];

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const stored = sessionStorage.getItem("fairride-admin-session");
  let activeToken = token;
  if (stored) {
    try {
      const session: unknown = JSON.parse(stored);
      if (
        typeof session === "object" &&
        session !== null &&
        "accessToken" in session &&
        typeof session.accessToken === "string"
      ) {
        activeToken = session.accessToken;
      }
    } catch {
      sessionStorage.removeItem("fairride-admin-session");
    }
  }
  const send = (accessToken: string) =>
    fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  let response = await send(activeToken);
  if (response.status === 401 && path !== "/auth/refresh") {
    let refreshToken: string | null = null;
    if (stored) {
      try {
        const session: unknown = JSON.parse(stored);
        if (
          typeof session === "object" &&
          session !== null &&
          "refreshToken" in session &&
          typeof session.refreshToken === "string"
        ) {
          refreshToken = session.refreshToken;
        }
      } catch {
        sessionStorage.removeItem("fairride-admin-session");
      }
    }
    if (!refreshToken) {
      sessionStorage.removeItem("fairride-admin-session");
      throw new Error("Admin session expired. Please sign in again.");
    }
    const refreshed = await fetch(`${apiBase}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshedData: unknown = await refreshed.json();
    if (
      !refreshed.ok ||
      typeof refreshedData !== "object" ||
      refreshedData === null ||
      !("accessToken" in refreshedData) ||
      typeof refreshedData.accessToken !== "string" ||
      !("refreshToken" in refreshedData) ||
      typeof refreshedData.refreshToken !== "string" ||
      !("user" in refreshedData) ||
      typeof refreshedData.user !== "object" ||
      refreshedData.user === null ||
      !("role" in refreshedData.user) ||
      refreshedData.user.role !== "SUPER_ADMIN" ||
      !("name" in refreshedData.user) ||
      typeof refreshedData.user.name !== "string"
    ) {
      sessionStorage.removeItem("fairride-admin-session");
      throw new Error("Admin session expired. Please sign in again.");
    }
    const renewed: Session = {
      accessToken: refreshedData.accessToken,
      refreshToken: refreshedData.refreshToken,
      user: {
        role: refreshedData.user.role,
        name: refreshedData.user.name,
      },
    };
    sessionStorage.setItem("fairride-admin-session", JSON.stringify(renewed));
    response = await send(renewed.accessToken);
  }
  const text = await response.text();
  const result: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null && "message" in result
        ? String(result.message)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return result as T;
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTab = useCallback(
    async (selected: Tab, active: Session) => {
      setBusy(true);
      setError("");
      try {
        if (selected === "overview") {
          setOverview(await request<Overview>("/admin/overview", active.accessToken));
        } else if (selected === "drivers") {
          const query = new URLSearchParams({ page: String(page), pageSize: "50" });
          if (searchQuery) query.set("q", searchQuery);
          const result = await request<Page<AdminDriver>>(
              `/admin/drivers?${query}`,
              active.accessToken,
            );
          setDrivers(result.items);
          setPagination({ page: result.page, totalPages: result.totalPages, total: result.total });
        } else if (selected === "accounts") {
          const query = new URLSearchParams({ page: String(page), pageSize: "50" });
          if (searchQuery) query.set("q", searchQuery);
          const result = await request<Page<AdminUser>>(
              `/admin/users?${query}`,
              active.accessToken,
            );
          setAccounts(result.items);
          setPagination({ page: result.page, totalPages: result.totalPages, total: result.total });
        } else if (selected === "rides") {
          const query = new URLSearchParams({ page: String(page), pageSize: "50" });
          if (searchQuery) query.set("q", searchQuery);
          const result = await request<Page<AdminRide>>(
              `/admin/rides?${query}`,
              active.accessToken,
            );
          setRides(result.items);
          setPagination({ page: result.page, totalPages: result.totalPages, total: result.total });
        } else {
          setPricing(await request<Pricing>("/admin/pricing", active.accessToken));
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load data.");
      } finally {
        setBusy(false);
      }
    },
    [page, searchQuery],
  );

  useEffect(() => {
    const stored = sessionStorage.getItem("fairride-admin-session");
    if (!stored) return;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "accessToken" in parsed &&
        "user" in parsed &&
        typeof parsed.accessToken === "string" &&
        typeof parsed.user === "object" &&
        parsed.user !== null &&
        "role" in parsed.user &&
        parsed.user.role === "SUPER_ADMIN" &&
        "refreshToken" in parsed &&
        typeof parsed.refreshToken === "string"
      ) {
        setSession(parsed as Session);
      } else {
        sessionStorage.removeItem("fairride-admin-session");
      }
    } catch {
      sessionStorage.removeItem("fairride-admin-session");
    }
  }, []);

  useEffect(() => {
    if (session) void loadTab(tab, session);
  }, [session, tab, loadTab]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data: unknown = await result.json();
      if (
        !result.ok ||
        typeof data !== "object" ||
        data === null ||
        !("accessToken" in data) ||
        typeof data.accessToken !== "string" ||
        !("refreshToken" in data) ||
        typeof data.refreshToken !== "string" ||
        !("user" in data) ||
        typeof data.user !== "object" ||
        data.user === null ||
        !("role" in data.user) ||
        typeof data.user.role !== "string" ||
        !("name" in data.user) ||
        typeof data.user.name !== "string"
      ) {
        throw new Error("Sign-in failed. Check your credentials and API URL.");
      }
      const auth = data as Session;
      if (auth.user.role !== "SUPER_ADMIN") {
        throw new Error("This account is not authorized for the admin dashboard.");
      }
      const adminSession: Session = {
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        user: auth.user,
      };
      sessionStorage.setItem(
        "fairride-admin-session",
        JSON.stringify(adminSession),
      );
      setSession(adminSession);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function mutate(path: string, body: unknown, success: string) {
    if (!session) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(path, session.accessToken, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setNotice(success);
      await loadTab(tab, session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The update failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="loginShell">
        <section className="loginCard">
          <div className="brandMark">F</div>
          <p className="eyebrow">FAIRRIDE OPERATIONS</p>
          <h1>Admin sign in</h1>
          <p className="muted">Use an existing SUPER_ADMIN account. Admin sign-up is disabled.</p>
          {error ? <p className="message error">{error}</p> : null}
          <form onSubmit={signIn}>
            <label>Email or phone<input required autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} /></label>
            <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="primaryButton full" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
          </form>
          <p className="tiny">API: {apiOrigin}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">F</span><span>FairRide<small>ADMIN</small></span></div>
        <nav aria-label="Admin sections">
          {tabs.map((item) => (
            <button key={item.key} className={tab === item.key ? "navItem active" : "navItem"} onClick={() => { setTab(item.key); setSearch(""); setSearchQuery(""); setPage(1); }}>
              <span>{item.label}</span><span className="navArrow">›</span>
            </button>
          ))}
        </nav>
        <div className="sideFoot">
          <div className="userBadge">{session.user.name.slice(0, 1).toUpperCase()}</div>
          <div className="sideUser"><strong>{session.user.name}</strong><small>Super admin</small></div>
          <button className="logout" onClick={() => { sessionStorage.removeItem("fairride-admin-session"); setSession(null); }}>Log out</button>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">FAIRRIDE / OPERATIONS</p><h1>{tabs.find((item) => item.key === tab)?.label}</h1></div>
          <button className="quietButton" onClick={() => void loadTab(tab, session)} disabled={busy}>{busy ? "Loading…" : "Refresh data"}</button>
        </header>
        {error ? <p className="message error">{error}</p> : null}
        {notice ? <p className="message success">{notice}</p> : null}
        {tab === "overview" && overview ? (
          <div className="metricsGrid">
            {[
              ["Total accounts", overview.totalUsers, "Passenger and driver accounts"],
              ["Active rides", overview.activeRides, "Searching or currently in progress"],
              ["Completed rides", overview.completedRides, "All-time completed trips"],
              ["Drivers to review", overview.pendingDrivers, "Waiting for admin decision"],
              ["Vehicles to review", overview.pendingVehicles, "Waiting for admin decision"],
            ].map(([title, value, detail]) => <article className="metricCard" key={title}><p>{title}</p><strong>{value}</strong><small>{detail}</small></article>)}
          </div>
        ) : null}
        {tab === "drivers" ? (
          <>
            <div className="toolbar"><p className="muted">Review driver licence details and registered vehicles. Document image uploads are not connected yet.</p><Search value={search} onChange={setSearch} onSearch={() => { setPage(1); setSearchQuery(search.trim()); }} /></div>
            <div className="reviewList">
              {drivers.map((driver) => <article className="reviewCard" key={driver.userId}>
                <div className="reviewHead"><div><h2>{driver.user.name}</h2><p>{driver.user.phone} · Driver {driver.verificationStatus.toLowerCase()}</p></div><Status value={driver.verificationStatus} /></div>
                <div className="detailGrid"><span>Licence <strong>{driver.licenseNumber}</strong></span><span>Expires <strong>{driver.licenseExpiry}</strong></span><span>Account <strong>{driver.user.status}</strong></span></div>
                {driver.vehicles.map((vehicle) => <div className="vehicleBox" key={vehicle.id}>
                  <div className="reviewHead"><div><h3>{vehicle.make} {vehicle.model} · {vehicle.vehicleType}</h3><p>{vehicle.registrationNumber} · {vehicle.category}</p></div><Status value={vehicle.verificationStatus} /></div>
                  <div className="detailGrid"><span>Chassis <strong>{vehicle.chassisNumber || "Not provided"}</strong></span><span>Engine <strong>{vehicle.engineNumber || "Not provided"}</strong></span><span>Document expiry <strong>{vehicle.documentExpiresAt}</strong></span></div>
                  <div className="actions">
                    {vehicle.verificationStatus !== "APPROVED" ? <button className="primaryButton" disabled={busy} onClick={() => void mutate(`/admin/vehicles/${vehicle.id}/verification`, { status: "APPROVED" }, "Vehicle approved.")}>Approve vehicle</button> : null}
                    {vehicle.verificationStatus !== "REJECTED" ? <button className="dangerButton" disabled={busy} onClick={() => void mutate(`/admin/vehicles/${vehicle.id}/verification`, { status: "REJECTED" }, "Vehicle rejected.")}>Reject</button> : null}
                  </div>
                </div>)}
                <div className="actions">
                  {driver.verificationStatus !== "APPROVED" ? <button className="primaryButton" disabled={busy} onClick={() => void mutate(`/admin/drivers/${driver.userId}/verification`, { status: "APPROVED" }, "Driver approved.")}>Approve driver</button> : null}
                  {driver.verificationStatus !== "REJECTED" ? <button className="dangerButton" disabled={busy} onClick={() => void mutate(`/admin/drivers/${driver.userId}/verification`, { status: "REJECTED" }, "Driver rejected.")}>Reject</button> : null}
                </div>
              </article>)}
              {!drivers.length && !busy ? <Empty>No driver reviews match this search.</Empty> : null}
            </div>
            <Pager value={pagination} onChange={setPage} />
          </>
        ) : null}
        {tab === "accounts" ? (
          <>
            <div className="toolbar"><p className="muted">Manage passenger and driver access. Super-admin accounts are protected.</p><Search value={search} onChange={setSearch} onSearch={() => { setPage(1); setSearchQuery(search.trim()); }} /></div>
            <div className="tableWrap"><table><thead><tr><th>Account</th><th>Role</th><th>Phone</th><th>Status</th><th>Joined</th><th>Action</th></tr></thead><tbody>
              {accounts.map((account) => <tr key={account.id}><td><strong>{account.name}</strong><small>{account.email || "No email"}</small></td><td>{account.role}</td><td>{account.phone}</td><td><Status value={account.status} /></td><td>{new Date(account.createdAt).toLocaleDateString()}</td><td>{account.role !== "SUPER_ADMIN" ? <button className={account.status === "ACTIVE" ? "dangerButton compact" : "primaryButton compact"} disabled={busy || account.status === "DELETION_REQUESTED"} onClick={() => void mutate(`/admin/users/${account.id}/status`, { status: account.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }, `Account ${account.status === "ACTIVE" ? "suspended" : "activated"}.`)}>{account.status === "ACTIVE" ? "Suspend" : "Activate"}</button> : "Protected"}</td></tr>)}
            </tbody></table>{!accounts.length && !busy ? <Empty>No accounts match this search.</Empty> : null}</div>
            <Pager value={pagination} onChange={setPage} />
          </>
        ) : null}
        {tab === "rides" ? (
          <>
            <div className="toolbar"><p className="muted">Search trip records, route labels and rider names.</p><Search value={search} onChange={setSearch} onSearch={() => { setPage(1); setSearchQuery(search.trim()); }} /></div>
            <div className="tableWrap"><table><thead><tr><th>Trip</th><th>Route</th><th>Passenger / driver</th><th>Vehicle</th><th>Fare (PKR)</th><th>Matching</th><th>State / action</th><th>Created</th></tr></thead><tbody>
              {rides.map((ride) => <tr key={ride.id}><td><code>{ride.id.slice(0, 8)}</code></td><td>{ride.pickupLabel}<small>to {ride.destinationLabel}</small></td><td>{ride.passengerName || "—"}<small>{ride.driverName || "No driver assigned"}</small></td><td>{ride.vehicleType}<small>{ride.vehicleCategory}</small></td><td>{((ride.finalFarePaisa ?? ride.estimatedFarePaisa) / 100).toFixed(2)}</td><td>{ride.offersSent}<small>{ride.pendingOffers} pending</small></td><td><Status value={ride.status} />{["SEARCHING", "ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"].includes(ride.status) ? <button className="dangerButton compact" disabled={busy} onClick={() => { if (window.confirm("Cancel this active ride and expire its offers?")) void mutate(`/admin/rides/${ride.id}/cancel`, {}, "Ride cancelled and offers expired."); }}>Cancel trip</button> : null}</td><td>{new Date(ride.createdAt).toLocaleString()}</td></tr>)}
            </tbody></table>{!rides.length && !busy ? <Empty>No rides match this search.</Empty> : null}</div>
            <Pager value={pagination} onChange={setPage} />
          </>
        ) : null}
        {tab === "pricing" && pricing ? <PricingForm pricing={pricing} busy={busy} onSave={(value) => void mutate("/admin/pricing", value, "Fare settings saved. New estimates will use these values.")} /> : null}
      </section>
    </main>
  );
}

function Search({ value, onChange, onSearch }: { value: string; onChange: (value: string) => void; onSearch: () => void }) {
  return <form className="searchForm" onSubmit={(event) => { event.preventDefault(); onSearch(); }}><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search…" /><button className="quietButton">Search</button></form>;
}

function Status({ value }: { value: string }) {
  const kind = value === "APPROVED" || value === "ACTIVE" || value === "COMPLETED" ? "good" : value === "REJECTED" || value === "SUSPENDED" || value === "CANCELLED" ? "bad" : "pending";
  return <span className={`status ${kind}`}>{value.replaceAll("_", " ")}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

function Pager({
  value,
  onChange,
}: {
  value: { page: number; totalPages: number; total: number };
  onChange: (page: number) => void;
}) {
  return (
    <div className="pager">
      <span>{value.total} records · Page {value.page} of {Math.max(1, value.totalPages)}</span>
      <div>
        <button className="quietButton" disabled={value.page <= 1} onClick={() => onChange(value.page - 1)}>Previous</button>
        <button className="quietButton" disabled={value.page >= value.totalPages} onClick={() => onChange(value.page + 1)}>Next</button>
      </div>
    </div>
  );
}

function PricingForm({ pricing, busy, onSave }: { pricing: Pricing; busy: boolean; onSave: (value: Pricing) => void }) {
  const [form, setForm] = useState(pricing);
  useEffect(() => setForm(pricing), [pricing]);
  const fields: { key: keyof Pricing; label: string }[] = [
    { key: "baseFarePaisa", label: "Base fare" },
    { key: "perKmFarePaisa", label: "Fare per kilometre" },
    { key: "perMinuteFarePaisa", label: "Fare per minute" },
    { key: "minimumFarePaisa", label: "Minimum fare" },
  ];
  return <div className="settingsCard"><p className="muted">Values are stored as paisa (100 paisa = PKR 1). Updates apply to new fare estimates only.</p><div className="pricingGrid">{fields.map((field) => <label key={field.key}>{field.label}<div className="moneyInput"><span>PKR</span><input type="number" min="0" step="100" value={(form[field.key] / 100).toString()} onChange={(event) => setForm({ ...form, [field.key]: Math.round(Number(event.target.value) * 100) })} /></div></label>)}</div><button className="primaryButton" disabled={busy} onClick={() => onSave(form)}>{busy ? "Saving…" : "Save fare settings"}</button></div>;
}
