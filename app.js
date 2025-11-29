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
const clearAllBtn = document.getElementById('clearAllBtn'); // NEW

const searchInput = document.getElementById('searchInput');


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
searchInput.addEventListener('input', renderTable);
clearAllBtn.addEventListener('click', clearAllItems); // NEW


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

        // FIX: convert both sides to string
        const existingItem = items.find(i => String(i.barcode) === String(barcode));

        if (existingItem) {
            descriptionInput.value = existingItem.description || "";
            priceInput.value = existingItem.price;

            if (categories.includes(existingItem.category)) {
                categorySelect.value = existingItem.category;
            }

            priceInput.focus();
            priceInput.select(); 
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

    // Always compare barcodes as strings
    const existingItemIndex = items.findIndex(item => String(item.barcode) === String(barcode));

    if (existingItemIndex !== -1) {
        const existingItem = items[existingItemIndex];

        // Check for price mismatch
        if (existingItem.price !== price) {
            alert(`Error: This barcode already exists with a price of LKR ${existingItem.price.toFixed(2)}.\nYou entered LKR ${price.toFixed(2)}.\n\nCannot add item with different price.`);
            return;
        }

        // Confirmation for quantity increase
        if (!confirm(`Item exists. Increase quantity for "${barcode}"?\nCategory: ${existingItem.category}\nPrice: LKR ${price}`)) {
            return;
        }

        // Update quantity
        existingItem.quantity += 1;

        // Update category only if current category is Uncategorized
        if (category !== 'Uncategorized' && existingItem.category === 'Uncategorized') {
            existingItem.category = category;
        }

        await saveItem(existingItem);
        logAction('UPDATE', `Increased quantity for ${barcode}`);
        highlightRow(barcode);
    } else {
        // Confirmation for adding new item
        if (!confirm(`Add NEW item?\nBarcode: ${barcode}\nCategory: ${category}\nPrice: LKR ${price}`)) {
            return;
        }

        const newItem = {
            id: Date.now().toString(),
            barcode: String(barcode),  // Store as string
            description: description,
            price: price,
            category: category,
            quantity: 1,
            actual: 0,   // NEW FIELD
            timestamp: new Date().toISOString()
        };

        items.push(newItem);
        await saveItem(newItem, true);
        logAction('ADD', `Added new item ${barcode} - ${category} - LKR ${price}`);
    }

    // Reset input fields
    barcodeInput.value = '';
    descriptionInput.value = '';
    priceInput.value = '';
    barcodeInput.focus();  // Ready for next input

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
                    actual: item.actual ?? 0,
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
const editActual = document.getElementById('editActual');
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
    editActual.value = item.actual ?? 0;

    editModal.style.display = 'block';
}

async function saveEdit() {
    if (!currentEditingBarcode) return;

    const item = items.find(i => i.barcode === currentEditingBarcode);
    if (!item) return;

    const newPrice = parseFloat(editPrice.value);
    const newQty = parseInt(editQuantity.value);
    const newActual = parseInt(editActual.value);
    const newCat = editCategory.value;
    const newDesc = editDescription.value.trim();

    if (isNaN(newPrice) || newPrice < 0 || isNaN(newQty) || newQty < 0) {
        alert("Please enter valid positive numbers.");
        return;
    }

    item.price = newPrice;
    item.quantity = newQty;
    item.actual = newActual;
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
        'Actual Stock': item.actual ?? 0,
        'Total (LKR)': item.price * item.quantity
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Report");

    const date = new Date().toISOString().split('T')[0];
    const fileName = `Item_Report_${date}.xlsx`;

    XLSX.writeFile(wb, fileName);
}

function uploadExcel() {
    const fileInput = document.getElementById("excelUpload");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select an Excel file first");
        return;
    }

    const reader = new FileReader();

    reader.onload = async function (event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        let importedCount = 0;

        for (let row of rows) {
            if (!row.Barcode) continue;

            const existingIndex = items.findIndex(i => i.barcode === row.Barcode);

            const newItem = {
                id: Date.now().toString(),
                barcode: row.Barcode,
                category: row.Category || "Uncategorized",
                description: row.Description || "",
                price: Number(row.Price) || 0,
                quantity: Number(row.Quantity) || 0,
                actual: Number(row["Actual Stock"]) || 0,
                timestamp: new Date().toISOString()
            };

            if (existingIndex === -1) {
                // Add new item
                items.push(newItem);
                await saveItem(newItem, true);
            } else {
                // Update existing item
                const existing = items[existingIndex];
                existing.category = newItem.category;
                existing.description = newItem.description;
                existing.price = newItem.price;
                existing.quantity = newItem.quantity;
                existing.actual = newItem.actual;

                await saveItem(existing, false);
            }

            importedCount++;
        }

        localStorage.setItem("itemReportData", JSON.stringify(items));

        alert(`Excel uploaded successfully! Imported/Updated: ${importedCount} items`);

        loadItems();
        renderTable();
    };

    reader.readAsArrayBuffer(file);
}


