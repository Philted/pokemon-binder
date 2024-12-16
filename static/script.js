let currentPage = 0;
let binderPages = [];
let preloadedImages = {};
let binderSettings = {};
let isUpdatingCard = false;

// Debounce function to prevent double-clicking
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Load and display the binder
function loadBinder(set_code, preservePage = false) {
    fetch(`/api/binder?set=${set_code}`)
        .then(response => response.json())
        .then(data => {
            binderPages = data.pages;
            binderSettings = data.settings;
            const set_name = data.set_name; // Extract set_name from the response
            document.getElementById("binder-title").innerText = set_name;
            document.getElementById("set-code").value = set_code; // Set the hidden field value
            applyBinderSettings();
            displayAllPages();
            displayCardCount(); // Display the card count
            if (!preservePage) {
                currentPage = 0; // Reset to the first page only if not preserving the page
            }
            displayPage(currentPage);
            showBinder();
            isUpdatingCard = false; // Reset the flag after loading the binder
            preloadNextPageImages(set_code, currentPage + 1); // Preload the next page's images
        })
        .catch(error => console.error('Error loading binder:', error));
}

// Apply binder settings
function applyBinderSettings() {
    document.documentElement.style.setProperty('--binder-color', binderSettings.color);
    document.documentElement.style.setProperty('--binder-width', binderSettings.width);
    document.documentElement.style.setProperty('--binder-height', binderSettings.height);
}

// Preload images for the first page of each binder
function preloadFirstPageImages() {
    fetch(`/api/first_page_images`)
        .then(response => response.json())
        .then(data => {
            for (const set in data) {
                data[set].forEach(url => {
                    const img = new Image();
                    img.src = url;
                    img.onload = () => console.log(`Image loaded: ${url}`);
                    img.onerror = () => console.error(`Failed to load image: ${url}`);
                    preloadedImages[url] = img;
                });
            }
        });
}

// Preload images for the next page of the binder
function preloadNextPageImages(set_code, page) {
    fetch(`/api/binder_page?set=${set_code}&page=${page}`)
        .then(response => response.json())
        .then(data => {
            data.page.forEach(card => {
                if (!preloadedImages[card.image]) {
                    const img = new Image();
                    img.src = `/static/${card.image}`;
                    img.onload = () => console.log(`Image loaded: ${card.image}`);
                    img.onerror = () => console.error(`Failed to load image: ${card.image}`);
                    preloadedImages[card.image] = img;
                }
            });
        });
}

// Display all pages of the binder
function displayAllPages() {
    const pagesContainer = document.getElementById("binder-pages");
    pagesContainer.innerHTML = '';
    binderPages.forEach((page, pageIndex) => {
        page.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = `card ${card.quantity > 0 ? 'active' : ''}`;
            cardElement.dataset.quantity = card.quantity;
            cardElement.dataset.page = pageIndex;
            cardElement.dataset.type = getCardType(card.name); // Set the data-type attribute
            cardElement.dataset.cardId = card.id; // Set the data-card-id attribute
            cardElement.style.display = 'none';
            cardElement.innerHTML = `
                <img src="/static/${card.image}" alt="${card.name}">
            `;
            cardElement.addEventListener('click', debounce(() => toggleCard(card.id), 300));
            pagesContainer.appendChild(cardElement);
        });
    });

    // Create page buttons
    updatePageButtons();
}

// Determine the card type based on its name
function getCardType(cardName) {
    if (cardName.includes('Reverse Holofoil')) {
        return 'reverse_holofoil';
    } else if (cardName.includes('Holofoil')) {
        return 'holofoil';
    } else {
        return 'normal';
    }
}

// Update page buttons based on the current page
function updatePageButtons() {
    const pageButtonsContainer = document.getElementById("page-buttons");
    pageButtonsContainer.innerHTML = '';
    const startPage = Math.max(0, currentPage - 5);
    const endPage = Math.min(binderPages.length - 1, currentPage + 5);

    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
        const pageButton = document.createElement('button');
        pageButton.className = 'page-button';
        pageButton.innerText = pageIndex + 1;
        pageButton.addEventListener('click', () => {
            currentPage = pageIndex;
            displayPage(currentPage);
            preloadNextPageImages(document.getElementById("set-code").value, currentPage + 1); // Preload the next page's images
        });
        pageButtonsContainer.appendChild(pageButton);
    }
}

// Display a specific page of the binder
function displayPage(page) {
    const pagesContainer = document.getElementById("binder-pages");
    Array.from(pagesContainer.children).forEach(cardElement => {
        cardElement.style.display = cardElement.dataset.page == page ? 'block' : 'none';
    });

    // Show or hide navigation buttons
    document.getElementById("prev-page").style.visibility = page > 0 ? 'visible' : 'hidden';
    document.getElementById("next-page").style.visibility = page < binderPages.length - 1 ? 'visible' : 'hidden';

    // Update active page button
    updatePageButtons();
    Array.from(document.getElementsByClassName('page-button')).forEach((button, index) => {
        button.classList.toggle('active', index === page - Math.max(0, currentPage - 5));
    });
}

