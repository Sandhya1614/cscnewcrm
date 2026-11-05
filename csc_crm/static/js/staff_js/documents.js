
/* ===== Document type detection (mirrors server-side logic) ===== */
function detectDocumentType(filename) {
    const name = filename.replace(/\.[^.]+$/, '').toLowerCase();
    if (/aadhaar|aadhar|uid/.test(name)) return 'Aadhaar Card';
    if (/\bpan\b|pancard/.test(name)) return 'PAN Card';
    if (/passport/.test(name)) return 'Passport';
    if (/resume|cv\b/.test(name)) return 'Resume';
    if (/offer|appointment/.test(name)) return 'Offer Letter';
    if (/certificate|cert|degree|diploma/.test(name)) return 'Certificate';
    // Prettify raw filename
    return filename.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/* ===== Show / hide upload panel ===== */
function showUploadPanel() {
    const panel = document.getElementById('uploadPanel');
    const layout = document.getElementById('docMainLayout');
    panel.classList.add('visible');
    layout.classList.add('upload-open');
}

function hideUploadPanel() {
    const panel = document.getElementById('uploadPanel');
    const layout = document.getElementById('docMainLayout');
    panel.classList.remove('visible');
    layout.classList.remove('upload-open');
}

/* ===== File selected: show name, detected type, then auto-submit ===== */
function onFileSelected(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    // Show filename
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSelected').style.display = 'flex';

    // Show detected type
    const detected = detectDocumentType(file.name);
    document.getElementById('detectedTypeName').textContent = 'Detected: ' + detected;
    document.getElementById('detectedType').style.display = 'flex';

    // Small delay so user sees the feedback, then submit
    setTimeout(() => {
        document.getElementById('uploadForm').style.display = 'none';
        document.getElementById('uploadingState').style.display = 'flex';
        document.getElementById('uploadForm').submit();
    }, 600);
}

/* ===== Drag & drop ===== */
const dropzone = document.getElementById('dropzone');

dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length) {
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        document.getElementById('fileInput').files = dt.files;
        onFileSelected(document.getElementById('fileInput'));
    }
});

/* ===== Delete modal ===== */
function openDeleteModal(docId, docName) {
    document.getElementById('deleteModalText').textContent =
        `Are you sure you want to delete "${docName}"? This action cannot be undone.`;
    document.getElementById('deleteForm').action = `/staff/documents/${docId}/delete/`;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
}

// =============================== ALERT MESSAGE VANISH ===============================
document.getElementById('deleteModal').addEventListener('click', function(e) {
    if (e.target === this) closeDeleteModal();
});

document.addEventListener('DOMContentLoaded', () => {
    const alerts = document.querySelectorAll('.doc-alert');

    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-8px)';

            setTimeout(() => {
                alert.remove();
            }, 400);

        }, 3000);
    });
});

// ====================================== HAMBURGER MENU ===========================================

document.addEventListener("DOMContentLoaded", function () {

    const navToggle = document.getElementById("docnavToggle");
    const navTabs = document.getElementById("docnavTabs");

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