// ----------------------------
// Preloader Logic
// ----------------------------
setTimeout(() => {
    const preloader = document.querySelector('.preloader');
    if (preloader) preloader.remove();

    const main = document.querySelector('.main');
    if (main) main.style.display = 'block';
}, 1500);

document.addEventListener('DOMContentLoaded', () => {
    const preloader = document.querySelector('.preloader');
    const mainContent = document.querySelector('.main');
    const vehicleOptions = document.querySelectorAll('.main-s > div'); // bike, car, truck
    const submitButton = document.querySelector('.main-b button');

    let selectedVehicle = null;

    // ----------------------------
    // Vehicle Selection Logic
    // ----------------------------
    vehicleOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove 'selected' class from all
            vehicleOptions.forEach(opt => opt.classList.remove('selected'));

            // Add 'selected' to clicked
            option.classList.add('selected');

            // Store selected vehicle type (from h3)
            selectedVehicle = option.querySelector('h3').textContent;

            // Enable submit button
            updateSubmitButtonState();
        });
    });

    // ----------------------------
    // Update Submit Button State
    // ----------------------------
    function updateSubmitButtonState() {
        if (selectedVehicle) {
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
        } else {
            submitButton.disabled = true;
            submitButton.style.opacity = '0.6';
            submitButton.style.cursor = 'not-allowed';
        }
    }

    // Initial button state
    updateSubmitButtonState();

    // ----------------------------
    // Submit Button Click
    // ----------------------------
    submitButton.addEventListener('click', () => {
        if (selectedVehicle) {
            // Store selection in localStorage
            localStorage.setItem('selectedVehicle', selectedVehicle);


            // Go to map.html
            window.location.href = 'pages/maps/maps.html';
        } else {
            alert('Please select a vehicle first!');
        }
    });
});
