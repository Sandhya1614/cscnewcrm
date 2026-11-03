// JS for the Student List page: delete confirmation, row action dropdown,
// export format validation, and the search/reset filter behaviour.

// Shows a confirm popup before actually following the delete link
function confirmDelete(event, url) {
    event.preventDefault();

    Swal.fire({
        title: "Are you sure?",
        text: "This student will be deleted permanently!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!"
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = url;
        }
    });
}


//  DROPDOWN MENU


function toggleDropdown(button) {

    const dropdown = button.nextElementSibling;
    const isOpen = dropdown.classList.contains("show");

    // close all dropdowns first
    document.querySelectorAll(".dropdown-content").forEach(d => {
        d.classList.remove("show");
    });

    if (!isOpen) {
        const rect = button.getBoundingClientRect();

        dropdown.style.top = (rect.bottom + 4) + "px";
        dropdown.style.left = "auto";
        dropdown.style.right = (window.innerWidth - rect.right) + "px";

        dropdown.classList.add("show");
    }
}

// outside click close
document.addEventListener("click", function (e) {

    if (!e.target.matches('.dots')) {

        document.querySelectorAll(".dropdown-content").forEach(d => {
            d.classList.remove("show");
        });

    }

});

// close open dropdown on scroll (table scroll / page scroll)
document.addEventListener("scroll", function () {
    document.querySelectorAll(".dropdown-content.show").forEach(d => {
        d.classList.remove("show");
    });
}, true);

// Makes sure a download format (excel/pdf) is picked before submitting the download form
function validateFormat() {

    let format = document.getElementById("format").value;
    let error = document.getElementById("error-msg");

    if (format === "") {
        error.innerText = "Please select one format";
        return false;
    }

    error.innerText = "";
    return true;
}


const form = document.getElementById("filterForm");
const error = document.getElementById("search-error");

/*=========================================
        ERROR HELPERS
        (same red-text / red-border pattern
        used on register / edit / fee dashboard)
=========================================*/

function showFieldError(input, errorEl, message) {
    if (input) input.classList.add("error-input");
    if (errorEl) errorEl.innerText = message;
}

function clearFieldError(input, errorEl) {
    if (input) input.classList.remove("error-input");
    if (errorEl) errorEl.innerText = "";
}

/*=========================================
        SEARCH NAME VALIDATION (real-time)
        letters + spaces only, matches the
        pattern="^[A-Za-z ]+$" already on the input
=========================================*/

const searchNameInput = form.querySelector('input[name="search"]');
let searchNameError = document.getElementById("search-name-error");

if (searchNameInput && !searchNameError) {
    searchNameError = document.createElement("small");
    searchNameError.id = "search-name-error";
    searchNameError.className = "text-danger";
    searchNameInput.insertAdjacentElement("afterend", searchNameError);
}

function validateSearchName() {

    if (!searchNameInput) return true;

    const value = searchNameInput.value.trim();

    // empty is fine - name is an optional filter
    if (value === "") {
        clearFieldError(searchNameInput, searchNameError);
        return true;
    }

    if (!/^[A-Za-z ]+$/.test(value)) {
        showFieldError(searchNameInput, searchNameError, "Only letters are allowed.");
        return false;
    }

    clearFieldError(searchNameInput, searchNameError);
    return true;
}

if (searchNameInput) {

    searchNameInput.addEventListener("input", function () {
        // strip anything that isn't a letter or space as they type
        this.value = this.value.replace(/[^A-Za-z ]/g, "");
        validateSearchName();
    });

    searchNameInput.addEventListener("blur", validateSearchName);
}

/*=========================================
        SEARCH ID VALIDATION (real-time)
        digits only, max 5 digits, matches
        the pattern="^\d{1,5}$" already on the input
=========================================*/

const searchIdInput = form.querySelector('input[name="id"]');
let searchIdError = document.getElementById("search-id-error");

if (searchIdInput && !searchIdError) {
    searchIdError = document.createElement("small");
    searchIdError.id = "search-id-error";
    searchIdError.className = "text-danger";
    searchIdInput.insertAdjacentElement("afterend", searchIdError);
}

function validateSearchId() {

    if (!searchIdInput) return true;

    const value = searchIdInput.value.trim();

    // empty is fine - ID is an optional filter
    if (value === "") {
        clearFieldError(searchIdInput, searchIdError);
        return true;
    }

    if (!/^\d{1,5}$/.test(value)) {
        showFieldError(searchIdInput, searchIdError, "Enter up to 5 digits only.");
        return false;
    }

    clearFieldError(searchIdInput, searchIdError);
    return true;
}

if (searchIdInput) {

    searchIdInput.addEventListener("input", function () {
        // strip anything non-digit and hard-cap at 5 digits as they type
        this.value = this.value.replace(/\D/g, "").substring(0, 5);
        validateSearchId();
    });

    searchIdInput.addEventListener("blur", validateSearchId);
}

