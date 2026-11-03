// ---------- Auto-hide the "today's attendance status" toast after 5s ----------

//================ AUTO-HIDE FILTER STATUS TOAST ==================//
let filterMessageTimeout = null;

function autoHideFilterMessage() {

    const filterMessageEl = document.getElementById("filterMessage");
    if (!filterMessageEl) return;

    const toasts = filterMessageEl.querySelectorAll(".attendance-toast");
    if (!toasts.length) return;

    if (filterMessageTimeout) {
        clearTimeout(filterMessageTimeout);
    }

    toasts.forEach(toast => toast.classList.remove("fade-out"));

    filterMessageTimeout = setTimeout(() => {
        toasts.forEach(toast => toast.classList.add("fade-out"));
    }, 5000);
}

// Hide the message that was rendered directly by Django on first page load.
autoHideFilterMessage();

// ---------- Open the date picker on click anywhere in the From/To boxes ----------
// By default, browsers only pop the calendar open when the tiny icon is
// clicked. This makes the entire input box trigger it.

//================ DATE INPUT - CLICK ANYWHERE OPENS PICKER ==================//
["dateFromFilter", "dateToFilter"].forEach(id => {
    const dateInput = document.getElementById(id);
    if (!dateInput) return;

    dateInput.addEventListener("click", function () {
        if (typeof dateInput.showPicker === "function") {
            try {
                dateInput.showPicker();
            } catch (e) {
                // Some browsers only allow showPicker() from a direct user
                // gesture on certain elements; fail silently and fall back
                // to default browser behavior.
            }
        }
    });
});

//================ MONTHLY ATTENDANCE BAR CHART - DATA + INIT ==================//
const attendanceChart = document.getElementById(
    'attendanceChart'
);

const monthlyPresent = JSON.parse(
    document.getElementById(
        "monthly-present"
    ).textContent
);

const monthlyAbsent = JSON.parse(
    document.getElementById(
        "monthly-absent"
    ).textContent
);

const monthlyLate = JSON.parse(
    document.getElementById(
        "monthly-late"
    ).textContent
);

const batchLabels = JSON.parse(
    document.getElementById(
        "batch-labels"
    ).textContent
);

const batchCounts = JSON.parse(
    document.getElementById(
        "batch-counts"
    ).textContent
);

const presentList = JSON.parse(
    document.getElementById(
        "batch-present-list"
    ).textContent
);

const absentList = JSON.parse(
    document.getElementById(
        "batch-absent-list"
    ).textContent
);

const lateList = JSON.parse(
    document.getElementById(
        "batch-late-list"
    ).textContent
);

const percentageList = JSON.parse(
    document.getElementById(
        "batch-percentage-list"
    ).textContent
);

const latestMonth = JSON.parse(
    document.getElementById(
        "latest-month"
    ).textContent
);

const attendanceChartInstance = new Chart(
    attendanceChart,
    {
        type: 'bar',

        data: {

            labels: [
                'Jan',
                'Feb',
                'Mar',
                'Apr',
                'May',
                'Jun',
                'Jul',
                'Aug',
                'Sep',
                'Oct',
                'Nov',
                'Dec'
            ],

            datasets: [

                {
                    label: 'Present',

                    data: monthlyPresent,

                    backgroundColor: '#22c55e',

                    borderRadius: 8,

                    barThickness: 18

                },

                {
                    label: 'Absent',

                    data: monthlyAbsent,

                    backgroundColor: '#ef4444',

                    borderRadius: 8,

                    barThickness: 18

                },

                {
                    label: 'Late',

                    data: monthlyLate,

                    backgroundColor: '#f59e0b',

                    borderRadius: 8,

                    barThickness: 18

                }

            ]

        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                mode: 'index',
                intersect: false
            },

            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },

            scales: {
                y: {
                    beginAtZero: true
                }

            }

        }

    }
);

//================ BATCH-WISE DOUGHNUT CHART (FILTERED SELECTION) - DATA + INIT ==================//
const batchChart = document.getElementById(
    'batchChart'
);

const colorPalette = [
    '#22c55e',
    '#2563eb',
    '#f59e0b',
    '#7c3aed',
    '#ef4444',
    '#06b6d4',
    '#ec4899',
    '#84cc16',
    '#f97316'
];

