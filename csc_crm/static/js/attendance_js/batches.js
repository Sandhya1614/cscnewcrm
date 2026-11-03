// JS for the Batches page: create/edit batch modal, client-side
// filtering + pagination of the batch cards, and toast notifications.

//================ CSRF TOKEN HELPER (READ FROM COOKIE) ==================//
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

//================ EDIT MODE STATE + FIELD ERROR ID MAP ==================//
let editingBatchId = null;

// All batch-form field error span ids, keyed by the field name the
// backend/DRF uses so server errors can be mapped straight to the
// right span without touching markup elsewhere.
const BATCH_FIELD_ERROR_IDS = {
    batch_name: "batchNameError",
    course: "courseError",
    timing: "timingError",
    start_time: "startTimeError",
    end_time: "endTimeError",
    start_date: "startDateError",
    end_date: "endDateError",
    trainer: "trainerError",
};

//================ CLEAR ALL BATCH FORM INLINE ERRORS ==================//
function clearBatchFormErrors() {
    Object.values(BATCH_FIELD_ERROR_IDS).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = "";
    });
}

//================ RESET MODAL TO CREATE MODE ==================//
function resetBatchModalToCreateMode() {
    editingBatchId = null;
    document.getElementById('batchForm').reset();
    clearBatchFormErrors();

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('id_start_date').setAttribute('min', today);
    document.getElementById('id_end_date').setAttribute('min', today);

    document.getElementById('batchModalTitle').innerText = 'Create New Batch';
    document.getElementById('batchModalSubtitle').innerText = 'Add a new training batch to schedule classes and track attendance';
    document.getElementById('batchSubmitBtn').innerHTML = '<i class="fa-solid fa-plus"></i> Create Batch';
}

//================ POPULATE FORM FOR EDIT MODE (FROM CACHED BATCH DATA) ==================//
async function editBatch(batchId) {

    // HR cannot edit batches (the API blocks it too)
    if (typeof IS_HR !== 'undefined' && IS_HR) {
        showToast("You are not allowed to edit batches", 'error');
        return;
    }

    const batch = allBatches.find(b => b.id === batchId);

    if (!batch) {
        showToast("Batch not found", 'error');
        return;
    }

    editingBatchId = batchId;

    clearBatchFormErrors();

    document.getElementById('id_start_date').removeAttribute('min');
    document.getElementById('id_end_date').removeAttribute('min');

    document.getElementById('id_batch_name').value = batch.batch_name || '';
    document.getElementById('id_course').value = batch.course || batch.course_id || '';
    document.getElementById('id_timing').value = batch.timing || '';
    document.getElementById('id_start_time').value = batch.start_time || '';
    document.getElementById('id_end_time').value = batch.end_time || '';
    document.getElementById('id_trainer').value = batch.trainer || batch.trainer_id || '';
    document.getElementById('id_start_date').value = batch.start_date || '';
    document.getElementById('id_end_date').value = batch.end_date || '';

    document.getElementById('batchModalTitle').innerText = 'Edit Batch';
    document.getElementById('batchModalSubtitle').innerText = 'Update the training batch details';
    document.getElementById('batchSubmitBtn').innerHTML = '<i class="fa-solid fa-check"></i> Update Batch';

    new bootstrap.Modal(document.getElementById('batchModal')).show();
}

//================ VIEW BATCH DETAILS (PLACEHOLDER) ==================//
function viewBatchDetails(batchId) {
    showToast(`Batch details page not built yet.`, 'error');
}

