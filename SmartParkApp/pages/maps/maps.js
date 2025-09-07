// -------------------
// Firebase config
// -------------------
// Initialize Firebase
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

// Initialize Firebase (v8/v9 compat mode)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();


// -------------------
// List of locations
// -------------------
const locations = [
    {
        name: "SRM Tech Park",
        desc: "", // will be fetched from Firebase
        lat: 12.824537,
        lon: 80.045190,
        dbPath: "parking" // database node path
    },
    {
        name: "SRM Hospital",
        desc: "This parking is based on the CCTV field parking.",
        lat: 12.821222,
        lon: 80.049277,
        dbPath: "CCTV_parking"
    }
];

// -------------------
// Initialize Map
// -------------------
const map = L.map('map').setView([12.823, 80.047], 15);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// -------------------
// Add markers
// -------------------
locations.forEach(loc => {
    const marker = L.marker([loc.lat, loc.lon]).addTo(map);
    marker.on('click', () => {
        // Fetch data from Firebase if dbPath exists
        if (loc.dbPath) {
            fetchParkingData(loc.dbPath, loc);
        } else {
            showSidebar(loc);
        }
    });
});

// -------------------
// Sidebar logic
// -------------------
const sidebar = document.querySelector('.sidebar');
const closeBtn = document.querySelector('.close-btn');
const locationName = document.getElementById('location-name');
const locationDesc = document.getElementById('location-desc');

function showSidebar(location) {
    locationName.textContent = location.name;
    locationDesc.innerHTML = location.desc; // allow HTML
    sidebar.classList.add('active');
}

closeBtn.addEventListener('click', () => {
    sidebar.classList.remove('active');
});

function fetchParkingData(nodePath, location) {
    db.ref(nodePath).on('value', snapshot => {
        const data = snapshot.val();

        if (!data) {
            location.desc = "Parking data not available.";
            showSidebar(location);
            return;
        }

        // -------------------
        // Calculate slots
        // -------------------
        let totalSlots = 0;
        let occupiedSlots = 0;

        if (data.slots) {
            totalSlots = Object.keys(data.slots).length; // count slots
            for (const slotKey in data.slots) {
                if (data.slots[slotKey].status === "occupied") {
                    occupiedSlots++;
                }
            }
        } else if (data.meta?.total_slots) {
            // fallback (Tech Park style)
            totalSlots = data.meta.total_slots;
            occupiedSlots = data.meta.occupied ?? 0;
        }

        const freeSlots = totalSlots - occupiedSlots;

        // -------------------
        // Others (price optional, type required)
        // -------------------
        const type = data.others?.type ?? 0; // default CCTV
        const price = data.others?.price;

        if (price !== undefined) {
            localStorage.setItem('parking_price', price);
        }
        localStorage.setItem('parking_type', type);

        // -------------------
        // Build UI description
        // -------------------
        location.desc = `
            Total Slots: ${totalSlots} <br>
            Occupied Slots: ${occupiedSlots} <br>
            Free Slots: ${freeSlots} <br>
            Type: ${type === 1 ? "Sensor-based" : "CCTV-based"}
            ${price !== undefined ? `<br> Price: ₹${price}` : ""}
        `;

        showSidebar(location);
    });
}
