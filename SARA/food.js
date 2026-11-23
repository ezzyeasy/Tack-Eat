'use strict';

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
const cartTrigger = document.querySelector('.cart-trigger');
const cartCount = document.querySelector('#cart-count');
const byId = new Map(restaurants.map(restaurant => [restaurant.id, restaurant]));
const offersById = new Map(offers.map(offer => [offer.id, offer]));
const asset = name => `food-assets/${name}`;
const restaurantImage = restaurant => asset(`${restaurant.id}.webp`);
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

let cart = readCart();
let offersOnly = false;
let currentDish;
let feedbackTimer;

function getDish(restaurantId, dishId) {
  return byId.get(restaurantId)?.dishes.find(dish => dish.id === dishId);
}

function readCart(raw) {
  const empty = { lines: [], promotion: null, placedOrder: false, mode: 'delivery' };
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
      placedOrder: saved.placedOrder === true,
      mode: saved.mode === 'pickup' ? 'pickup' : 'delivery',
    };
  } catch {
    return empty;
  }
}

function updateCartBadge() {
  const count = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  cartCount.textContent = count;
  cartCount.hidden = count === 0;
  cartTrigger.setAttribute('aria-label', `Cart, ${count} ${count === 1 ? 'item' : 'items'}`);
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

  cuisineList.innerHTML = cuisines.map(cuisine => `
    <button type="button" class="cuisine-card" data-action="cuisine" data-cuisine="${cuisine}" aria-pressed="false">
      <img src="${asset(`${cuisine.toLowerCase()}.webp`)}" alt="" width="110" height="108">
      <span>${cuisine}</span>
    </button>`).join('');

  const carouselOffers = [...offers, offersById.get('chicken')];
  offerList.innerHTML = carouselOffers.map(offer => `
    <button type="button" class="offer-card ${offer.color ?? ''}" data-action="offer" data-offer="${offer.id}" aria-haspopup="dialog">
      <span class="offer-shadow" aria-hidden="true"></span>
      <img class="offer-art" src="${asset(offer.image)}" alt="">
      <span class="offer-brand" aria-hidden="true">
        <img src="${offer.color === 'red' ? '../Assets/logo/Tack-Eat_Logo-Orange.svg' : asset('offer-logo-green.svg')}" alt="" width="592" height="75">
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
  const matches = restaurants.filter(restaurant => {
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

function restaurantCard(restaurant, showDistance) {
  const meal = restaurant.meal ? ` · ${restaurant.meal}` : '';
  const distance = showDistance ? ` · ${restaurant.distance.toFixed(1)} km` : '';
  const pickingUp = cart.mode === 'pickup';
  const timing = pickingUp ? 'Pick-up from' : 'From';
  const freeDelivery = !pickingUp && restaurant.freeDelivery;
  const feeAmount = formatWon(restaurant.fee);
  const fee = freeDelivery
    ? `<del>${feeAmount}</del><span class="free-delivery-label">Free Delivery</span>`
    : `<span>${feeAmount}</span>`;
  const deliveryFee = `<img class="delivery-fee-icon" src="${asset('delivery-scooter.png')}" alt="" width="19" height="15">${fee}`;
  const score = restaurant.rating.toFixed(1);
  return `
    <button type="button" class="restaurant-card" data-action="restaurant" data-restaurant="${restaurant.id}" aria-haspopup="dialog">
      <img src="${restaurantImage(restaurant)}" alt="" width="349" height="207" loading="lazy">
      <span class="restaurant-title">
        <span class="restaurant-name">${escapeText(restaurant.name)}</span>
        <span class="rating" aria-label="${score} stars from ${restaurant.reviews} reviews">
          <span class="star" aria-hidden="true">★</span> ${score} <span class="review-count">(${restaurant.reviews})</span>
        </span>
      </span>
      <span class="restaurant-meta"><span>${restaurant.open ? `${timing} ${restaurant.minutes} min${distance}` : 'Closed'}</span><span>${restaurant.price}</span><span>${restaurant.cuisine}${meal}</span><span>${restaurant.dietary}</span></span>
      <span class="restaurant-fee${freeDelivery ? ' free-delivery' : ''}">${pickingUp ? 'Free pick-up' : deliveryFee}</span>
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
  grid.innerHTML = matches.map(restaurant => restaurantCard(restaurant, sort === 'distance')).join('');
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
      if (!restaurant.freeDelivery) delivery += restaurant.fee;
    }
  }

  const qualifyingDishes = new Map();
  for (const line of cart.lines) {
    const dish = getDish(line.restaurantId, line.dishId);
    if (line.portion !== 'Regular' || !dish.buyOneGetOne) continue;
    qualifyingDishes.set(dish, (qualifyingDishes.get(dish) ?? 0) + line.quantity);
  }
  const buyOneGetOne = [...qualifyingDishes].reduce((total, [dish, quantity]) =>
    total + Math.floor(quantity / 2) * dish.price, 0);
  const voucherSubtotal = subtotal - buyOneGetOne;
  const voucherRules = {
    'first-order': () => cart.placedOrder ? 0 : Math.round(voucherSubtotal * .6),
    chicken: () => cart.lines.some(line => line.dishId === 'crispy-chicken-combo') ? fixedVoucherDiscount : 0,
    'over-forty': () => voucherSubtotal > minimumVoucherSubtotal ? fixedVoucherDiscount : 0,
  };
  const voucher = Math.min(voucherSubtotal, voucherRules[cart.promotion]?.() ?? 0);
  return { subtotal, delivery, buyOneGetOne, voucher, total: subtotal + delivery - buyOneGetOne - voucher };
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
  showDialog('checkout', 'Review order', `
    <p>${cart.mode === 'pickup' ? 'Pick-up' : 'Delivery'} · Seoul, KR</p>
    ${cartLines(false)}
    ${totalsMarkup(cartTotals())}
    <p class="order-note">Demo order for this device.</p>
    <div class="dialog-actions">
      <button class="secondary-button" type="button" data-action="cart">Back to cart</button>
      <button class="primary-button" type="button" data-action="confirm-order">Confirm demo order</button>
    </div>`, focus);
}

function confirmOrder() {
  if (!cart.lines.length) return showCart();
  const total = cartTotals().total;
  cart.lines = [];
  cart.promotion = null;
  cart.placedOrder = true;
  saveCart();
  showDialog('confirmed', 'Demo order complete', `
    <p>Order total · ${formatWon(total)}</p>
    <div class="dialog-actions"><button class="primary-button" type="button" data-action="close">Back to restaurants</button></div>`);
}

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
  'show-offers': () => { offersOnly = true; renderRestaurants(); focusSection('#offers-heading'); },
  'reset-search': () => { search.value = ''; offersOnly = false; resetFilters(); focusSection('#restaurant-heading'); },
  nearby: showNearby,
  'locate-nearby': () => { dialog.close(); showNearby(); },
  location: () => showDialog('location', 'Seoul, KR', `
    <p>Browse restaurants near the Seoul location shown on this menu.</p>
    <div class="dialog-actions"><button class="primary-button" type="button" data-action="locate-nearby">Show nearby</button></div>`),
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
  if (action) return actions[action](button);

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

dialog.addEventListener('submit', event => {
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
updateCartBadge();
