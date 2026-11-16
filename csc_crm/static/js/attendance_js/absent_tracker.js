//================ TOAST NOTIFICATION HELPER ==================//
const TOAST_ICONS = {
    success: "fa-check",
    error: "fa-times",
    warning: "fa-exclamation"
};

const TOAST_TITLES = {
    success: "Success",
    error: "Error",
    warning: "Attention"
};

//================ CSRF TOKEN HELPER (READ FROM COOKIE) ==================//
function getCookie(name) {
    let cookieValue = null;

    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");

        for (let cookie of cookies) {
            cookie = cookie.trim();

            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(
                    cookie.substring(name.length + 1)
                );
                break;
            }
        }
    }

    return cookieValue;
}

//================ NOTIFY / RE-NOTIFY BUTTON HANDLER ==================//
document.addEventListener("DOMContentLoaded", function () {

    const notifyButtons = document.querySelectorAll(".notify-action-btn");

    notifyButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const studentId = button.dataset.id;

            fetch(`/api/mark-notification/${studentId}/`)
                .then(response => response.json())
                .then(data => {
                    console.log(data);
                });

            // PREVENT MULTIPLE CLICKS
            button.disabled = true;

            // LOADING STATE
            button.innerHTML = `
                <span class="spinner-border spinner-border-sm"></span>
                Sending...
            `;

            // SIMULATE REAL-TIME API
            setTimeout(function () {

                // BUTTON STYLE CHANGE
                button.classList.remove("notify-btn");
                button.classList.add("renotify-btn");

                // BUTTON TEXT CHANGE
                button.innerHTML = `
                    <i class="bi bi-arrow-repeat"></i>
                    Re-notify
                `;

                // ENABLE AGAIN
                button.disabled = false;

                // STATUS BADGE UPDATE
                const row = button.closest("tr");
                const statusBadge = row.querySelector(".notification-cell .status-badge");

                if (statusBadge) {
                    statusBadge.classList.remove("pending");
                    statusBadge.classList.add("dispatched");
                    statusBadge.innerHTML = `
                        <i class="bi bi-check-circle-fill"></i>
                        Dispatched
                    `;
                }

                // SUCCESS MESSAGE
                showToast("Student SMS Alert Queued Successfully", 'success');

            }, 3200);

        });

    });

});

//================ TABLE FILTERS (NAME, BATCH, COURSE, PHONE, EMAIL, STATUS) ==================//
function applyFilters() {

    const name = document.getElementById("studentNameFilter").value.toLowerCase();
    const batch = document.getElementById("batchFilter").value.toLowerCase();

    // courseFilter is rendered only for Admin / Manager / HR (null for Trainer)
    const courseEl = document.getElementById("courseFilter");
    const course = courseEl ? courseEl.value.toLowerCase() : "";

    const phone = document.getElementById("phoneFilter").value.toLowerCase();
    const email = document.getElementById("emailFilter").value.toLowerCase();
    const status = document.getElementById("statusFilter").value.toLowerCase();

    let visibleCount = 0;

    const totalCount = document.querySelectorAll(".student-row").length;

    document.querySelectorAll(".student-row").forEach(row => {

        const show =
            (name === "" || row.dataset.name.toLowerCase().startsWith(name)) &&
            (course === "" || row.dataset.course.toLowerCase() === course) &&
            (batch === "" || row.dataset.batch.toLowerCase() === batch) &&
            (phone === "" || row.dataset.phone.toLowerCase().startsWith(phone)) &&
            (email === "" || row.dataset.email.toLowerCase().includes(email)) &&
            (status === "" || row.dataset.status.toLowerCase() === status);

        row.style.display = show ? "" : "none";

        if (show) {
            visibleCount++;
        }

    });

    document.getElementById("resultsCount").innerHTML =
        `Showing ${visibleCount} of ${totalCount} Students`;

    const noResults = document.getElementById("noResultsMessage");
    if (noResults) {
        noResults.style.display = (visibleCount === 0 && totalCount > 0) ? "block" : "none";
    }

}

//================ FILTER INPUT LISTENERS (KEYUP/CHANGE) ==================//
document.querySelectorAll(".filter-input, .filter-select").forEach(input => {
    input.addEventListener("keyup", applyFilters);
    input.addEventListener("change", applyFilters);
});

//================ CLEAR FILTERS BUTTON ==================//
function clearAllFilters() {

    document.querySelectorAll(".filter-input").forEach(input => {
        input.value = "";
    });

    document.getElementById("statusFilter").value = "";
    document.getElementById("batchFilter").value = "";

    // courseFilter does not exist for Trainer login
    const courseEl = document.getElementById("courseFilter");
    if (courseEl) courseEl.value = "";

    applyFilters();
}

const clearBtn = document.getElementById("clearFilters");
if (clearBtn) {
    clearBtn.addEventListener("click", clearAllFilters);
}

//================ SHOW ALL / RESET FILTERS BUTTON (OPTIONAL - COMMENTED OUT IN HTML) ==================//
const showAllBtn = document.getElementById("showAllBtn");
if (showAllBtn) {
    showAllBtn.addEventListener("click", clearAllFilters);
}

