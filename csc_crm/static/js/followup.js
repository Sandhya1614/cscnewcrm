document.addEventListener("DOMContentLoaded", function () {

    
    const buttons = document.querySelectorAll(".tab-button");
    const tabs = document.querySelectorAll(".tab-content");

    if (buttons.length > 0) {

        buttons.forEach(button => {

            button.addEventListener("click", () => {

                buttons.forEach(btn => btn.classList.remove("tab-active"));
                button.classList.add("tab-active");

                tabs.forEach(tab => tab.classList.remove("active"));

                const target = button.getAttribute("data-tab");
                const tab = document.getElementById("tab-" + target);

                if (tab) {
                    tab.classList.add("active");
                }

            });

        });

    }

});

function toggleNote(el) {
    el.classList.toggle("expanded");
}


/* FILTER MENU */
function toggleFilterMenu() {

    const menu = document.getElementById("filterMenu");

    if (menu) {
        menu.classList.toggle("show");
    }

}


/* THREE DOT ACTION MENU */
function toggleActionMenu(button) {

    const currentMenu = button.parentElement.querySelector(".action-menu");

    document.querySelectorAll(".action-menu").forEach(menu => {

        if (menu !== currentMenu) {
            menu.classList.remove("show");
        }

    });

    if (currentMenu) {
        currentMenu.classList.toggle("show");
    }

}


/* CLOSE MENUS WHEN CLICK OUTSIDE */
document.addEventListener("click", function (event) {

    if (!event.target.closest(".action-menu-wrapper")) {

        document.querySelectorAll(".action-menu").forEach(menu => {
            menu.classList.remove("show");
        });

    }

    if (!event.target.closest(".filter-button") &&
        !event.target.closest(".filter-menu")) {

        const filterMenu = document.getElementById("filterMenu");

        if (filterMenu) {
            filterMenu.classList.remove("show");
        }

    }

});