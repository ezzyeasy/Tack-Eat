const cuisines = ['Italian', 'Chinese', 'Japanese', 'Korean', 'Western', 'Malaysian', 'Indian', 'Coffee'];

const filterGroups = [
  { key: 'quick', title: 'Quick filters', values: ['Ratings 4+', 'Under 20 min', 'Free delivery', 'Open now'] },
  { key: 'offer', title: 'Offers', values: ['Accept vouchers', 'Discounts', 'Buy 1 Free 1'] },
  { key: 'meal', title: 'Meal type', values: ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Dessert', 'Late night'] },
  { key: 'cuisine', title: 'Cuisines', values: cuisines },
  { key: 'dietary', title: 'Dietary', values: ['Vegetarian', 'Halal', 'Non-Halal'] },
  { key: 'price', title: 'Price', values: ['$', '$$', '$$$'] },
];

const formatWon = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format;
const fixedVoucherDiscount = 5000;
const minimumVoucherSubtotal = 40000;
const fixedVoucherTitle = `${formatWon(fixedVoucherDiscount)} off`;

const offers = [
  {
    id: 'first-order', title: '60% off', subtitle: 'your 1st order', code: 'CRUNCH',
    image: 'offer-first-order.webp', text: 'Get 60% off the food subtotal on your first demo order.',
  },
  {
    id: 'chicken', title: fixedVoucherTitle, subtitle: 'crispy chicken combo', code: 'CRUNCH',
    image: 'offer-chicken.webp', color: 'red',
    text: `Add a Crispy Chicken Combo from Texas Meat to get ${formatWon(fixedVoucherDiscount)} off your demo order.`,
  },
  {
    id: 'over-forty', title: fixedVoucherTitle, subtitle: `on orders over ${formatWon(minimumVoucherSubtotal)}`, code: 'CRUNCH',
    image: 'offer-order.webp',
    text: `Get ${formatWon(fixedVoucherDiscount)} off when your food subtotal is over ${formatWon(minimumVoucherSubtotal)}.`,
  },
];

// The design supplies the restaurant cards. Dishes, distances, and availability are sample data.
// The sample prices and delivery fees are in whole Korean won.
const restaurants = [
  {
    id: 'toast-and-co', name: 'Toast & Co.', cuisine: 'Western', meal: 'Breakfast', meals: ['Breakfast', 'Brunch'],
    dietary: 'Halal', price: '$$', minutes: 10, distance: 1.4, rating: 4.5, reviews: 67, fee: 2500,
    freeDelivery: true, open: true, offers: ['Accept vouchers', 'Discounts'],
    dishes: [
      { id: 'breakfast-toast', name: 'Breakfast Toast', description: 'Grilled sourdough with fried eggs and herbs.', price: 8900 },
      { id: 'french-toast', name: 'Berry French Toast', description: 'Brioche, seasonal berries and maple syrup.', price: 11900 },
    ],
  },
  {
    id: 'sakana', name: 'Sakana', cuisine: 'Japanese', meal: 'Dinner', meals: ['Lunch', 'Dinner'],
    dietary: 'Halal', price: '$$$', minutes: 30, distance: 3.6, rating: 4.8, reviews: 100, fee: 3500,
    open: true, offers: ['Accept vouchers'],
    dishes: [
      { id: 'salmon-sushi', name: 'Salmon Sushi Platter', description: 'Salmon nigiri and maki with pickled ginger.', price: 19900 },
      { id: 'teriyaki', name: 'Teriyaki Chicken Bowl', description: 'Glazed chicken, rice and vegetables.', price: 11900 },
    ],
  },
  {
    id: 'casa-napoli', name: 'Casa Napoli', cuisine: 'Italian', meal: 'Lunch', meals: ['Lunch', 'Dinner'],
    dietary: 'Non-Halal', price: '$$$', minutes: 15, distance: 1.2, rating: 4.3, reviews: 190, fee: 2500,
    open: true, offers: ['Accept vouchers'],
    dishes: [
      { id: 'alfredo', name: 'Chicken Alfredo', description: 'Pasta with chicken in a creamy parmesan sauce.', price: 13900 },
      { id: 'margherita', name: 'Margherita Pizza', description: 'Tomato, mozzarella and fresh basil.', price: 17900 },
    ],
  },
  {
    id: 'soban-seoul', name: 'Soban Seoul', cuisine: 'Korean', meal: 'Late night', meals: ['Dinner', 'Late night'],
    dietary: 'Non-Halal', price: '$$', minutes: 15, distance: .8, rating: 4.1, reviews: 300, fee: 2000,
    open: true, offers: ['Accept vouchers'],
    dishes: [
      { id: 'bibimbap', name: 'Beef Bibimbap', description: 'Rice, beef, vegetables, egg and gochujang.', price: 11900 },
      { id: 'tteokbokki', name: 'Tteokbokki', description: 'Chewy rice cakes in a sweet, spicy sauce.', price: 7900 },
    ],
  },
  {
    id: 'selera-kampung', name: 'Selera Kampung', cuisine: 'Malaysian', meals: ['Breakfast', 'Lunch', 'Dinner'],
    dietary: 'Halal', price: '$', minutes: 25, distance: 2.2, rating: 4.7, reviews: 260, fee: 2900,
    freeDelivery: true, open: true, offers: ['Accept vouchers', 'Discounts'],
    dishes: [
      { id: 'satay', name: 'Chicken Satay', description: 'Grilled chicken skewers with peanut sauce.', price: 10900 },
      { id: 'nasi-lemak', name: 'Nasi Lemak', description: 'Coconut rice with sambal, anchovies and egg.', price: 12900 },
    ],
  },
  {
    id: 'annapurna-kitchen', name: 'Annapurna Kitchen', cuisine: 'Indian', meals: ['Lunch', 'Dinner'],
    dietary: 'Vegetarian', price: '$$', minutes: 20, distance: 2.8, rating: 4.4, reviews: 69, fee: 3200,
    open: true, offers: ['Accept vouchers'],
    dishes: [
      { id: 'thali', name: 'Vegetarian Thali', description: 'A selection of curries, dal, rice and roti.', price: 16900 },
      { id: 'chana-masala', name: 'Chana Masala', description: 'Chickpea curry with cumin, tomato and rice.', price: 13900 },
    ],
  },
  {
    id: 'sweet-hour', name: 'Sweet Hour', cuisine: 'Coffee', meal: 'Dessert', meals: ['Brunch', 'Dessert'],
    dietary: 'Halal', price: '$', minutes: 10, distance: .6, rating: 3.9, reviews: 500, fee: 2000,
    open: true, offers: ['Accept vouchers', 'Buy 1 Free 1'],
    dishes: [
      { id: 'latte', name: 'Vanilla Latte', description: 'Espresso, milk and vanilla. Buy 1 Free 1 on regular portions.', price: 5500, buyOneGetOne: true },
      { id: 'cheesecake', name: 'Berry Cheesecake', description: 'Creamy cheesecake with a mixed-berry topping.', price: 6900 },
    ],
  },
  {
    id: 'dragon-bowl', name: 'Dragon Bowl', cuisine: 'Chinese', meals: ['Lunch', 'Dinner'],
    dietary: 'Halal', price: '$$', minutes: 30, distance: 3.1, rating: 4.5, reviews: 2, fee: 3500,
    open: false, offers: [],
    dishes: [
      { id: 'noodles', name: 'Chicken Chow Mein', description: 'Wok-tossed noodles, chicken and vegetables.', price: 11900 },
      { id: 'dumplings', name: 'Steamed Chicken Dumplings', description: 'Chicken dumplings with a soy dipping sauce.', price: 7900 },
    ],
  },
  {
    id: 'texas-meat', name: 'Texas Meat', cuisine: 'Western', meals: ['Lunch', 'Dinner', 'Late night'],
    dietary: 'Non-Halal', price: '$$$', minutes: 15, distance: 1.9, rating: 4.2, reviews: 190, fee: 3000,
    open: true, offers: ['Accept vouchers', 'Discounts'],
    dishes: [
      { id: 'crispy-chicken-combo', name: 'Crispy Chicken Combo', description: 'Fried chicken, fries and a cold drink.', price: 21900 },
      { id: 'smokehouse', name: 'Smokehouse Platter', description: 'Smoked beef with slaw and seasoned fries.', price: 29900 },
    ],
  },
];
