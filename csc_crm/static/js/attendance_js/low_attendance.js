//================ TOAST NOTIFICATION HELPER ==================//
const TOAST_ICONS = {
    success: "bi-check-circle-fill",
    error: "bi-x-circle-fill",
    warning: "bi-exclamation-triangle-fill"
};

//================ CSRF TOKEN ==================//
const csrftoken = "{{ csrf_token }}";

// ---------- helpers ----------

function showToast(message, type = 'success', duration = 3200) {

    const container = document.getElementById('toastContainer');

    if (!container) {
        alert(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${TOAST_ICONS[type] || TOAST_ICONS.success}"></i></div>
        <div class="toast-body">
            <p class="toast-message">${message}</p>
        </div>
        <button type="button" class="toast-close" aria-label="Close">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    const removeToast = () => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.toast-close').addEventListener('click', removeToast);

    const timer = setTimeout(removeToast, duration);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
}

//================ LOADING POPUP (SWEETALERT2) ==================//
function showLoading(title) {
    Swal.fire({
        icon: "info",
        title: title,
        text: "Please wait...",
        allowOutsideClick: false,
        showConfirmButton: false
    });
}

//================ BULK - SEND EMAIL TO ALL LOW ATTENDANCE STUDENTS ==================//
function sendEmailAll() {

    Swal.fire({
        icon: "info",
        title: "Sending Emails",
        text: "Please wait...",
        allowOutsideClick: false,
        showConfirmButton: false
    });

    fetch("/api/send-email-all/")

        .then(response => response.json())

        .then(data => {

            Swal.close();

            showToast(data.message, data.status === 'success' ? 'success' : 'error');

        })

        .catch(error => {

            showToast(
                "❌ Email Sending Failed",
                "error");

        });

}

//================ BULK - SEND SMS TO ALL LOW ATTENDANCE STUDENTS ==================//
function sendSMSAll() {

    Swal.fire({
        icon: "info",
        title: "Sending SMS",
        text: "Please wait...",
        allowOutsideClick: false,
        showConfirmButton: false
    });

    fetch("/api/send-sms-all/")

        .then(response => response.json())

        .then(data => {

            Swal.close();

            showToast(data.message, data.status === 'success' ? 'success' : 'error');

        })

        .catch(error => {

            showToast(
                "❌ SMS Sending Failed",
                "error"         
            );

        });

}

//================ SEND MONTHLY REPORT ==================//
function sendMonthlyReport() {

    Swal.fire({
        icon: "info",
        title: "Generating Monthly Report",
        text: "Please wait...",
        allowOutsideClick: false,
        showConfirmButton: false
    });

    fetch("/api/send-monthly-report/")

        .then(response => response.json())

        .then(data => {

            Swal.close();

            showToast(data.message, data.status === 'success' ? 'success' : 'error');

        })

        .catch(error => {

            showToast(
                "❌ Monthly Report Sending Failed",
                "error"
            );

        });

}

//================ MAIL BUTTON CLICK HANDLER (LEGACY - SEE ajax-action-btn BELOW) ==================//
document.querySelectorAll(".mail-btn").forEach(button => {

    button.addEventListener("click", function (e) {

        e.preventDefault();

        if (this.href.includes("send_sms")) {

            Swal.fire({
                icon: "info",
                title: "Sending SMS",
                text: "Please wait...",
                allowOutsideClick: false,
                showConfirmButton: false
            });

        } else {

            Swal.fire({
                icon: "info",
                title: "Sending Email",
                text: "Please wait...",
                allowOutsideClick: false,
                showConfirmButton: false
            });
        }

        fetch(this.href)

            .then(response => response.json())

            .then(data => {

                Swal.close();

                showToast(data.message, data.status === 'success' ? 'success' : 'error');

            })

            .catch(error => {

                showToast(
                    "❌ Notification Sending Failed",
                    "error"     
                );

                setTimeout(() => {
                    msg.classList.add("d-none");
                }, 1000);

            });

    });

});

// ---------- last updated time ----------

//================ SET "LAST UPDATED" TIMESTAMP ==================//
document.getElementById("lastUpdatedTime").textContent =
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ---------- per-row SMS / Email buttons ----------

//================ PER-ROW SMS/EMAIL BUTTON HANDLER ==================//
document.querySelectorAll(".ajax-action-btn").forEach(function (button) {

    button.addEventListener("click", function (e) {

        e.preventDefault();

        showLoading(this.dataset.type === "sms" ? "Sending SMS" : "Sending Email");

        fetch(this.href)
            .then(response => response.json())
            .then(data => {
                Swal.close();
                showToast(data.message, data.status === 'success' ? 'success' : 'error');
            })
            .catch(() => {
                Swal.close();
                showToast("❌ Notification Sending Failed", "error");
            });

    });

});

// ---------- select all (per section) ----------

//================ SELECT ALL CHECKBOX (PER SECTION) ==================//
document.querySelectorAll(".select-all-checkbox").forEach(function (checkbox) {

    checkbox.addEventListener("change", function () {

        const section = document.getElementById(this.dataset.target);

        section.querySelectorAll(".row-checkbox").forEach(function (rowCheckbox) {
            rowCheckbox.checked = checkbox.checked;
        });

    });

});

// ---------- bulk send to selected rows in a section ----------

//================ BULK SEND TO SELECTED ROWS (SMS/EMAIL) ==================//
function sendSectionNotification(sectionId, type) {

    const section = document.getElementById(sectionId);

    const ids = Array.from(
        section.querySelectorAll(".row-checkbox:checked")
    ).map(cb => parseInt(cb.dataset.id, 10));

    if (ids.length === 0) {
        showToast("Please select at least one student", "error");
        return;
    }

    showLoading(type === "sms" ? "Sending SMS" : "Sending Emails");

    fetch("/api/send-bulk-notification/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken
        },
        body: JSON.stringify({ type: type, enrollment_ids: ids })
    })
        .then(response => response.json())
        .then(data => {

            Swal.close();

            // Clear selected checkboxes
            section.querySelectorAll(".row-checkbox:checked").forEach(cb => {
                cb.checked = false;
            });

            // Clear Select All checkbox
            const selectAll = section.querySelector(".select-all-checkbox");
            if (selectAll) {
                selectAll.checked = false;
            }

            showToast(data.message, data.status === 'success' ? 'success' : 'error');

        })

        .catch(() => {
            Swal.close();
            showToast("❌ Notification Sending Failed", "error");
        });

}

