// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBC3tS6zWgBqRpFWJA_EvHNUH5JovEipIc",
  authDomain: "smartpark-5991c.firebaseapp.com",
  databaseURL: "https://smartpark-5991c-default-rtdb.firebaseio.com",
  projectId: "smartpark-5991c",
  storageBucket: "smartpark-5991c.firebasestorage.app",
  messagingSenderId: "410552122646",
  appId: "1:410552122646:web:935724d02ba7ab75db2437",
  measurementId: "G-WNV8GM1KJX"
};

// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- DOM Element References ---
const themeToggle = document.getElementById('theme-toggle');
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const sosListContainer = document.getElementById('sos-log-list'); // New reference for SOS list

// --- State Management ---
let currentLotId = 'parking';
let activeLotRef = null;
const lotState = {
    parking: { initialized: false, currentAvailable: 0 },
    CCTV_parking: { initialized: false, currentAvailable: 0 }
};
let charts = {};

// --- Navigation ---
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-target');
        const lotId = link.getAttribute('data-lot');

        navLinks.forEach(nav => nav.classList.remove('active'));
        link.classList.add('active');

        pages.forEach(page => page.classList.toggle('active', page.id === targetId));
        
        if (lotId) {
            currentLotId = lotId;
            switchLotView(currentLotId);
        }
        
        if (targetId === 'analytics' && !charts.hourly) {
            setTimeout(initCharts, 50);
        }
    });
});

// --- Theme Switcher ---
themeToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
    if (charts.hourly) {
        updateAllChartOptions();
    }
});

// --- Firebase Data Handling ---
function switchLotView(lotId) {
    if (activeLotRef) {
        activeLotRef.off();
    }
    activeLotRef = database.ref(lotId);
    activeLotRef.on('value', (snapshot) => {
        const data = snapshot.val();
        const pageId = lotId === 'parking' ? 'live-view' : 'cctv-view';
        
        if (!data || !data.slots) {
            const container = document.querySelector(`#${pageId} .slots-grid`);
            if (container) container.innerHTML = '<p>No data available for this lot.</p>';
            return;
        }
        
        updateMeta(data, pageId);

        if (!lotState[lotId].initialized) {
            initializeSlots(data.slots, pageId);
            lotState[lotId].initialized = true;
        } else {
            updateSlots(data.slots, pageId);
        }

        if (data.logs) {
            updateLogs(data.logs, pageId);
        }
    });
}

// --- NEW: Firebase Listener for SOS Alerts ---
// --- In app.js, REPLACE the entire "sosRef" listener with this new version ---

const sosRef = database.ref('sos');
sosRef.on('value', (snapshot) => {
    const sosData = snapshot.val();
    sosListContainer.innerHTML = ''; // Clear the list first

    if (!sosData) {
        sosListContainer.innerHTML = '<p class="no-alerts-message">No active SOS alerts.</p>';
        return;
    }

    Object.keys(sosData).forEach(key => {
        const alert = sosData[key];
        const listItem = document.createElement('li');
        listItem.className = 'sos-item';
        
        const details = document.createElement('div');
        details.className = 'sos-details';
        details.innerHTML = `
            Alert for Slot <strong>${alert.slot.replace('slot', '')}</strong> 
            - Status: ${alert.status} 
            - Time: ${new Date(alert.timestamp).toLocaleString()}
        `;

        // Create a container for the action buttons
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'sos-actions';

        // Create the "Take Action" button
        const actionButton = document.createElement('button');
        actionButton.className = 'sos-action-btn';
        actionButton.innerHTML = `<i class="fas fa-check"></i> Take Action`;
        actionButton.onclick = () => takeSosAction(key, alert.slot); // Pass the key and slot

        // Create the "Delete" button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'sos-delete-btn';
        deleteButton.innerHTML = `<i class="fas fa-trash-alt"></i> Delete`;
        deleteButton.onclick = () => deleteSosAlert(key);

        // Add buttons to their container
        actionsContainer.appendChild(actionButton);
        actionsContainer.appendChild(deleteButton);
        
        // Add details and the button container to the list item
        listItem.appendChild(details);
        listItem.appendChild(actionsContainer);
        sosListContainer.appendChild(listItem);
    });
});

