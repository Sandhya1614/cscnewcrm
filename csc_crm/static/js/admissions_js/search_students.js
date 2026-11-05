const form = document.getElementById("filterForm");
const error = document.getElementById("filter-error");

const nameInput = form.querySelector('input[name="search"]');
const idInput = form.querySelector('input[name="id"]');
const phoneInput = form.querySelector('input[name="phone_no"]');


// helper: create (or reuse) a small error tag right after a field
function getFieldError(input) {

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

const nameError = getFieldError(nameInput);
const idError = getFieldError(idInput);
const phoneError = getFieldError(phoneInput);


/*=========================================
        SEARCH NAME — letters & spaces only
=========================================*/

function validateName() {

    if (!nameInput || !nameError) return true;

    // strip out anything that isn't a letter or space, live
    nameInput.value = nameInput.value.replace(/[^A-Za-z ]/g, "");

    if (nameInput.value.trim() !== "" && !/^[A-Za-z ]+$/.test(nameInput.value)) {

        nameInput.classList.add("error-input");
        nameError.innerText = "Only letters and spaces allowed";
        return false;

    } else {

        nameInput.classList.remove("error-input");
        nameError.innerText = "";
        return true;

    }

}

if (nameInput) {
    nameInput.addEventListener("input", validateName);
}


/*=========================================
        SEARCH ID — 1 to 5 digits only
=========================================*/

function validateId() {

    if (!idInput || !idError) return true;

    // strip out non-digits live, cap at 5 digits
    idInput.value = idInput.value.replace(/[^0-9]/g, "").slice(0, 5);

    if (idInput.value.trim() !== "" && !/^\d{1,5}$/.test(idInput.value)) {

        idInput.classList.add("error-input");
        idError.innerText = "ID must be 1 to 5 digits";
        return false;

    } else {

        idInput.classList.remove("error-input");
        idError.innerText = "";
        return true;

    }

}

if (idInput) {
    idInput.addEventListener("input", validateId);
}


/*=========================================
        PHONE — exactly 10 digits
=========================================*/

function validatePhone() {

    if (!phoneInput || !phoneError) return true;

    // strip out non-digits live, cap at 10 digits
    phoneInput.value = phoneInput.value.replace(/[^0-9]/g, "").slice(0, 10);

    if (phoneInput.value.trim() !== "" && !/^\d{10}$/.test(phoneInput.value)) {

        phoneInput.classList.add("error-input");
        phoneError.innerText = "Phone number must be exactly 10 digits";
        return false;

    } else {

        phoneInput.classList.remove("error-input");
        phoneError.innerText = "";
        return true;

    }

}

if (phoneInput) {
    phoneInput.addEventListener("input", validatePhone);
}


// FILTER VALIDATION
form.addEventListener("submit", function (e) {

    let hasValue = false;

    form.querySelectorAll('input:not([type="hidden"]), select').forEach(field => {

        if (field.value.trim() !== "") {
            hasValue = true;
        }

    });

    const validName = validateName();
    const validId = validateId();
    const validPhone = validatePhone();

    if (!hasValue) {

        e.preventDefault();

        error.innerText = "Choose at least one filter";
        error.style.color = "red";

    } else if (!validName || !validId || !validPhone) {

        e.preventDefault();

        error.innerText = "Please fix the highlighted fields";
        error.style.color = "red";

        const firstError = form.querySelector(".error-input");
        if (firstError) {
            firstError.scrollIntoView({ behavior: "smooth", block: "center" });
            firstError.focus();
        }

    } else {

        error.innerText = "";

    }

});


// RESET WITHOUT RELOAD
document.getElementById("resetBtn").addEventListener("click", function () {

    // batch page-la hidden "batch" input irukkum, adhai kedukka koodaadhu
    const lockedBatchInput = form.querySelector('input[type="hidden"][name="batch"]');
    const lockedBatch = lockedBatchInput ? lockedBatchInput.value : "";
    const baseUrl = window.location.pathname +
        (lockedBatch ? "?batch=" + encodeURIComponent(lockedBatch) : "");

    // CLEAR INPUTS (hidden thavira)
    form.querySelectorAll('input:not([type="hidden"])').forEach(input => {
        input.value = "";
        input.classList.remove("error-input");
    });

    // RESET SELECTS
    form.querySelectorAll("select").forEach(select => {
        select.selectedIndex = 0;
    });

    // CLEAR ERRORS
    error.innerText = "";
    [nameError, idError, phoneError].forEach(el => {
        if (el) el.innerText = "";
    });

    // URL: batch irundha adhai vachirukkanum
    window.history.replaceState({}, document.title, baseUrl);

    // FETCH BASE PAGE
    fetch(baseUrl)
        .then(response => response.text())
        .then(data => {

            const doc = new DOMParser().parseFromString(data, "text/html");

            // TABLE RESET
            document.querySelector(".table-wrapper").innerHTML =
                doc.querySelector(".table-wrapper").innerHTML;

            // RESULT INFO RESET
            document.querySelector(".result-info").innerHTML =
                doc.querySelector(".result-info").innerHTML;

            // PAGINATION RESET
            const curPg = document.querySelector(".pagination-container");
            const newPg = doc.querySelector(".pagination-container");
            if (curPg && newPg) curPg.innerHTML = newPg.innerHTML;

            // selection UI refresh
            updateSelectionUI();
        });

});


    (function () {
        const btn = document.getElementById('toggleFiltersBtn');
        const card = document.getElementById('filterCard');
        if (!btn || !card) return;
        btn.addEventListener('click', function () {
            const hidden = card.style.display === 'none';
            card.style.display = hidden ? '' : 'none';
            btn.innerHTML = hidden
                ? '<i class="fa-solid fa-chevron-up"></i> Hide Filters'
                : '<i class="fa-solid fa-chevron-down"></i> Show Filters';
        });
    })();

    const perPageSelect = document.getElementById('perPageSelect');
    if (perPageSelect) {
        perPageSelect.addEventListener('change', function () {
            const params = new URLSearchParams(window.location.search);
            params.set('per_page', this.value);
            params.set('page', 1);
            window.location.search = params.toString();
        });
    }

    // ================= BULK SELECTION =================
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const selectedCountText = document.getElementById('selectedCountText');

function getRowCheckboxes() {
    return document.querySelectorAll('.row-checkbox');
}

function getSelectedIds() {
    return Array.from(getRowCheckboxes())
        .filter(cb => cb.checked)
        .map(cb => cb.value);
}

function updateSelectionUI() {
    const rowCheckboxes = getRowCheckboxes();
    const selectedIds = getSelectedIds();

    if (selectAllCheckbox) {
        if (rowCheckboxes.length === 0 || selectedIds.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedIds.length === rowCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    if (selectedCountText) {
        if (selectedIds.length > 0) {
            selectedCountText.style.display = 'block';
            selectedCountText.innerText = selectedIds.length === 1
                ? '1 Student Selected'
                : `${selectedIds.length} Students Selected`;
        } else {
            selectedCountText.style.display = 'none';
            selectedCountText.innerText = '';
        }
    }
}

// Event delegation — works even for rows injected later (reset fetch)
document.addEventListener('change', function (e) {

    if (e.target.classList.contains('row-checkbox')) {
        updateSelectionUI();
    }

    if (e.target.id === 'selectAllCheckbox') {
        getRowCheckboxes().forEach(cb => { cb.checked = e.target.checked; });
        updateSelectionUI();
    }
});

// EXPORT SELECTED ONLY
if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', function () {

        const selectedIds = getSelectedIds();

        if (selectedIds.length === 0) {
            alert("Please select at least one student to export.");
            return;
        }

        const baseQuery = exportExcelBtn.dataset.baseQuery || '';
        const params = new URLSearchParams(baseQuery);
        params.set('format', 'excel');
        params.set('ids', selectedIds.join(','));

        window.location.href = '?' + params.toString();
    });
}

updateSelectionUI();

function toggleKebabMenu(event, btn) {
    event.stopPropagation();
    const menu = btn.nextElementSibling;

    document.querySelectorAll('.kebab-menu.show').forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });

    menu.classList.toggle('show');
}

// outside click pannina menu close aagum
document.addEventListener('click', function () {
    document.querySelectorAll('.kebab-menu.show').forEach(m => m.classList.remove('show'));
});

function confirmDelete(el) {
    const deleteUrl = el.dataset.deleteUrl;

    Swal.fire({
        title: "Are you sure?",
        text: "This student will be deleted permanently!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel"
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = deleteUrl;
        }
    });
}