//================ TOAST (SAME DESIGN AS REST OF CRM) ==================//
function showToast(message, type = 'success', duration = 3200) {

    let container = document.getElementById('toastContainer');

    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
    }

    // Keep the container directly under <body> so parent overflow / z-index
    // / transform inside the page layout cannot hide the toast
    if (container.parentElement !== document.body) {
        document.body.appendChild(container);
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

// Initial run
applyFilters();

//================ ADMIN NOTES MODAL - SET MODE (VIEW / EDIT) ==================//
function setNoteMode(mode) {

    const textarea = document.getElementById("adminNoteText");
    const title = document.getElementById("adminNoteTitle");
    const isEdit = mode === "edit";

    textarea.readOnly = !isEdit;

    if (title) {
        title.textContent = isEdit ? "Edit Admin Notes" : "Admin Notes";
    }

    document.getElementById("saveNoteBtn").style.display = isEdit ? "inline-block" : "none";
    document.getElementById("editNoteBtn").style.display = isEdit ? "none" : "inline-block";

    if (isEdit) {
        textarea.focus();
        // cursor at the end of the existing text
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
}

//================ ADMIN NOTES MODAL - EDIT MODE ==================//
function openEditModal(id, note) {

    closeActionMenus();

    document.getElementById("trackerId").value = id;

    document.getElementById("adminNoteText").value = note || "";

    document.getElementById("adminNoteModal").style.display = "block";

    setNoteMode("edit");

}

//================ ADMIN NOTES MODAL - VIEW MODE (READ-ONLY) ==================//
function openViewModal(id, note) {

    closeActionMenus();

    document.getElementById("trackerId").value = id;

    document.getElementById("adminNoteText").value = note || "No notes available";

    document.getElementById("adminNoteModal").style.display = "block";

    setNoteMode("view");
}

//================ ADMIN NOTES MODAL - CLOSE ==================//
function closeAdminModal() {

    document.getElementById("adminNoteModal").style.display = "none";

    document.getElementById("adminNoteText").value = "";

    // Reset to default (edit) state
    setNoteMode("edit");

}

//================ ADMIN NOTES - SAVE (AJAX POST) ==================//
function saveAdminNotes() {

    const trackerId = document.getElementById("trackerId").value;
    const note = document.getElementById("adminNoteText").value.trim();

    const csrftoken = getCookie("csrftoken");

    fetch(
        "/api/save-admin-notes/",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken,
            },
            body: JSON.stringify({
                tracker_id: trackerId,
                notes: note
            })
        }
    )
        .then(response => response.json())
        .then(data => {

            console.log("SERVER RESPONSE:", data);

            if (data.status === "success") {

                closeAdminModal();
                closeActionMenus();

                updateAdminNoteInRow(trackerId, note);

                showToast("Notes updated successfully!", 'success');

            } else {
                showToast(data.message || " Failed to save notes.", 'error');
            }
        })
        .catch(error => {
            console.error(error);
            showToast(" Error saving notes.", 'error');
        });

}

//================ UPDATE ADMIN NOTE ON BUTTON WITHOUT PAGE RELOAD ==================//
// Selector depends on the onclick starting exactly as: openViewModal('ID' / openEditModal('ID'
function updateAdminNoteInRow(trackerId, note) {

    const safeNote = note && note.trim() !== "" ? note : "No notes available";

    const viewBtn = document.querySelector(
        `.action-dropdown button[onclick*="openViewModal('${trackerId}'"]`
    );

    const editBtn = document.querySelector(
        `.action-dropdown button[onclick*="openEditModal('${trackerId}'"]`
    );

    // JSON.stringify gives a valid JS string literal (handles quotes + new lines)
    if (viewBtn) {
        viewBtn.setAttribute(
            "onclick",
            `openViewModal('${trackerId}', ${JSON.stringify(safeNote)})`
        );
    }

    if (editBtn) {
        editBtn.setAttribute(
            "onclick",
            `openEditModal('${trackerId}', ${JSON.stringify(note || "")})`
        );
    }
}

//================ ADMIN NOTES MODAL - SWITCH VIEW MODE TO EDIT MODE ==================//
function enableEditMode() {

    const textarea = document.getElementById("adminNoteText");

    // If it was only the placeholder text, start with an empty box
    if (textarea.value === "No notes available") {
        textarea.value = "";
    }

    setNoteMode("edit");
}

//================ ACTION MENU - CLOSE ALL ==================//
function closeActionMenus() {
    document.querySelectorAll('.action-dropdown.show').forEach(menu => {
        menu.classList.remove('show');
    });
}

//================ ACTION MENU (THREE-DOT DROPDOWN) - TOGGLE ==================//
function toggleActionMenu(button) {

    const dropdown = button
        .closest('.action-menu')
        .querySelector('.action-dropdown');

    const wasOpen = dropdown.classList.contains('show');

    // Close all other menus
    closeActionMenus();

    if (!wasOpen) {

        const rect = button.getBoundingClientRect();

        dropdown.style.top = (rect.bottom + 4) + "px";
        dropdown.style.left = "auto";
        dropdown.style.right = (window.innerWidth - rect.right) + "px";

        dropdown.classList.add('show');
    }
}

//================ ACTION MENU - CLOSE ON OUTSIDE CLICK ==================//
document.addEventListener('click', function (event) {

    if (!event.target.closest('.action-menu')) {
        closeActionMenus();
    }

});

//================ ACTION MENU - CLOSE ON SCROLL ==================//
document.addEventListener('scroll', closeActionMenus, true);