// --- NEW: Function to delete an SOS alert ---
function deleteSosAlert(key) {
    if (confirm('Are you sure you want to delete this SOS alert?')) {
        database.ref('sos/' + key).remove()
            .then(() => {
                console.log(`SOS Alert ${key} deleted successfully.`);
            })
            .catch(error => {
                console.error("Error deleting SOS alert: ", error);
            });
    }
}


// --- UI Update Functions ---
function updateMeta(data, pageId) {
    const pageElement = document.getElementById(pageId);
    if (!pageElement) return;

    const totalSlotsElement = pageElement.querySelector('.total-slots');
    const availableSlotsElement = pageElement.querySelector('.available-slots');

    let total_slots = 0, available = 0;

    if (pageId === 'live-view' && data.meta) {
        total_slots = data.meta.total_slots || Object.keys(data.slots).length;
        available = data.meta.available;
    } else {
        const slots = data.slots || {};
        total_slots = Object.keys(slots).length;
        available = Object.values(slots).filter(s => s.status === 'empty').length;
    }
    
    totalSlotsElement.textContent = total_slots;
    const currentAvailable = lotState[currentLotId].currentAvailable;
    if (currentAvailable !== available) {
        animateValue(availableSlotsElement, currentAvailable, available, 500);
        lotState[currentLotId].currentAvailable = available;
    }
}

function initializeSlots(slots, pageId) {
    const slotsContainer = document.querySelector(`#${pageId} .slots-grid`);
    if (!slotsContainer) return;
    
    slotsContainer.innerHTML = '';
    let index = 0;
    for (const slotKey in slots) {
        const slotData = slots[slotKey];
        if (!slotData.id) slotData.id = parseInt(slotKey.replace('slot', ''));
        const slotDiv = createSlotElement(slotKey, slotData);
        slotDiv.style.animationDelay = `${index * 40}ms`;
        slotsContainer.appendChild(slotDiv);
        index++;
    }
}

function updateSlots(slots, pageId) {
    for (const slotKey in slots) {
        const slotData = slots[slotKey];
        if (!slotData.id) slotData.id = parseInt(slotKey.replace('slot', ''));
        const slotElement = document.getElementById(`${pageId}-${slotKey}`);
        if (slotElement) {
            updateSlotElement(slotElement, slotData);
        }
    }
}

function updateLogs(logsData, pageId) {
    const logList = document.querySelector(`#${pageId} .log-list`);
    if (!logList) return;

    logList.innerHTML = '';
    if (logsData && logsData.recent) {
        const logsArray = Array.isArray(logsData.recent) 
            ? logsData.recent 
            : Object.values(logsData.recent);

        logsArray.sort((a, b) => new Date(b.ts) - new Date(a.ts));

        logsArray.slice(0, 10).forEach(log => {
            const listItem = document.createElement('li');
            const eventText = log.event.replace(/_/g, ' ');
            listItem.textContent = `[${new Date(log.ts).toLocaleTimeString()}] Slot ${log.slot.replace('slot', '')} ${eventText}`;
            logList.appendChild(listItem);
        });
    }
}

// --- Element Creation & Booking ---
function createSlotElement(slotKey, slotData) {
    const pageId = currentLotId === 'parking' ? 'live-view' : 'cctv-view';
    const slotDiv = document.createElement('div');
    slotDiv.id = `${pageId}-${slotKey}`;
    slotDiv.className = `slot ${slotData.status}`;

    let innerHTML = `
        <div class="slot-info">
            <span class="slot-id">Slot ${slotData.id}</span>
            <span class="slot-status">${slotData.status}</span>
        </div>
        <div class="car"></div>`;
    
    slotDiv.innerHTML = innerHTML;

    let button = null;
    if (slotData.status === 'empty') {
        button = document.createElement('button');
        button.className = 'book-btn';
        button.textContent = 'Book';
        button.onclick = () => bookSlot(slotData.id);
    } else if (slotData.status === 'booked') {
        button = document.createElement('button');
        button.className = 'book-btn';
        button.textContent = 'Cancel';
        button.onclick = () => cancelBooking(slotData.id);
    }

    if (button) {
        slotDiv.appendChild(button);
    }
    
    return slotDiv;
}

