//================ CSRF TOKEN HELPER (READ FROM COOKIE) ==================//
console.log("Script Loaded");

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const csrftoken = csrfToken;

//================ AVATAR COLOR ASSIGNMENT (CYCLED PALETTE) ==================//
function getAvatarColor(index) {

    const colors = [
        "#2563eb",
        "#16a34a",
        "#dc2626",
        "#9333ea",
        "#ea580c",
        "#0891b2"
    ];

    return colors[index % colors.length];
}

//================ IN-MEMORY ATTENDANCE STATE ==================//
let attendanceData = [];

/* =========================
   TOAST NOTIFICATIONS
   (replaces browser alert())
========================= */

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

function showToast(message, type = "success", duration = 6800) {

    const container = document.getElementById('toastContainer');

    if (!container) {
        // fallback, just in case the container isn't present
        alert(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${TOAST_ICONS[type] || TOAST_ICONS.success}"></i></div>
        <div class="toast-body">
            <p class="toast-title">${TOAST_TITLES[type] || TOAST_TITLES.success}</p>
            <p class="toast-message">${message}</p>
        </div>
        <button type="button" class="toast-close" aria-label="Close">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    const removeToast = () => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 2000);
    };

    toast.querySelector('.toast-close').addEventListener('click', removeToast);

    const timer = setTimeout(removeToast, duration);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
}


//================ RENDER STUDENT TABLE + BUILD IN-MEMORY ATTENDANCE DATA ==================//
// Renders the student table body from the `students` data (injected by the
// template) and builds the in-memory attendanceData array used for submission
function loadStudents() {

    const tbody = document.getElementById('studentBody');
    tbody.innerHTML = '';
    attendanceData = [];

    document.getElementById('totalCount').innerText = students.length;

    students.forEach((student, index) => {

        attendanceData.push({
            enrollment: student.enrollment,
            status: student.status,
            remarks: student.remarks || "",
        });

        tbody.innerHTML += `
        <tr class="row-${index}">

            <td>${index + 1}</td>

            <td>
              <div class="student-info">

                ${student.photo
                ?
                `<img src="${student.photo}" class="student-avatar-img" alt="Student">`
                :
                `<div class="student-avatar avatar-${index} ">
                ${student.student_name
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </div>`
            }

                <span>${student.student_name}</span>

                </div>
            </td>

            <td>${student.student_id}</td>

            <td>

                <button class="status-btn present ${student.status === 'Present' ? 'active' : ''}"
                    onclick="setStatus(${index},'Present')">Present</button>

                <button class="status-btn absent ${student.status === 'Absent' ? 'active' : ''}"
                    onclick="setStatus(${index},'Absent')">Absent</button>

                <button class="status-btn late ${student.status === 'Late' ? 'active' : ''}"
                    onclick="setStatus(${index},'Late')">Late</button>

            </td>

            <td>
                <input type="text"
                    id="remark-${index}"
                    class="form-control remarks-input"
                    value="${student.remarks || ''}"
                    placeholder="${student.status === 'Present' ? 'Optional' : 'Remarks required'}"
                    onchange="setRemark(${index},this.value)">
            </td>

        </tr>`;
    });

    updateCounts();
}

//================ SET STUDENT STATUS (PRESENT/ABSENT/LATE) ==================//
function setStatus(index, status) {

    // update data
    attendanceData[index].status = status;

    // get row buttons
    const row = document.querySelector(`.row-${index}`);
    const buttons = row.querySelectorAll('.status-btn');

    // remove active from all buttons in that row
    buttons.forEach(btn => btn.classList.remove('active'));

    // add active to clicked one
    let activeBtn;

    if (status === 'Present') {
        activeBtn = row.querySelector('.present');
    } else if (status === 'Absent') {
        activeBtn = row.querySelector('.absent');
    } else if (status === 'Late') {
        activeBtn = row.querySelector('.late');
    }


    activeBtn.classList.add('active');


    const remarkInput = document.getElementById(`remark-${index}`);

    if (status === 'Present') {
        remarkInput.value = '';
        remarkInput.placeholder = 'Optional';
    } else {
        remarkInput.value = attendanceData[index].remarks || '';
        remarkInput.placeholder = 'Remarks Required';
    }

    updateCounts();
}

//================ SET REMARKS FOR A STUDENT ==================//
function setRemark(index, value) {
    attendanceData[index].remarks = value;
}

//================ UPDATE PRESENT/ABSENT/LATE COUNTS + PERCENTAGE ==================//
function updateCounts() {

    let present = 0, absent = 0, late = 0;

    attendanceData.forEach(d => {
        if (d.status === 'Present') present++;
        if (d.status === 'Absent') absent++;
        if (d.status === 'Late') late++;
    });

    document.getElementById('presentCount').innerText = present;
    document.getElementById('absentCount').innerText = absent;
    document.getElementById('lateCount').innerText = late;

    // Attendance Percentage Update
    const percentage =
        students.length > 0
            ? Math.round(((present + late) / students.length) * 100)
            : 0;

    document.getElementById('attendancePercentage').innerText =
        percentage + "% Present";
}

//================ SUBMIT ATTENDANCE + SYLLABUS LOG (BULK API) ==================//
// Validates remarks, gathers the syllabus log fields, then posts the
// whole batch's attendance + syllabus log to the bulk attendance API
async function submitAttendance() {

    for (let data of attendanceData) {

        if (
            (data.status === 'Absent' || data.status === 'Late') &&
            (!data.remarks || data.remarks.trim() === '')
        ) {
            showToast("Remarks required for Absent / Late", "warning");
            return;
        }
    }

    const topicCovered =
        document.getElementById("topicCovered").value;

    const hours =
        parseInt(document.getElementById("durationHours").value) || 0;

    const minutes =
        parseInt(document.getElementById("durationMinutes").value) || 0;

    const duration = (hours * 60) + minutes;

    const nextTopic =
        document.getElementById("nextTopic").value;

    const trainerNotes =
        document.getElementById("trainerNotes").value;

    if (!topicCovered.trim()) {
        showToast("Topic Covered is required", "warning");
        return;
    }

    document.getElementById("durationError").innerText = "";

    if (duration <= 0) {
        document.getElementById("durationError").innerText =
            "Duration is required";

        return;
    }

    try {

        const response = await fetch(
            "/api/attendance/bulk/",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrftoken
                },
                body: JSON.stringify({
                    batch: batchId,
                    attendance: attendanceData,
                    syllabus_log: {
                        topic_covered: topicCovered,
                        duration: duration,
                        next_topic: nextTopic,
                        trainer_notes: trainerNotes
        }
            })
}
    );

const result = await response.json();

console.log(result);

if (response.ok) {

    const modalEl = document.getElementById('attendanceModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
        modalInstance.hide();
    }

    showToast("Attendance submitted successfully!", "success", 5000);

    setTimeout(() => {
        window.location.href = attendanceHistoryUrl;
    }, 5300);

} else {
    showToast(typeof result === 'string' ? result : (result.detail || result.message || "Something went wrong. Please try again."), "error");
}

} catch (error) {
    console.error(error);
    showToast("Network error. Please try again.", "error");
}
}

