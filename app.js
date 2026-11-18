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

for (const button of document.querySelectorAll("[data-preview]")) {
  button.addEventListener("click", () => {
    const [heading, description] = previews[button.dataset.preview];
    title.textContent = heading;
    message.textContent = description;
    dialog.showModal();
  });
}
