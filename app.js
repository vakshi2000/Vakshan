// app.js

// State
let items = [];
let historyLog = [];
let categories = ['Uncategorized'];
const COLLECTION_NAME = 'items';
const CATEGORY_KEY = 'itemReportCategories';
let isSortedByBarcode = false;

// DOM Elements
const barcodeInput = document.getElementById('barcodeInput');
const descriptionInput = document.getElementById('descriptionInput');
const priceInput = document.getElementById('priceInput');
const categorySelect = document.getElementById('categorySelect');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const addItemBtn = document.getElementById('addItemBtn');
const itemTableBody = document.querySelector('#itemTable tbody');
const emptyState = document.getElementById('emptyState');
const totalItemsEl = document.getElementById('totalItems');
const grandTotalEl = document.getElementById('grandTotal');
// const clearBtn = document.getElementById('clearBtn'); // Removed
const historyBtn = document.getElementById('historyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const historyModal = document.getElementById('historyModal');
const closeModalBtn = document.querySelector('.close-modal');
const historyList = document.getElementById('historyList');
const categoryFilter = document.getElementById('categoryFilter');
const sortBarcodeBtn = document.getElementById('sortBarcodeBtn');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadItems();
    loadHistory();
    renderTable();
    categorySelect.focus();
});

// Event Listeners
addItemBtn.addEventListener('click', handleAddItem);
addCategoryBtn.addEventListener('click', handleAddCategory);
// clearBtn.addEventListener('click', clearAllItems); // Removed
historyBtn.addEventListener('click', openHistoryModal);
closeModalBtn.addEventListener('click', closeHistoryModal);
window.addEventListener('click', (e) => {
    if (e.target == historyModal) {
        closeHistoryModal();
    }
});
downloadBtn.addEventListener('click', downloadExcel);
categoryFilter.addEventListener('change', renderTable);
sortBarcodeBtn.addEventListener('click', toggleBarcodeSort);

// Allow "Enter" key to submit in inputs
categorySelect.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        barcodeInput.focus();
    }
});

descriptionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        priceInput.focus();
    }
});

barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const barcode = barcodeInput.value.trim();
        const existingItem = items.find(i => i.barcode === barcode);

        if (existingItem) {
            priceInput.value = existingItem.price;
            // Also set category if it exists in our list
            if (categories.includes(existingItem.category)) {
                categorySelect.value = existingItem.category;
            }
            priceInput.focus();
            priceInput.select(); // Select price for easy overwrite if needed
        } else {
            descriptionInput.focus();
        }
    }
});

priceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleAddItem();
    }
});

// Core Logic
async function handleAddItem() {
    const barcode = barcodeInput.value.trim();
    const description = descriptionInput.value.trim();
    const price = parseFloat(priceInput.value);
    const category = categorySelect.value;

    if (!barcode) {
        alert('Please enter a barcode number.');
        return;
    }

    if (isNaN(price) || price < 0) {
        alert('Please enter a valid price.');
        return;
    }
    // Check if item exists
    const existingItemIndex = items.findIndex(item => item.barcode === barcode);

    if (existingItemIndex !== -1) {
        // Check for price mismatch
        if (items[existingItemIndex].price !== price) {
            alert(`Error: This barcode already exists with a price of LKR ${items[existingItemIndex].price.toFixed(2)}.\nYou entered LKR ${price.toFixed(2)}.\n\nCannot add item with different price.`);
            return;
        }

        // Confirmation for update
        if (!confirm(`Item exists. Increase quantity for "${barcode}"?\nCategory: ${items[existingItemIndex].category}\nPrice: LKR ${price}`)) {
            return;
        }

        // Update existing
        items[existingItemIndex].quantity += 1;
        // Price is same, no need to update
        if (category !== 'Uncategorized' && items[existingItemIndex].category === 'Uncategorized') {
            items[existingItemIndex].category = category;
        }

        await saveItem(items[existingItemIndex]);
        logAction('UPDATE', `Increased quantity for ${barcode}`);
        highlightRow(barcode);
    } else {
        // Confirmation for new item
        if (!confirm(`Add NEW item?\nBarcode: ${barcode}\nCategory: ${category}\nPrice: LKR ${price}`)) {
            return;
        }

        // Add new
        const newItem = {
            id: Date.now().toString(),
            barcode: barcode,
            description: description,
            price: price,
            category: category,
            quantity: 1,
            timestamp: new Date().toISOString()
        };
        items.push(newItem);
        await saveItem(newItem, true);
        logAction('ADD', `Added new item ${barcode} - ${category} - LKR ${price}`);
    }

    // Reset inputs
    barcodeInput.value = '';
    descriptionInput.value = '';
    priceInput.value = '';
    // Keep category for convenience, and focus barcode for next item
    barcodeInput.focus();

    renderTable();
}

