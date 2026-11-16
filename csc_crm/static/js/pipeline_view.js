document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("filterForm");
    const pipelineData = document.getElementById("pipelineData");

    const searchBtn = document.getElementById("searchBtn");
    const clearBtn = document.getElementById("clearBtn");

    const staffSelect = document.getElementById("staffSelect");
    const searchInput = document.getElementById("searchInput");

    if (!form || !pipelineData) return;

    function updateExportUrl() {
        const exportBtn = document.getElementById("exportBtn");
        if (!exportBtn) return;

        const baseUrl = exportBtn.dataset.url;
        const params = new URLSearchParams({
            search: searchInput ? searchInput.value : "",
            assigned_to: staffSelect ? staffSelect.value : ""
        });

        exportBtn.href = `${baseUrl}?${params.toString()}`;
    }

    async function loadData() {
        const formData = new FormData(form);
        const params = new URLSearchParams(formData);

        try {
            const response = await fetch(`?${params.toString()}`, {
                headers: { "X-Requested-With": "XMLHttpRequest" }
            });

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const newData = doc.getElementById("pipelineData");

            if (newData) {
                pipelineData.innerHTML = newData.innerHTML;
                updateExportUrl();
                initSeeMoreButtons();
            }

            history.replaceState(null, "", "?" + params.toString());

        } catch (error) {
            console.log("AJAX ERROR:", error);
        }
    }

    if (searchBtn) {
        searchBtn.addEventListener("click", function (e) {
            e.preventDefault();
            updateExportUrl();
            loadData();
        });
    }

    if (staffSelect) {
        staffSelect.addEventListener("change", function () {
            updateExportUrl();
            loadData();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (searchInput) searchInput.value = "";
            if (staffSelect) staffSelect.value = "";
            updateExportUrl();
            loadData();
            history.replaceState(null, "", window.location.pathname);
        });
    }

    updateExportUrl();
});
// Pagination (AJAX) - handles next/prev/number links
document.addEventListener("click", function (e) {
    const link = e.target.closest(".ajax-page");
    if (!link) return;

    e.preventDefault();

    fetch(link.href, {
        headers: {
            "X-Requested-With": "XMLHttpRequest"
        }
    })
    .then(res => res.text())
    .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        document.getElementById("pipelineData").innerHTML =
            doc.getElementById("pipelineData").innerHTML;

        history.replaceState(null, "", link.href);

        bindPageSizeSelect();
        initSeeMoreButtons();
    });
});

// Page size (AJAX)
function bindPageSizeSelect() {
    const select = document.getElementById("pageSizeSelect");
    if (!select) return;

    select.addEventListener("change", function () {
        const pageSize = this.value;
        const url = new URL(window.location.href);
        url.searchParams.set("page_size", pageSize);
        url.searchParams.set("page", "1");

        fetch(url.toString(), {
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
        .then(res => res.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            document.getElementById("pipelineData").innerHTML =
                doc.getElementById("pipelineData").innerHTML;

            history.replaceState(null, "", url.toString());

            bindPageSizeSelect();
            initSeeMoreButtons();
        });
    });
}

document.addEventListener("DOMContentLoaded", bindPageSizeSelect);


// See More button logic for kanban columns
function initColumnScrollButtons() {
    document.querySelectorAll(".kanban-column").forEach(function (column) {
        const cardsBox = column.querySelector(".column-cards");
        const upBtn = column.querySelector(".scroll-up-btn");
        const downBtn = column.querySelector(".scroll-down-btn");

        if (!cardsBox || !upBtn || !downBtn) return;

        const clickStep = 120;      // Single click scroll
        const holdStep = 20;        // Continuous scroll speed
        const visibleCardLimit = 4; // Buttons show only beyond this many cards
        let interval = null;
        let longPress = false;

        function startScroll(direction) {
            longPress = false;

            // If button held for 250ms, start continuous scrolling
            const timer = setTimeout(() => {
                longPress = true;
                interval = setInterval(() => {
                    cardsBox.scrollBy({
                        top: direction * holdStep,
                        behavior: "auto",
                    });
                }, 16); // ~60 FPS
            }, 250);

            function stopScroll() {
                clearTimeout(timer);
                clearInterval(interval);
                interval = null;

                // If it wasn't a long press, do normal 120px scroll
                if (!longPress) {
                    cardsBox.scrollBy({
                        top: direction * clickStep,
                        behavior: "smooth",
                    });
                }

                document.removeEventListener("mouseup", stopScroll);
                document.removeEventListener("touchend", stopScroll);
            }

            document.addEventListener("mouseup", stopScroll);
            document.addEventListener("touchend", stopScroll);
        }

        upBtn.addEventListener("mousedown", () => startScroll(-1));
        downBtn.addEventListener("mousedown", () => startScroll(1));

        upBtn.addEventListener("touchstart", () => startScroll(-1));
        downBtn.addEventListener("touchstart", () => startScroll(1));

        function toggleButtons() {

            const cardCount = cardsBox.querySelectorAll(".lead-card").length;

            // Fewer than 5 cards -> never show scroll buttons
            if (cardCount <= visibleCardLimit) {
                upBtn.classList.add("hidden");
                downBtn.classList.add("hidden");
                return;
            }

            const atTop = cardsBox.scrollTop <= 0;
            const atBottom =
                cardsBox.scrollTop + cardsBox.clientHeight >=
                cardsBox.scrollHeight - 1;

            const scrollable =
                cardsBox.scrollHeight > cardsBox.clientHeight;

            upBtn.classList.toggle("hidden", !scrollable || atTop);
            downBtn.classList.toggle("hidden", !scrollable || atBottom);
        }

        cardsBox.addEventListener("scroll", toggleButtons);
        toggleButtons();
    });
}

document.addEventListener("DOMContentLoaded", initColumnScrollButtons);