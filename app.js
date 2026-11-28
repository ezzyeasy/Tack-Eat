// ============================================================================
// 1. SUPABASE CONFIGURATION (Using your existing project URL & publishable key)
// ============================================================================
const SUPABASE_URL = "https://vxjcvaoexqsruilmylnz.supabase.co";
const SUPABASE_KEY = "sb_publishable_kT0QRsCfbBklfVgAvmNUrQ_5pr9Zih2";

// Optional fallback list of admin emails (in addition to database `profiles.role === 'admin'`
// and Supabase Auth `app_metadata.role === 'admin'`). Add your admin email(s) here!
const ADMIN_EMAILS = [
  "admin@tack-eat.com"
];

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ============================================================================
// 2. HOME PAGE PREVIEW DIALOGS & NAVBAR AUTH STATUS (index.html)
// ============================================================================
const previews = {
  location: ["Location", "You're browsing food spots in Seoul, KR."],
  cart: ["Cart", "Your cart is empty."],
  explore: ["Explore", "Food spot browsing is coming soon."],
  nearby: ["What's Nearby", "Nearby food spots are coming soon."],
  offers: ["Offers", "Offers are coming soon."],
  signup: ["Sign Up", "Account registration is coming soon."],
};

const dialog = document.querySelector(".preview");
const title = document.querySelector("#preview-title");
const message = document.querySelector("#preview-message");

if (dialog && title && message) {
  for (const button of document.querySelectorAll("[data-preview]")) {
    button.addEventListener("click", (e) => {
      const key = button.dataset.preview;
      if (!previews[key]) return;
      e.preventDefault();
      const [heading, description] = previews[key];
      title.textContent = heading;
      message.textContent = description;
      dialog.showModal();
    });
  }
}

// Mobile Hamburger Navigation Toggle
const navbarEl = document.querySelector(".navbar");
const navHamburgerBtn = document.getElementById("nav-hamburger");
const navActionsMenu = document.getElementById("nav-actions-menu");

function closeMobileNavbar() {
  if (!navbarEl || !navHamburgerBtn) return;
  navbarEl.classList.remove("is-open");
  navHamburgerBtn.setAttribute("aria-expanded", "false");
}

if (navbarEl && navHamburgerBtn && navActionsMenu) {
  navHamburgerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = navbarEl.classList.toggle("is-open");
    navHamburgerBtn.setAttribute("aria-expanded", String(isOpen));
  });

  navActionsMenu.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) {
      closeMobileNavbar();
    }
  });

  document.addEventListener("click", (e) => {
    if (navbarEl.classList.contains("is-open") && !navbarEl.contains(e.target)) {
      closeMobileNavbar();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navbarEl.classList.contains("is-open")) {
      closeMobileNavbar();
      navHamburgerBtn.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && navbarEl.classList.contains("is-open")) {
      closeMobileNavbar();
    }
  });
}

// Update the navbar button and sign-up banner on index.html when logged in
async function syncNavbarAuthState() {
  const navAuthLink = document.getElementById("nav-auth-link");
  const signUpBanner = document.getElementById("sign-up-banner");
  if (!supabaseClient) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    if (navAuthLink) {
      navAuthLink.textContent = "Sign Up";
      navAuthLink.href = "login.html";
    }
    if (signUpBanner) {
      signUpBanner.hidden = false;
    }
    return;
  }

  // Hide the "Sign up for free delivery" banner once the user has signed up / logged in
  if (signUpBanner) {
    signUpBanner.hidden = true;
  }

  if (navAuthLink) {
    const { isAdmin, username } = await checkUserRoleAndProfile(user);
    navAuthLink.textContent = isAdmin ? `Admin (${username})` : `Hi, ${username}`;
    navAuthLink.href = isAdmin ? "admin.html" : "login.html";
  }
}

// ============================================================================
// 3. ADMIN DETECTION & REDUNDANCY CHECK HELPERS
// ============================================================================

/**
 * Detects whether the authenticated user is an Admin and retrieves their username.
 * Checks 3 sources in priority order:
 *   1. `public.profiles` table (`role = 'admin'`)
 *   2. Supabase JWT `app_metadata.role === 'admin'`
 *   3. `ADMIN_EMAILS` list in app.js
 */
async function checkUserRoleAndProfile(user) {
  if (!user) return { isAdmin: false, role: "guest", username: "" };

  const email = (user.email || "").toLowerCase();
  let dbRole = null;
  let dbUsername = null;

  if (supabaseClient) {
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("username, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && profile) {
      dbRole = profile.role;
      dbUsername = profile.username;
    }
  }

  const appMetaRole = user.app_metadata?.role;
  const isEmailAdmin = ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email);

  const isAdmin =
    dbRole === "admin" ||
    appMetaRole === "admin" ||
    isEmailAdmin;

  const username =
    dbUsername ||
    user.user_metadata?.username ||
    email.split("@")[0] ||
    "Member";

  return {
    isAdmin,
    role: isAdmin ? "admin" : "customer",
    username,
  };
}

/**
 * Checks `public.profiles` before Sign Up to prevent duplicate usernames or emails.
 * Also gracefully handles if the `profiles` table hasn't been created yet.
 */
async function checkRedundantAccount(username, email) {
  if (!supabaseClient) return { isDuplicate: false };

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  // Check if email already exists in public.profiles
  const { data: emailMatch, error: emailErr } = await supabaseClient
    .from("profiles")
    .select("id")
    .ilike("email", cleanEmail)
    .maybeSingle();

  if (!emailErr && emailMatch) {
    return {
      isDuplicate: true,
      reason: "An account with this email address already exists. Please Log In instead.",
    };
  }

  // Check if username is already taken in public.profiles
  const { data: userMatch, error: userErr } = await supabaseClient
    .from("profiles")
    .select("id")
    .ilike("username", cleanUsername)
    .maybeSingle();

  if (!userErr && userMatch) {
    return {
      isDuplicate: true,
      reason: `The username "${cleanUsername}" is already taken. Please choose another username.`,
    };
  }

  return { isDuplicate: false };
}

/**
 * Resolves a login identifier (Email OR Username) to an email address.
 * Allows users to type either their Username or Email in the Log In field!
 */
async function resolveLoginEmail(identifier) {
  const clean = identifier.trim();
  if (clean.includes("@")) {
    return clean.toLowerCase();
  }

  if (!supabaseClient) return clean;

  // Look up email by username in public.profiles
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("email")
    .ilike("username", clean)
    .maybeSingle();

  if (!error && profile?.email) {
    return profile.email.toLowerCase();
  }

  return clean;
}

// ============================================================================
// 4. AUTH PAGE CONTROLLER (login.html)
// ============================================================================
function initAuthPage() {
  const formLogin = document.getElementById("form-login");
  const formRegister = document.getElementById("form-register");
  const formForgot = document.getElementById("form-forgot");
  const formResetPassword = document.getElementById("form-reset-password");
  const viewSession = document.getElementById("view-session");

  // Only run on login.html
  if (!formLogin || !formRegister || !formForgot) return;

  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const topControls = document.querySelector(".auth-top-bar-controls");
  const alertBox = document.getElementById("auth-alert");

  let isSubmitting = false;

  function showAlert(type, text) {
    if (!alertBox) return;
    if (!text) {
      alertBox.className = "auth-alert hidden";
      alertBox.textContent = "";
      return;
    }
    alertBox.className = `auth-alert alert-${type}`;
    alertBox.textContent = text;
  }

  function switchView(mode) {
    showAlert(null, "");
    formLogin.classList.add("hidden");
    formRegister.classList.add("hidden");
    formForgot.classList.add("hidden");
    formResetPassword?.classList.add("hidden");
    viewSession?.classList.add("hidden");

    if (topControls) {
      topControls.classList.toggle("hidden", mode === "session" || mode === "reset-password");
    }

    if (mode === "login") {
      formLogin.classList.remove("hidden");
      tabLogin?.classList.add("active");
      tabLogin?.setAttribute("aria-selected", "true");
      tabRegister?.classList.remove("active");
      tabRegister?.setAttribute("aria-selected", "false");
    } else if (mode === "register") {
      formRegister.classList.remove("hidden");
      tabRegister?.classList.add("active");
      tabRegister?.setAttribute("aria-selected", "true");
      tabLogin?.classList.remove("active");
      tabLogin?.setAttribute("aria-selected", "false");
    } else if (mode === "forgot") {
      formForgot.classList.remove("hidden");
      tabLogin?.classList.remove("active");
      tabRegister?.classList.remove("active");
    } else if (mode === "reset-password") {
      formResetPassword?.classList.remove("hidden");
    } else if (mode === "session") {
      viewSession?.classList.remove("hidden");
    }
  }

  // Top-right Log In / Register tab buttons
  tabLogin?.addEventListener("click", () => switchView("login"));
  tabRegister?.addEventListener("click", () => switchView("register"));

  // Bottom quick-switch links ("Forgot Password?", "Not a Member yet?", "Back to Log In")
  for (const link of document.querySelectorAll("[data-switch]")) {
    link.addEventListener("click", () => {
      switchView(link.dataset.switch);
    });
  }

  // Render Logged-in Session & Admin Detection View
  async function renderSessionView(user) {
    if (!user) {
      switchView("login");
      return;
    }

    const { isAdmin, username } = await checkUserRoleAndProfile(user);

    const roleBadge = document.getElementById("role-badge");
    const sessionWelcome = document.getElementById("session-welcome");
    const sessionEmail = document.getElementById("session-email");
    const adminPanelBox = document.getElementById("admin-panel-box");
    const btnAdminDashboard = document.getElementById("btn-admin-dashboard");

    if (roleBadge) {
      roleBadge.textContent = isAdmin ? "Admin Account" : "Customer Account";
      roleBadge.className = `role-badge ${isAdmin ? "role-admin" : "role-customer"}`;
    }
    if (sessionWelcome) {
      sessionWelcome.textContent = `Welcome, ${username}!`;
    }
    if (sessionEmail) {
      sessionEmail.textContent = `Signed in as ${user.email}`;
    }
    if (adminPanelBox) {
      adminPanelBox.classList.toggle("hidden", !isAdmin);
    }
    if (btnAdminDashboard) {
      btnAdminDashboard.classList.toggle("hidden", !isAdmin);
    }

    switchView("session");
  }

  // Listen to Supabase Auth state changes (including PASSWORD_RECOVERY redirect)
  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        switchView("reset-password");
        showAlert("info", "Please enter your new password below.");
        return;
      }
      if (event === "SIGNED_IN" && session?.user) {
        setTimeout(() => renderSessionView(session.user), 0);
      } else if (event === "SIGNED_OUT") {
        switchView("login");
      }
    });

    // Initial session check on page load
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
      // Check URL hash for recovery token before overriding view
      if (window.location.hash.includes("type=recovery")) {
        switchView("reset-password");
        return;
      }
      if (user) {
        renderSessionView(user);
      }
    });
  }

  // --------------------------------------------------------------------------
  // A. LOG IN SUBMIT (Supports Email or Username + Admin Detection)
  // --------------------------------------------------------------------------
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabaseClient) return;

    const rawIdentifier = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const submitBtn = document.getElementById("btn-login-submit");

    if (!rawIdentifier || !password) {
      showAlert("error", "Please enter both your email/username and password.");
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing In...";
    showAlert("info", "Verifying credentials...");

    try {
      const email = await resolveLoginEmail(rawIdentifier);

      if (!email.includes("@")) {
        showAlert("error", "Username not found. Please enter your registered email address.");
        return;
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        showAlert("error", error.message);
        return;
      }

      const { isAdmin, username } = await checkUserRoleAndProfile(data.user);
      if (isAdmin) {
        showAlert("success", `Admin verified (${username}). Redirecting to Admin Dashboard...`);
        window.location.href = "admin.html";
        return;
      }

      await renderSessionView(data.user);
      showAlert("success", `Welcome back, ${username}!`);
    } catch (err) {
      showAlert("error", err.message || "Unable to sign in.");
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign In";
    }
  });

  // --------------------------------------------------------------------------
  // B. REGISTER / SIGN UP SUBMIT (With Redundancy Prevention)
  // --------------------------------------------------------------------------
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabaseClient) return;

    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim().toLowerCase();
    const password = document.getElementById("reg-password").value;
    const submitBtn = document.getElementById("btn-register-submit");

    if (!username || !email || !password) {
      showAlert("error", "Please fill in your username, email, and password.");
      return;
    }

    if (password.length < 6) {
      showAlert("error", "Password must be at least 6 characters long.");
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Checking & Creating...";
    showAlert("info", "Checking for existing account...");

    try {
      // 1. Check `public.profiles` for redundant username or email
      const redundancyCheck = await checkRedundantAccount(username, email);
      if (redundancyCheck.isDuplicate) {
        showAlert("error", redundancyCheck.reason);
        return;
      }

      // 2. Register user in Supabase Auth
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          showAlert("error", "This email is already registered. Please switch to Log In.");
        } else {
          showAlert("error", error.message);
        }
        return;
      }

      // 3. Detect Supabase's obfuscated duplicate signup response (identities === [])
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        showAlert("error", "An account with this email already exists. Please Log In instead.");
        return;
      }

      // 4. Upsert into `public.profiles` if session is active (fallback if DB trigger isn't installed yet)
      if (data.user && data.session) {
        await supabaseClient.from("profiles").upsert(
          [
            {
              id: data.user.id,
              username,
              email,
              role: ADMIN_EMAILS.includes(email) ? "admin" : "customer",
            },
          ],
          { onConflict: "id" }
        );
      }

      if (data.user && !data.session) {
        showAlert(
          "success",
          `Account created for ${username}! Please check ${email} to confirm your email address.`
        );
        formRegister.reset();
      } else if (data.user) {
        const { isAdmin } = await checkUserRoleAndProfile(data.user);
        if (isAdmin) {
          window.location.href = "admin.html";
          return;
        }
        await renderSessionView(data.user);
        showAlert("success", `Account created! Welcome to Tack-Eat, ${username}.`);
      }
    } catch (err) {
      showAlert("error", err.message || "Registration failed.");
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
  });

  // --------------------------------------------------------------------------
  // C. FORGOT PASSWORD SUBMIT (Sends Supabase Password Reset Email)
  // --------------------------------------------------------------------------
  formForgot.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabaseClient) return;

    const email = document.getElementById("forgot-email").value.trim().toLowerCase();
    const submitBtn = document.getElementById("btn-forgot-submit");

    if (!email || !email.includes("@")) {
      showAlert("error", "Please enter a valid email address.");
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        showAlert("error", error.message);
        return;
      }

      showAlert(
        "success",
        `Password reset link sent to ${email}! Check your inbox and click the link to set a new password.`
      );
      formForgot.reset();
    } catch (err) {
      showAlert("error", err.message || "Failed to send reset email.");
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Reset Link";
    }
  });

  // --------------------------------------------------------------------------
  // D. SET NEW PASSWORD SUBMIT (After clicking email recovery link)
  // --------------------------------------------------------------------------
  formResetPassword?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabaseClient) return;

    const newPassword = document.getElementById("new-password").value;
    const submitBtn = document.getElementById("btn-reset-submit");

    if (!newPassword || newPassword.length < 6) {
      showAlert("error", "New password must be at least 6 characters.");
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Updating...";

    try {
      const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        showAlert("error", error.message);
        return;
      }

      window.location.hash = "";
      await renderSessionView(data.user);
      showAlert("success", "Your password has been updated!");
    } catch (err) {
      showAlert("error", err.message || "Failed to update password.");
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Update Password";
    }
  });

  // --------------------------------------------------------------------------
  // E. SIGN OUT BUTTON
  // --------------------------------------------------------------------------
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    switchView("login");
    showAlert("info", "You have been signed out.");
  });
}