function handleAddCategory() {
    const newCat = prompt("Enter new category name:");
    if (newCat && newCat.trim() !== "") {
        const trimmedCat = newCat.trim();
        if (!categories.includes(trimmedCat)) {
            categories.push(trimmedCat);
            categories.sort();
            saveCategories();
            updateCategoryDropdowns();
            categorySelect.value = trimmedCat; // Select the new one
        } else {
            alert("Category already exists!");
            categorySelect.value = trimmedCat;
        }
    }
}

function saveCategories() {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
}

function loadCategories() {
    const storedCats = localStorage.getItem(CATEGORY_KEY);
    if (storedCats) {
        categories = JSON.parse(storedCats);
    } else {
        categories = ['Uncategorized'];
    }
    updateCategoryDropdowns();
}

function updateCategoryDropdowns() {
    // Update Add Item Dropdown
    const currentSelect = categorySelect.value;
    categorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    if (categories.includes(currentSelect)) categorySelect.value = currentSelect;

    // Update Filter Dropdown
    const currentFilter = categoryFilter.value;
    let filterHTML = `<option value="all">All Categories</option>`;
    categories.forEach(c => {
        filterHTML += `<option value="${c}">${c}</option>`;
    });
    categoryFilter.innerHTML = filterHTML;

    if (categories.includes(currentFilter) || currentFilter === 'all') {
        categoryFilter.value = currentFilter;
    } else {
        categoryFilter.value = 'all';
    }
}

async function saveItem(item, isNew = false) {
    // 1. Save to LocalStorage
    localStorage.setItem('itemReportData', JSON.stringify(items));

    // 2. Save to Firebase (if configured)
    if (db) {
        try {
            const itemRef = db.collection(COLLECTION_NAME).doc(item.barcode);
            if (isNew) {
                await itemRef.set(item);
            } else {
                await itemRef.update({
                    quantity: item.quantity,
                    price: item.price,
                    category: item.category
                });
            }
        } catch (error) {
            console.error("Error saving to Firebase:", error);
        }
    }
}

async function deleteItem(barcode) {
    if (confirm(`Delete item ${barcode}?`)) {
        items = items.filter(i => i.barcode !== barcode);

        localStorage.setItem('itemReportData', JSON.stringify(items));

        if (db) {
            try {
                await db.collection(COLLECTION_NAME).doc(barcode).delete();
            } catch (e) { console.error(e); }
        }

        logAction('DELETE', `Deleted item ${barcode}`);
        renderTable();
    }
}

let currentEditingBarcode = null;
const editModal = document.getElementById('editModal');
const editCategory = document.getElementById('editCategory');
const editDescription = document.getElementById('editDescription');
const editPrice = document.getElementById('editPrice');
const editQuantity = document.getElementById('editQuantity');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const closeEditModalBtn = document.querySelector('.close-edit-modal');

// Edit Modal Listeners
saveEditBtn.addEventListener('click', saveEdit);
cancelEditBtn.addEventListener('click', closeEditModal);
closeEditModalBtn.addEventListener('click', closeEditModal);
window.addEventListener('click', (e) => {
    if (e.target == editModal) {
        closeEditModal();
    }
});

function editItem(barcode) {
    const item = items.find(i => i.barcode === barcode);
    if (!item) return;

    currentEditingBarcode = barcode;

    // Populate categories
    editCategory.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    editCategory.value = item.category || 'Uncategorized';

    editDescription.value = item.description || '';
    editPrice.value = item.price;
    editQuantity.value = item.quantity;

    editModal.style.display = 'block';
}

async function saveEdit() {
    if (!currentEditingBarcode) return;

    const item = items.find(i => i.barcode === currentEditingBarcode);
    if (!item) return;

    const newPrice = parseFloat(editPrice.value);
    const newQty = parseInt(editQuantity.value);
    const newCat = editCategory.value;
    const newDesc = editDescription.value.trim();

    if (isNaN(newPrice) || newPrice < 0 || isNaN(newQty) || newQty < 0) {
        alert("Please enter valid positive numbers.");
        return;
    }

    item.price = newPrice;
    item.quantity = newQty;
    item.category = newCat;
    item.description = newDesc;

    await saveItem(item);
    logAction('EDIT', `Edited item ${currentEditingBarcode} - Cat: ${newCat}, Price: ${newPrice}, Qty: ${newQty}`);
    renderTable();
    closeEditModal();
}