function renderTable() {
    itemTableBody.innerHTML = '';
    let totalQty = 0;
    let grandTotal = 0;

    const filter = categoryFilter.value;
    const searchTerm = searchInput.value.toLowerCase().trim();

    let filteredItems = items.filter(i => {
        const matchesCategory = filter === 'all' || (i.category || 'Uncategorized') === filter;
        const matchesSearch = !searchTerm ||
            i.barcode.toLowerCase().includes(searchTerm) ||
            (i.description && i.description.toLowerCase().includes(searchTerm)) ||
            (i.category && i.category.toLowerCase().includes(searchTerm));

        return matchesCategory && matchesSearch;
    });

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
                <td>${item.actual ?? 0}</td>
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

// Scanner Elements
// Scanner Elements
const scanBtn = document.getElementById("scanBtn");
const scannerModal = document.getElementById("scannerModal");
const closeScanner = document.querySelector(".close-scanner");
const videoElement = document.getElementById("cameraPreview");
let codeReader = null;
let currentStream = null;
let videoDevices = [];
let selectedDeviceId = null;
let decodingActive = false; // Line after selectedDeviceId

// Open Scanner
scanBtn.addEventListener("click", async () => {
    scannerModal.style.display = "block";
    codeReader = new ZXing.BrowserMultiFormatReader();
    decodingActive = true; // Start decoding

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(d => d.kind === 'videoinput');

        let rearCamera = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
        selectedDeviceId = rearCamera ? rearCamera.deviceId : null;

        await startCamera(selectedDeviceId);
        addCameraToggle();  // <-- make sure toggle button exists
        decodeLoop();       // <-- start continuous scan
    } catch (err) {
        console.error(err);
        alert("Cannot access camera. " + err.message);
    }
});


// Start camera with deviceId
async function startCamera(deviceId = null) {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    let constraints;
    if (deviceId) {
        constraints = { video: { deviceId: { exact: deviceId } } };
    } else {
        constraints = { video: { facingMode: { ideal: "environment" } } };
    }

    try {
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = currentStream;
        videoElement.play();

        codeReader.decodeFromVideoElement(videoElement, (result, err) => {
            if (result) {
                document.getElementById("barcodeInput").value = result.text;
                closeScannerModal();
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error(err);
            }
        });
    } catch (err) {
        console.error("Camera error:", err);
        alert("Cannot access camera. Error: " + err.message);
    }
}


// decodeLoop
async function decodeLoop() {
    if (!decodingActive) return; // Stop if scanner closed
    try {
        const result = await codeReader.decodeOnceFromVideoDevice(selectedDeviceId, videoElement);
        if (result) {
            document.getElementById("barcodeInput").value = result.text;
            closeScannerModal();
        }
    } catch (err) {
        if (!(err instanceof ZXing.NotFoundException)) console.error(err);
        setTimeout(decodeLoop, 500); // Retry every 0.5s
    }
}




// Close Scanner
function closeScannerModal() {
    decodingActive = false; // Stop decode loop
    scannerModal.style.display = "none";
    if (codeReader) {
        codeReader.reset();
        codeReader = null;
    }
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}


// Close events
closeScanner.addEventListener("click", closeScannerModal);
window.addEventListener("click", (e) => {
    if (e.target === scannerModal) closeScannerModal();
});

// Optional: Toggle camera
function addCameraToggle() {
    let toggleBtn = document.getElementById("cameraToggleBtn");
    if (!toggleBtn) {
        toggleBtn = document.createElement("button");
        toggleBtn.id = "cameraToggleBtn";
        toggleBtn.textContent = "Switch Camera";
        toggleBtn.className = "btn-secondary";
        scannerModal.querySelector(".modal-body").prepend(toggleBtn);

        toggleBtn.addEventListener("click", () => {
            if (videoDevices.length < 2) return; // Only 1 camera
            const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
            const nextIndex = (currentIndex + 1) % videoDevices.length;
            selectedDeviceId = videoDevices[nextIndex].deviceId;
            startCamera(selectedDeviceId);
        });
    }
}

async function clearAllItems() {
    if (!confirm("Are you sure you want to clear ALL items? This action cannot be undone.")) {
        return;
    }

    // Clear local array
    items = [];

    // Clear LocalStorage
    localStorage.removeItem('itemReportData');

    // Optionally clear Firebase
    if (db) {
        try {
            const snapshot = await db.collection(COLLECTION_NAME).get();
            const batch = db.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        } catch (error) {
            console.error("Error clearing Firebase:", error);
        }
    }

    logAction('CLEAR', 'All items cleared');
    renderTable();
}