// ============================================================================
// 5. CONTACT FORM VALIDATION, RESET & NOTIFICATION (index.html)
// ============================================================================
function initContactForm() {
  const contactForm = document.getElementById("contact-form");
  if (!contactForm) return;

  const nameInput = document.getElementById("contact-name");
  const emailInput = document.getElementById("contact-email");
  const subjectInput = document.getElementById("contact-subject");
  const messageInput = document.getElementById("contact-message");
  const feedbackBox = document.getElementById("contact-feedback");

  const fields = [nameInput, emailInput, subjectInput, messageInput];
  let feedbackTimeout = null;

  function showContactFeedback(type, text) {
    if (!feedbackBox) return;
    if (feedbackTimeout) clearTimeout(feedbackTimeout);

    if (!text) {
      feedbackBox.className = "contact-feedback hidden";
      feedbackBox.textContent = "";
      return;
    }

    feedbackBox.className = `contact-feedback feedback-${type}`;
    feedbackBox.textContent = text;

    if (type === "success") {
      feedbackTimeout = setTimeout(() => {
        feedbackBox.className = "contact-feedback hidden";
      }, 5000);
    }
  }

  // Clear invalid outline when the user starts typing in a field
  for (const field of fields) {
    field?.addEventListener("input", () => {
      field.classList.remove("input-invalid");
      if (feedbackBox && feedbackBox.classList.contains("feedback-error")) {
        showContactFeedback(null, "");
      }
    });
  }

  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const subject = subjectInput.value.trim();
    const messageTxt = messageInput.value.trim();

    // Reset invalid states
    for (const field of fields) {
      field.classList.remove("input-invalid");
    }

    // 1. Check that all fields are filled
    const emptyFields = [];
    if (!name) {
      nameInput.classList.add("input-invalid");
      emptyFields.push("Name");
    }
    if (!email) {
      emailInput.classList.add("input-invalid");
      emptyFields.push("Email");
    }
    if (!subject) {
      subjectInput.classList.add("input-invalid");
      emptyFields.push("Subject");
    }
    if (!messageTxt) {
      messageInput.classList.add("input-invalid");
      emptyFields.push("Message");
    }

    if (emptyFields.length > 0) {
      showContactFeedback(
        "error",
        `Please fill in all required fields (${emptyFields.join(", ")}).`
      );
      return;
    }

    // 2. Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      emailInput.classList.add("input-invalid");
      showContactFeedback("error", "Please enter a valid email address (e.g., name@example.com).");
      return;
    }

    // 3. Reset the form and show confirmation notification
    contactForm.reset();
    showContactFeedback(
      "success",
      `Thank you, ${name}! Your message has been sent successfully.`
    );

    // Also show the site's modal dialog notification if available
    if (dialog && title && message) {
      title.textContent = "Message Sent! 📌";
      message.textContent = `Thanks for reaching out, ${name}! Your message regarding "${subject}" has been sent.`;
      dialog.showModal();
    }
  });
}

// Initialize all page modules
syncNavbarAuthState();
initAuthPage();
initContactForm();
initCartUI();

// ============================================================================
// 6. FLOATING CART BUTTON & RIGHT CART DRAWER UI (Visual Only)
// ============================================================================
function initCartUI() {
  const floatingCartBtn = document.getElementById("floating-cart-btn");
  const cartDrawer = document.getElementById("cart-drawer");
  const cartBackdrop = document.getElementById("cart-backdrop");
  const cartCloseBtn = document.getElementById("cart-close-btn");
  const cartOpenTriggers = document.querySelectorAll("[data-cart-open]");

  if (!cartDrawer || !cartBackdrop) return;

  function openCartDrawer() {
    cartDrawer.classList.add("is-open");
    cartBackdrop.classList.add("is-open");
    cartDrawer.setAttribute("aria-hidden", "false");
  }

  function closeCartDrawer() {
    cartDrawer.classList.remove("is-open");
    cartBackdrop.classList.remove("is-open");
    cartDrawer.setAttribute("aria-hidden", "true");
  }

  // Open cart when clicking either the navbar cart button or the bottom-left floating button
  for (const trigger of cartOpenTriggers) {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      openCartDrawer();
    });
  }

  // Close cart when clicking the close button, the 50% dark backdrop, or pressing Escape
  cartCloseBtn?.addEventListener("click", closeCartDrawer);
  cartBackdrop.addEventListener("click", closeCartDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && cartDrawer.classList.contains("is-open")) {
      closeCartDrawer();
    }
  });

  // Show the bottom-left floating cart button when scrolling down
  if (floatingCartBtn) {
    function handleScroll() {
      if (window.scrollY > 120) {
        floatingCartBtn.classList.add("is-visible");
      } else {
        floatingCartBtn.classList.remove("is-visible");
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
  }
}

// ============================================================================
// 7. SUPABASE MENU & COUPON CMS ENGINE & ADMIN DASHBOARD (admin.html & index.html)
// ============================================================================
const CMS_STORAGE_KEY = "tack-eat.cms.restaurants.v2";
const COUPONS_STORAGE_KEY = "tack-eat.cms.coupons.v1";

const DEFAULT_COUPONS = [
  {
    code: "CRUNCH",
    discount_type: "fixed",
    discount_value: 5000,
    min_order: 0,
    description: "₩5,000 off with Tack-Eat CRUNCH promo!",
    active: true,
  },
  {
    code: "FIRST60",
    discount_type: "percent",
    discount_value: 60,
    min_order: 0,
    description: "60% off your first order!",
    active: true,
  },
  {
    code: "TACK10",
    discount_type: "percent",
    discount_value: 10,
    min_order: 15000,
    description: "10% off orders above ₩15,000!",
    active: true,
  },
];

function normalizeCoupon(raw) {
  return {
    code: String(raw.code || "").trim().toUpperCase(),
    discount_type: raw.discount_type === "percent" ? "percent" : "fixed",
    discount_value: Number(raw.discount_value) || 0,
    min_order: Number(raw.min_order) || 0,
    description: raw.description || "",
    active: raw.active !== false,
  };
}

async function loadCouponsFromCMS() {
  if (supabaseClient) {
    try {
      const { data: dbCoupons, error } = await supabaseClient
        .from("coupons")
        .select("*")
        .order("code");

      if (!error && Array.isArray(dbCoupons) && dbCoupons.length > 0) {
        const list = dbCoupons.map(normalizeCoupon);
        localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(list));
        return { coupons: list, source: "supabase" };
      }
    } catch {
      // fallback below
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(COUPONS_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length > 0) {
      return { coupons: saved.map(normalizeCoupon), source: "local" };
    }
  } catch {
    // ignore
  }

  return { coupons: DEFAULT_COUPONS.map(normalizeCoupon), source: "default" };
}

const formatCurrency =
  typeof formatWon === "function"
    ? formatWon
    : new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format;

function slugifyId(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `item-${Date.now()}`
  );
}

/**
 * Normalizes a restaurant object (either from Supabase DB or food-catalog.js)
 */
function normalizeRestaurant(raw) {
  return {
    id: raw.id,
    name: raw.name,
    cuisine: raw.cuisine || "Western",
    meal: raw.meal || undefined,
    meals: Array.isArray(raw.meals) && raw.meals.length ? raw.meals : ["Lunch", "Dinner"],
    dietary: raw.dietary || "Halal",
    price: raw.price || "$$",
    minutes: Number(raw.minutes) || 15,
    distance: Number(raw.distance) || 1.5,
    rating: Number(raw.rating) || 4.5,
    reviews: Number(raw.reviews) || 50,
    fee: Number(raw.fee) || 2500,
    freeDelivery: Boolean(raw.free_delivery ?? raw.freeDelivery),
    open: raw.open !== false,
    image: raw.image || `Assets/images/${raw.id}.webp`,
    offers: Array.isArray(raw.offers) ? raw.offers : ["Accept vouchers"],
    dishes: Array.isArray(raw.dishes)
      ? raw.dishes.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description || "",
          price: Number(d.price) || 10000,
          buyOneGetOne: Boolean(d.buy_one_get_one ?? d.buyOneGetOne),
        }))
      : [],
  };
}

/**
 * Loads the restaurant & dish catalog from:
 *   1. Supabase `restaurants` + `dishes` tables (if created)
 *   2. Otherwise falls back to localStorage overrides + `food-catalog.js` defaults
 */
