// ============================================================================
// 1. SUPABASE CONFIGURATION (Connected to your Supabase Project!)
// ============================================================================
const DEFAULT_SUPABASE_URL = "https://vxjcvaoexqsruilmylnz.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_kT0QRsCfbBklfVgAvmNUrQ_5pr9Zih2";
const DEFAULT_TABLE_NAME = "items";

let supabaseClient = null;
let authSubscription = null;
let currentUser = null;

// Detect if the current HTML page requires authentication (Protected Route)
const isProtectedPage = document.body.dataset.protectedRoute === "true";

// DOM Elements (Some exist only on index.html or only on dashboard.html)
const urlInput = document.getElementById("supabase-url");
const keyInput = document.getElementById("supabase-key");
const tableInput = document.getElementById("table-name");
const connectBtn = document.getElementById("connect-btn");
const sqlToggleBtn = document.getElementById("sql-toggle-btn");
const sqlHelper = document.getElementById("sql-helper");

const statusBanner = document.getElementById("status-banner");
const statusText = document.getElementById("status-text");
const navAuthBadge = document.getElementById("nav-auth-badge");

// Auth DOM Elements
const authFormContainer = document.getElementById("auth-form-container");
const userSessionBox = document.getElementById("user-session-box");
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const signinBtn = document.getElementById("signin-btn");
const signupBtn = document.getElementById("signup-btn");
const signoutBtn = document.getElementById("signout-btn");
const userEmailDisplay = document.getElementById("user-email-display");
const userIdDisplay = document.getElementById("user-id-display");
const userLastSignin = document.getElementById("user-last-signin");

// Protected Route / Section DOM Elements
const routeLockBadge = document.getElementById("route-lock-badge");
const protectedLockedView = document.getElementById("protected-locked-view");
const protectedContentView = document.getElementById("protected-content-view");
const routeGuardLoader = document.getElementById("route-guard-loader");
const protectedPageContainer = document.getElementById("protected-page-container");

// Database CRUD DOM Elements
const addForm = document.getElementById("add-form");
const itemInput = document.getElementById("item-input");
const refreshBtn = document.getElementById("refresh-btn");
const itemsList = document.getElementById("items-list");

// Helper: Update status banner
function setStatus(state, message) {
  if (!statusBanner || !statusText) return;
  statusBanner.className = `status-banner status-${state}`;
  statusText.textContent = message;
}

// Helper: Read active table name
function getTableName() {
  if (tableInput && tableInput.value.trim()) {
    return tableInput.value.trim();
  }
  return localStorage.getItem("sb_table") || DEFAULT_TABLE_NAME;
}

// ============================================================================
// 2. INITIALIZATION & ROUTE GUARD
// ============================================================================
async function initApp() {
  const savedUrl = localStorage.getItem("sb_url") || DEFAULT_SUPABASE_URL;
  const savedKey = localStorage.getItem("sb_key") || DEFAULT_SUPABASE_ANON_KEY;
  const savedTable = localStorage.getItem("sb_table") || DEFAULT_TABLE_NAME;

  if (urlInput) urlInput.value = savedUrl;
  if (keyInput) keyInput.value = savedKey;
  if (tableInput) tableInput.value = savedTable;

  // Check if user was redirected here from a protected route
  const params = new URLSearchParams(window.location.search);
  if (params.get("reason") === "auth_required") {
    setStatus("error", "Access Denied: Please sign in first to view the Protected Dashboard.");
  }

  if (savedUrl && savedKey) {
    await connectToSupabase(savedUrl, savedKey, savedTable);
  } else if (isProtectedPage) {
    // No credentials configured at all -> redirect back to setup page
    window.location.replace("index.html?reason=auth_required");
  }
}