/*=========================================
        SHARED: update the download form's
        hidden fields (search/id/course_name/batch)
        so Excel/PDF export always matches
        whatever is currently filtered on screen
=========================================*/

function syncDownloadHiddenFields(params) {

    const downloadForm = document.getElementById("downloadForm");
    if (!downloadForm) return;

    ["search", "id", "course_name", "batch"].forEach(function (key) {
        const hidden = downloadForm.querySelector('input[name="' + key + '"]');
        if (hidden) {
            hidden.value = params.get(key) || "";
        }
    });
}

/*=========================================
        SHARED: swap the table / counts /
        pagination from a fetched page into
        the current DOM, without a full reload
=========================================*/

function swapOne(selector, doc) {

    const current = document.querySelector(selector);
    const incoming = doc.querySelector(selector);

    // guard: if either side is missing this element, skip it quietly
    // instead of throwing (which used to trip the catch() and show a
    // false "something went wrong" message even when the fetch worked).
    if (current && incoming) {
        current.innerHTML = incoming.innerHTML;
    }
}

function swapListingFromDoc(doc) {

    // TABLE UPDATE
    swapOne(".table-wrapper", doc);

    // TOTAL STUDENTS UPDATE
    swapOne(".total-count", doc);

    // PAGINATION INFO UPDATE ("Showing X to Y of Z students")
    swapOne(".pagination-info", doc);

    // PAGINATION BUTTONS UPDATE
    // NOTE: the actual class in student_list.html is ".pagination-right",
    // not ".pagination-buttons" - that mismatch was throwing on every
    // AJAX swap and triggering the red error message below.
    swapOne(".pagination-right", doc);
}

/*=========================================
        FILTER / SEARCH (AJAX)
        Builds the query string from the form,
        validates it, fetches the filtered page,
        and swaps the table in-place - same
        pattern as the Reset button below.
=========================================*/

function runFilterSearch(url) {

    fetch(url)
        .then(response => response.text())
        .then(data => {

            const parser = new DOMParser();
            const doc = parser.parseFromString(data, "text/html");

            swapListingFromDoc(doc);

            const params = new URL(url, window.location.origin).searchParams;
            syncDownloadHiddenFields(params);
        })
        .catch(() => {
            error.innerText = "Something went wrong while searching. Please try again.";
            error.style.color = "red";
        });
}

form.addEventListener("submit", function (e) {

    // always AJAX - never let this do a normal full-page GET
    e.preventDefault();

    const inputs = form.querySelectorAll("input");
    const selects = form.querySelectorAll("select");

    let hasValue = false;

    // CHECK INPUTS
    inputs.forEach(input => {
        if (input.type !== "hidden" && input.value.trim() !== "") {
            hasValue = true;
        }
    });

    // CHECK SELECTS
    selects.forEach(select => {
        if (select.value.trim() !== "") {
            hasValue = true;
        }
    });

    // FORMAT CHECKS (letters-only name, digits-only id)
    const validName = validateSearchName();
    const validId = validateSearchId();

    // ALL EMPTY
    if (!hasValue) {

        error.innerText = "Enter at least one filter";
        error.style.color = "red";
        return;
    }

    if (!validName || !validId) {

        const firstError = form.querySelector(".error-input");
        if (firstError) {
            firstError.scrollIntoView({ behavior: "smooth", block: "center" });
            firstError.focus();
        }
        return;
    }

    error.innerText = "";

    // BUILD QUERY STRING (skip empty fields to keep the URL clean)
    const params = new URLSearchParams();

    inputs.forEach(input => {
        if (input.name && input.value.trim() !== "") {
            params.set(input.name, input.value.trim());
        }
    });

    selects.forEach(select => {
        if (select.name && select.value.trim() !== "") {
            params.set(select.name, select.value.trim());
        }
    });

    const newUrl = window.location.pathname + "?" + params.toString();

    // UPDATE ADDRESS BAR (so refresh/back keeps the filter)
    window.history.pushState({}, document.title, newUrl);

    runFilterSearch(newUrl);
});


// RESET
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
    if (searchNameError) searchNameError.innerText = "";
    if (searchIdError) searchIdError.innerText = "";

    // URL: batch irundha adhai vachirukkanum
    window.history.replaceState({}, document.title, baseUrl);

    fetch(baseUrl)
        .then(response => response.text())
        .then(data => {

            const parser = new DOMParser();
            const doc = parser.parseFromString(data, "text/html");

            swapListingFromDoc(doc);

            // download form hidden fields-ah reset pannu, batch mattum vachuko
            const keep = new URLSearchParams();
            if (lockedBatch) keep.set("batch", lockedBatch);
            syncDownloadHiddenFields(keep);
        });

});