const colors = [
    '#2563eb',
    '#16a34a',
    '#dc2626',
    '#9333ea',
    '#ea580c',
    '#0891b2',
    '#ca8a04',
    '#be123c',
    '#22c55e',
    '#f59e0b'
];

const chartColors = batchLabels.map(
    (_, index) => colors[index % colors.length]
);

let batchChartInstance = null;

if (batchChart) {
    batchChartInstance = new Chart(
        batchChart,
        {
            type: 'doughnut',

            data: {

                labels: batchLabels,

                datasets: [{

                    data: batchCounts,

                    backgroundColor: chartColors,

                    borderWidth: 0

                }]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                cutout: '70%',

                plugins: {

                    legend: {
                        position: 'right'
                    },

                    tooltip: {
                        displayColors: false,

                        callbacks: {

                            title: function (context) {

                                return batchLabels[
                                    context[0].dataIndex
                                ];

                            },

                            label: function (context) {

                                let index =
                                    context.dataIndex;

                                return [

                                    "🟩 Present : " +
                                    presentList[index],

                                    "🟥 Absent : " +
                                    absentList[index],

                                    "🟨 Late : " +
                                    lateList[index],

                                    "📊 Attendance : " +
                                    (percentageList[index] || 0) + "%"

                                ];

                            }

                        }

                    }

                }

            }

        }
    );
}

//================ BATCH CHART - TOGGLE "NO DATA" OVERLAY ==================//
// Toggle the "no data" overlay for the batch-wise chart.
function toggleBatchChartEmpty(dataArr) {
    const emptyEl = document.getElementById("batchChartEmpty");
    if (!emptyEl) return;
    const isEmpty = !dataArr || dataArr.reduce((a, b) => a + b, 0) === 0;
    emptyEl.classList.toggle("show", isEmpty);
}

toggleBatchChartEmpty(batchCounts);

//================ BATCH PERFORMANCE HORIZONTAL BAR CHART - DATA + INIT ==================//
const batchPerformanceLabels = JSON.parse(
    document.getElementById(
        "batch-performance-labels"
    ).textContent
);

const batchPerformanceCounts = JSON.parse(
    document.getElementById(
        "batch-performance-counts"
    ).textContent
);

const batchPerformanceChart =
    document.getElementById(
        "batchPerformanceChart"
    );

if (batchPerformanceChart) {
new Chart(
    batchPerformanceChart,
    {
        type: "bar",

        data: {

            labels:
                batchPerformanceLabels,

            datasets: [

                {
                    label:
                        "Attendance %",

                    data:
                        batchPerformanceCounts,

                    backgroundColor:
                        "#2563eb",

                    borderRadius: 8
                }
            ]
        },

        options: {

            indexAxis: "y",

            responsive: true,

            maintainAspectRatio: false,

            scales: {

                x: {

                    beginAtZero: true,

                    max: 100
                }
            }
        }
    }
);
}
// ---------- Attendance Distribution (Present / Absent / Late / Incomplete) ----------
// Only affected by the "Min % (Distribution)" filter.

//================ ATTENDANCE DISTRIBUTION DOUGHNUT CHART - DATA + INIT ==================//
const distributionData = JSON.parse(
    document.getElementById("distribution-data").textContent
);

const distributionChartCanvas = document.getElementById("distributionChart");

let distributionChartInstance = null;

