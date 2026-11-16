//================ IMPORTANT: CONFIRM THIS PREFIX ==================//
// Your screenshot showed the working page at 127.0.0.1:8000/api/schedule/
// so this app's urls.py is mounted under /api/ in the project root urls.py.
// If that is NOT correct, change this one line only.
const SCHEDULE_API_BASE = "/api/schedule";

//================ CSRF TOKEN HELPER ==================//
function getCsrfToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : "";
}

//================ ALERT BANNER HELPER ==================//
function showScheduleAlert(message, type) {
    const alertBox = document.getElementById("scheduleAlert");
    if (!alertBox) return;

    alertBox.textContent = message;
    alertBox.className = "schedule-alert " + type;
    alertBox.style.display = "block";

    alertBox.scrollIntoView({ behavior: "smooth", block: "nearest" });

    setTimeout(() => {
        alertBox.style.display = "none";
    }, 5000);
}

//================ FIELD ERROR HELPERS ==================//
function clearFieldErrors() {
    document.querySelectorAll(".field-error").forEach(el => {
        el.textContent = "";
    });
    document.querySelectorAll(".sched-input").forEach(el => {
        el.classList.remove("input-error");
    });
}

function setFieldError(fieldId, errorId, message) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(errorId);

    if (input) input.classList.add("input-error");
    if (errorEl) errorEl.textContent = message;
}

/* ============================================
   CREATE SCHEDULE FORM - CLIENT-SIDE VALIDATION
   (status field removed - always Upcoming, no validation needed for it)
============================================ */

document.addEventListener("DOMContentLoaded", function () {

    const scheduleForm = document.getElementById("scheduleForm");
    if (!scheduleForm) return;

    scheduleForm.addEventListener("submit", function (e) {

        clearFieldErrors();

        let hasError = false;

        const staff = document.getElementById("assignTrainer");
        const topic = document.getElementById("scheduleTopic");
        const date = document.getElementById("scheduleDate");
        const time = document.getElementById("scheduleTime");
        const type = document.getElementById("scheduleType");

        if (!staff || !staff.value) {
            setFieldError("assignTrainer", "err-staff", "Please select a trainer.");
            hasError = true;
        }

        if (!topic || !topic.value.trim()) {
            setFieldError("scheduleTopic", "err-topic", "Topic is required.");
            hasError = true;
        }

        if (!date || !date.value) {
            setFieldError("scheduleDate", "err-date", "Date is required.");
            hasError = true;
        }

        if (!time || !time.value) {
            setFieldError("scheduleTime", "err-time", "Time is required.");
            hasError = true;
        }

        if (!type || !type.value) {
            setFieldError("scheduleType", "err-type", "Please select a type.");
            hasError = true;
        }

        if (hasError) {
            e.preventDefault();
            showScheduleAlert("Please fill in all required fields before creating the schedule.", "error");
        }

    });

});

document.addEventListener("DOMContentLoaded", function () {
    const dateInput = document.getElementById("scheduleDate");
    if (dateInput) {
        const today = new Date().toISOString().split("T")[0];   // yyyy-mm-dd
        dateInput.setAttribute("min", today);
    }
});

/* ============================================
   STATUS UPDATES - COMPLETED / BLOCK BUTTONS
   Both buttons share the same design (.status-action-btn), just
   different color themes (.btn-complete = green, .btn-block = red).

   Trainer: one-way only (upcoming -> completed OR blocked), then both
   buttons lock permanently (server also enforces this - see update_schedule_status view).

   Admin/Manager: free toggle. Clicking the already-active button
   reverts the schedule back to "upcoming". Clicking the other button
   switches to that status. Every change asks for confirmation.
============================================ */

document.addEventListener("DOMContentLoaded", function () {

    function applyStatusToRow(row, newStatus, newStatusDisplay) {
        const pill = row.querySelector(".status-pill");
        const completeBtn = row.querySelector(".btn-complete");
        const blockBtn = row.querySelector(".btn-block");

        pill.textContent = newStatusDisplay;
        pill.className = "status-pill " + newStatus;

        completeBtn.classList.toggle("active", newStatus === "completed");
        completeBtn.textContent = (newStatus === "completed") ? "Uncomplete" : "Completed";
        blockBtn.classList.toggle("active", newStatus === "blocked");
        blockBtn.textContent = (newStatus === "blocked") ? "Unblock" : "Block";

        // Trainer: lock both buttons permanently once status leaves "upcoming"
        if (typeof MY_ROLE !== "undefined" && MY_ROLE === "Trainer" && newStatus !== "upcoming") {
            completeBtn.disabled = true;
            blockBtn.disabled = true;
        }
    }

    function sendStatusUpdate(scheduleId, newStatus, row) {
        fetch(`${SCHEDULE_API_BASE}/status/${scheduleId}/`, {
            method: "POST",
            headers: {
                "X-CSRFToken": getCsrfToken(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: newStatus })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                applyStatusToRow(row, data.new_status, data.new_status_display);
                showScheduleAlert("Status updated successfully.", "success");
            } else {
                showScheduleAlert(data.message || "Could not update status.", "error");
            }
        })
        .catch(() => {
            showScheduleAlert("Could not update status. Please try again.", "error");
        });
    }

    // ---- Completed button ----
    document.querySelectorAll(".btn-complete").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const scheduleId = this.dataset.scheduleId;
            const row = this.closest("tr");
            const isActive = this.classList.contains("active");

            if (isActive) {
                if (!confirm("Move this schedule back to upcoming?")) return;
                sendStatusUpdate(scheduleId, "upcoming", row);
            } else {
                if (!confirm("Mark this schedule as completed?")) return;
                sendStatusUpdate(scheduleId, "completed", row);
            }
        });
    });

    // ---- Block / Unblock button ----
    document.querySelectorAll(".btn-block").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const scheduleId = this.dataset.scheduleId;
            const row = this.closest("tr");
            const isActive = this.classList.contains("active");

            if (isActive) {
                if (!confirm("Unblock this schedule and move it back to upcoming?")) return;
                sendStatusUpdate(scheduleId, "upcoming", row);
            } else {
                if (!confirm("Block this schedule?")) return;
                sendStatusUpdate(scheduleId, "blocked", row);
            }
        });
    });

});

/* ============================================
   SELECT ALL / ROW SELECTION FOR EXPORT
============================================ */

document.addEventListener("DOMContentLoaded", function () {

    const selectAll = document.getElementById("selectAllRows");

    if (selectAll) {
        selectAll.addEventListener("change", function () {
            document.querySelectorAll(".row-check").forEach(cb => {
                cb.checked = selectAll.checked;
            });
        });
    }

    document.querySelectorAll(".row-check").forEach(cb => {
        cb.addEventListener("change", function () {
            const allChecked = Array.from(
                document.querySelectorAll(".row-check")
            ).every(box => box.checked);

            if (selectAll) selectAll.checked = allChecked;
        });
    });

});

/* ============================================
   EXPORT SELECTED ROWS
============================================ */

document.addEventListener("DOMContentLoaded", function () {

    const exportBtn = document.getElementById("exportBtn");
    if (!exportBtn) return;

    exportBtn.addEventListener("click", function () {

        const checkedBoxes = document.querySelectorAll(".row-check:checked");
        const ids = Array.from(checkedBoxes).map(cb => cb.value);

        let url = `${SCHEDULE_API_BASE}/export/`;

        if (ids.length > 0) {
            url += "?ids=" + ids.join(",");
        }

        window.location.href = url;

    });

});