async function connectToSupabase(urlOverride, keyOverride, tableOverride) {
  const url = (urlOverride ?? urlInput?.value ?? "").trim();
  const key = (keyOverride ?? keyInput?.value ?? "").trim();
  const tableName = (tableOverride ?? tableInput?.value ?? DEFAULT_TABLE_NAME).trim();

  if (!url || !key) {
    setStatus("error", "Please enter both your Supabase Project URL and Publishable/Anon Key.");
    return;
  }

  localStorage.setItem("sb_url", url);
  localStorage.setItem("sb_key", key);
  localStorage.setItem("sb_table", tableName);

  try {
    setStatus("idle", "Connecting to Supabase...");
    supabaseClient = window.supabase.createClient(url, key);

    // Clean up previous auth listener if re-connecting
    if (authSubscription) {
      authSubscription.unsubscribe();
    }

    // Listen to Auth state changes (Sign In, Sign Out, Token Refresh)
    // IMPORTANT: Keep callback synchronous and schedule async DB work via setTimeout
    // to prevent supabase-js v2 auth lock deadlocks.
    const { data: listener } = supabaseClient.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      handleAuthStateChange(event, user);
    });
    authSubscription = listener.subscription;

    // Verify current user with the Supabase Auth server
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError && userError.status !== 400 && userError.name !== "AuthSessionMissingError") {
      setStatus("error", `Connected, but Auth check returned: ${userError.message}`);
    } else if (user) {
      setStatus("connected", `Connected & authenticated as ${user.email}`);
    } else {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reason") !== "auth_required") {
        setStatus("connected", "Connected to Supabase! Sign Up or Sign In in Step 2 to unlock protected routes.");
      }
    }

    handleAuthStateChange("INITIAL_CHECK", user);
  } catch (err) {
    setStatus("error", `Failed to initialize Supabase client: ${err.message}`);
  }
}

// ============================================================================
// 3. AUTHENTICATION & PROTECTED ROUTE HANDLER
// ============================================================================
function handleAuthStateChange(event, user) {
  currentUser = user;

  // 1. Full-Page Route Guard (dashboard.html)
  if (isProtectedPage) {
    if (!user) {
      // Redirect unauthenticated users away from protected pages immediately
      window.location.replace("index.html?reason=auth_required");
      return;
    }
    // User is authenticated: hide loader and reveal protected dashboard
    if (routeGuardLoader) routeGuardLoader.classList.add("hidden");
    if (protectedPageContainer) protectedPageContainer.classList.remove("hidden");
  }

  // 2. Update Navigation Badge
  if (navAuthBadge) {
    if (user) {
      navAuthBadge.textContent = `Signed in: ${user.email}`;
      navAuthBadge.className = "auth-pill auth-pill-authed";
    } else {
      navAuthBadge.textContent = "Guest (Unauthenticated)";
      navAuthBadge.className = "auth-pill auth-pill-guest";
    }
  }

  // 3. Update Auth Card & Profile Details
  if (user) {
    if (authFormContainer) authFormContainer.classList.add("hidden");
    if (userSessionBox) userSessionBox.classList.remove("hidden");
    if (userEmailDisplay) userEmailDisplay.textContent = user.email;
    if (userIdDisplay) userIdDisplay.textContent = `UID: ${user.id}`;
    if (userLastSignin && user.last_sign_in_at) {
      userLastSignin.textContent = new Date(user.last_sign_in_at).toLocaleString();
    }

    // Unlock Protected Section on index.html
    if (routeLockBadge) {
      routeLockBadge.textContent = "🔓 Unlocked (Authenticated)";
      routeLockBadge.className = "lock-badge unlocked";
    }
    if (protectedLockedView) protectedLockedView.classList.add("hidden");
    if (protectedContentView) protectedContentView.classList.remove("hidden");

    // Fetch protected rows outside the synchronous onAuthStateChange stack
    setTimeout(() => {
      fetchItems();
    }, 0);
  } else {
    if (authFormContainer) authFormContainer.classList.remove("hidden");
    if (userSessionBox) userSessionBox.classList.add("hidden");

    // Lock Protected Section on index.html
    if (routeLockBadge) {
      routeLockBadge.textContent = "🔒 Locked (Sign in required)";
      routeLockBadge.className = "lock-badge locked";
    }
    if (protectedLockedView) protectedLockedView.classList.remove("hidden");
    if (protectedContentView) protectedContentView.classList.add("hidden");
  }
}

// SIGN UP: Register a new user with email and password
async function signUpUser() {
  if (!supabaseClient) {
    setStatus("error", "Connect your Supabase URL and Key in Step 1 first.");
    return;
  }

  const email = authEmailInput?.value.trim();
  const password = authPasswordInput?.value;

  if (!email || !password) {
    setStatus("error", "Please enter both an email address and a password.");
    return;
  }

  setStatus("idle", "Creating user account...");
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
  });

  if (error) {
    setStatus("error", `Sign Up failed: ${error.message}`);
    return;
  }

  if (data.user && !data.session) {
    setStatus(
      "connected",
      `Sign Up successful! Check ${email} for a confirmation link (or disable "Confirm email" in Supabase Auth → Providers → Email for instant testing).`
    );
  } else {
    setStatus("connected", `Account created and signed in as ${data.user?.email}!`);
  }
}