// ---------- export dropdown ----------

//================ EXPORT DROPDOWN TOGGLE (EXCEL) ==================//
function toggleExportMenu(button) {

    const menu = button.nextElementSibling;

    document.querySelectorAll(".export-menu").forEach(function (otherMenu) {
        if (otherMenu !== menu) otherMenu.classList.remove("open");
    });

    menu.classList.toggle("open");

}

//================ EXPORT DROPDOWN - CLOSE ON OUTSIDE CLICK ==================//
document.addEventListener("click", function (e) {
    if (!e.target.closest(".alert-section-actions")) {
        document.querySelectorAll(".export-menu").forEach(m => m.classList.remove("open"));
    }
});

// ---------- pagination (per section) ----------

//================ PAGINATION SETUP (CRITICAL/WARNING SECTIONS) ==================//
const PAGE_SIZE = 3;

function setupPagination(sectionId, colorClass) {

    const section = document.getElementById(sectionId);
    const rows = Array.from(section.querySelectorAll("tbody tr.data-row"));
    const footerCount = section.querySelector(".footer-count");
    const pagerEl = section.querySelector(".pager");

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    let currentPage = 1;

    function renderPage() {

        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;

        rows.forEach(function (row, index) {
            row.style.display = (index >= start && index < end) ? "" : "none";
        });

        if (total === 0) {
            footerCount.textContent = "Showing 0 of 0 students";
        } else {
            footerCount.textContent =
                `Showing ${start + 1} to ${Math.min(end, total)} of ${total} students`;
        }

        renderPager();

    }

    function renderPager() {

        pagerEl.innerHTML = "";

        const prevBtn = document.createElement("button");
        prevBtn.innerHTML = '<i class="bi bi-chevron-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener("click", function () {
            if (currentPage > 1) { currentPage--; renderPage(); }
        });
        pagerEl.appendChild(prevBtn);

        for (let page = 1; page <= totalPages; page++) {
            const pageBtn = document.createElement("button");
            pageBtn.textContent = page;
            if (page === currentPage) pageBtn.classList.add("active", colorClass);
            pageBtn.addEventListener("click", function () {
                currentPage = page;
                renderPage();
            });
            pagerEl.appendChild(pageBtn);
        }

        const nextBtn = document.createElement("button");
        nextBtn.innerHTML = '<i class="bi bi-chevron-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener("click", function () {
            if (currentPage < totalPages) { currentPage++; renderPage(); }
        });
        pagerEl.appendChild(nextBtn);

    }

    renderPage();

}

setupPagination("criticalSection", "critical");
setupPagination("warningSection", "warning");

// ==========================================
//          FILTER FORM VALIDATION
// ==========================================