//================ CLIENT-SIDE BATCH FORM VALIDATION (MIRRORS SERVER FIELDS) ==================//
// Runs every client-side check for the batch form and paints inline
// field errors (mirrors the same field names the DRF serializer uses,
// so client + server errors land in the same spans).
function validateBatchFormFields() {

    clearBatchFormErrors();

    const batchName = document.getElementById('id_batch_name').value.trim();
    const course = document.getElementById('id_course').value;
    const timing = document.getElementById('id_timing').value;
    const startTime = document.getElementById('id_start_time').value;
    const endTime = document.getElementById('id_end_time').value;
    const startDate = document.getElementById('id_start_date').value;
    const endDate = document.getElementById('id_end_date').value;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(startDate);
    const end = new Date(endDate);

    let hasError = false;

    if (!batchName) {
        document.getElementById("batchNameError").innerText =
            "Batch name is required";
        hasError = true;
    } else if (batchName.length > 100) {
        document.getElementById("batchNameError").innerText =
            "Batch name cannot exceed 100 characters";
        hasError = true;
    }

    if (!course) {
        document.getElementById("courseError").innerText =
            "Please select a course";
        hasError = true;
    }

    if (!timing) {
        document.getElementById("timingError").innerText =
            "Please select a timing";
        hasError = true;
    }

    if (!startTime) {
        document.getElementById("startTimeError").innerText =
            "Start time is required";
        hasError = true;
    }

    if (!endTime) {
        document.getElementById("endTimeError").innerText =
            "End time is required";
        hasError = true;
    } else if (startTime && endTime <= startTime) {
        document.getElementById("endTimeError").innerText =
            "End time must be after start time";
        hasError = true;
    }

    if (!startDate) {
        document.getElementById("startDateError").innerText =
            "Start date is required";
        hasError = true;
    } else if (!editingBatchId && start < today) {
        document.getElementById("startDateError").innerText =
            "Start cannot be a past date";
        hasError = true;
    }

    if (!endDate) {
        document.getElementById("endDateError").innerText =
            "End date is required";
        hasError = true;
    } else {
        if (end <= today) {
            document.getElementById("endDateError").innerText =
                "End date must be a future date";
            hasError = true;
        }

        if (startDate && end < start) {
            document.getElementById("endDateError").innerText =
                "End date must be greater than start date";
            hasError = true;
        }
    }

    return !hasError;
}

//================ MAP DRF SERVER ERRORS ONTO INLINE FIELD SPANS ==================//
// Maps a DRF error payload (field -> [messages]) onto the matching
// inline error span. Anything that isn't a recognised field (e.g.
// non_field_errors, detail) falls back to a toast so it's never lost.
function applyBatchServerErrors(error) {

    let mapped = false;

    Object.keys(error || {}).forEach(key => {

        const spanId = BATCH_FIELD_ERROR_IDS[key];
        const messages = error[key];
        const message = Array.isArray(messages) ? messages[0] : messages;

        if (spanId && message) {
            const el = document.getElementById(spanId);
            if (el) {
                el.innerText = message;
                mapped = true;
            }
        }
    });

    if (!mapped) {
        const fallback =
            error && (error.detail || error.non_field_errors?.[0]);
        showToast(fallback || 'Please check the form for errors', 'error');
    }
}