//================ SEARCH STUDENTS BY NAME OR ID (CLIENT-SIDE) ==================//
function searchStudents(searchText) {

    searchText = searchText.toLowerCase();

    document.querySelectorAll('#studentBody tr').forEach(row => {

        const studentName =
            row.children[1].innerText.toLowerCase();

        const studentId =
            row.children[2].innerText.toLowerCase();

        if (
            studentName.includes(searchText) ||
            studentId.includes(searchText)
        ) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

//================ INITIAL LOAD - RENDER STUDENTS + AVATAR COLORS ==================//
loadStudents();

document.querySelectorAll('.student-avatar').forEach((el, index) => {
    el.style.background = getAvatarColor(index);
});

//================ SEARCH INPUT LISTENER ==================//
document.getElementById('searchInput')
    .addEventListener('input', function () {

        searchStudents(this.value);
    });

//================ SYNC MODAL SUMMARY COUNTS ON MODAL SHOW ==================//
document.getElementById('attendanceModal')
    .addEventListener('show.bs.modal', function () {

        document.getElementById('modalPresent').innerText =
            document.getElementById('presentCount').innerText;

        document.getElementById('modalAbsent').innerText =
            document.getElementById('absentCount').innerText;

        document.getElementById('modalLate').innerText =
            document.getElementById('lateCount').innerText;
    });

//================ OPEN CONFIRM ATTENDANCE MODAL (WITH REMARKS VALIDATION) ==================//
function openAttendanceModal() {

    for (let data of attendanceData) {
        if (
            (data.status === 'Absent' || data.status === 'Late') &&
            (!data.remarks || data.remarks.trim() === '')
        ) {
            showToast("Remarks required for Absent / Late", "warning");
            return;
        }
    }

    updateCounts();

    document.getElementById('modalPresent').innerText =
        document.getElementById('presentCount').innerText;

    document.getElementById('modalAbsent').innerText =
        document.getElementById('absentCount').innerText;

    document.getElementById('modalLate').innerText =
        document.getElementById('lateCount').innerText;

    const modal = new bootstrap.Modal(
        document.getElementById('attendanceModal')
    );

    modal.show();
}

//================ INITIAL ATTENDANCE PERCENTAGE (ON PAGE LOAD) ==================//
const percentage =
    Math.round(
        (parseInt(document.getElementById('presentCount').innerText)
            / students.length) * 100
    );

document.getElementById('attendancePercentage').innerText =
    percentage + "% Present";


//================ TOGGLE DURATION UNIT DISPLAY (HOURS/MINUTES) ==================//
function toggleUnit(inputId, unitId) {

    const input = document.getElementById(inputId);
    const unit = document.getElementById(unitId);

    unit.style.display = input.value ? 'flex' : 'none';

    if (
        document.getElementById("durationHours").value ||
        document.getElementById("durationMinutes").value
    ) {
        document.getElementById("durationError").innerText = "";
    }
}