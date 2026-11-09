// ============================================================================
// 1. SUPABASE CONFIGURATION (Replace these once you share your credentials!)
// ============================================================================
const DEFAULT_SUPABASE_URL = ""; // e.g., "https://xyzcompany.supabase.co"
const DEFAULT_SUPABASE_ANON_KEY = ""; // e.g., "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
const DEFAULT_TABLE_NAME = "items";

let supabaseClient = null;

// DOM Elements
const urlInput = document.getElementById("supabase-url");
const keyInput = document.getElementById("supabase-key");
const tableInput = document.getElementById("table-name");
const connectBtn = document.getElementById("connect-btn");
const sqlToggleBtn = document.getElementById("sql-toggle-btn");
const sqlHelper = document.getElementById("sql-helper");
const statusBanner = document.getElementById("status-banner");
const statusText = document.getElementById("status-text");
const addForm = document.getElementById("add-form");
const itemInput = document.getElementById("item-input");
const refreshBtn = document.getElementById("refresh-btn");
const itemsList = document.getElementById("items-list");

// Load saved credentials from localStorage or fallback to hardcoded defaults
function initCredentials() {
  urlInput.value = localStorage.getItem("sb_url") || DEFAULT_SUPABASE_URL;
  keyInput.value = localStorage.getItem("sb_key") || DEFAULT_SUPABASE_ANON_KEY;
  tableInput.value = localStorage.getItem("sb_table") || DEFAULT_TABLE_NAME;

  if (urlInput.value && keyInput.value) {
    connectToSupabase();
  }
}

function setStatus(state, message) {
  statusBanner.className = `status-banner status-${state}`;
  statusText.textContent = message;
}

// Initialize Supabase Client and test fetching rows
async function connectToSupabase() {
  const url = urlInput.value.trim();
  const key = keyInput.value.trim();
  const tableName = tableInput.value.trim() || "items";

  if (!url || !key) {
    setStatus("error", "Please enter both your Supabase Project URL and Anon Key.");
    return;
  }

  // Save in localStorage for convenience during testing
  localStorage.setItem("sb_url", url);
  localStorage.setItem("sb_key", key);
  localStorage.setItem("sb_table", tableName);

  try {
    setStatus("idle", "Connecting to Supabase...");
    supabaseClient = window.supabase.createClient(url, key);
    await fetchItems();
  } catch (err) {
    setStatus("error", `Failed to initialize client: ${err.message}`);
  }
}

// READ: Fetch rows from the table
async function fetchItems() {
  if (!supabaseClient) {
    setStatus("error", "Connect to Supabase first before fetching records.");
    return;
  }

  const tableName = tableInput.value.trim() || "items";

  const { data, error } = await supabaseClient
    .from(tableName)
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    setStatus(
      "error",
      `Supabase Error (${error.code || "Query"}): ${error.message}. Did you create the "${tableName}" table and RLS policy?`
    );
    return;
  }

  setStatus("connected", `Connected to Supabase! Loaded ${data.length} row(s) from "${tableName}".`);
  renderItems(data);
}

// CREATE: Insert a new row into the table
async function addItem(e) {
  e.preventDefault();
  if (!supabaseClient) {
    setStatus("error", "Please connect to your Supabase project first.");
    return;
  }

  const name = itemInput.value.trim();
  const tableName = tableInput.value.trim() || "items";
  if (!name) return;

  const { error } = await supabaseClient.from(tableName).insert([{ name }]);

  if (error) {
    setStatus("error", `Insert failed: ${error.message}`);
    return;
  }

  itemInput.value = "";
  await fetchItems();
}

// DELETE: Remove a row by ID
async function deleteItem(id) {
  if (!supabaseClient) return;
  const tableName = tableInput.value.trim() || "items";

  const { error } = await supabaseClient.from(tableName).delete().eq("id", id);

  if (error) {
    setStatus("error", `Delete failed: ${error.message}`);
    return;
  }

  await fetchItems();
}

// Render list items in the UI
function renderItems(items) {
  itemsList.innerHTML = "";

  if (!items || items.length === 0) {
    itemsList.innerHTML = `<li class="empty-state">Table is empty. Add your first item above!</li>`;
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

// Event Listeners
connectBtn.addEventListener("click", connectToSupabase);
refreshBtn.addEventListener("click", fetchItems);
addForm.addEventListener("submit", addItem);
sqlToggleBtn.addEventListener("click", () => {
  sqlHelper.classList.toggle("hidden");
});

// Run on page load
initCredentials();

