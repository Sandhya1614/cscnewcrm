document.addEventListener("DOMContentLoaded", function () {

    const menuBtn = document.getElementById("menuToggle");
    const sidebar = document.querySelector(".sidebar");
    const wrapper = document.querySelector(".main-wrapper");
    const tabs = document.querySelector(".top-tabs");
    const overlay = document.querySelector(".sidebar-overlay");

    if (!menuBtn || !sidebar) return;

    // RESTORE SIDEBAR STATE AFTER PAGE CHANGE
  

    if (window.innerWidth > 768) {

        const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";

        if (isCollapsed) {

            sidebar.classList.add("collapsed");

            if (wrapper) {wrapper.classList.add("expanded");}

            if (tabs) {tabs.style.left = "70px"; }

        }

    }

    // MENU BUTTON CLICK

    menuBtn.addEventListener("click", function () {
       //mobile

        if (window.innerWidth <= 768) { sidebar.classList.toggle("show");

            if (overlay) {  overlay.classList.toggle("show"); }

        }
      // lap
        else {

            sidebar.classList.toggle("collapsed");

            if (wrapper) {  wrapper.classList.toggle("expanded"); }

            const isCollapsed = sidebar.classList.contains("collapsed");

            localStorage.setItem( "sidebarCollapsed", isCollapsed);
            
            document.documentElement.classList.toggle( "sidebar-collapsed",isCollapsed );

            // Move secondary navbar

            if (tabs) {

                tabs.style.left = isCollapsed
                    ? "70px"
                    : "250px";

            }

        }

    });


    if (overlay) {

        overlay.addEventListener("click", function () {

            sidebar.classList.remove("show");

            overlay.classList.remove("show");

        });

    }

});