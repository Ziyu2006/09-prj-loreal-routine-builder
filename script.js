/* ---------- DOM References ---------- */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

/* ---------- State ---------- */
let allProducts = [];
let selectedProductIds = JSON.parse(localStorage.getItem("selectedProductIds")) || [];
let conversationHistory = [
  {
    role: "system",
    content: `
You are a helpful L'Oréal beauty advisor.
Only answer questions related to the user's selected products, generated routine,
or beauty topics such as skincare, makeup, haircare, fragrance, suncare, and grooming.

Rules:
- Be clear, friendly, and organized.
- If relevant, separate advice by morning and evening.
- Use only the selected products when generating a routine.
- Do not recommend unrelated medical treatment.
- Keep answers focused on beauty and personal care.
    `.trim()
  }
];

const WORKER_URL = "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE";

/* ---------- Initial UI ---------- */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Choose a category or search for a product to start browsing.
  </div>
`;

appendMessage(
  "assistant",
  "Hi! Select a few products, then click “Generate Routine” and I’ll build a personalized routine for you."
);

renderSelectedProducts();

/* ---------- Load Products ---------- */
async function loadProducts() {
  try {
    const response = await fetch("products.json");

    if (!response.ok) {
      throw new Error("Could not load product data.");
    }

    const data = await response.json();
    allProducts = data.products;
    applyFilters();
  } catch (error) {
    console.error("Error loading products:", error);
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Sorry, products could not be loaded right now.
      </div>
    `;
  }
}

/* ---------- Filter Logic ---------- */
function applyFilters() {
  const selectedCategory = categoryFilter.value.trim().toLowerCase();
  const searchTerm = productSearch.value.trim().toLowerCase();

  const filteredProducts = allProducts.filter((product) => {
    const categoryMatch =
      !selectedCategory || product.category.toLowerCase() === selectedCategory;

    const searchMatch =
      !searchTerm ||
      product.name.toLowerCase().includes(searchTerm) ||
      product.brand.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm);

    return categoryMatch && searchMatch;
  });

  displayProducts(filteredProducts);
}

/* ---------- Render Product Cards ---------- */
function displayProducts(products) {
  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products matched your filters. Try a different category or keyword.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProductIds.includes(product.id);

      return `
        <article class="product-card ${isSelected ? "selected" : ""}" data-id="${product.id}">
          <div class="product-top">
            <img src="${product.image}" alt="${product.name}">
            <div class="product-info">
              <h3>${product.name}</h3>
              <p class="product-brand">${product.brand}</p>
              <span class="product-category">${product.category}</span>
            </div>
          </div>

          <div class="product-actions">
            <button
              class="product-btn select-btn"
              type="button"
              data-action="select"
              data-id="${product.id}"
            >
              ${isSelected ? "Unselect" : "Select"}
            </button>

            <button
              class="product-btn details-btn"
              type="button"
              data-action="details"
              data-id="${product.id}"
            >
              View Details
            </button>
          </div>

          <div class="product-description hidden" id="description-${product.id}">
            ${product.description}
          </div>
        </article>
      `;
    })
    .join("");
}

/* ---------- Selected Products ---------- */
function renderSelectedProducts() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.includes(product.id)
  );

  if (!selectedProducts.length) {
    selectedProductsList.innerHTML = `
      <p class="empty-selected">No products selected yet.</p>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-item">
          <span>${product.name}</span>
          <button
            type="button"
            data-action="remove-selected"
            data-id="${product.id}"
            aria-label="Remove ${product.name}"
            title="Remove ${product.name}"
          >
            ×
          </button>
        </div>
      `
    )
    .join("");
}

function toggleProductSelection(productId) {
  const numericId = Number(productId);

  if (selectedProductIds.includes(numericId)) {
    selectedProductIds = selectedProductIds.filter((id) => id !== numericId);
  } else {
    selectedProductIds.push(numericId);
  }

  saveSelections();
  renderSelectedProducts();
  applyFilters();
}

function removeSelectedProduct(productId) {
  const numericId = Number(productId);
  selectedProductIds = selectedProductIds.filter((id) => id !== numericId);

  saveSelections();
  renderSelectedProducts();
  applyFilters();
}

