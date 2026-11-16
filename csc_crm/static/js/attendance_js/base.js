//================ MOBILE SIDEBAR TOGGLE ==================//
document.addEventListener("DOMContentLoaded", () => {

    const toggle =
        document.getElementById("menuToggle");

    const sidebar =
        document.getElementById("navLinks");

    toggle.addEventListener("click", () => {

        sidebar.classList.toggle("show");

    });

});



//================ AUTO-HIDE ALERT MESSAGES AFTER 3 SECONDS ==================//
setTimeout(() => {

    const alerts = document.querySelectorAll(".alert");

    alerts.forEach(alert => {

        alert.style.display = "none";

    });

}, 3000);