//================ BATCH FORM SUBMIT (CREATE/UPDATE VIA API) ==================//
document.getElementById('batchForm')
    .addEventListener('submit', async function (e) {

        e.preventDefault()

        if (!validateBatchFormFields()) {
            return;
        }

        const payload = JSON.stringify({
            batch_name: document.getElementById('id_batch_name').value.trim(),
            course: document.getElementById('id_course').value,
            timing: document.getElementById('id_timing').value,
            start_time: document.getElementById('id_start_time').value,
            end_time: document.getElementById('id_end_time').value,
            trainer: document.getElementById('id_trainer').value || null,
            start_date: document.getElementById('id_start_date').value,
            end_date: document.getElementById('id_end_date').value,
        })

        const url = editingBatchId
            ? `/api/batches/${editingBatchId}/`
            : '/api/batches/';

        const method = editingBatchId ? 'PATCH' : 'POST';

        const submitBtn = document.getElementById('batchSubmitBtn');
        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : null;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = editingBatchId
                ? '<i class="fa-solid fa-spinner fa-spin"></i> Updating...'
                : '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
        }

        try {

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: payload
            })

            if (res.ok) {

                bootstrap.Modal
                    .getInstance(document.getElementById('batchModal'))
                    .hide()

                const wasEditing = !!editingBatchId;

                resetBatchModalToCreateMode()

                fetchAllBatches()

                showToast(wasEditing ? 'Batch Updated Successfully' : 'Batch Created Successfully', 'success')
            }
            else {
                try {
                    const error = await res.json();
                    console.log("SERVER ERROR:", error);
                    applyBatchServerErrors(error);
                } catch {
                    const error = await res.text();
                    console.log("SERVER ERROR:", error);
                    showToast('Something went wrong. Please try again.', 'error');
                }
            }
        } catch (err) {
            console.log("NETWORK ERROR:", err);
            showToast('Unable to reach the server. Please try again.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    })

//================ TIME FORMAT HELPER (24H -> 12H DISPLAY) ==================//
function formatTime(timeStr) {
    const date = new Date(`1970-01-01T${timeStr}`);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// ===================== STATE (client-side filter + pagination) =====================

//================ CLIENT-SIDE STATE (ALL BATCHES, PAGE, PAGE SIZE) ==================//
let allBatches = [];
let currentPage = 1;
let pageSize = 10;

// Map backend display_status -> the CSS class + filter-value your UI already uses
const STATUS_CLASS_MAP = {
    'Upcoming': 'upcoming',
    'Active': 'active',
    'Completed': 'completed',
    'Cancelled': 'cancelled'
};

//================ FETCH ALL BATCHES FROM API ==================//
// Fetches ALL batches once from the same existing endpoint (no backend change)
// Handles both plain-array responses AND DRF paginated responses ({results: [...]})
async function fetchAllBatches() {

    const res = await fetch(`/api/batches/`)
    const data = await res.json()

    allBatches = Array.isArray(data) ? data : (data.results || []);

    console.log("Total batches loaded:", allBatches.length)

    populateFilterOptions()
    currentPage = 1
    applyFiltersAndRender()
}

//================ POPULATE COURSE/TRAINER/TIMING FILTER DROPDOWNS ==================//
function populateFilterOptions() {

    const courseSelect = document.getElementById('filterCourse');
    const trainerSelect = document.getElementById('filterTrainer');
    const timingSelect = document.getElementById('filterTiming');

    const courses = [...new Set(allBatches.map(b => b.course_name).filter(Boolean))];
    const trainers = [...new Set(allBatches.map(b => b.trainer_name).filter(Boolean))];
    const timings = [...new Set(allBatches.map(b => b.timing).filter(Boolean))];

    courseSelect.innerHTML = '<option value="">All Courses</option>' +
        courses.map(c => `<option value="${c}">${c}</option>`).join('');

    trainerSelect.innerHTML = '<option value="">All Trainers</option>' +
        trainers.map(t => `<option value="${t}">${t}</option>`).join('');

    timingSelect.innerHTML = '<option value="">All Timings</option>' +
        timings.map(t => `<option value="${t}">${t}</option>`).join('');
}

//================ APPLY FILTERS + PAGINATION + RENDER ==================//
function applyFiltersAndRender() {

    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    const courseFilter = document.getElementById('filterCourse').value;
    const trainerFilter = document.getElementById('filterTrainer').value;
    const timingFilter = document.getElementById('filterTiming').value;
    const statusFilter = document.getElementById('filterStatus').value;

    let filtered = allBatches.filter(batch => {

        // status now comes straight from the backend (batch.display_status),
        // no more re-deriving Upcoming/Completed from dates here.
        const status = STATUS_CLASS_MAP[batch.display_status] || 'active';

        const matchesSearch = !search || [
            batch.batch_name, batch.course_name, batch.trainer_name, batch.timing
        ].filter(Boolean).some(field => field.toLowerCase().includes(search));

        const matchesCourse = !courseFilter || batch.course_name === courseFilter;
        const matchesTrainer = !trainerFilter || batch.trainer_name === trainerFilter;
        const matchesTiming = !timingFilter || batch.timing === timingFilter;
        const matchesStatus = !statusFilter || status === statusFilter;

        return matchesSearch && matchesCourse && matchesTrainer && matchesTiming && matchesStatus;
    });

    // clamp currentPage BEFORE rendering cards, so stale page number never shows wrong slice
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    // batches on the page currently shown (same slice renderBatches draws)
    const startIndex = (currentPage - 1) * pageSize;
    const pageBatches = filtered.slice(startIndex, startIndex + pageSize);

    renderStats(filtered, pageBatches);
    renderBatches(filtered);
    renderPagination(filtered.length);
}

// ===================== RESET BUTTON ===================

//================ RESET ALL FILTERS ==================//
document.getElementById("btnReset").addEventListener("click", () => {

    document.getElementById("filterCourse").value = "";
    document.getElementById("filterTrainer").value = "";
    document.getElementById("filterTiming").value = "";
    document.getElementById("filterStatus").value = "";
    document.getElementById("searchInput").value = "";

    currentPage = 1;
    applyFiltersAndRender();
});

//================ RENDER TOP STAT CARDS (BATCH COUNT FROM CURRENT PAGE; STUDENTS, MARKED, ABSENT) ==================//
function renderStats(filtered, pageBatches) {

    let totalStudents = 0;
    let markedCount = 0;
    let notMarkedCount = 0;
    let absentCount = 0;

    filtered.forEach(batch => {

        const isOngoing = batch.display_status === 'Active';

        totalStudents += batch.student_count;
        absentCount += (batch.absent_count || 0);

        if (isOngoing) {
            if (batch.is_marked) markedCount++;
            else notMarkedCount++;
        }
    });

    // Batch count comes straight from the batches on the current page:
    // Active -> Ongoing, Upcoming -> Upcoming (no more created_at "this month" source).
    const pageList = pageBatches || [];
    const ongoingOnPage = pageList.filter(b => b.display_status === 'Active').length;
    const upcomingOnPage = pageList.filter(b => b.display_status === 'Upcoming').length;

    document.getElementById('totalBatches').innerText = pageList.length;
    document.getElementById('totalStudents').innerText = totalStudents;
    document.getElementById('attendanceMarked').innerText = markedCount;
    document.getElementById('notMarked').innerText = notMarkedCount;
    document.getElementById('absentToday').innerText = absentCount;

    document.getElementById('batchesThisMonth').innerText =
        `${ongoingOnPage} ongoing · ${upcomingOnPage} upcoming`;
}

//================ RENDER BATCH CARDS (CURRENT PAGE) ==================//
function renderBatches(filtered) {

    const container = document.getElementById('batchContainer');
    container.innerHTML = '';

    const startIndex = (currentPage - 1) * pageSize;
    const pageBatches = filtered.slice(startIndex, startIndex + pageSize);

    pageBatches.forEach(batch => {

        const statusLabel = batch.display_status || 'Ongoing';
        const statusClass = STATUS_CLASS_MAP[statusLabel] || 'active';

        const isUpcoming = statusLabel === 'Upcoming';
        const isCompleted = statusLabel === 'Completed';
        const isCancelled = statusLabel === 'Cancelled';

        const present = batch.present_count || 0;
        const absent = batch.absent_count || 0;
        const pct = batch.student_count > 0
            ? Math.round((present / batch.student_count) * 100)
            : 0;

        container.innerHTML += `
        <div class="col-lg-6 col-md-6">
            <div class="batch-card ${isUpcoming ? 'upcoming' : ''}" id="batch-${batch.id}">

                <div class="card-top">
                    <span class="status-badge ${statusClass}">
                        <span class="dot"></span> ${statusLabel}
                    </span>
                    <span class="timing-badge">
                        <i class="fa-regular fa-clock"></i> ${batch.timing}
                    </span>
                </div>

                <h4 class="batch-title">${batch.course_name} ${batch.batch_name}</h4>

                <div class="meta-row">
                    <span><i class="fa-solid fa-chalkboard-user"></i><div class="meta-value"><strong>Trainer</strong>${batch.trainer_name || 'No Trainer'}</div></span>
                    <span><i class="fa-solid fa-graduation-cap"></i><div class="meta-value"><strong>Course</strong>${batch.course_name}</div></span>
                </div>

                <div class="meta-row">
                    <span><i class="fa-regular fa-clock"></i><div class="meta-value"><strong>Timing</strong>${formatTime(batch.start_time)} to ${formatTime(batch.end_time)}</div></span>
                    <span><i class="fa-solid fa-users"></i><div class="meta-value"><strong>Students</strong>${batch.student_count} Students</div></span>
                </div>

                <div class="attendance-block">
                    <div class="attendance-block-head">
                        <span>Attendance Today</span>
                        <span class="pct">${pct}%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="present-absent-row">
                        <span class="legend present"><span class="dot"></span> Present ${present}</span>
                        <span class="legend absent"><span class="dot"></span> Absent ${absent}</span>
                    </div>
                </div>

                <div class="card-actions">
                    <button class="btn-view" onclick="window.location.href='/api/batch-preview/${batch.id}/'">
                        <i class="fa-regular fa-eye"></i> View
                    </button>
                    ${isUpcoming
                ? `<button class="btn-attendance" disabled>Upcoming</button>`
                : (isCompleted || isCancelled)
                    ? `<button class="btn-attendance" disabled>${statusLabel}</button>`
                    : `<button class="btn-attendance"
        onclick="window.location.href='/api/mark-attendance/${batch.id}/'">
        ${batch.is_marked ? 'Update' : 'Mark'}
       </button>`
            }
                ${(IS_TRAINER || (typeof IS_HR !== 'undefined' && IS_HR)) ? '' : `
                    <button class="btn-edit" onclick="editBatch(${batch.id})">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>`}
                </div>

            </div>
        </div>
        `
    })
}

//================ RENDER PAGINATION CONTROLS ==================//
function renderPagination(totalItems) {

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    document.getElementById('paginationInfo').innerText =
        `Showing ${startItem} to ${endItem} of ${totalItems} batches`;

    const pageNumbers = document.getElementById('pageNumbers');
    pageNumbers.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        pageNumbers.innerHTML += `
            <button class="page-number ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>
        `;
    }

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

//================ PAGE NAVIGATION HELPER ==================//
function goToPage(page) {
    currentPage = page;
    applyFiltersAndRender();
}

//================ PAGINATION BUTTON LISTENERS (PREV/NEXT/PAGE SIZE) ==================//
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        applyFiltersAndRender();
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    currentPage++;
    applyFiltersAndRender();
});

document.getElementById('pageSizeSelect').addEventListener('change', function () {
    pageSize = parseInt(this.value, 10);
    currentPage = 1;
    applyFiltersAndRender();
});

//================ SEARCH INPUT LISTENER ==================//
document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    applyFiltersAndRender();
});