async function loadCatalogFromCMS() {
  const defaultList =
    typeof restaurants !== "undefined" ? restaurants.map(normalizeRestaurant) : [];

  if (supabaseClient) {
    try {
      const [{ data: dbRests, error: rErr }, { data: dbDishes, error: dErr }] =
        await Promise.all([
          supabaseClient.from("restaurants").select("*").order("name"),
          supabaseClient.from("dishes").select("*").order("name"),
        ]);

      if (!rErr && !dErr && Array.isArray(dbRests) && dbRests.length > 0) {
        const dishesByRest = new Map();
        for (const d of dbDishes || []) {
          const list = dishesByRest.get(d.restaurant_id) || [];
          list.push({
            id: d.id,
            name: d.name,
            description: d.description || "",
            price: Number(d.price) || 1000,
            buyOneGetOne: Boolean(d.buy_one_get_one),
          });
          dishesByRest.set(d.restaurant_id, list);
        }

        const merged = dbRests.map((r) =>
          normalizeRestaurant({
            ...r,
            dishes: dishesByRest.get(r.id) || [],
          })
        );

        localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(merged));
        return { catalog: merged, source: "supabase" };
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback: check localStorage CMS cache, otherwise default food-catalog.js
  try {
    const saved = JSON.parse(localStorage.getItem(CMS_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length > 0) {
      return { catalog: saved.map(normalizeRestaurant), source: "local" };
    }
  } catch {
    // ignore
  }

  return { catalog: defaultList, source: "default" };
}

/**
 * Seeds the default `food-catalog.js` restaurants and dishes into Supabase
 */
async function seedDefaultCatalogToSupabase(currentCatalog) {
  if (!supabaseClient) return { ok: false, message: "Supabase client not initialized." };

  const sourceList =
    currentCatalog && currentCatalog.length
      ? currentCatalog
      : typeof restaurants !== "undefined"
      ? restaurants.map(normalizeRestaurant)
      : [];

  const restRows = sourceList.map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    meal: r.meal || null,
    meals: r.meals || ["Lunch", "Dinner"],
    dietary: r.dietary,
    price: r.price,
    minutes: r.minutes,
    distance: r.distance,
    rating: r.rating,
    reviews: r.reviews,
    fee: r.fee,
    free_delivery: Boolean(r.freeDelivery),
    open: r.open !== false,
    offers: r.offers || [],
    image: r.image || `Assets/images/${r.id}.webp`,
  }));

  const { error: rErr } = await supabaseClient
    .from("restaurants")
    .upsert(restRows, { onConflict: "id" });

  if (rErr) {
    return { ok: false, message: rErr.message };
  }

  const dishRows = sourceList.flatMap((r) =>
    (r.dishes || []).map((d) => ({
      id: d.id,
      restaurant_id: r.id,
      name: d.name,
      description: d.description || "",
      price: Number(d.price),
      buy_one_get_one: Boolean(d.buyOneGetOne),
    }))
  );

  if (dishRows.length > 0) {
    const { error: dErr } = await supabaseClient
      .from("dishes")
      .upsert(dishRows, { onConflict: "id,restaurant_id" });

    if (dErr) {
      return { ok: false, message: dErr.message };
    }
  }

  // Also seed default coupons if coupons table exists
  await supabaseClient
    .from("coupons")
    .upsert(DEFAULT_COUPONS, { onConflict: "code" });

  return { ok: true };
}

async function initAdminDashboard() {
  const adminUserDisplay = document.getElementById("admin-user-display");
  const adminLogoutBtn = document.getElementById("admin-logout-btn");
  const dishForm = document.getElementById("admin-dish-form");
  const restForm = document.getElementById("admin-restaurant-form");
  const itemsListEl = document.getElementById("admin-items-list");

  if (!adminUserDisplay && !adminLogoutBtn && !dishForm) return;

  if (supabaseClient) {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (user && adminUserDisplay) {
      const { username } = await checkUserRoleAndProfile(user);
      adminUserDisplay.textContent = `${username} (${user.email})`;
    }
  }

  adminLogoutBtn?.addEventListener("click", async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    window.location.href = "login.html";
  });

  if (!dishForm || !itemsListEl) return;

  const restSelect = document.getElementById("dish-restaurant-select");
  const filterPillsEl = document.getElementById("admin-filter-pills");
  const statRests = document.getElementById("stat-total-restaurants");
  const statDishes = document.getElementById("stat-total-dishes");
  const statCoupons = document.getElementById("stat-total-coupons");
  const statStatus = document.getElementById("stat-cms-status");
  const alertEl = document.getElementById("admin-cms-alert");
  const seedBtn = document.getElementById("admin-seed-btn");

  const couponForm = document.getElementById("admin-coupon-form");
  const couponsListEl = document.getElementById("admin-coupons-list");

  const editDishIdInput = document.getElementById("edit-dish-id");
  const dishHeading = document.getElementById("dish-form-heading");
  const dishNameInput = document.getElementById("menu-item-name");
  const dishPriceInput = document.getElementById("menu-item-price");
  const dishDescInput = document.getElementById("menu-item-desc");
  const dishBogoInput = document.getElementById("menu-item-bogo");
  const dishSubmitBtn = document.getElementById("dish-submit-btn");
  const dishCancelBtn = document.getElementById("dish-cancel-btn");

  let catalog = [];
  let couponsList = [];
  let activeRestaurantFilter = "all";
  let cmsSource = "default";

  function showAdminAlert(type, text) {
    if (!alertEl) return;
    if (!text) {
      alertEl.className = "contact-feedback hidden";
      alertEl.textContent = "";
      return;
    }
    alertEl.className = `contact-feedback feedback-${type === "error" ? "error" : "success"}`;
    alertEl.textContent = text;
  }

  function saveLocalCatalog() {
    localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(catalog));
  }

  function resetDishForm() {
    dishForm.reset();
    editDishIdInput.value = "";
    dishHeading.textContent = "+ Add New Dish to Menu";
    dishSubmitBtn.textContent = "Save Dish to Menu";
  }

  function renderAdminUI() {
    // 1. Update Stats
    const totalDishes = catalog.reduce((sum, r) => sum + (r.dishes?.length || 0), 0);
    if (statRests) statRests.textContent = catalog.length;
    if (statDishes) statDishes.textContent = totalDishes;
    if (statCoupons) statCoupons.textContent = couponsList.length;
    if (statStatus) {
      statStatus.textContent =
        cmsSource === "supabase" ? "● Supabase Live" : "● Local + Sync Ready";
    }

    // 1b. Render Active Coupons List
    if (couponsListEl) {
      if (couponsList.length === 0) {
        couponsListEl.innerHTML = `<p style="color:#64748b; font-size:14px;">No coupons created yet.</p>`;
      } else {
        couponsListEl.innerHTML = couponsList
          .map((c) => {
            const badgeLabel =
              c.discount_type === "percent"
                ? `${c.discount_value}% OFF`
                : `${formatCurrency(c.discount_value)} OFF`;
            const minText =
              c.min_order > 0 ? `Min. order ${formatCurrency(c.min_order)}` : "No min. order";
            return `
              <article class="admin-menu-row" style="padding: 12px 14px;">
                <div class="admin-item-details">
                  <div class="admin-item-top">
                    <h3><code>${c.code}</code></h3>
                    <span class="admin-price-badge">${badgeLabel}</span>
                  </div>
                  <p style="margin-bottom: 6px;">${c.description}</p>
                  <div class="admin-item-meta">
                    <span class="meta-tag">${minText}</span>
                    <span class="meta-status status-instock">● Active</span>
                  </div>
                </div>
                <div class="admin-item-actions">
                  <button type="button" class="admin-action-btn btn-danger" data-coupon-delete="${c.code}">Delete</button>
                </div>
              </article>
            `;
          })
          .join("");
      }
    }

    // 2. Populate Restaurant Select Dropdown
    const prevSelected = restSelect.value;
    restSelect.innerHTML = catalog
      .map((r) => `<option value="${r.id}">${r.name} (${r.cuisine})</option>`)
      .join("");
    if (prevSelected && catalog.some((r) => r.id === prevSelected)) {
      restSelect.value = prevSelected;
    }

    // 3. Populate Filter Pills
    if (filterPillsEl) {
      filterPillsEl.innerHTML = [
        `<button type="button" class="filter-pill ${
          activeRestaurantFilter === "all" ? "active" : ""
        }" data-filter="all">All (${totalDishes})</button>`,
        ...catalog.map(
          (r) =>
            `<button type="button" class="filter-pill ${
              activeRestaurantFilter === r.id ? "active" : ""
            }" data-filter="${r.id}">${r.name} (${r.dishes?.length || 0})</button>`
        ),
      ].join("");
    }

    // 4. Render Dishes List grouped/filtered by restaurant
    const visibleRestaurants =
      activeRestaurantFilter === "all"
        ? catalog
        : catalog.filter((r) => r.id === activeRestaurantFilter);

    const rows = [];
    for (const r of visibleRestaurants) {
      const thumb = r.image || `Assets/images/${r.id}.webp`;
      for (const dish of r.dishes || []) {
        rows.push(`
          <article class="admin-menu-row">
            <img src="${thumb}" alt="${r.name}" class="admin-item-thumb" onerror="this.src='Assets/images/burger-hero.png'">
            <div class="admin-item-details">
              <div class="admin-item-top">
                <h3>${dish.name}</h3>
                <span class="admin-price-badge">${formatCurrency(dish.price)}</span>
              </div>
              <p>${dish.description}</p>
              <div class="admin-item-meta">
                <span class="meta-tag">${r.name} · ${r.cuisine}</span>
                <span class="meta-tag">${r.dietary}</span>
                ${
                  dish.buyOneGetOne
                    ? `<span class="meta-status status-instock">★ Buy 1 Free 1</span>`
                    : `<span class="meta-status status-instock">● Available</span>`
                }
              </div>
            </div>
            <div class="admin-item-actions">
              <button type="button" class="admin-action-btn" data-admin-action="edit-dish" data-rest="${r.id}" data-dish="${dish.id}">Edit</button>
              <button type="button" class="admin-action-btn btn-danger" data-admin-action="delete-dish" data-rest="${r.id}" data-dish="${dish.id}">Delete</button>
            </div>
          </article>
        `);
      }
    }

    itemsListEl.innerHTML = rows.length
      ? rows.join("")
      : `<p style="color:#64748b;">No dishes in this category yet. Use the form on the left to add one!</p>`;
  }

  async function refreshAdminCatalog() {
    const [res, couponRes] = await Promise.all([
      loadCatalogFromCMS(),
      loadCouponsFromCMS(),
    ]);
    catalog = res.catalog;
    couponsList = couponRes.coupons;
    cmsSource = res.source === "supabase" || couponRes.source === "supabase" ? "supabase" : res.source;
    renderAdminUI();
  }

  // Create / Update Coupon Submit
  couponForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = document.getElementById("coupon-code").value.trim().toUpperCase();
    const discount_type = document.getElementById("coupon-type").value;
    const discount_value = Math.round(parseFloat(document.getElementById("coupon-value").value));
    const min_order = Math.round(parseFloat(document.getElementById("coupon-min-order").value) || 0);
    const description = document.getElementById("coupon-desc").value.trim();

    if (!code || isNaN(discount_value) || discount_value <= 0 || !description) {
      showAdminAlert("error", "Please enter a valid coupon code, discount value, and description.");
      return;
    }

    if (discount_type === "percent" && discount_value > 100) {
      showAdminAlert("error", "Percentage discount cannot exceed 100%.");
      return;
    }

    const newCoupon = normalizeCoupon({
      code,
      discount_type,
      discount_value,
      min_order,
      description,
      active: true,
    });

    const existingIdx = couponsList.findIndex((c) => c.code === code);
    if (existingIdx >= 0) {
      couponsList[existingIdx] = newCoupon;
    } else {
      couponsList.unshift(newCoupon);
    }
    localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(couponsList));

    let syncedToDb = false;
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("coupons")
        .upsert([newCoupon], { onConflict: "code" });
      if (!error) {
        syncedToDb = true;
        cmsSource = "supabase";
      }
    }

    couponForm.reset();
    renderAdminUI();
    showAdminAlert(
      "success",
      syncedToDb
        ? `Coupon code "${code}" saved to Supabase!`
        : `Coupon code "${code}" saved! Customers can now apply it at checkout.`
    );
  });

  // Delete Coupon Click
  couponsListEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-coupon-delete]");
    if (!btn) return;
    const code = btn.dataset.couponDelete;
    couponsList = couponsList.filter((c) => c.code !== code);
    localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(couponsList));

    if (supabaseClient) {
      await supabaseClient.from("coupons").delete().eq("code", code);
    }

    renderAdminUI();
    showAdminAlert("success", `Coupon "${code}" deleted.`);
  });

  // Filter pill click
  filterPillsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    activeRestaurantFilter = btn.dataset.filter;
    renderAdminUI();
  });

  // Cancel / clear dish form
  dishCancelBtn?.addEventListener("click", resetDishForm);

  // Add or Update Dish Submit
  dishForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const restId = restSelect.value;
    const name = dishNameInput.value.trim();
    const priceWon = Math.round(parseFloat(dishPriceInput.value));
    const description = dishDescInput.value.trim();
    const buyOneGetOne = dishBogoInput.checked;

    if (!restId || !name || isNaN(priceWon) || priceWon <= 0 || !description) {
      showAdminAlert("error", "Please fill in the dish name, valid price (KRW ₩), and description.");
      return;
    }

    const priceCents = priceWon;
    const dishId = editDishIdInput.value || slugifyId(name);
    const targetRest = catalog.find((r) => r.id === restId);
    if (!targetRest) return;

    // Update in-memory & localStorage catalog immediately
    const existingIndex = targetRest.dishes.findIndex((d) => d.id === dishId);
    const dishObj = { id: dishId, name, description, price: priceCents, buyOneGetOne };

    if (existingIndex >= 0) {
      targetRest.dishes[existingIndex] = dishObj;
    } else {
      targetRest.dishes.push(dishObj);
    }
    saveLocalCatalog();

    // Sync to Supabase if tables exist
    let syncedToDb = false;
    if (supabaseClient) {
      // Ensure parent restaurant exists in DB first
      await supabaseClient.from("restaurants").upsert(
        [
          {
            id: targetRest.id,
            name: targetRest.name,
            cuisine: targetRest.cuisine,
            meal: targetRest.meal || null,
            meals: targetRest.meals,
            dietary: targetRest.dietary,
            price: targetRest.price,
            minutes: targetRest.minutes,
            distance: targetRest.distance,
            rating: targetRest.rating,
            reviews: targetRest.reviews,
            fee: targetRest.fee,
            free_delivery: Boolean(targetRest.freeDelivery),
            open: targetRest.open !== false,
            offers: targetRest.offers || [],
            image: targetRest.image || `Assets/images/${targetRest.id}.webp`,
          },
        ],
        { onConflict: "id" }
      );

      const { error } = await supabaseClient.from("dishes").upsert(
        [
          {
            id: dishId,
            restaurant_id: restId,
            name,
            description,
            price: priceCents,
            buy_one_get_one: buyOneGetOne,
          },
        ],
        { onConflict: "id,restaurant_id" }
      );

      if (!error) {
        syncedToDb = true;
        cmsSource = "supabase";
      }
    }

    resetDishForm();
    renderAdminUI();
    showAdminAlert(
      "success",
      syncedToDb
        ? `"${name}" saved to ${targetRest.name} in Supabase!`
        : `"${name}" saved to ${targetRest.name}! (Run the CMS SQL setup in Supabase to enable cloud persistence.)`
    );
  });

  // Add New Restaurant Submit
  restForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("rest-name").value.trim();
    const cuisine = document.getElementById("rest-cuisine").value;
    const dietary = document.getElementById("rest-dietary").value;
    const price = document.getElementById("rest-price").value;
    const minutes = parseInt(document.getElementById("rest-minutes").value, 10) || 15;
    const feeRm = parseFloat(document.getElementById("rest-fee").value) || 0;
    const imageInput = document.getElementById("rest-image").value.trim();
    const freeDelivery = document.getElementById("rest-free-delivery").checked;

    if (!name) {
      showAdminAlert("error", "Please enter a restaurant name.");
      return;
    }

    const id = slugifyId(name);
    const feeCents = Math.round(feeRm);
    const defaultCuisineImg = `Assets/images/${cuisine.toLowerCase()}.webp`;
    const image = imageInput || defaultCuisineImg;

    const newRest = normalizeRestaurant({
      id,
      name,
      cuisine,
      meals: ["Lunch", "Dinner"],
      dietary,
      price,
      minutes,
      distance: 1.5,
      rating: 4.8,
      reviews: 1,
      fee: feeCents,
      freeDelivery,
      open: true,
      image,
      offers: ["Accept vouchers"],
      dishes: [],
    });

    const existingIdx = catalog.findIndex((r) => r.id === id);
    if (existingIdx >= 0) {
      newRest.dishes = catalog[existingIdx].dishes;
      catalog[existingIdx] = newRest;
    } else {
      catalog.unshift(newRest);
    }
    saveLocalCatalog();

    let syncedToDb = false;
    if (supabaseClient) {
      const { error } = await supabaseClient.from("restaurants").upsert(
        [
          {
            id: newRest.id,
            name: newRest.name,
            cuisine: newRest.cuisine,
            meals: newRest.meals,
            dietary: newRest.dietary,
            price: newRest.price,
            minutes: newRest.minutes,
            distance: newRest.distance,
            rating: newRest.rating,
            reviews: newRest.reviews,
            fee: newRest.fee,
            free_delivery: newRest.freeDelivery,
            open: true,
            offers: newRest.offers,
            image: newRest.image,
          },
        ],
        { onConflict: "id" }
      );
      if (!error) {
        syncedToDb = true;
        cmsSource = "supabase";
      }
    }

    restForm.reset();
    activeRestaurantFilter = newRest.id;
    renderAdminUI();
    restSelect.value = newRest.id;
    showAdminAlert(
      "success",
      syncedToDb
        ? `Restaurant "${name}" created in Supabase! Now add dishes to it using the top form.`
        : `Restaurant "${name}" created! Now add dishes to it using the top form.`
    );
  });

  // Edit / Delete Dish Click Handler
  itemsListEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-admin-action]");
    if (!btn) return;

    const action = btn.dataset.adminAction;
    const restId = btn.dataset.rest;
    const dishId = btn.dataset.dish;
    const targetRest = catalog.find((r) => r.id === restId);
    if (!targetRest) return;

    if (action === "edit-dish") {
      const dish = targetRest.dishes.find((d) => d.id === dishId);
      if (!dish) return;

      restSelect.value = restId;
      editDishIdInput.value = dish.id;
      dishNameInput.value = dish.name;
      dishPriceInput.value = dish.price;
      dishDescInput.value = dish.description;
      dishBogoInput.checked = Boolean(dish.buyOneGetOne);

      dishHeading.textContent = `Editing: ${dish.name}`;
      dishSubmitBtn.textContent = "Update Dish";
      dishForm.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (action === "delete-dish") {
      targetRest.dishes = targetRest.dishes.filter((d) => d.id !== dishId);
      saveLocalCatalog();

      if (supabaseClient) {
        await supabaseClient
          .from("dishes")
          .delete()
          .eq("id", dishId)
          .eq("restaurant_id", restId);
      }

      renderAdminUI();
      showAdminAlert("success", "Dish removed from menu.");
    }
  });

  // Sync Default Catalog to Supabase Button
  seedBtn?.addEventListener("click", async () => {
    seedBtn.disabled = true;
    seedBtn.textContent = "Syncing to Supabase...";
    const res = await seedDefaultCatalogToSupabase(catalog);
    seedBtn.disabled = false;
    seedBtn.textContent = "Sync Default Catalog to Supabase";

    if (res.ok) {
      cmsSource = "supabase";
      await refreshAdminCatalog();
      showAdminAlert(
        "success",
        "All restaurants and dishes are now synced to your Supabase database!"
      );
    } else {
      showAdminAlert(
        "error",
        `Supabase Sync Error: ${res.message}. Run the SQL table setup first.`
      );
    }
  });

  await refreshAdminCatalog();
}