//================ FILTER FORM ELEMENT REFS ==================//
const lowAttendanceFilterForm = document.getElementById("filterForm");
const studentNameFilter = document.getElementById("studentNameFilter");
const percentageFilter = document.getElementById("percentageFilter");

//================ INLINE FIELD ERROR HELPER (CREATE/REUSE ERROR TAG) ==================//
// helper: create (or reuse) a small error tag right after a field
function getLowAttendanceFieldError(input) {

    if (!input) return null;

    let el = input.parentElement.querySelector(".field-error");

    if (!el) {
        el = document.createElement("small");
        el.className = "field-error";
        el.style.color = "red";
        el.style.display = "block";
        el.style.marginTop = "4px";
        input.insertAdjacentElement("afterend", el);
    }

    return el;

}

const studentNameError = getLowAttendanceFieldError(studentNameFilter);
const percentageError = getLowAttendanceFieldError(percentageFilter);


/*=========================================
        STUDENT NAME — letters, numbers, spaces only
=========================================*/

//================ VALIDATE STUDENT NAME FILTER (LETTERS/NUMBERS/SPACES ONLY) ==================//
function validateStudentNameFilter() {

    if (!studentNameFilter || !studentNameError) return true;

    // strip out anything that isn't a letter, number, or space, live
    studentNameFilter.value = studentNameFilter.value.replace(/[^A-Za-z0-9 ]/g, "");

    if (studentNameFilter.value.trim() !== "" && !/^[A-Za-z0-9 ]+$/.test(studentNameFilter.value)) {

        studentNameError.innerText = "Only letters, numbers and spaces allowed";
        return false;

    } else {

        studentNameError.innerText = "";
        return true;

    }

}

if (studentNameFilter) {
    studentNameFilter.addEventListener("input", validateStudentNameFilter);
}


/*=========================================
        ATTENDANCE % — number between 0 and 100
=========================================*/

//================ VALIDATE ATTENDANCE % FILTER (0-100) ==================//
function validatePercentageFilter() {

    if (!percentageFilter || !percentageError) return true;

    // strip out anything that isn't a digit or a single decimal point, live
    let cleaned = percentageFilter.value.replace(/[^0-9.]/g, "");

    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
        cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
    }

    percentageFilter.value = cleaned;

    if (cleaned.trim() === "") {

        percentageError.innerText = "";
        return true;

    }

    const value = parseFloat(cleaned);

    if (isNaN(value) || value < 0 || value > 100) {

        percentageError.innerText = "Attendance % must be between 0 and 100";
        return false;

    } else {

        percentageError.innerText = "";
        return true;

    }

}

if (percentageFilter) {
    percentageFilter.addEventListener("input", validatePercentageFilter);
}


/*=========================================
        AT LEAST ONE FIELD MUST BE FILLED
=========================================*/

//================ VALIDATE AT LEAST ONE FILTER FIELD FILLED ==================//
const courseFilterEl = document.getElementById("courseFilter");
const batchFilterEl = document.getElementById("batchFilter");
const filterGeneralError = document.getElementById("filterGeneralError");

function validateAtLeastOneFilter() {

    if (!filterGeneralError) return true;

    const nameVal = studentNameFilter ? studentNameFilter.value.trim() : "";
    const courseVal = courseFilterEl ? courseFilterEl.value.trim() : "";
    const batchVal = batchFilterEl ? batchFilterEl.value.trim() : "";
    const percentVal = percentageFilter ? percentageFilter.value.trim() : "";

    if (!nameVal && !courseVal && !batchVal && !percentVal) {
        filterGeneralError.innerText = "Please enter at least one field to search";
        filterGeneralError.style.display = "block";
        return false;
    }

    filterGeneralError.innerText = "";
    filterGeneralError.style.display = "none";
    return true;

}


/*=========================================
        BLOCK SUBMIT IF ANYTHING IS INVALID
=========================================*/

//================ BLOCK FORM SUBMIT ON VALIDATION FAILURE ==================//
if (lowAttendanceFilterForm) {

    lowAttendanceFilterForm.addEventListener("submit", function (e) {

        const validName = validateStudentNameFilter();
        const validPercentage = validatePercentageFilter();
        const hasAnyFilter = validateAtLeastOneFilter();

        if (!validName || !validPercentage || !hasAnyFilter) {
            e.preventDefault();
        }

    });

}

// ---------- filters ----------

//================ CLEAR FILTERS BUTTON ==================//
document.getElementById("clearFilters").addEventListener("click", function () {

    if (studentNameError) studentNameError.innerText = "";
    if (percentageError) percentageError.innerText = "";
    if (filterGeneralError) {
        filterGeneralError.innerText = "";
        filterGeneralError.style.display = "none";
    }

    window.location.href = window.location.pathname;
});