//================ FILTER DROPDOWN LISTENERS ==================//
['filterCourse', 'filterTrainer', 'filterTiming', 'filterStatus'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        currentPage = 1;
        applyFiltersAndRender();
    });
});

//================ MARK ATTENDANCE (NOTE: attendanceData/res NOT DEFINED IN SCOPE - PRE-EXISTING BUG) ==================//
async function markAttendance(enrollment, batchId, status, remarks) {

    for (let data of attendanceData) {

        if ((data.status === 'Absent' || data.status === 'Late') && !data.remarks) {
            showToast("Remarks required", 'error')
            return
        }

        const res = await fetch('/api/attendance/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                enrollment: enrollment,
                batch: batchId,
                status: status,
                remarks: remarks,
            })
        })
    }

    if (res.ok) {
        showToast("Attendance Marked Successfully", 'success')
        fetchAllBatches()
    } else {
        const err = await res.text()
        console.log("Error:", err)
        showToast("Failed to mark attendance", 'error')
    }
}

//================ INITIAL LOAD ==================//
fetchAllBatches()

//================ DATE PICKER + BATCH FORM LIVE FIELD VALIDATION ==================//
document.addEventListener("DOMContentLoaded", function () {

    const today = new Date().toISOString().split('T')[0];

    document.querySelectorAll('input[type="date"], input[type="time"]')
        .forEach(input => {
            input.addEventListener("click", function () {
                if (this.showPicker) {
                    this.showPicker();
                }
            });
        });

    const startDate = document.getElementById("id_start_date");
    const endDate = document.getElementById("id_end_date");

    startDate.min = today;
    endDate.min = today;

    function validateDates() {

        document.getElementById("startDateError").innerText = "";
        document.getElementById("endDateError").innerText = "";

        if (!editingBatchId && startDate.value && startDate.value < today) {
            document.getElementById("startDateError").innerText =
                "Start cannot be a past date";
        }

        if (endDate.value && endDate.value <= today) {
            document.getElementById("endDateError").innerText =
                "End date must be a future date";
        }

        if (
            startDate.value &&
            endDate.value &&
            endDate.value < startDate.value
        ) {
            document.getElementById("endDateError").innerText =
                "End date must be greater than start date";
        }
    }

    startDate.addEventListener("input", validateDates);
    endDate.addEventListener("input", validateDates);

    startDate.addEventListener("change", validateDates);
    endDate.addEventListener("change", validateDates);

    // Live per-field feedback for the remaining required batch fields,
    // clearing each field's own error as soon as it becomes valid.
    const batchNameInput = document.getElementById("id_batch_name");
    const courseInput = document.getElementById("id_course");
    const timingInput = document.getElementById("id_timing");
    const startTimeInput = document.getElementById("id_start_time");
    const endTimeInput = document.getElementById("id_end_time");

    if (batchNameInput) {
        batchNameInput.addEventListener("input", () => {
            const el = document.getElementById("batchNameError");
            if (!el) return;
            const value = batchNameInput.value.trim();
            if (!value) {
                el.innerText = "Batch name is required";
            } else if (value.length > 100) {
                el.innerText = "Batch name cannot exceed 100 characters";
            } else {
                el.innerText = "";
            }
        });
    }

    if (courseInput) {
        courseInput.addEventListener("change", () => {
            const el = document.getElementById("courseError");
            if (el) el.innerText = courseInput.value ? "" : "Please select a course";
        });
    }

    if (timingInput) {
        timingInput.addEventListener("change", () => {
            const el = document.getElementById("timingError");
            if (el) el.innerText = timingInput.value ? "" : "Please select a timing";
        });
    }

    function validateTimes() {
        const startEl = document.getElementById("startTimeError");
        const endEl = document.getElementById("endTimeError");

        if (startEl) {
            startEl.innerText = startTimeInput.value ? "" : "Start time is required";
        }

        if (endEl) {
            if (!endTimeInput.value) {
                endEl.innerText = "End time is required";
            } else if (startTimeInput.value && endTimeInput.value <= startTimeInput.value) {
                endEl.innerText = "End time must be after start time";
            } else {
                endEl.innerText = "";
            }
        }
    }

    if (startTimeInput) {
        startTimeInput.addEventListener("change", validateTimes);
        startTimeInput.addEventListener("input", validateTimes);
    }

    if (endTimeInput) {
        endTimeInput.addEventListener("change", validateTimes);
        endTimeInput.addEventListener("input", validateTimes);
    }

    const newBatchBtn = document.querySelector('.btn-new-batch');
    if (newBatchBtn) {
        newBatchBtn.addEventListener('click', resetBatchModalToCreateMode);
    }
    document.getElementById('batchModal').addEventListener('hidden.bs.modal', resetBatchModalToCreateMode);

});

//================ AUTO-CALCULATE END DATE FROM COURSE DURATION ==================//
async function autoCalculateEndDate() {

    const courseId = document.getElementById("id_course").value;
    const startDate = document.getElementById("id_start_date").value;

    if (!courseId || !startDate) {
        return;
    }

    if (editingBatchId) {
        return;
    }

    const response = await fetch(`/api/course-duration/${courseId}/`);
    const data = await response.json();

    let endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + data.duration);

    document.getElementById("id_end_date").value =
        endDate.toISOString().split("T")[0];
}

document.getElementById("id_course")
    .addEventListener("change", autoCalculateEndDate);

document.getElementById("id_start_date")
    .addEventListener("change", autoCalculateEndDate);


// ===================== TOAST HELPER =====================

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
            // <p class="toast-title">${TOAST_TITLES[type] || TOAST_TITLES.success}</p>
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