// SIGN IN: Authenticate an existing user with email and password
async function signInUser() {
  if (!supabaseClient) {
    setStatus("error", "Connect your Supabase URL and Key in Step 1 first.");
    return;
  }

  const email = authEmailInput?.value.trim();
  const password = authPasswordInput?.value;

  if (!email || !password) {
    setStatus("error", "Please enter both your email address and password.");
    return;
  }

  setStatus("idle", "Signing in...");
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setStatus("error", `Sign In failed: ${error.message}`);
    return;
  }

  setStatus("connected", `Welcome back, ${data.user.email}! Protected routes are now unlocked.`);
}

// SIGN OUT: End the current user session
async function signOutUser() {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setStatus("error", `Sign Out failed: ${error.message}`);
    return;
  }

  setStatus("connected", "Signed out. Protected routes are now locked.");
}

// ============================================================================
// 4. PROTECTED DATABASE OPERATIONS (CRUD with RLS)
// ============================================================================
async function fetchItems() {
  if (!supabaseClient || !currentUser || !itemsList) return;

  const tableName = getTableName();

  const { data, error } = await supabaseClient
    .from(tableName)
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    setStatus(
      "error",
      `Database Error (${error.code || "Query"}): ${error.message}. Click "Show Auth + RLS SQL Setup" in Step 1 to set up your table.`
    );
    return;
  }

  renderItems(data);
}

async function addItem(e) {
  e.preventDefault();
  if (!supabaseClient || !currentUser) {
    setStatus("error", "You must be signed in to add items.");
    return;
  }

  const name = itemInput.value.trim();
  const tableName = getTableName();
  if (!name) return;

  // Include user_id explicitly so it works whether or not the column has default auth.uid()
  const { error } = await supabaseClient
    .from(tableName)
    .insert([{ name, user_id: currentUser.id }]);

  if (error) {
    setStatus("error", `Insert failed: ${error.message}`);
    return;
  }

  itemInput.value = "";
  await fetchItems();
}

async function deleteItem(id) {
  if (!supabaseClient || !currentUser) return;
  const tableName = getTableName();

  const { error } = await supabaseClient.from(tableName).delete().eq("id", id);

  if (error) {
    setStatus("error", `Delete failed: ${error.message}`);
    return;
  }

  await fetchItems();
}

function renderItems(items) {
  if (!itemsList) return;
  itemsList.innerHTML = "";

  if (!items || items.length === 0) {
    itemsList.innerHTML = `<li class="empty-state">No rows found for your account yet. Add one above!</li>`;
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "item-row";

    const displayTitle = item.name || item.title || JSON.stringify(item);
    const timestamp = item.created_at
      ? new Date(item.created_at).toLocaleString()
      : `ID: ${item.id}`;

    li.innerHTML = `
      <div class="item-info">
        <span class="item-name"></span>
        <span class="item-meta"></span>
      </div>
      <button class="btn btn-delete" data-id="${item.id}">Delete</button>
    `;

    li.querySelector(".item-name").textContent = displayTitle;
    li.querySelector(".item-meta").textContent = timestamp;
    li.querySelector(".btn-delete").addEventListener("click", () => deleteItem(item.id));

    itemsList.appendChild(li);
  });
}

// ============================================================================
// 5. EVENT LISTENERS
// ============================================================================
if (connectBtn) {
  connectBtn.addEventListener("click", () => connectToSupabase());
}
if (sqlToggleBtn && sqlHelper) {
  sqlToggleBtn.addEventListener("click", () => sqlHelper.classList.toggle("hidden"));
}
if (signinBtn) {
  signinBtn.addEventListener("click", signInUser);
}
if (signupBtn) {
  signupBtn.addEventListener("click", signUpUser);
}
if (signoutBtn) {
  signoutBtn.addEventListener("click", signOutUser);
}
if (refreshBtn) {
  refreshBtn.addEventListener("click", fetchItems);
}
if (addForm) {
  addForm.addEventListener("submit", addItem);
}

// Boot the app
initApp();

