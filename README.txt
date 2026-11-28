GROUP MEMBERS:
1. Muhammad Izz Ukail bin Razman (24102607)
2. Nurul Adilah Binti Burhanuddin (24101010)
3. Nur Amira Natasha Binti Rahmat (24101011)
4. Alif Shahmi bin Ahmad Shukri (24101026)
5. Qistina Aisara Binti Azhar Azwari (24101047)

DESCRIPTION OF FEATURES:
1. Interactive Shopping Cart, Coupon System & User Authentication
    a. Dynamic Floating Cart Drawer & Badge Sync: Slide-out right-hand shopping cart drawer and floating scroll cart button allowing users to add, increment/decrement, and remove dishes with automatic subtotal, delivery fee, Buy 1 Free 1, coupon discount, and grand total (KRW ₩) calculations.
    b. Integrated Coupon & Promo Code System: Supports percentage (%) and fixed-amount (₩) discount codes with minimum order subtotal validation, redeemable directly inside the cart drawer or via the promotional offers carousel.
    c. User Account Integration (Log In / Register / Password Recovery): Split-screen authentication flow (login.html) powered by Supabase Auth supporting email or username login, duplicate username/email validation, session profile management, and automatic hiding of promotional sign-up banners once authenticated.
    d. Account-Synced Saved Delivery Locations & Contact Manager: Navbar-exclusive location switcher allowing users to manually save, edit, select, and delete multiple labeled addresses (e.g., Home, Office, Campus) along with recipient contact name, phone number, and delivery instructions connected to their Supabase user account.

2. Dynamic Food Menu & Cloud Database Integration
    a. Scalable Backend CMS: Restaurants, menu items, prices, delivery times, ratings, and availability are managed and rendered dynamically without hardcoding HTML.
    b. Supabase & PostgreSQL Database: Real-time cloud data fetching for restaurants, dishes, and coupons using the Supabase JavaScript SDK v2 with automatic local storage fallback.
    c. Multi-Faceted Category, Dietary & Search Filtering: Instant client-side filtering and sorting by browse mode (Delivery, Pick-up, Offers), cuisine carousels, quick filters (Ratings 4+, Under 20 min, Free delivery, Open now), meal types, dietary tags (Halal, Vegetarian, Non-Halal), price tiers ($, $$, $$$), and live keyword search.
    d. Interactive Carousels & Accessible Modals: Horizontal scroll-snap carousels for cuisines and promotional offers, paired with accessible dialog modals for restaurant menus, dish customization, location management, and order checkout confirmation.
    e. Order Customization & Add-to-Cart Flow: Allows users to configure item quantities, portion sizes (Regular or Large), and special preparation instructions before adding dishes to the cart.

3. Contact & Feedback System
    a. Content Validation & Interactive Notifications: Client-side JavaScript validation for required fields (Name, Email, Subject, Message) and email format verification, complete with invalid field highlighting, status feedback banners, automatic form reset, and confirmation modal notifications.

4. Dynamic Footer & Brand Storytelling
    a. Live Real-Time Clock: Continuously updating digital clock displaying Seoul time (GMT +9) powered by JavaScript (setInterval / Date API).
    b. Sticky Reveal Footer & Editorial About Section: Scroll-activated footer with staggered SVG character-by-character logo animation and a responsive two-column About section.

5. Frontend Performance, Animations & UI/UX Optimization
    a. Responsive Layout & Mobile Hamburger Navigation: Mobile-friendly Flexbox/Grid architecture featuring an animated mobile hamburger dropdown menu (<= 768px) and custom CSS variables (:root) for consistent brand theming.
    b. Scroll-Reveal, Marquee Carousel & Parallax Effects: Smooth IntersectionObserver scroll-reveal animations across the Hero, About, Menu, and Footer sections, an infinite scrolling marquee separator carousel, and a requestAnimationFrame scroll parallax effect on the hero burger illustration (with prefers-reduced-motion accessibility support).
    c. Optimized Assets & Typography: Lightweight scalable vector graphics (SVG logos/icons), WebP food imagery, and custom typography (Fredoka & Dongle) for fast rendering and smooth micro-interactions.

6. Admin Dashboard & Storefront CMS
    a. Dynamic Restaurant, Menu & Coupon Management: Dedicated admin console (admin.html) allowing admins to create/delete restaurants, add/edit/delete dishes (with Open/Closed, Free Delivery, and Buy 1 Free 1 toggles), create/delete discount coupon codes, and sync the default catalog to Supabase with one click.
    b. Role-Based Access Control (RBAC): Multi-layer admin verification checking Supabase profiles table roles, JWT app_metadata, and authorized admin emails so only authenticated administrators can access and manage the CMS.

7. Custom Domain & Deployment
    a. Custom Domain Access (tackeat.app): Configured and deployed with a custom domain name so users can access the platform seamlessly across desktop and mobile browsers.

DIVISION OF TASKS:
1. Ezzy - Backend/Supabase Integration, Compiling
2. Alipe - Navbar, Hero Section
3. Adilah - Contact Section, Auth UI
4. Mira - Dynamic Footer, About Section
5. Sara - Food Section