// Toggle card ownership on the server
function toggleCard(cardId) {
    const set_code = document.getElementById("set-code").value; // Get the set_code from the hidden field
    const cardElement = document.querySelector(`.card[data-card-id="${cardId}"]`);
    const change = cardElement.classList.contains('active') ? -1 : 1;
    isUpdatingCard = true; // Set the flag to indicate card update
    fetch("/api/cards/update", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            set_code: set_code,
            card_id: cardId,
            change: change
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadBinder(set_code, true); // Preserve the current page when reloading the binder
            } else {
                console.error("Failed to update card:", data.error);
            }
        });
}

// Handle page navigation
document.getElementById("prev-page").addEventListener("click", () => {
    if (currentPage > 0) {
        currentPage--;
        displayPage(currentPage);
        preloadNextPageImages(document.getElementById("set-code").value, currentPage + 1); // Preload the next page's images
    }
});

document.getElementById("next-page").addEventListener("click", () => {
    if (currentPage < binderPages.length - 1) {
        currentPage++;
        displayPage(currentPage);
        preloadNextPageImages(document.getElementById("set-code").value, currentPage + 1); // Preload the next page's images
    }
});

// Show the binder view
function showBinder() {
    document.getElementById("home-screen").style.display = "none";
    document.getElementById("binder").style.display = "block";
}

// Show the home view
function showHome() {
    document.getElementById("home-screen").style.display = "block";
    document.getElementById("binder").style.display = "none";
}

// Preload first page images on page load
window.onload = function() {
    preloadFirstPageImages();
    updateButtonColors();
};

// Display the number of cards out of the set you have
function displayCardCount() {
    const totalCards = binderPages.flat().length;
    const ownedCards = binderPages.flat().filter(card => card.quantity > 0).length;
    document.getElementById("card-count").innerText = `${ownedCards}/${totalCards} collected`;
    const progressPercentage = ((ownedCards / totalCards) * 100).toFixed(1);
    const progressBar = document.getElementById("progress");
    progressBar.style.width = `${progressPercentage}%`;
    progressBar.style.backgroundColor = binderSettings.color; 
    document.getElementById("progress-percentage").innerText = `${progressPercentage}%`;
}

// Update card quantity
function updateCardQuantity(setCode, cardId, quantity) {
    const formData = new FormData();
    formData.append('set_code', setCode);
    formData.append('card_id', cardId);
    formData.append('quantity', quantity);

    fetch('/update_card', {
        method: 'POST',
        body: formData
    }).then(response => {
        if (response.ok) {
            location.reload();
        }
    });
}

// Add event listeners to update quantity buttons
document.querySelectorAll('.update-quantity').forEach(button => {
    button.addEventListener('click', () => {
        const setCode = button.dataset.setCode;
        const cardId = button.dataset.cardId;
        const quantity = button.previousElementSibling.value;
        updateCardQuantity(setCode, cardId, quantity);
    });
});

document.querySelectorAll('.card').forEach(cardElement => {
    cardElement.addEventListener('click', debounce(() => toggleCard(cardElement.dataset.cardId), 300));
});

function openSettingsModal() {
    const modal = document.getElementById("settings-modal");
    const setCode = document.getElementById("set-code").value;
    const settings = binderSettings;

    document.getElementById("binder-width").value = settings.width;
    document.getElementById("binder-height").value = settings.height;
    document.getElementById("binder-color").value = settings.color;

    modal.style.display = "block";
}

function closeSettingsModal() {
    const modal = document.getElementById("settings-modal");
    modal.style.display = "none";
}

function updateBinderSettings() {
    const setCode = document.getElementById("set-code").value;
    const width = document.getElementById("binder-width").value;
    const height = document.getElementById("binder-height").value;
    const color = document.getElementById("binder-color").value;

    const settings = {
        width: parseInt(width),
        height: parseInt(height),
        color: color
    };

    fetch(`/api/binder/settings/update`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            set_code: setCode,
            settings: settings
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            binderSettings = settings;
            applyBinderSettings();
            closeSettingsModal();
            loadBinder(setCode);
        } else {
            console.error("Failed to update settings:", data.error);
        }
    });
}

function confirmResetBinder() {
    const modal = document.getElementById("reset-confirmation-modal");
    modal.style.display = "block";
}

function closeResetConfirmationModal() {
    const modal = document.getElementById("reset-confirmation-modal");
    modal.style.display = "none";
}

function resetBinder() {
    const setCode = document.getElementById("set-code").value;

    fetch(`/api/binder/reset`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            set_code: setCode
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeResetConfirmationModal();
            closeSettingsModal();
            loadBinder(setCode);
        } else {
            console.error("Failed to reset binder:", data.error);
        }
    });
}