function clearSelections() {
  selectedProductIds = [];
  saveSelections();
  renderSelectedProducts();
  applyFilters();
}

function saveSelections() {
  localStorage.setItem("selectedProductIds", JSON.stringify(selectedProductIds));
}

/* ---------- Chat UI ---------- */
function appendMessage(role, content) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("chat-message", role);
  messageDiv.textContent = content;
  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setGenerateButtonLoading(isLoading) {
  generateRoutineBtn.disabled = isLoading;
  generateRoutineBtn.innerHTML = isLoading
    ? `<i class="fa-solid fa-spinner fa-spin"></i> Generating...`
    : `<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine`;
}

/* ---------- AI Request ---------- */
async function callBeautyAdvisor(messages) {
  if (!WORKER_URL || WORKER_URL === "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE") {
    throw new Error("Please paste your Cloudflare Worker URL into script.js.");
  }

  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ messages })
  });

  if (!response.ok) {
    throw new Error(`Worker request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data.reply) {
    throw new Error("No reply returned from the Worker.");
  }

  return data.reply;
}

/* ---------- Generate Routine ---------- */
async function generateRoutine() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.includes(product.id)
  );

  if (!selectedProducts.length) {
    appendMessage(
      "assistant",
      "Please select at least one product before generating a routine."
    );
    return;
  }

  const productSummary = selectedProducts
    .map(
      (product) => `
Name: ${product.name}
Brand: ${product.brand}
Category: ${product.category}
Description: ${product.description}
      `.trim()
    )
    .join("\n\n");

  const prompt = `
Build a personalized beauty routine using only these selected L'Oréal products.

Selected products:
${productSummary}

Instructions:
- Use only the selected products.
- Organize the routine clearly.
- Separate morning and evening if relevant.
- Explain the order of use.
- Mention helpful cautions if relevant.
- Keep the advice focused on beauty and personal care.
  `.trim();

  conversationHistory.push({
    role: "user",
    content: prompt
  });

  setGenerateButtonLoading(true);
  appendMessage("user", "Generate a personalized routine with my selected products.");

  try {
    const reply = await callBeautyAdvisor(conversationHistory);
    conversationHistory.push({ role: "assistant", content: reply });
    appendMessage("assistant", reply);
  } catch (error) {
    console.error("Routine generation error:", error);
    appendMessage(
      "assistant",
      "Sorry — something went wrong while generating your routine. Please check your Worker URL and try again."
    );
  } finally {
    setGenerateButtonLoading(false);
  }
}

/* ---------- Follow-up Chat ---------- */
async function handleChatSubmit(event) {
  event.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  appendMessage("user", message);
  conversationHistory.push({
    role: "user",
    content: message
  });

  userInput.value = "";

  try {
    const reply = await callBeautyAdvisor(conversationHistory);
    conversationHistory.push({ role: "assistant", content: reply });
    appendMessage("assistant", reply);
  } catch (error) {
    console.error("Chat error:", error);
    appendMessage(
      "assistant",
      "Sorry — I couldn’t respond just now. Double-check your Worker and try again."
    );
  }
}

/* ---------- Event Listeners ---------- */
categoryFilter.addEventListener("change", applyFilters);
productSearch.addEventListener("input", applyFilters);
clearSelectionsBtn.addEventListener("click", clearSelections);
generateRoutineBtn.addEventListener("click", generateRoutine);
chatForm.addEventListener("submit", handleChatSubmit);

/* Product card buttons */
productsContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const productId = button.dataset.id;

  if (action === "select") {
    toggleProductSelection(productId);
  }

  if (action === "details") {
    const description = document.getElementById(`description-${productId}`);
    if (!description) return;

    description.classList.toggle("hidden");
    button.textContent = description.classList.contains("hidden")
      ? "View Details"
      : "Hide Details";
  }
});

/* Remove from selected list */
selectedProductsList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const productId = button.dataset.id;

  if (action === "remove-selected") {
    removeSelectedProduct(productId);
  }
});

/* ---------- Start App ---------- */
loadProducts();