function updateSlotElement(slotElement, slotData) {
    const currentStatus = slotElement.className.match(/(empty|occupied|booked)/)?.[0];

    if (currentStatus !== slotData.status) {
        slotElement.className = `slot ${slotData.status}`;
        slotElement.querySelector('.slot-status').textContent = slotData.status;

        const existingButton = slotElement.querySelector('.book-btn');
        if (existingButton) existingButton.remove();

        let newButton = null;
        if (slotData.status === 'empty') {
            newButton = document.createElement('button');
            newButton.className = 'book-btn';
            newButton.textContent = 'Book';
            newButton.onclick = () => bookSlot(slotData.id);
        } else if (slotData.status === 'booked') {
            newButton = document.createElement('button');
            newButton.className = 'book-btn';
            newButton.textContent = 'Cancel';
            newButton.onclick = () => cancelBooking(slotData.id);
        }

        if (newButton) {
            slotElement.appendChild(newButton);
        }
    }
}

function bookSlot(slotId) {
    database.ref(`${currentLotId}/slots/slot${slotId}`).update({ status: 'booked' });
}

function cancelBooking(slotId) {
    database.ref(`${currentLotId}/slots/slot${slotId}`).update({ status: 'empty' });
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

// --- Chart Functions ---
function getChartOptions() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDarkMode ? '#f0f0f0' : '#333';
    Chart.defaults.color = textColor;
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
            x: { grid: { color: gridColor }, ticks: { color: textColor } }
        },
        plugins: { legend: { labels: { color: textColor } } }
    };
}

function updateAllChartOptions() {
    const newOptions = getChartOptions();
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    if (charts.hourly) {
        charts.hourly.options = newOptions;
        charts.hourly.update();
    }
    if (charts.daily) {
        charts.daily.options = newOptions;
        charts.daily.update();
    }
    if (charts.peakHours) {
        charts.peakHours.data.datasets[0].borderColor = isDarkMode ? '#2c2c2c' : '#fff';
        charts.peakHours.options.plugins.legend.labels.color = isDarkMode ? '#f0f0f0' : '#333';
        charts.peakHours.update();
    }
}

function initCharts() {
    const options = getChartOptions();
    const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
    charts.hourly = new Chart(hourlyCtx, {
        type: 'bar',
        data: { labels: ['8am', '10am', '12pm', '2pm', '4pm', '6pm'], datasets: [{ label: 'Occupied Slots', data: [12, 19, 8, 15, 22, 18], backgroundColor: 'rgba(39, 174, 96, 0.7)', borderRadius: 4 }] },
        options: options
    });
    const dailyCtx = document.getElementById('dailyChart').getContext('2d');
    charts.daily = new Chart(dailyCtx, {
        type: 'line',
        data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ label: 'Average Occupancy %', data: [65, 59, 80, 81, 76, 55, 60], borderColor: 'rgba(41, 128, 185, 1)', backgroundColor: 'rgba(41, 128, 185, 0.1)', fill: true, tension: 0.3 }] },
        options: options
    });
    const peakHoursCtx = document.getElementById('peakHoursChart').getContext('2d');
    charts.peakHours = new Chart(peakHoursCtx, {
        type: 'doughnut',
        data: { labels: ['Morning (8-12)', 'Afternoon (12-5)', 'Evening (5-9)'], datasets: [{ data: [300, 450, 250], backgroundColor: ['#e74c3c', '#f1c40f', '#3498db'], borderColor: document.body.classList.contains('dark-mode') ? '#2c2c2c' : '#fff', borderWidth: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: options.plugins.legend.labels.color } } } }
    });
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    switchLotView(currentLotId);
});