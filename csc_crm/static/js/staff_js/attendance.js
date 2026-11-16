
setTimeout(function(){

    const messages = document.querySelectorAll('.success-message');

    messages.forEach(function(msg){

        msg.style.transition = "opacity 0.3s";

        msg.style.opacity = "0";

        setTimeout(function(){

            msg.remove();

        },300);

    });

},1000);

// Hamburger

document.addEventListener("DOMContentLoaded", function () {

    const navToggle = document.getElementById("attnavToggle");
    const navTabs = document.getElementById("attnavTabs");

    if (!navToggle || !navTabs) return;

    let isOpen = false;

    navToggle.addEventListener("click", function (e) {
        e.stopPropagation();

        isOpen = !isOpen;

        navTabs.classList.toggle("show", isOpen);
      //  document.body.classList.toggle("menu-open", isOpen);
    });

    navTabs.addEventListener("click", function (e) {
        e.stopPropagation();
    });

    document.addEventListener("click", function () {
        isOpen = false;
        navTabs.classList.remove("show");
      //  document.body.classList.remove("menu-open");
    });

});

  //attendance filter 
document.getElementById('attendance-filter-form').addEventListener('submit', function(e){

    e.preventDefault();

    const month = document.querySelector('[name="month"]').value;
    const year = document.querySelector('[name="year"]').value;
    const date = document.querySelector('[name="date"]').value;

    if(date){

        const selectedDate = new Date(date);

        const dateMonth = String(selectedDate.getMonth() + 1);
        const dateYear = String(selectedDate.getFullYear());

        if(month && month !== dateMonth){

            alert("Selected Date and Month do not match.");
            return;
        }

        if(year && year !== dateYear){

            alert("Selected Date and Year do not match.");
            return;
        }
    }

    const params = new URLSearchParams(
        new FormData(this)
    );

    fetch(window.location.pathname + '?' + params.toString())
    .then(response => response.text())
    .then(html => {

        const parser = new DOMParser();

        const doc = parser.parseFromString(html,'text/html');

        const newDashboard =
            doc.querySelector('#attendance-dashboard');

        document.querySelector('#attendance-dashboard').innerHTML =
            newDashboard.innerHTML;

    });

});