function closeEditModal() {
    editModal.style.display = 'none';
    currentEditingBarcode = null;
}
function loadItems() {
    const stored = localStorage.getItem('itemReportData');
    if (stored) {
        items = JSON.parse(stored);
        // We don't update categories from items anymore, categories are master.
    }

    if (db) {
        db.collection(COLLECTION_NAME).onSnapshot((snapshot) => {
            const dbItems = [];
            snapshot.forEach((doc) => {
                dbItems.push(doc.data());
            });
            if (dbItems.length > 0) {
                items = dbItems;
                renderTable();
                localStorage.setItem('itemReportData', JSON.stringify(items));
            }
        });
    }
}

function loadHistory() {
    const storedHistory = localStorage.getItem('itemReportHistory');
    if (storedHistory) {
        historyLog = JSON.parse(storedHistory);
    }
}

function logAction(action, details) {
    const logEntry = {
        timestamp: new Date().toLocaleString(),
        action: action,
        details: details
    };
    historyLog.unshift(logEntry); // Add to top
    if (historyLog.length > 50) historyLog.pop(); // Keep last 50
    localStorage.setItem('itemReportHistory', JSON.stringify(historyLog));
}

function openHistoryModal() {
    historyList.innerHTML = '';
    if (historyLog.length === 0) {
        historyList.innerHTML = '<li>No history yet.</li>';
    } else {
        historyLog.forEach(log => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="log-time">${log.timestamp}</span>
                <span class="log-action ${log.action.toLowerCase()}">${log.action}</span>
                <span class="log-details">${log.details}</span>
            `;
            historyList.appendChild(li);
        });
    }
    historyModal.style.display = 'block';
}

function closeHistoryModal() {
    historyModal.style.display = 'none';
}

function downloadExcel() {
    if (items.length === 0) {
        alert('No items to download.');
        return;
    }

    const filter = categoryFilter.value;
    let dataToExport = filter === 'all' ? items : items.filter(i => (i.category || 'Uncategorized') === filter);

    if (isSortedByBarcode) {
        dataToExport = [...dataToExport].sort((a, b) => a.barcode.localeCompare(b.barcode));
    }

    if (dataToExport.length === 0) {
        alert('No items match the current filter.');
        return;
    }

    const data = dataToExport.map(item => ({
        'Barcode': item.barcode,
        'Category': item.category || 'Uncategorized',
        'Description': item.description || '',
        'Price (LKR)': item.price,
        'Quantity': item.quantity,
        'Total (LKR)': item.price * item.quantity
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Report");

    const date = new Date().toISOString().split('T')[0];
    const fileName = `Item_Report_${date}.xlsx`;

    XLSX.writeFile(wb, fileName);
}

function renderTable() {
    itemTableBody.innerHTML = '';
    let totalQty = 0;
    let grandTotal = 0;

    const filter = categoryFilter.value;
    let filteredItems = filter === 'all' ? items : items.filter(i => (i.category || 'Uncategorized') === filter);

    if (isSortedByBarcode) {
        filteredItems = [...filteredItems].sort((a, b) => a.barcode.localeCompare(b.barcode));
    }

    if (filteredItems.length === 0) {
        emptyState.style.display = 'block';
        emptyState.textContent = items.length > 0 ? 'No items in this category.' : 'No items added yet. Enter a barcode to begin.';
    } else {
        emptyState.style.display = 'none';

        filteredItems.forEach(item => {
            const row = document.createElement('tr');
            row.setAttribute('data-barcode', item.barcode);

            const itemTotal = item.price * item.quantity;
            totalQty += item.quantity;
            grandTotal += itemTotal;

            row.innerHTML = `
                <td>${item.barcode}</td>
                <td>${item.category || 'Uncategorized'}</td>
                <td>${item.description || ''}</td>
                <td>LKR ${item.price.toFixed(2)}</td>
                <td>${item.quantity}</td>
                <td>LKR ${itemTotal.toFixed(2)}</td>
                <td>
                    <button class="action-btn edit" onclick="editItem('${item.barcode}')">Edit</button>
                    <button class="action-btn delete" onclick="deleteItem('${item.barcode}')">Del</button>
                </td>
            `;
            itemTableBody.appendChild(row);
        });
    }

    totalItemsEl.textContent = totalQty;
    grandTotalEl.textContent = `LKR ${grandTotal.toFixed(2)}`;
}

function highlightRow(barcode) {
    renderTable();
    const row = document.querySelector(`tr[data-barcode="${barcode}"]`);
    if (row) {
        row.classList.remove('highlight');
        void row.offsetWidth;
        row.classList.add('highlight');
    }
}

function toggleBarcodeSort() {
    isSortedByBarcode = !isSortedByBarcode;
    sortBarcodeBtn.textContent = isSortedByBarcode ? "Sort: Barcode" : "Sort: Default";
    sortBarcodeBtn.classList.toggle('active', isSortedByBarcode);
    renderTable();
}
