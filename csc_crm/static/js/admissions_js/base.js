const toggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

toggle.addEventListener("click", () => {
    navLinks.classList.toggle("show");
});



setTimeout(() => {

    const alerts = document.querySelectorAll(".alert");

    alerts.forEach(alert => {

        alert.style.display = "none";

    });

}, 3000);