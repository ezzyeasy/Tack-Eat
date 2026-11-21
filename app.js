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

// Update the navbar button on index.html when logged in
async function syncNavbarAuthState() {
  const navAuthLink = document.getElementById("nav-auth-link");
  if (!navAuthLink || !supabaseClient) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    navAuthLink.textContent = "Sign Up";
    navAuthLink.href = "login.html";
    return;
  }

  const { isAdmin, username } = await checkUserRoleAndProfile(user);
  navAuthLink.textContent = isAdmin ? `🛡️ Admin (${username})` : `Hi, ${username}`;
  navAuthLink.href = "login.html";
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

    if (roleBadge) {
      roleBadge.textContent = isAdmin ? "🛡️ Admin Account" : "Customer Account";
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
      await renderSessionView(data.user);
      showAlert(
        "success",
        isAdmin
          ? `Signed in as Administrator (${username}).`
          : `Welcome back, ${username}!`
      );
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