if (distributionChartCanvas) {
    distributionChartInstance = new Chart(distributionChartCanvas, {
        type: "doughnut",
        data: {
            labels: ["Present", "Absent", "Late", "Incomplete"],
            datasets: [{
                data: [
                    distributionData.present,
                    distributionData.absent,
                    distributionData.late,
                    distributionData.incomplete
                ],
                backgroundColor: ["#22c55e", "#ef4444", "#f59e0b", "#94a3b8"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
                legend: { position: "right" },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const pctKey = [
                                "present_pct",
                                "absent_pct",
                                "late_pct",
                                "incomplete_pct"
                            ][context.dataIndex];
                            return `${context.label}: ${context.raw} (${distributionData[pctKey]}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ---------- Batch-wise Attendance (independent dropdown selector) ----------

//================ BATCH-WISE DROPDOWN SELECTOR - DATA + CHART SWAP LOGIC ==================//
const allBatchLabels = JSON.parse(
    document.getElementById("all-batch-labels").textContent
);
const allBatchIds = JSON.parse(
    document.getElementById("all-batch-ids").textContent
);
const allBatchPresentList = JSON.parse(
    document.getElementById("all-batch-present-list").textContent
);
const allBatchAbsentList = JSON.parse(
    document.getElementById("all-batch-absent-list").textContent
);
const allBatchLateList = JSON.parse(
    document.getElementById("all-batch-late-list").textContent
);
const allBatchPercentageList = JSON.parse(
    document.getElementById("all-batch-percentage-list").textContent
);

const batchWiseSelector = document.getElementById("batchWiseSelector");

if (batchWiseSelector) {

    allBatchIds.forEach((id, index) => {
        const option = document.createElement("option");
        option.value = String(id);
        option.textContent = allBatchLabels[index];
        batchWiseSelector.appendChild(option);
    });

    batchWiseSelector.addEventListener("change", function () {

        const selectedId = this.value;

        if (selectedId === "") {
            // "All Batches" selected — restore the existing batch chart as-is.
            if (batchChartInstance) {
                batchChartInstance.data.labels = batchLabels;
                batchChartInstance.data.datasets[0].data = batchCounts;
                batchChartInstance.data.datasets[0].backgroundColor = chartColors;
                batchChartInstance.update();
            }
            toggleBatchChartEmpty(batchCounts);
            return;
        }

        const index = allBatchIds.findIndex(
            id => String(id) === selectedId
        );

        if (index === -1) return;

        const present = allBatchPresentList[index];
        const absent = allBatchAbsentList[index];
        const late = allBatchLateList[index];

        if (batchChartInstance) {
            batchChartInstance.data.labels = ["Present", "Absent", "Late"];
            batchChartInstance.data.datasets[0].data = [present, absent, late];
            batchChartInstance.data.datasets[0].backgroundColor = [
                "#22c55e", "#ef4444", "#f59e0b"
            ];
            batchChartInstance.update();
        }
        toggleBatchChartEmpty([present, absent, late]);
    });
}

// filters

//================ CLIENT-SIDE TABLE FILTER (LEGACY - UNUSED, SEE applyFiltersLive) ==================//
function applyFilters() {

    let visibleCount = 0;

    const totalCount =
        document.querySelectorAll(
            ".report-row"
        ).length;

    const name =
        document.getElementById(
            "studentNameFilter"
        ).value.toLowerCase().trim();

    const course =
        document.getElementById(
            "courseFilter"
        ).value.toLowerCase().trim();

    const batch =
        document.getElementById(
            "batchFilter"
        ).value.toLowerCase().trim();


    const status =
        document.getElementById(
            "statusFilter"
        ).value.toLowerCase().trim();
    const student_name =
        document.getElementById(
            "studentNameFilter"
        ).value;



    const attendance =
        document.getElementById(
            "attendanceFilter"
        ).value.trim();

    document.querySelectorAll(
        ".report-row"
    ).forEach(row => {

        const studentName =
            row.dataset.name.toLowerCase();

        const studentCourse =
            row.dataset.course.toLowerCase();

        const studentStatus =
            row.dataset.status.toLowerCase();

        const studentAttendance =
            parseFloat(
                row.dataset.attendance
            );

        let attendanceMatch = true;

        if (attendance !== "") {

            attendanceMatch =
                Math.floor(studentAttendance) ===
                parseInt(attendance);

        }

        const show =

            (name === "" ||
                studentName.startsWith(name))

            &&


            (course === "" ||
                studentCourse === course)

            &&

            (batch === "" ||
                row.dataset.batch === batch)

            &&

            (status === "" ||
                studentStatus === status)

            &&

            attendanceMatch;

        row.style.display =
            show ? "" : "none";

        if (show) {

            visibleCount++;

        }

    });
    if (visibleCount === 0) {

        document.getElementById(
            "noResultsMessage"
        ).style.display = "block";

    } else {

        document.getElementById(
            "noResultsMessage"
        ).style.display = "none";

    }

    // document.getElementById("resultsCount").textContent = `Showing ${visibleCount} of ${totalCount} Students`;

}

/* document.querySelectorAll(
     ".filter-input,.filter-select"
 ).forEach(input => {
 
     input.addEventListener(
         "keyup",
         applyFilters
     );
 
     input.addEventListener(
         "change",
         applyFilters
     );
 
 });*/

// ---------- Live filtering via AJAX (no full page reload) ----------

// ---------- Client-side filter validation ----------
// Catches obviously invalid input immediately, with a message the user
// can actually understand, instead of silently sending it to the server.

//================ SHOW CLIENT-SIDE VALIDATION ERRORS ==================//
function showClientValidationErrors(errors) {

    const filterMessageEl = document.getElementById("filterMessage");
    if (!filterMessageEl || !errors.length) return;

    const banner = document.createElement("div");
    banner.className = "alert alert-danger attendance-toast";
    banner.textContent = errors.join(" ");

    filterMessageEl.prepend(banner);
    autoHideFilterMessage();
}

//================ VALIDATE FILTERS BEFORE SENDING TO SERVER ==================//
function validateFiltersClientSide() {

    const errors = [];

    const studentName = document.getElementById("studentNameFilter").value.trim();
    const course = document.getElementById("courseFilter") ? document.getElementById("courseFilter").value : "";
    const batch = document.getElementById("batchFilter").value;
    const status = document.getElementById("statusFilter").value;
    const dateFrom = document.getElementById("dateFromFilter").value;
    const dateTo = document.getElementById("dateToFilter").value;
    const attendance = document.getElementById("attendanceFilter").value;
    const distribution = document.getElementById("distributionPercentageFilter").value;

    const anyFieldFilled =
        studentName !== "" ||
        course !== "" ||
        batch !== "" ||
        status !== "" ||
        dateFrom !== "" ||
        dateTo !== "" ||
        attendance !== "" ||
        distribution !== "";

    if (!anyFieldFilled) {
        errors.push("Please enter or select at least one filter field before applying.");
        return errors;
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
        errors.push("From date cannot be after To date.");
    }

    if (attendance !== "" && (isNaN(attendance) || Number(attendance) < 0 || Number(attendance) > 100)) {
        errors.push("Attendance % must be a number between 0 and 100.");
    }

    if (distribution !== "" && (isNaN(distribution) || Number(distribution) < 0 || Number(distribution) > 100)) {
        errors.push("Distribution % must be a number between 0 and 100.");
    }

    return errors;
}

//================ BUILD QUERY PARAMS FROM FILTER FIELDS ==================//
function buildFilterParams() {

    const courseFilterEl = document.getElementById("courseFilter");

    const params = {
        student_name: document.getElementById("studentNameFilter").value,
        course: courseFilterEl ? courseFilterEl.value : "",
        batch: document.getElementById("batchFilter").value,
        status: document.getElementById("statusFilter").value,
        attendance: document.getElementById("attendanceFilter").value,
        date_from: document.getElementById("dateFromFilter").value,
        date_to: document.getElementById("dateToFilter").value,
        distribution_percentage:
            document.getElementById("distributionPercentageFilter").value,
    };

    const query = new URLSearchParams();

    Object.keys(params).forEach(key => {
        if (params[key]) {
            query.set(key, params[key]);
        }
    });

    return query;
}

function buildExportUrl(baseUrl) {
    const query = buildFilterParams();
    const queryString = query.toString();

    if (queryString) {
        return `${baseUrl}?${queryString}`;
    }

    return baseUrl;
}

document.querySelectorAll(".export-btn").forEach(button => {
    button.addEventListener("click", function (event) {
        event.preventDefault();

        const exportUrl = buildExportUrl(this.href);

        window.location.href = exportUrl;
    });
});

//================ APPLY FILTER BUTTON LOADING STATE ==================//
function setLoadingState(isLoading) {

    const applyBtn = document.getElementById("showAllBtn");

    if (applyBtn) {
        applyBtn.disabled = isLoading;
        applyBtn.style.opacity = isLoading ? "0.6" : "1";
    }
}

//================ APPLY FILTERS - AJAX FETCH + UPDATE CHARTS/TABLE ==================//
function applyFiltersLive(query) {

    setLoadingState(true);

    const url = "?" + query.toString();

    fetch(url, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Server returned status " + response.status);
            }
            return response.json();
        })
        .then(data => {

            // Update URL bar without reloading the page.
            window.history.pushState({}, "", url);

            // Monthly Attendance Chart
            const sumArr = (arr) => (arr || []).reduce((a, b) => a + b, 0);

            const monthlyIsEmpty =
                sumArr(data.monthly_present) +
                sumArr(data.monthly_absent) +
                sumArr(data.monthly_late) === 0;

            if (attendanceChartInstance) {
                attendanceChartInstance.data.datasets[0].data = data.monthly_present;
                attendanceChartInstance.data.datasets[1].data = data.monthly_absent;
                attendanceChartInstance.data.datasets[2].data = data.monthly_late;
                attendanceChartInstance.update();
            }

            const attendanceChartEmptyEl = document.getElementById("attendanceChartEmpty");
            if (attendanceChartEmptyEl) {
                attendanceChartEmptyEl.classList.toggle("show", monthlyIsEmpty);
            }

            const monthlyTitleEl = document.getElementById("monthlyChartTitle");
            if (monthlyTitleEl) {
                monthlyTitleEl.textContent = data.monthly_chart_title;
            }

            // Attendance Distribution chart
            const d = data.distribution_data || {};
            const distributionIsEmpty =
                ((d.present || 0) + (d.absent || 0) + (d.late || 0) + (d.incomplete || 0)) === 0;

            if (distributionChartInstance) {
                distributionChartInstance.data.datasets[0].data = [
                    d.present, d.absent, d.late, d.incomplete
                ];
                distributionChartInstance.options.plugins.tooltip.callbacks.label =
                    function (context) {
                        const pctKey = [
                            "present_pct", "absent_pct", "late_pct", "incomplete_pct"
                        ][context.dataIndex];
                        return `${context.label}: ${context.raw} (${d[pctKey]}%)`;
                    };
                distributionChartInstance.update();
            }

            const distributionChartEmptyEl = document.getElementById("distributionChartEmpty");
            if (distributionChartEmptyEl) {
                distributionChartEmptyEl.classList.toggle("show", distributionIsEmpty);
            }

            // Student Performance Report table
            const tbody = document.getElementById("reportTableBody");
            if (tbody) {
                tbody.innerHTML = data.table_rows_html;
            }

            const footer = document.getElementById("reportTableFooter");
            if (footer) {
                const count = data.record_count;
                footer.textContent =
                    `Showing all ${count} record${count === 1 ? "" : "s"} — single page, no pagination.`;
            }

            const noResults = document.getElementById("noResultsMessage");
            if (noResults) {
                noResults.style.display = data.record_count === 0 ? "block" : "none";
            }

            const filterMessage = document.getElementById("filterMessage");
            if (filterMessage) {
                filterMessage.innerHTML = data.filter_message_html;
                autoHideFilterMessage();
            }

            setLoadingState(false);
        })
        .catch(err => {
            console.error("Live filter update failed:", err);
            showClientValidationErrors([
                "Could not apply the filter right now. Please check your connection and try again."
            ]);
            setLoadingState(false);
        });
}

//================ CLEAR FILTERS BUTTON ==================//
document.getElementById(
    "clearFilters"
).addEventListener(
    "click",
    function () {

        document.getElementById("studentNameFilter").value = "";

        const courseFilterEl = document.getElementById("courseFilter");
        if (courseFilterEl) {
            courseFilterEl.value = "";
        }

        document.getElementById("batchFilter").value = "";
        document.getElementById("statusFilter").value = "";
        document.getElementById("attendanceFilter").value = "";
        document.getElementById("dateFromFilter").value = "";
        document.getElementById("dateToFilter").value = "";
        document.getElementById("distributionPercentageFilter").value = "";

        applyFiltersLive(new URLSearchParams());

    }
);

/* Select all btn */
//================ APPLY FILTER BUTTON ==================//
document.getElementById(
    "showAllBtn"
).addEventListener(
    "click",
    function () {

        const clientErrors = validateFiltersClientSide();

        if (clientErrors.length) {
            showClientValidationErrors(clientErrors);
            return;
        }

        applyFiltersLive(buildFilterParams());

    }
);

// ================= STUDENT REPORT TABLE PAGINATION =================

document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("reportTableBody");
    const paginationInfo = document.getElementById("paginationInfo");
    const paginationNumbers = document.getElementById("paginationNumbers");
    const paginationControls = document.getElementById("paginationControls");

    const firstBtn = document.getElementById("firstPageBtn");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    const lastBtn = document.getElementById("lastPageBtn");

    if (!tableBody || !paginationInfo || !paginationNumbers) {
        return;
    }

    const rows = Array.from(
        tableBody.querySelectorAll("tr.report-row")
    );

    const rowsPerPage = 10;
    let currentPage = 1;

    // Track rows hidden by existing filters separately.
    rows.forEach(row => {
        row.dataset.paginationHidden = "false";
    });

    function getFilteredRows() {
        return rows.filter(row => {
            return row.style.display === "none";
        }).length === rows.length
            ? []
            : rows.filter(row => row.dataset.paginationHidden !== "true");
    }

    function renderPagination() {
        // Respect rows hidden by the existing filters.
        const filteredRows = rows.filter(row => {
            return row.dataset.paginationHidden !== "true";
        });

        const totalRecords = filteredRows.length;
        const totalPages = Math.max(
            1,
            Math.ceil(totalRecords / rowsPerPage)
        );

        // Keep current page valid after filtering.
        currentPage = Math.min(currentPage, totalPages);
        currentPage = Math.max(currentPage, 1);

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = Math.min(
            startIndex + rowsPerPage,
            totalRecords
        );

        // Hide all rows on pages other than the current page.
        rows.forEach(row => {
            row.hidden = true;
        });

        // Show only the current page's filtered rows.
        filteredRows.slice(startIndex, endIndex).forEach(row => {
            row.hidden = false;
        });

        // Update record count.
        if (totalRecords === 0) {
            paginationInfo.textContent = "Showing 0 records";
        } else {
            paginationInfo.textContent =
                `Showing ${startIndex + 1}–${endIndex} of ${totalRecords} records`;
        }

        // Update page number buttons.
        paginationNumbers.innerHTML = "";

        for (let page = 1; page <= totalPages; page++) {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "pagination-btn page-number";
            button.textContent = page;
            button.setAttribute("aria-label", `Page ${page}`);

            if (page === currentPage) {
                button.classList.add("active");
                button.setAttribute("aria-current", "page");
            }

            button.addEventListener("click", function () {
                currentPage = page;
                renderPagination();
            });

            paginationNumbers.appendChild(button);
        }

        // Enable/disable navigation buttons.
        firstBtn.disabled = currentPage === 1 || totalRecords === 0;
        prevBtn.disabled = currentPage === 1 || totalRecords === 0;
        nextBtn.disabled = currentPage === totalPages || totalRecords === 0;
        lastBtn.disabled = currentPage === totalPages || totalRecords === 0;

        // Hide pagination if there is only one page.
        if (paginationControls) {
            paginationControls.style.display =
                totalRecords > rowsPerPage ? "flex" : "none";
        }
    }

    // First, Previous, Next and Last buttons.
    firstBtn.addEventListener("click", function () {
        currentPage = 1;
        renderPagination();
    });

    prevBtn.addEventListener("click", function () {
        if (currentPage > 1) {
            currentPage--;
            renderPagination();
        }
    });

    nextBtn.addEventListener("click", function () {
        const totalRecords = rows.filter(
            row => row.dataset.paginationHidden !== "true"
        ).length;

        const totalPages = Math.max(
            1,
            Math.ceil(totalRecords / rowsPerPage)
        );

        if (currentPage < totalPages) {
            currentPage++;
            renderPagination();
        }
    });

    lastBtn.addEventListener("click", function () {
        const totalRecords = rows.filter(
            row => row.dataset.paginationHidden !== "true"
        ).length;

        currentPage = Math.max(
            1,
            Math.ceil(totalRecords / rowsPerPage)
        );

        renderPagination();
    });

    // Detect filtering changes made by the existing reports.js.
    const observer = new MutationObserver(function (mutations) {
        let filterChanged = false;

        mutations.forEach(mutation => {
            if (
                mutation.type === "attributes" &&
                mutation.attributeName === "style"
            ) {
                const row = mutation.target;

                if (row.matches("tr.report-row")) {
                    const isFilteredOut =
                        row.style.display === "none";

                    row.dataset.paginationHidden =
                        isFilteredOut ? "true" : "false";

                    filterChanged = true;
                }
            }
        });

        if (filterChanged) {
            currentPage = 1;
            renderPagination();
        }
    });

    rows.forEach(row => {
        observer.observe(row, {
            attributes: true,
            attributeFilter: ["style"]
        });
    });

    // Re-render after Apply Filter or Clear.
    ["showAllBtn", "clearFilters"].forEach(id => {
        const button = document.getElementById(id);

        if (button) {
            button.addEventListener("click", function () {
                setTimeout(function () {
                    currentPage = 1;

                    rows.forEach(row => {
                        row.dataset.paginationHidden =
                            row.style.display === "none"
                                ? "true"
                                : "false";
                    });

                    renderPagination();
                }, 100);
            });
        }
    });

    renderPagination();
});