initAdminDashboard();

// ============================================================================
// 8. FOOD SECTION (Merged from SARA/food.js + Powered by Supabase CMS)
// ============================================================================
async function initFoodSection() {
  const filters = document.querySelector('#filter-form');
  const search = document.querySelector('#search-query');
  const cuisineList = document.querySelector('#cuisine-list');
  const offerList = document.querySelector('#offer-list');
  const grid = document.querySelector('#restaurant-grid');
  const results = document.querySelector('#results-status');
  const feedback = document.querySelector('#feedback');
  const dialog = document.querySelector('#food-dialog');
  const dialogContent = document.querySelector('#dialog-content');
  const filterPanel = document.querySelector('#filter-panel');
  const cartTrigger = document.querySelector('.cart-trigger') || document.querySelector('.nav-cart-trigger');
  const cartCount = document.querySelector('#cart-count');

  if (!filters || !grid || typeof restaurants === 'undefined') return;

  // Load live catalog and coupons from Supabase CMS (or fallback to local/default catalog)
  const [{ catalog: activeRestaurants }, { coupons: activeCoupons }] = await Promise.all([
    loadCatalogFromCMS(),
    loadCouponsFromCMS(),
  ]);

  const byId = new Map(activeRestaurants.map(restaurant => [restaurant.id, restaurant]));
  const offersById = new Map(offers.map(offer => [offer.id, offer]));
  const couponsByCode = new Map(activeCoupons.map(c => [c.code.toUpperCase(), c]));
  const asset = name => `Assets/images/${name}`;
  const restaurantImage = restaurant => restaurant.image || asset(`${restaurant.id}.webp`);
  const maxQuantity = 20;
  const maxNoteLength = 120;
  const storageKey = 'tack-eat.food.v1';
  const portions = { Regular: 0, Large: 3000 };
  const restaurantSorts = {
    fastest: (a, b) => a.minutes - b.minutes,
    distance: (a, b) => a.distance - b.distance,
    rating: (a, b) => b.rating - a.rating,
  };
  const quickFilters = {
    'Ratings 4+': restaurant => restaurant.rating >= 4,
    'Under 20 min': restaurant => restaurant.minutes < 20,
    'Free delivery': restaurant => Boolean(restaurant.freeDelivery),
    'Open now': restaurant => restaurant.open,
  };
  const filterMatches = {
    quick: (restaurant, value) => quickFilters[value](restaurant),
    offer: (restaurant, value) => restaurant.offers.includes(value),
    meal: (restaurant, value) => restaurant.meals.includes(value),
    cuisine: (restaurant, value) => restaurant.cuisine === value,
    dietary: (restaurant, value) => restaurant.dietary === value,
    price: (restaurant, value) => restaurant.price === value,
  };

  // Floating Right Cart Drawer Elements
  const cartDrawer = document.getElementById('cart-drawer');
  const cartBackdrop = document.getElementById('cart-backdrop');
  const cartDrawerBody = document.getElementById('cart-drawer-body');
  const cartDrawerModeSub = document.getElementById('cart-drawer-mode-subtitle');
  const cartTotalsBreakdown = document.getElementById('cart-totals-breakdown');
  const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
  const cartCouponForm = document.getElementById('cart-coupon-form');
  const cartCouponInput = document.getElementById('cart-coupon-input');
  const cartCouponStatus = document.getElementById('cart-coupon-status');
  const floatingCartCount = document.getElementById('floating-cart-count');
  const navLocationText = document.getElementById('nav-location-text');

  // ==========================================================================
  // ACCOUNT-CONNECTED SAVED LOCATIONS & CONTACT MANAGER (Navbar Only)
  // ==========================================================================
  let locationAccountUser = null;
  let locationAccountUsername = '';
  let savedLocations = [];
  let activeLocationId = null;

  function getLocationStorageKey() {
    return locationAccountUser
      ? `tack_eat_locations_user_${locationAccountUser.id}`
      : 'tack_eat_locations_guest';
  }

  function getLabelIcon(label = '') {
    const clean = label.trim().toLowerCase();
    if (clean.includes('home')) return '🏠';
    if (clean.includes('office') || clean.includes('work')) return '🏢';
    if (clean.includes('campus') || clean.includes('dorm') || clean.includes('school')) return '🎓';
    if (clean.includes('partner') || clean.includes('friend')) return '❤️';
    return '📍';
  }

  function getActiveLocation() {
    if (!savedLocations.length) return null;
    return savedLocations.find(loc => loc.id === activeLocationId) || savedLocations[0];
  }

  function getFormattedLocationSummary() {
    const active = getActiveLocation();
    if (!active) return 'Seoul, KR · Now';
    return `${active.label} · ${active.address}`;
  }

  function updateNavbarLocationDisplay() {
    const summary = getFormattedLocationSummary();
    if (navLocationText) {
      navLocationText.textContent = summary;
    }
    if (cartDrawerModeSub) {
      cartDrawerModeSub.textContent = `${cart.mode === 'pickup' ? 'Pick-up' : 'Delivery'} · ${summary}`;
    }
  }

  async function loadAccountLocations() {
    if (supabaseClient) {
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        locationAccountUser = user || null;
        if (user) {
          const profileInfo = await checkUserRoleAndProfile(user);
          locationAccountUsername = profileInfo.username || user.email?.split('@')[0] || 'Member';
        }
      } catch {
        locationAccountUser = null;
      }
    }

    const localKey = getLocationStorageKey();
    let localData = null;
    try {
      localData = JSON.parse(localStorage.getItem(localKey));
    } catch {
      localData = null;
    }

    // 1. If authenticated, check Supabase Auth user_metadata (and merge with local cache)
    const metaLocations = locationAccountUser?.user_metadata?.saved_locations;
    const metaActiveId = locationAccountUser?.user_metadata?.active_location_id;

    if (Array.isArray(metaLocations) && metaLocations.length > 0) {
      savedLocations = metaLocations;
      activeLocationId = metaActiveId || metaLocations[0].id;
      try {
        localStorage.setItem(localKey, JSON.stringify({ locations: savedLocations, activeId: activeLocationId }));
      } catch { /* ignore */ }
    } else if (localData && Array.isArray(localData.locations)) {
      savedLocations = localData.locations;
      activeLocationId = localData.activeId || (savedLocations[0]?.id ?? null);
    } else {
      savedLocations = [];
      activeLocationId = null;
    }

    updateNavbarLocationDisplay();
  }

  async function persistAccountLocations() {
    const localKey = getLocationStorageKey();
    try {
      localStorage.setItem(localKey, JSON.stringify({
        locations: savedLocations,
        activeId: activeLocationId,
      }));
    } catch { /* ignore */ }

    updateNavbarLocationDisplay();

    // Sync directly to the user's Supabase Auth account metadata so it follows their account
    if (supabaseClient && locationAccountUser) {
      try {
        await supabaseClient.auth.updateUser({
          data: {
            saved_locations: savedLocations,
            active_location_id: activeLocationId,
          },
        });
      } catch {
        // Fallback already stored in user-scoped localStorage
      }
    }
  }

  function showLocationManager(editingId = null) {
    const editingLoc = editingId ? savedLocations.find(l => l.id === editingId) : null;
    const activeLoc = getActiveLocation();
    const defaultContactName = editingLoc?.contactName || locationAccountUsername || '';
    const defaultContactPhone = editingLoc?.contactPhone || (savedLocations[0]?.contactPhone ?? '');
    const currentLabel = editingLoc?.label || 'Home';
    const presets = ['Home', 'Office', 'Campus', 'Other'];

    const accountBannerHtml = locationAccountUser
      ? `<div class="location-account-banner">
           <span>✓ Connected to account <strong>@${escapeText(locationAccountUsername)}</strong> — Locations auto-save to your account</span>
         </div>`
      : `<div class="location-account-banner">
           <span>Saving on this device. <a href="login.html">Sign in / Register</a> to sync locations (Home, Office, etc.) to your account.</span>
         </div>`;

    const savedListHtml = savedLocations.length > 0
      ? `<div class="saved-locations-section">
           <div class="saved-locations-heading">Your Saved Locations (${savedLocations.length})</div>
           <ul class="saved-locations-list">
             ${savedLocations.map(loc => {
               const isActive = activeLoc && activeLoc.id === loc.id;
               return `
                 <li class="saved-location-card ${isActive ? 'is-active' : ''}">
                   <div class="saved-location-main">
                     <div class="saved-location-header">
                       <span class="saved-location-tag">${getLabelIcon(loc.label)} ${escapeText(loc.label)}</span>
                       ${isActive ? '<span class="saved-location-active-pill">Active on Navbar</span>' : ''}
                     </div>
                     <p class="saved-location-address">${escapeText(loc.address)}</p>
                     <p class="saved-location-contact">👤 ${escapeText(loc.contactName)} · 📞 ${escapeText(loc.contactPhone)}</p>
                     ${loc.notes ? `<p class="saved-location-notes">Note: "${escapeText(loc.notes)}"</p>` : ''}
                   </div>
                   <div class="saved-location-actions">
                     ${!isActive ? `<button type="button" class="loc-action-btn loc-use-btn" data-action="select-location" data-location-id="${loc.id}">Use Location</button>` : ''}
                     <div class="saved-location-actions-row">
                       <button type="button" class="loc-action-btn" data-action="edit-location" data-location-id="${loc.id}">Edit</button>
                       <button type="button" class="loc-action-btn loc-delete-btn" data-action="delete-location" data-location-id="${loc.id}">Delete</button>
                     </div>
                   </div>
                 </li>
               `;
             }).join('')}
           </ul>
         </div>`
      : `<p class="order-note">No saved locations yet. Add your Home, Office, or delivery address & contact details below!</p>`;

    showDialog('location', 'Delivery Location & Contact', `
      ${accountBannerHtml}
      ${savedListHtml}
      <div class="location-form-divider">
        <h3>${editingLoc ? `Edit "${escapeText(editingLoc.label)}" Location` : '+ Add New Location & Contact Info'}</h3>
      </div>
      <form class="dish-form" id="location-manager-form">
        <input type="hidden" name="editId" value="${editingLoc ? escapeText(editingLoc.id) : ''}">
        <div>
          <label>Location Label (e.g. Home, Office)</label>
          <div class="location-preset-chips">
            ${presets.map(preset => `
              <button type="button" class="location-preset-chip ${currentLabel.toLowerCase() === preset.toLowerCase() ? 'is-selected' : ''}" data-action="location-preset" data-preset="${preset}">
                ${getLabelIcon(preset)} ${preset}
              </button>
            `).join('')}
          </div>
          <input type="text" id="location-label-input" name="label" value="${escapeText(currentLabel)}" placeholder="Home, Office, Dorm, etc." maxlength="32" required>
        </div>
        <label>
          Delivery Address (Manual Entry)
          <input type="text" name="address" value="${editingLoc ? escapeText(editingLoc.address) : ''}" placeholder="e.g. 123 Teheran-ro, Apt 402, Gangnam-gu, Seoul" maxlength="120" required>
        </label>
        <div class="location-contact-grid">
          <label>
            Contact Name
            <input type="text" name="contactName" value="${escapeText(defaultContactName)}" placeholder="Recipient full name" maxlength="60" required>
          </label>
          <label>
            Contact Phone Number
            <input type="tel" name="contactPhone" value="${escapeText(defaultContactPhone)}" placeholder="e.g. 010-1234-5678" maxlength="30" required>
          </label>
        </div>
        <label>
          Delivery Instructions / Gate Code (Optional)
          <input type="text" name="notes" value="${editingLoc?.notes ? escapeText(editingLoc.notes) : ''}" placeholder="e.g. Leave at reception / Door pin #1234" maxlength="100">
        </label>
        <div class="dialog-actions">
          ${editingLoc ? '<button class="secondary-button" type="button" data-action="location">Cancel Edit</button>' : '<button class="secondary-button" type="button" data-action="locate-nearby">Show Nearby Spots</button>'}
          <button class="primary-button" type="submit">${editingLoc ? 'Update Location' : 'Save & Use Location'}</button>
        </div>
      </form>
    `);
  }

  let cart = readCart();
  let offersOnly = false;
  let currentDish;
  let feedbackTimer;

  function getDish(restaurantId, dishId) {
    return byId.get(restaurantId)?.dishes.find(dish => dish.id === dishId);
  }

  function readCart(raw) {
    const empty = { lines: [], promotion: null, couponCode: null, placedOrder: false, mode: 'delivery' };
    try {
      const saved = JSON.parse(raw === undefined ? localStorage.getItem(storageKey) : raw);
      if (!saved || !Array.isArray(saved.lines)) return empty;

      const lines = saved.lines.filter(line => line && getDish(line.restaurantId, line.dishId)
        && Object.hasOwn(portions, line.portion) && typeof line.notes === 'string'
        && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= maxQuantity)
        .map(line => ({ ...line, notes: line.notes.slice(0, maxNoteLength) }));
      return {
        lines,
        promotion: offersById.get(saved.promotion)?.code ? saved.promotion : null,
        couponCode: typeof saved.couponCode === 'string' ? saved.couponCode.toUpperCase() : null,
        placedOrder: saved.placedOrder === true,
        mode: saved.mode === 'pickup' ? 'pickup' : 'delivery',
      };
    } catch {
      return empty;
    }
  }

  function updateCartBadge() {
    const count = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
    if (cartCount) {
      cartCount.textContent = count;
      cartCount.hidden = count === 0;
    }
    if (floatingCartCount) {
      floatingCartCount.textContent = count;
      floatingCartCount.hidden = count === 0;
    }
    if (cartTrigger) {
      cartTrigger.setAttribute('aria-label', `Cart, ${count} ${count === 1 ? 'item' : 'items'}`);
    }
    renderCartDrawer();
  }

  function saveCart() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      // Keep the current cart usable when the browser blocks storage.
    }
    updateCartBadge();
  }

  function escapeText(value) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return value.replace(/[&<>"']/g, character => entities[character]);
  }

  function announce(message) {
    clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedbackTimer = setTimeout(() => { feedback.textContent = ''; }, 3200);
  }

  function renderBrowseControls() {
    document.querySelector('#filter-groups').innerHTML = filterGroups.map(({ key, title, values }) => `
      <fieldset class="${key === 'price' ? 'price-options' : ''}">
        <legend>${title}</legend>
        ${values.map(value => `<label><input type="checkbox" name="${key}" value="${value}"><span>${value}</span></label>`).join('')}
      </fieldset>`).join('');

    cuisineList.innerHTML = cuisines.map((cuisine, i) => `
      <button type="button" class="cuisine-card" style="--card-i:${i}" data-action="cuisine" data-cuisine="${cuisine}" aria-pressed="false">
        <img src="${asset(`${cuisine.toLowerCase()}.webp`)}" alt="" width="110" height="108">
        <span>${cuisine}</span>
      </button>`).join('');

    const carouselOffers = [...offers, offersById.get('chicken')];
    offerList.innerHTML = carouselOffers.map((offer, i) => `
      <button type="button" class="offer-card ${offer.color ?? ''}" style="--card-i:${i}" data-action="offer" data-offer="${offer.id}" aria-haspopup="dialog">
        <span class="offer-shadow" aria-hidden="true"></span>
        <img class="offer-art" src="${asset(offer.image)}" alt="">
        <span class="offer-brand" aria-hidden="true">
          <img src="${offer.color === 'red' ? 'Assets/logo/Tack-Eat_Logo-Orange.svg' : asset('offer-logo-green.svg')}" alt="" width="592" height="75">
        </span>
        <span class="offer-title">${offer.title}</span>
        <span class="offer-copy">${offer.subtitle}</span>
        <span class="offer-code"><span>code</span><span>${offer.code}</span></span>
        <span class="offer-terms">T&amp;Cs apply.</span>
      </button>`).join('');
  }

  function matchingRestaurants(values, query) {
    const terms = query.split(/\s+/).filter(Boolean);
    const selections = filterGroups.map(({ key }) => [key, values.getAll(key)]);
    const matches = activeRestaurants.filter(restaurant => {
      const text = [restaurant.name, restaurant.cuisine, restaurant.dietary, ...restaurant.meals,
        ...restaurant.dishes.flatMap(dish => [dish.name, dish.description])].join(' ').toLowerCase();
      return (!offersOnly || restaurant.offers.length || restaurant.freeDelivery)
        && terms.every(term => text.includes(term))
        && selections.every(([key, selected]) => selected.length === 0 || (key === 'quick'
          ? selected.every(value => filterMatches[key](restaurant, value))
          : selected.some(value => filterMatches[key](restaurant, value))));
    });
    const compare = restaurantSorts[values.get('sort')];
    return compare ? matches.sort(compare) : matches;
  }

  function restaurantCard(restaurant, showDistance, index = 0) {
    const meal = restaurant.meal ? ` · ${restaurant.meal}` : '';
    const distance = showDistance ? ` · ${restaurant.distance.toFixed(1)} km` : '';
    const pickingUp = cart.mode === 'pickup';
    const timing = pickingUp ? 'Pick-up from' : 'From';
    const freeDelivery = restaurant.freeDelivery;
    const feeAmount = formatWon(restaurant.fee);
    const fee = freeDelivery
      ? `<del>${feeAmount}</del><span class="free-delivery-label">Free Delivery</span>`
      : `<span>${feeAmount}</span>`;
    const deliveryFee = `<img class="delivery-fee-icon" src="${asset('delivery-scooter.png')}" alt="" width="19" height="15">${fee}`;
    const score = restaurant.rating.toFixed(1);
    return `
      <button type="button" class="restaurant-card" style="--card-i:${index}" data-action="restaurant" data-restaurant="${restaurant.id}" aria-haspopup="dialog">
        <img src="${restaurantImage(restaurant)}" alt="" width="349" height="207" loading="lazy">
        <span class="restaurant-title">
          <span class="restaurant-name">${escapeText(restaurant.name)}</span>
          <span class="rating" aria-label="${score} stars from ${restaurant.reviews} reviews">
            <span class="star" aria-hidden="true">✭</span> ${score} <span class="review-count">(${restaurant.reviews})</span>
          </span>
        </span>
        <span class="restaurant-meta"><span>${restaurant.open ? `${timing} ${restaurant.minutes} min${distance}` : 'Closed'}</span><span>${restaurant.price}</span><span>${restaurant.cuisine}${meal}</span><span>${restaurant.dietary}</span></span>
        <span class="restaurant-fee${freeDelivery ? ' free-delivery' : ''}" title="Delivery fee">${deliveryFee}</span>
      </button>`;
  }

  function renderRestaurants() {
    const values = new FormData(filters);
    const query = search.value.trim().toLowerCase();
    const matches = matchingRestaurants(values, query);
    const activeCount = filterGroups.reduce((total, group) => total + values.getAll(group.key).length, 0);
    const sort = values.get('sort');
    document.querySelector('#filter-count').textContent = activeCount;
    document.querySelector('#filter-count').hidden = !activeCount;
    document.querySelector('#reset-filters').hidden = !activeCount && sort === 'relevance';
    document.querySelector('#restaurant-heading').textContent = offersOnly ? 'Restaurants with offers' : 'All restaurants';
    results.textContent = activeCount || offersOnly || query || sort !== 'relevance'
      ? `${matches.length} ${matches.length === 1 ? 'restaurant' : 'restaurants'} found`
      : '';
    grid.innerHTML = matches.map((restaurant, idx) => restaurantCard(restaurant, sort === 'distance', idx)).join('');
    grid.hidden = matches.length === 0;
    document.querySelector('#no-results').hidden = matches.length > 0;

    for (const button of cuisineList.querySelectorAll('[data-cuisine]')) {
      button.setAttribute('aria-pressed', values.getAll('cuisine').includes(button.dataset.cuisine));
    }
    for (const button of document.querySelectorAll('[data-mode]')) {
      const mode = offersOnly ? 'offers' : cart.mode;
      button.setAttribute('aria-pressed', mode === button.dataset.mode);
    }
  }

  function focusSection(selector) {
    const heading = document.querySelector(selector);
    heading.scrollIntoView({ block: 'start' });
    heading.focus({ preventScroll: true });
  }

  function setFilter(key, value, checked) {
    const control = [...filters.elements].find(input => input.name === key && input.value === value);
    control.checked = checked ?? !control.checked;
    renderRestaurants();
  }

  function resetFilters() {
    for (const input of filters.querySelectorAll('input')) input.checked = input.defaultChecked;
    renderRestaurants();
  }

  function setupCarousel(track, keepArrowsVisible = false) {
    const arrows = [...track.parentElement.querySelectorAll('[data-scroll]')];
    function updateArrows() {
      const disabled = [track.scrollLeft < 2, track.scrollLeft + track.clientWidth >= track.scrollWidth - 2];
      const focusedArrow = arrows.indexOf(document.activeElement);
      for (const [index, arrow] of arrows.entries()) {
        arrow.hidden = disabled[index] && !keepArrowsVisible;
        arrow.disabled = disabled[index];
      }
      if (focusedArrow !== -1 && disabled[focusedArrow]) {
        arrows.find(arrow => !arrow.disabled)?.focus({ preventScroll: true });
      }
    }
    for (const arrow of arrows) {
      arrow.addEventListener('click', () => {
        const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
        track.scrollBy({ left: Number(arrow.dataset.scroll) * track.clientWidth * .8, behavior });
      });
    }
    track.addEventListener('scroll', updateArrows, { passive: true });
    new ResizeObserver(updateArrows).observe(track);
    updateArrows();
  }

  function showDialog(view, title, contents, focus = true) {
    dialog.dataset.view = view;
    dialogContent.innerHTML = `<h2 id="dialog-title" tabindex="-1">${escapeText(title)}</h2>${contents}`;
    if (!dialog.open) dialog.showModal();
    if (focus) {
      dialog.scrollTop = 0;
      dialogContent.firstElementChild.focus({ preventScroll: true });
    }
  }

  function showRestaurant(restaurantId) {
    const restaurant = byId.get(restaurantId);
    showDialog('menu', restaurant.name, `
      <p>${restaurant.cuisine} · ${restaurant.dietary} · ${restaurant.open ? `From ${restaurant.minutes} min` : 'Currently closed'}</p>
      <ul class="menu-list">
        ${restaurant.dishes.map(dish => `
          <li>
            <button type="button" data-action="dish" data-restaurant="${restaurant.id}" data-dish="${dish.id}" ${restaurant.open ? '' : 'disabled'}>
              <h3>${dish.name}</h3><p>${dish.description}</p>
            </button>
            <strong class="dish-price">${formatWon(dish.price)}</strong>
          </li>`).join('')}
      </ul>
      <img class="dialog-photo" src="${restaurantImage(restaurant)}" alt="" width="349" height="207">`);
  }

  function showDish(restaurantId, dishId) {
    const dish = getDish(restaurantId, dishId);
    currentDish = { restaurantId, dishId };
    showDialog('dish', dish.name, `
      <p>${dish.description}</p>
      <form class="dish-form" id="dish-form">
        <div class="dish-options">
          <label>Portion <select name="portion"><option>Regular</option><option value="Large">Large (+${formatWon(portions.Large)})</option></select></label>
          <label>Quantity <input name="quantity" type="number" min="1" max="${maxQuantity}" step="1" value="1" required></label>
        </div>
        <label>Special instructions <textarea name="notes" rows="2" maxlength="${maxNoteLength}" placeholder="Optional"></textarea></label>
        <div class="dialog-actions">
          <button class="secondary-button" type="button" data-action="restaurant" data-restaurant="${restaurantId}">Back to menu</button>
          <button class="primary-button" id="add-to-cart" type="submit">Add to cart · ${formatWon(dish.price)}</button>
        </div>
        <p id="dish-status" class="order-note" role="status"></p>
      </form>`);
  }

  function linePrice(line) {
    return getDish(line.restaurantId, line.dishId).price + portions[line.portion];
  }

  function addDish(form) {
    const values = new FormData(form);
    const { restaurantId, dishId } = currentDish;
    if (!byId.get(restaurantId).open) return;
    const portion = values.get('portion');
    const notes = values.get('notes').trim();
    const quantity = Number(values.get('quantity'));
    const existing = cart.lines.find(line => line.restaurantId === restaurantId && line.dishId === dishId
      && line.portion === portion && line.notes === notes);

    if ((existing?.quantity ?? 0) + quantity > maxQuantity) {
      document.querySelector('#dish-status').textContent = `You can add up to ${maxQuantity} of each dish and portion.`;
      return;
    }
    if (existing) existing.quantity += quantity;
    else cart.lines.push({ restaurantId, dishId, portion, notes, quantity });
    saveCart();
    dialog.close();
    announce(`Added ${quantity} × ${getDish(restaurantId, dishId).name} to your cart.`);
  }

  function cartTotals() {
    const subtotal = cart.lines.reduce((total, line) => total + linePrice(line) * line.quantity, 0);
    const restaurantsInCart = new Set(cart.lines.map(line => line.restaurantId));
    let delivery = 0;
    if (cart.mode === 'delivery') {
      for (const id of restaurantsInCart) {
        const restaurant = byId.get(id);
        if (restaurant && !restaurant.freeDelivery) delivery += restaurant.fee;
      }
    }

    const qualifyingDishes = new Map();
    for (const line of cart.lines) {
      const dish = getDish(line.restaurantId, line.dishId);
      if (!dish || line.portion !== 'Regular' || !dish.buyOneGetOne) continue;
      qualifyingDishes.set(dish, (qualifyingDishes.get(dish) ?? 0) + line.quantity);
    }
    const buyOneGetOne = [...qualifyingDishes].reduce((total, [dish, quantity]) =>
      total + Math.floor(quantity / 2) * dish.price, 0);
    const voucherSubtotal = subtotal - buyOneGetOne;

    // 1. Check Admin-created Coupon Code first, or built-in Offer Card promotion
    let voucher = 0;
    let activeCodeLabel = null;

    if (cart.couponCode && couponsByCode.has(cart.couponCode)) {
      const c = couponsByCode.get(cart.couponCode);
      activeCodeLabel = c.code;
      if (voucherSubtotal >= (c.min_order || 0)) {
        if (c.discount_type === 'percent') {
          voucher = Math.round(voucherSubtotal * (c.discount_value / 100));
        } else {
          voucher = c.discount_value;
        }
      }
    } else if (cart.promotion) {
      const offerObj = offersById.get(cart.promotion);
      activeCodeLabel = offerObj?.code || 'CRUNCH';
      const voucherRules = {
        'first-order': () => cart.placedOrder ? 0 : Math.round(voucherSubtotal * .6),
        chicken: () => cart.lines.some(line => line.dishId === 'crispy-chicken-combo') ? fixedVoucherDiscount : 0,
        'over-forty': () => voucherSubtotal > minimumVoucherSubtotal ? fixedVoucherDiscount : 0,
      };
      voucher = voucherRules[cart.promotion]?.() ?? 0;
    }

    voucher = Math.min(voucherSubtotal, voucher);
    return {
      subtotal,
      delivery,
      buyOneGetOne,
      voucher,
      activeCodeLabel,
      total: Math.max(0, subtotal + delivery - buyOneGetOne - voucher),
    };
  }

  /**
   * Renders the right-hand floating Cart Drawer (#cart-drawer) with live items,
   * quantity controls, coupon status, and full price breakdown.
   */
  function renderCartDrawer() {
    if (!cartDrawerBody || !cartTotalsBreakdown) return;

    if (cartDrawerModeSub) {
      cartDrawerModeSub.textContent = `${cart.mode === 'pickup' ? 'Pick-up' : 'Delivery'} · ${getFormattedLocationSummary()}`;
    }

    const totals = cartTotals();

    // 1. Render Cart Items or Empty State
    if (cart.lines.length === 0) {
      cartDrawerBody.classList.add('is-empty');
      cartDrawerBody.innerHTML = `
        <div class="cart-empty-placeholder">
          <img class="cart-placeholder-icon" src="Assets/icons/cart.svg" alt="" width="44" height="44">
          <p class="cart-empty-title">Your cart is empty</p>
          <p class="cart-empty-sub">Click any restaurant card and add tasty dishes to your cart!</p>
        </div>
      `;
    } else {
      cartDrawerBody.classList.remove('is-empty');
      cartDrawerBody.innerHTML = `
        <ul class="drawer-cart-list">
          ${cart.lines.map((line, idx) => {
            const dish = getDish(line.restaurantId, line.dishId);
            const rest = byId.get(line.restaurantId);
            if (!dish || !rest) return '';
            return `
              <li class="drawer-cart-item">
                <div class="drawer-item-info">
                  <h3>${escapeText(dish.name)}</h3>
                  <p class="drawer-item-meta">${escapeText(rest.name)} · ${line.portion}</p>
                  ${line.notes ? `<p class="drawer-item-notes">"${escapeText(line.notes)}"</p>` : ''}
                  <div class="drawer-item-controls">
                    <button type="button" class="drawer-qty-btn" data-drawer-action="decrease" data-line="${idx}" aria-label="Decrease quantity" ${line.quantity <= 1 ? 'disabled' : ''}>−</button>
                    <span class="drawer-qty-val">${line.quantity}</span>
                    <button type="button" class="drawer-qty-btn" data-drawer-action="increase" data-line="${idx}" aria-label="Increase quantity" ${line.quantity >= maxQuantity ? 'disabled' : ''}>+</button>
                    <button type="button" class="drawer-remove-btn" data-drawer-action="remove" data-line="${idx}">Remove</button>
                  </div>
                </div>
                <span class="drawer-item-price">${formatWon(linePrice(line) * line.quantity)}</span>
              </li>
            `;
          }).join('')}
        </ul>
      `;
    }

    // 2. Render Active Coupon Status Banner
    if (cartCouponStatus) {
      if (cart.couponCode && couponsByCode.has(cart.couponCode)) {
        const c = couponsByCode.get(cart.couponCode);
        const minPending = totals.voucher === 0 && c.min_order > 0;
        cartCouponStatus.className = 'cart-coupon-status status-applied';
        cartCouponStatus.innerHTML = `
          <span>🏷️ <strong>${c.code}</strong>: ${escapeText(c.description)}${minPending ? ` (Add ${formatWon(c.min_order - (totals.subtotal - totals.buyOneGetOne))} more)` : ''}</span>
          <button type="button" class="cart-coupon-remove" data-drawer-action="clear-coupon">Remove</button>
        `;
      } else if (cart.promotion && offersById.has(cart.promotion)) {
        const off = offersById.get(cart.promotion);
        cartCouponStatus.className = 'cart-coupon-status status-applied';
        cartCouponStatus.innerHTML = `
          <span>🏷️ <strong>${off.code}</strong> (${off.title} ${off.subtitle})${totals.voucher === 0 ? ' · Conditions pending' : ''}</span>
          <button type="button" class="cart-coupon-remove" data-drawer-action="clear-coupon">Remove</button>
        `;
      } else {
        cartCouponStatus.className = 'cart-coupon-status hidden';
        cartCouponStatus.innerHTML = '';
      }
    }

    // 3. Render Subtotal, Delivery, Discounts, and Grand Total
    cartTotalsBreakdown.innerHTML = `
      ${cart.lines.length > 0 ? `
        <div class="cart-breakdown-line">
          <span>Subtotal</span>
          <span>${formatWon(totals.subtotal)}</span>
        </div>
        <div class="cart-breakdown-line">
          <span>${cart.mode === 'pickup' ? 'Pick-up' : 'Delivery Fee'}</span>
          <span>${totals.delivery > 0 ? formatWon(totals.delivery) : 'Free'}</span>
        </div>
        ${totals.buyOneGetOne > 0 ? `
          <div class="cart-breakdown-line discount-line">
            <span>Buy 1 Free 1</span>
            <span>−${formatWon(totals.buyOneGetOne)}</span>
          </div>
        ` : ''}
        ${totals.voucher > 0 ? `
          <div class="cart-breakdown-line discount-line">
            <span>Coupon (${totals.activeCodeLabel || 'PROMO'})</span>
            <span>−${formatWon(totals.voucher)}</span>
          </div>
        ` : ''}
      ` : ''}
      <div class="cart-summary-row">
        <span>Total</span>
        <strong id="cart-grand-total">${formatWon(cart.lines.length > 0 ? totals.total : 0)}</strong>
      </div>
    `;

    if (cartCheckoutBtn) {
      cartCheckoutBtn.disabled = cart.lines.length === 0;
    }
  }

  function totalsMarkup(totals) {
    return `
      <dl class="order-totals">
        <div><dt>Subtotal</dt><dd>${formatWon(totals.subtotal)}</dd></div>
        <div><dt>${cart.mode === 'pickup' ? 'Pick-up' : 'Delivery'}</dt><dd>${totals.delivery ? formatWon(totals.delivery) : 'Free'}</dd></div>
        ${totals.buyOneGetOne ? `<div><dt>Buy 1 Free 1</dt><dd>−${formatWon(totals.buyOneGetOne)}</dd></div>` : ''}
        ${totals.voucher ? `<div><dt>CRUNCH</dt><dd>−${formatWon(totals.voucher)}</dd></div>` : ''}
        <div class="grand-total"><dt>Total</dt><dd>${formatWon(totals.total)}</dd></div>
      </dl>`;
  }

  function cartLines(editable) {
    return `<ul class="cart-list">${cart.lines.map((line, index) => {
      const dish = getDish(line.restaurantId, line.dishId);
      return `
        <li>
          <div class="cart-entry">
            <h3>${dish.name}</h3>
            <p>${escapeText(byId.get(line.restaurantId).name)} · ${line.portion}${editable ? '' : ` · Qty ${line.quantity}`}</p>
            ${line.notes ? `<p>${escapeText(line.notes)}</p>` : ''}
            ${editable ? `<div class="cart-edit">
              <button type="button" data-action="decrease" data-line="${index}" aria-label="Decrease ${dish.name} quantity" ${line.quantity === 1 ? 'disabled' : ''}>−</button>
              <span aria-label="Quantity">${line.quantity}</span>
              <button type="button" data-action="increase" data-line="${index}" aria-label="Increase ${dish.name} quantity" ${line.quantity === maxQuantity ? 'disabled' : ''}>+</button>
              <button class="remove-line" type="button" data-action="remove" data-line="${index}" aria-label="Remove ${dish.name}">Remove</button>
            </div>` : ''}
          </div>
          <strong>${formatWon(linePrice(line) * line.quantity)}</strong>
        </li>`;
    }).join('')}</ul>`;
  }

  function showCart(focus = true) {
    const promotion = offersById.get(cart.promotion);
    const total = cartTotals();
    showDialog('cart', 'Your Cart', `
      ${cart.lines.length ? cartLines(true) : '<p>Your cart is empty. Choose a restaurant to browse its menu.</p>'}
      ${promotion ? `<p class="order-note">CRUNCH · ${promotion.subtitle}${total.voucher ? '' : ' · Conditions pending'}</p>` : ''}
      ${cart.lines.length ? totalsMarkup(total) : ''}
      <div class="dialog-actions">
        <button class="secondary-button" type="button" data-action="close">Keep browsing</button>
        ${promotion ? '<button class="secondary-button" type="button" data-action="clear-promotion">Remove code</button>' : ''}
        ${cart.lines.length ? '<button class="primary-button" type="button" data-action="checkout">Review order</button>' : ''}
      </div>`, focus);
  }

  function editCart(button, action) {
    const index = Number(button.dataset.line);
    const line = cart.lines[index];
    if (!line) return;
    if (action === 'remove') cart.lines.splice(index, 1);
    if (action === 'increase') line.quantity = Math.min(maxQuantity, line.quantity + 1);
    if (action === 'decrease') line.quantity = Math.max(1, line.quantity - 1);
    saveCart();
    showCart(false);
    const controls = [...dialogContent.querySelectorAll(`[data-line="${index}"]:not(:disabled)`)];
    const nextFocus = controls.find(control => control.dataset.action === action) ?? controls[0] ?? dialogContent.firstElementChild;
    nextFocus.focus({ preventScroll: true });
  }

  function showCheckout(focus = true) {
    if (!cart.lines.length) return showCart(focus);
    const activeLoc = getActiveLocation();
    const locBlock = activeLoc
      ? `<div class="checkout-location-box">
           <strong>${getLabelIcon(activeLoc.label)} ${escapeText(activeLoc.label)} — ${escapeText(activeLoc.address)}</strong>
           <p>👤 ${escapeText(activeLoc.contactName)} · 📞 ${escapeText(activeLoc.contactPhone)}</p>
           ${activeLoc.notes ? `<p>Note: "${escapeText(activeLoc.notes)}"</p>` : ''}
           <p class="checkout-loc-hint">To change location or contact info, use the location button in the top navbar.</p>
         </div>`
      : `<div class="checkout-location-box">
           <strong>📍 Default Area — Seoul, KR</strong>
           <p class="checkout-loc-hint">Tip: You can add your Home/Office address & contact info from the top navbar location button.</p>
         </div>`;

    showDialog('checkout', 'Review order', `
      <p>${cart.mode === 'pickup' ? 'Pick-up' : 'Delivery'} · ${escapeText(getFormattedLocationSummary())}</p>
      ${locBlock}
      ${cartLines(false)}
      ${totalsMarkup(cartTotals())}
      <p class="order-note">Demo order for this device.</p>
      <div class="dialog-actions">
        <button class="secondary-button" type="button" data-action="cart">Back to cart</button>
        <button class="primary-button" type="button" data-action="confirm-order">Confirm demo order</button>
      </div>`, focus);
  }

  function confirmOrder() {
    if (!cart.lines.length) return;
    const total = cartTotals().total;
    const activeLoc = getActiveLocation();
    cart.lines = [];
    cart.promotion = null;
    cart.couponCode = null;
    cart.placedOrder = true;
    saveCart();
    if (cartDrawer && cartBackdrop) {
      cartDrawer.classList.remove('is-open');
      cartBackdrop.classList.remove('is-open');
      cartDrawer.setAttribute('aria-hidden', 'true');
    }
    showDialog('confirmed', 'Order Confirmed! 🎉', `
      <p>Your Tack-Eat order has been placed and is being prepared.</p>
      ${activeLoc ? `<p>Delivering to <strong>${escapeText(activeLoc.label)} (${escapeText(activeLoc.address)})</strong> · Contact: <strong>${escapeText(activeLoc.contactName)} (${escapeText(activeLoc.contactPhone)})</strong></p>` : ''}
      <p><strong>Total Paid · ${formatWon(total)}</strong></p>
      <div class="dialog-actions"><button class="primary-button" type="button" data-action="close">Back to restaurants</button></div>`);
  }

  // Handle Cart Drawer Quantity / Remove / Coupon clicks & form submit
  cartDrawer?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-drawer-action]');
    if (!btn) return;
    const act = btn.dataset.drawerAction;

    if (act === 'clear-coupon') {
      cart.couponCode = null;
      cart.promotion = null;
      saveCart();
      announce('Coupon code removed.');
      return;
    }

    const index = Number(btn.dataset.line);
    const line = cart.lines[index];
    if (!line) return;

    if (act === 'increase') line.quantity = Math.min(maxQuantity, line.quantity + 1);
    else if (act === 'decrease') line.quantity = Math.max(1, line.quantity - 1);
    else if (act === 'remove') cart.lines.splice(index, 1);

    saveCart();
  });

  cartCouponForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawCode = (cartCouponInput?.value || '').trim().toUpperCase();
    if (!rawCode) return;

    if (couponsByCode.has(rawCode)) {
      cart.couponCode = rawCode;
      cart.promotion = null;
      cartCouponInput.value = '';
      saveCart();
      announce(`Coupon ${rawCode} applied!`);
    } else if (rawCode === 'CRUNCH') {
      cart.promotion = 'first-order';
      cart.couponCode = null;
      cartCouponInput.value = '';
      saveCart();
      announce('Coupon CRUNCH applied!');
    } else {
      if (cartCouponStatus) {
        cartCouponStatus.className = 'cart-coupon-status status-error';
        cartCouponStatus.textContent = `Invalid or expired coupon code "${rawCode}".`;
      }
    }
  });

  cartCheckoutBtn?.addEventListener('click', () => {
    if (!cart.lines.length) return;
    if (cartDrawer && cartBackdrop) {
      cartDrawer.classList.remove('is-open');
      cartBackdrop.classList.remove('is-open');
      cartDrawer.setAttribute('aria-hidden', 'true');
    }
    showCheckout();
  });

  function showOffer(id) {
    const offer = offersById.get(id);
    const usedFirstOffer = offer.id === 'first-order' && cart.placedOrder;
    showDialog('offer', offer.title, `
      <p>${offer.text}</p>
      ${usedFirstOffer ? '<p class="order-note">You have already placed a demo order on this device.</p>' : ''}
      <div class="dialog-actions">
        <button class="primary-button" type="button" data-action="apply-offer" data-offer="${id}" ${usedFirstOffer ? 'disabled' : ''}>
          Use ${offer.code}
        </button>
      </div>`);
  }

  function applyOffer(id) {
    dialog.close();
    cart.promotion = id;
    cart.couponCode = null;
    saveCart();
    announce('CRUNCH selected. Review the discount in your cart.');
    if (id === 'chicken') {
      search.value = 'crispy chicken combo';
      resetFilters();
    }
    focusSection('#restaurant-heading');
  }

  function showNearby() {
    offersOnly = false;
    setFilter('sort', 'distance', true);
    focusSection('#restaurant-heading');
  }

  const actions = {
    cuisine: button => setFilter('cuisine', button.dataset.cuisine),
    restaurant: button => showRestaurant(button.dataset.restaurant),
    dish: button => showDish(button.dataset.restaurant, button.dataset.dish),
    cart: () => showCart(),
    decrease: button => editCart(button, 'decrease'),
    increase: button => editCart(button, 'increase'),
    remove: button => editCart(button, 'remove'),
    offer: button => showOffer(button.dataset.offer),
    'apply-offer': button => applyOffer(button.dataset.offer),
    'clear-promotion': () => { cart.promotion = null; saveCart(); showCart(); },
    'show-offers': (button, event) => { event?.preventDefault(); offersOnly = true; renderRestaurants(); focusSection('#offers-heading'); },
    'reset-search': () => { search.value = ''; offersOnly = false; resetFilters(); focusSection('#restaurant-heading'); },
    nearby: (button, event) => { event?.preventDefault(); showNearby(); },
    'locate-nearby': () => { dialog.close(); showNearby(); },
    location: () => showLocationManager(),
    'location-preset': button => {
      const preset = button.dataset.preset;
      const labelInput = document.getElementById('location-label-input');
      if (labelInput && preset) {
        labelInput.value = preset;
        for (const chip of dialogContent.querySelectorAll('.location-preset-chip')) {
          chip.classList.toggle('is-selected', chip.dataset.preset === preset);
        }
      }
    },
    'select-location': async button => {
      const locId = button.dataset.locationId;
      const target = savedLocations.find(l => l.id === locId);
      if (!target) return;
      activeLocationId = target.id;
      await persistAccountLocations();
      showLocationManager();
      announce(`Active location set to ${target.label} (${target.address}).`);
    },
    'edit-location': button => {
      showLocationManager(button.dataset.locationId);
    },
    'delete-location': async button => {
      const locId = button.dataset.locationId;
      const target = savedLocations.find(l => l.id === locId);
      if (!target) return;
      savedLocations = savedLocations.filter(l => l.id !== locId);
      if (activeLocationId === locId) {
        activeLocationId = savedLocations[0]?.id ?? null;
      }
      await persistAccountLocations();
      showLocationManager();
      announce(`Removed saved location "${target.label}".`);
    },
    app: button => showDialog('app', 'Tack-Eat app', `
      <p>The ${button.dataset.store} link is pending. You can browse the current offers here.</p>
      <div class="dialog-actions"><button class="primary-button" type="button" data-action="browse-app-offers">Browse offers</button></div>`),
    'browse-app-offers': () => { dialog.close(); focusSection('#offers-heading'); },
    checkout: () => showCheckout(),
    'confirm-order': confirmOrder,
    close: () => dialog.close(),
  };

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action], [data-mode]');
    if (!button) return;
    const { action, mode } = button.dataset;
    if (action) return actions[action](button, event);

    offersOnly = mode === 'offers' && !offersOnly;
    if (mode !== 'offers') {
      cart.mode = mode;
      saveCart();
    }
    renderRestaurants();
  });

  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });

  dialog.addEventListener('submit', async event => {
    if (event.target.id === 'location-manager-form') {
      event.preventDefault();
      const formData = new FormData(event.target);
      const editId = (formData.get('editId') || '').toString().trim();
      const label = (formData.get('label') || '').toString().trim() || 'Home';
      const address = (formData.get('address') || '').toString().trim();
      const contactName = (formData.get('contactName') || '').toString().trim();
      const contactPhone = (formData.get('contactPhone') || '').toString().trim();
      const notes = (formData.get('notes') || '').toString().trim();

      if (!address || !contactName || !contactPhone) return;

      if (editId) {
        const idx = savedLocations.findIndex(l => l.id === editId);
        if (idx !== -1) {
          savedLocations[idx] = { ...savedLocations[idx], label, address, contactName, contactPhone, notes };
          activeLocationId = editId;
        }
      } else {
        const newLoc = {
          id: `loc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label,
          address,
          contactName,
          contactPhone,
          notes,
        };
        savedLocations.unshift(newLoc);
        activeLocationId = newLoc.id;
      }

      await persistAccountLocations();
      showLocationManager();
      announce(`Saved & selected "${label}" (${address}).`);
      return;
    }

    if (event.target.id !== 'dish-form') return;
    event.preventDefault();
    addDish(event.target);
  });

  dialog.addEventListener('input', event => {
    if (!['quantity', 'portion'].includes(event.target.name)) return;
    const values = new FormData(event.target.form);
    const line = { ...currentDish, portion: values.get('portion') };
    const quantity = Number(values.get('quantity'));
    document.querySelector('#add-to-cart').textContent = `Add to cart · ${formatWon(linePrice(line) * (quantity || 1))}`;
  });

  search.addEventListener('input', renderRestaurants);
  document.querySelector('#food-search').addEventListener('submit', event => {
    event.preventDefault();
    focusSection('#restaurant-heading');
  });
  filters.addEventListener('change', renderRestaurants);
  filters.addEventListener('reset', event => {
    event.preventDefault();
    resetFilters();
    filterPanel.querySelector('summary').focus();
  });

  const compactLayout = matchMedia('(max-width: 760px)');
  function syncCompactLayout() {
    filterPanel.open = !compactLayout.matches;
    search.placeholder = compactLayout.matches ? 'Search food and restaurants' : 'Search for restaurants, cuisines, and dishes';
  }
  compactLayout.addEventListener('change', syncCompactLayout);
  syncCompactLayout();

  window.addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    const oldMode = cart.mode;
    cart = readCart(event.newValue);
    updateCartBadge();
    if (oldMode !== cart.mode) renderRestaurants();
    if (dialog.open && dialog.dataset.view === 'cart') showCart();
    if (dialog.open && dialog.dataset.view === 'checkout') showCheckout();
  });

  renderBrowseControls();
  setupCarousel(cuisineList);
  setupCarousel(offerList, true);
  renderRestaurants();
  await loadAccountLocations();
  updateCartBadge();
}

initFoodSection();

// ============================================================================
// 9. FOOTER ANIMATION & LIVE CLOCK (Merged from NATASHA/footer section/script.js)
// ============================================================================
function initFooterSection() {
  const footer = document.getElementById('footer');
  const brandWrap = document.getElementById('brandWrap');
  const cols = document.getElementById('cols');
  const localTimeEl = document.getElementById('localTime');

  if (!footer || !brandWrap || !cols) return;

  const cover = footer.previousElementSibling;
  if (!cover) return;

  function revealed(el) {
    const r = el.getBoundingClientRect();
    const coverRect = cover.getBoundingClientRect();
    if (coverRect.bottom >= window.innerHeight) return 0;
    const coverEdge = Math.max(coverRect.bottom, 0);
    const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, coverEdge);
    return r.height > 0 ? visible / r.height : 0;
  }

  function update() {
    const nearBottom = cover.getBoundingClientRect().bottom <= window.innerHeight + 40;
    footer.classList.toggle('is-pinned', nearBottom && footer.offsetHeight <= window.innerHeight);

    const b = revealed(brandWrap);
    if (b >= 0.25) brandWrap.classList.add('is-in');
    else if (b <= 0) brandWrap.classList.remove('is-in');

    const c = revealed(cols);
    if (c >= 0.25) footer.classList.add('is-in');
    else if (c <= 0) footer.classList.remove('is-in');
  }

  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
  window.addEventListener('load', update);

  if (localTimeEl) {
    function tick() {
      const t = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul',
        hour12: false,
      });
      localTimeEl.textContent = `${t} (GMT +9)`;
    }
    tick();
    setInterval(tick, 30000);
  }
}

initFooterSection();

// ============================================================================
// 10. SCROLL-REVEAL ANIMATIONS FOR ABOUT, MENU & INTRO SECTIONS
// ============================================================================
function initScrollRevealAnimations() {
  const aboutSection = document.getElementById('about');
  const revealTargets = [
    { selector: '.food-section .toolbar', delay: 0 },
    { selector: '.food-section .sidebar', delay: 0.06 },
    { selector: '#sign-up-banner', delay: 0.08 },
    { selector: '.food-section .featured', delay: 0.12 },
    { selector: '.food-section .offers-section', delay: 0.16 },
    { selector: '.food-section .restaurants', delay: 0.1 },
    { selector: '.intro .intro__logo', delay: 0 },
    { selector: '.intro .intro__image', delay: 0.1 },
    { selector: '.intro .intro__text', delay: 0.18 },
  ];

  const elementsToObserve = [];

  if (aboutSection) {
    elementsToObserve.push(aboutSection);
  }

  for (const { selector, delay } of revealTargets) {
    const el = document.querySelector(selector);
    if (!el) continue;
    el.classList.add('scroll-reveal');
    if (delay) {
      el.style.setProperty('--reveal-delay', String(delay));
    }
    elementsToObserve.push(el);
  }

  if (!elementsToObserve.length) return;

  if (!('IntersectionObserver' in window)) {
    for (const el of elementsToObserve) el.classList.add('is-in');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
        }
      }
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -36px 0px',
    }
  );

  for (const el of elementsToObserve) {
    observer.observe(el);
  }
}

initScrollRevealAnimations();

// ============================================================================
// 11. HERO BURGER PARALLAX ON SCROLL
// ============================================================================
function initHeroParallax() {
  const heroSection = document.querySelector('.hero');
  if (!heroSection) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let ticking = false;

  function updateParallax() {
    ticking = false;
    if (reducedMotion.matches) {
      heroSection.style.setProperty('--burger-parallax', '0px');
      return;
    }

    const scrollY = window.scrollY || window.pageYOffset;
    const heroHeight = heroSection.offsetHeight || 900;

    if (scrollY <= heroHeight * 1.25) {
      const offset = Math.round(scrollY * 0.32);
      heroSection.style.setProperty('--burger-parallax', `${offset}px`);
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateParallax);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  updateParallax();
}

initHeroParallax();
