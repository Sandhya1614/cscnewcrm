// ============================================================
// STUDENT REGISTER PAGE - FULL UPDATED JAVASCRIPT
// ============================================================
// Includes:
// 1. Name validation
// 2. Email validation + duplicate check
// 3. Student phone validation + duplicate check
// 4. Guardian phone validation + duplicate check
// 5. DOB validation - minimum 18 years
// 6. Start/Admission Date - TODAY + PREVIOUS 1 MONTH ONLY
// 7. Course -> Duration/Fee auto fill
// 8. Course -> Batch AJAX loading
// 9. Gender / Address / Course / Batch validation
// 10. Photo validation
// 11. ID Proof / Certificate validation
// 12. Server-side error mapping
// 13. Automatic scroll to first error
// 14. AJAX form submit
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("studentForm");

    if (!form) return;

    // ============================================================
    // INPUTS
    // ============================================================

    const firstNameInput = document.getElementById("id_first_name");
    const lastNameInput = document.getElementById("id_last_name");
    const guardianNameInput = document.getElementById("id_guardian_name");
    const educationalQualificationInput = document.getElementById("id_educational_qualification");

    const emailInput = document.getElementById("id_email");

    const phoneInput = document.getElementById("id_phone_no");
    const guardianPhoneInput = document.getElementById("id_guardian_phone_no");

    const dobInput = document.getElementById("id_dob");
    const admissionDateInput = document.getElementById("id_start_date");

    const genderInput = document.getElementById("id_gender");
    const addressInput = document.getElementById("id_address");

    const courseInput = document.getElementById("id_course");
    const batchInput = document.getElementById("id_batch");

    const durationInput = document.getElementById("duration");
    const feeInput = document.getElementById("fee");

    const photoInput = document.getElementById("id_photo");
    const idProofInput = document.getElementById("idProofInput");
    const certificateInput = document.getElementById("certificateInput");

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

    const photoProgressBar =
        document.getElementById("photoProgressBar");

    const photoProgressText =
        document.getElementById("PhotoProgressText");

    const removePhotoBtn =
        document.getElementById("removePhotoBtn");

    const idProofProgressBar =
        document.getElementById("idProofProgressBar");

    const idProofProgressText =
        document.getElementById("idProofProgressText");

    const removeIdProofBtn =
        document.getElementById("removeIdProofBtn");

    const certificateProgressBar =
        document.getElementById("certificateProgressBar");

    const certificateProgressText =
        document.getElementById("certificateProgressText");

    const removeCertificateBtn =
        document.getElementById("removeCertificateBtn");

    const submitBtn =
        form.querySelector('button[type="submit"]');


    // ============================================================
    // NULL SAFETY
    // ============================================================

    if (!firstNameInput ||
        !lastNameInput ||
        !guardianNameInput ||
        !emailInput ||
        !phoneInput ||
        !guardianPhoneInput ||
        !dobInput ||
        !admissionDateInput ||
        !genderInput ||
        !addressInput ||
        !educationalQualificationInput ||
        !courseInput ||
        !batchInput) {

        console.warn("Some Student Register fields are missing.");
    }


    // ============================================================
    // PLACEHOLDERS
    // ============================================================

    if (emailInput) {
        emailInput.placeholder = "e.g. name@example.com";
    }

    if (phoneInput) {
    phoneInput.placeholder = "10 digit mobile number";
    phoneInput.setAttribute("maxlength", "10");
    phoneInput.setAttribute("inputmode", "numeric");
    }

    if (guardianPhoneInput) {
    guardianPhoneInput.placeholder = "10 digit mobile number";
    guardianPhoneInput.setAttribute("maxlength", "10");
    guardianPhoneInput.setAttribute("inputmode", "numeric");
    }


    // ============================================================
    // REGEX
    // ============================================================

    const nameRegex = /^[A-Za-z ]+$/;

    const basicEmailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    const indianPhonePattern = /^[6-9]\d{9}$/;


    const allowedDomainEndings = [
        ".com",
        ".in",
        ".co.in",
        ".org",
        ".org.in",
        ".net",
        ".edu",
        ".edu.in",
        ".ac.in"
    ];


    // ============================================================
    // STATIC ERROR SPANS
    // ============================================================

    const staticErrorIds = {

        id_email:
            "email-error",

        id_phone_no:
            "phone-error",

        id_guardian_phone_no:
            "guardian-phone-error",

        id_photo:
            "photo-error",

        idProofInput:
            "idproof-error",

        certificateInput:
            "certificate-error"
    };


    // ============================================================
    // GET ERROR SPAN
    // ============================================================

    function getStaticErrorSpan(input) {

        if (!input) return null;

        const id = staticErrorIds[input.id];

        return id
            ? document.getElementById(id)
            : null;
    }


    // ============================================================
    // SHOW ERROR
    // ============================================================

    function showError(input, message) {

        if (!input) return;

        input.classList.add("error-input");

        const staticSpan =
            getStaticErrorSpan(input);

        if (staticSpan) {

            staticSpan.textContent = message;

            return;
        }

        let error =
            input.parentElement?.querySelector(".custom-error");

        if (!error) {

            error = document.createElement("span");

            error.className =
                "custom-error error";

            input.parentElement.appendChild(error);
        }

        error.textContent = message;
    }


    // ============================================================
    // CLEAR ERROR
    // ============================================================

    function clearError(input) {

        if (!input) return;

        input.classList.remove("error-input");

        const staticSpan =
            getStaticErrorSpan(input);

        if (staticSpan) {

            staticSpan.textContent = "";

            return;
        }

        const error =
            input.parentElement?.querySelector(".custom-error");

        if (error) {

            error.textContent = "";
        }
    }


    // ============================================================
    // SCROLL TO FIRST ERROR
    // ============================================================

    function scrollToFirstError() {

        const firstError =
            document.querySelector(".error-input");

        if (!firstError) return;

        setTimeout(() => {

            firstError.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            setTimeout(() => {

                try {
                    firstError.focus({
                        preventScroll: true
                    });
                } catch (err) {
                    firstError.focus();
                }

            }, 400);

        }, 100);
    }


    // ============================================================
    // PHONE SANITIZATION
    // ============================================================

    function sanitizeIndianPhone(input) {

    if (!input) return;

    // Only digits, max 10
    input.value = input.value
        .replace(/\D/g, "")
        .substring(0, 10);
    }


    // ============================================================
    // PHONE KEYBOARD VALIDATION
    // ============================================================

    function attachPhoneKeyboardValidation(input) {

    if (!input) return;

    input.addEventListener("keydown", function (e) {

        const allowedKeys = [
            "Backspace", "Delete",
            "ArrowLeft", "ArrowRight",
            "ArrowUp", "ArrowDown",
            "Tab", "Home", "End"
        ];

        if (allowedKeys.includes(e.key)) return;

        // Ctrl/Cmd shortcuts (copy, paste, select all)
        if (e.ctrlKey || e.metaKey) return;

        if (/^[0-9]$/.test(e.key)) {

            // First digit must be 6-9
            if (this.selectionStart === 0 && !/[6-9]/.test(e.key)) {
                e.preventDefault();
                return;
            }

            // Max 10 digits
            if (
                this.value.length >= 10 &&
                this.selectionStart === this.selectionEnd
            ) {
                e.preventDefault();
            }

            return;
        }

        e.preventDefault();
    });
    }

    // ============================================================
    // PHONE PASTE VALIDATION
    // ============================================================

    function attachPhonePasteValidation(
        input,
        validateFunction
    ) {

        if (!input) return;

        input.addEventListener("paste", function (e) {

            e.preventDefault();

            let pasted =
                (e.clipboardData || window.clipboardData)
                    .getData("text");

            pasted = pasted.replace(/\D/g, "");


            if (pasted.length > 10 && pasted.startsWith("91")) {
                pasted = pasted.substring(2);
            }
            if (pasted.length > 10 && pasted.startsWith("0")) {
                 pasted = pasted.substring(1);
            }

            pasted = pasted.substring(0, 10);

            const start =
                this.selectionStart;

            const end =
                this.selectionEnd;

            this.value =
                this.value.substring(0, start) +
                pasted +
                this.value.substring(end);

            sanitizeIndianPhone(this);

            if (typeof validateFunction === "function") {
                validateFunction();
            }
        });
    }


    // ============================================================
    // GET PHONE VALUE
    // ============================================================

    function getPhoneValue(input) {

        if (!input) return "";

        return input.value.trim();
    }


    // ============================================================
    // COURSE DETAILS AUTO FILL
    // ============================================================

    function updateCourseDetails() {

        if (!courseInput) return;

        const selected =
            courseInput.options[
                courseInput.selectedIndex
            ];

        if (!selected) return;

        if (durationInput) {

            durationInput.value =
                selected.dataset.duration || "";
        }

        if (feeInput) {

            feeInput.value =
                selected.dataset.fee || "";
        }
    }


    if (courseInput) {

        courseInput.addEventListener(
            "change",
            updateCourseDetails
        );

        updateCourseDetails();
    }


    // ============================================================
    // COURSE -> BATCH AJAX
    // ============================================================

    async function loadBatches(courseId, selectedBatchId) {

        if (!batchInput) return;

        batchInput.innerHTML = '<option value="">Loading...</option>';

        if (!courseId) {
            batchInput.innerHTML = '<option value="">Select Batch</option>';
            return;
        }

        try {
            const response = await fetch(
                `/api/get-batches/?course_id=${encodeURIComponent(courseId)}`
            );

            if (!response.ok) {
                throw new Error("Unable to load batches");
            }

            const batches = await response.json();

            batchInput.innerHTML = '<option value="">Select Batch</option>';

            batches.forEach(batch => {
                const option = document.createElement("option");
                option.value = batch.id;
                option.textContent = batch.batch_name;
                batchInput.appendChild(option);
            });

            if (selectedBatchId) {
                batchInput.value = String(selectedBatchId);
            }

        } catch (err) {
            console.error(err);
            batchInput.innerHTML =
                '<option value="">Unable to load batches</option>';
        }
    }

    if (courseInput && batchInput) {
        courseInput.addEventListener("change", () => {
            loadBatches(courseInput.value);
        });
    }


    // ============================================================
    // LOCKED COURSE + BATCH
    // (opened from a batch's student list -> Add New Student)
    // ============================================================

    const lockedCourseId = form.dataset.lockedCourse;
    const lockedBatchId = form.dataset.lockedBatch;

    function lockSelect(select) {

        if (!select || select.dataset.locked) return;

        // disabled selects are NOT submitted, so keep a hidden copy
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = select.name;
        hidden.value = select.value;

        select.insertAdjacentElement("afterend", hidden);

        select.disabled = true;
        select.dataset.locked = "1";
        select.classList.add("locked-field");
    }

    async function applyLockedSelection() {

        if (!lockedCourseId || !lockedBatchId) return;

        courseInput.value = lockedCourseId;
        updateCourseDetails();

        await loadBatches(lockedCourseId, lockedBatchId);

        lockSelect(courseInput);
        lockSelect(batchInput);
    }

    applyLockedSelection();

    // "Clear Form" resets everything, so put the locked values back
    form.addEventListener("reset", () => {

        if (!lockedCourseId || !lockedBatchId) return;

        setTimeout(() => {
            courseInput.value = lockedCourseId;
            batchInput.value = lockedBatchId;
            updateCourseDetails();
        }, 0);
    });


    // ============================================================
    // NAME VALIDATION
    // ============================================================

    function validateName(input, label) {

        if (!input) return true;

        const value =
            input.value.trim();

        if (value === "") {

            showError(
                input,
                `${label} is required.`
            );

            return false;
        }

        if (!nameRegex.test(value)) {

            showError(
                input,
                `${label} should contain only alphabets.`
            );

            return false;
        }

        clearError(input);

        return true;
    }


    // ============================================================
    // LETTER ONLY INPUT
    // ============================================================

    function bindLetterOnly(input, label) {

        if (!input) return;

        input.addEventListener(
            "input",
            () => {

                input.value =
                    input.value.replace(
                        /[^A-Za-z ]/g,
                        ""
                    );

                validateName(
                    input,
                    label
                );
            }
        );

        input.addEventListener(
            "blur",
            () => {
                validateName(input, label);
            }
        );
    }


    bindLetterOnly(
        firstNameInput,
        "First Name"
    );

    bindLetterOnly(
        lastNameInput,
        "Last Name"
    );

    bindLetterOnly(
        guardianNameInput,
        "Guardian Name"
    );

    bindLetterOnly(
        educationalQualificationInput,
        "Educational Qualification"
    );


    // ============================================================
    // EMAIL VALIDATION
    // ============================================================

    function validateEmailFormat() {

        if (!emailInput) return false;

        const email =
            emailInput.value
                .trim()
                .toLowerCase();

        if (email === "") {

            showError(
                emailInput,
                "Email is required."
            );

            return false;
        }

        if (!email.includes("@")) {

            showError(
                emailInput,
                "Email must contain '@' symbol."
            );

            return false;
        }

        const parts =
            email.split("@");

        if (parts.length !== 2) {

            showError(
                emailInput,
                "Email can contain only one '@' symbol."
            );

            return false;
        }

        const username = parts[0];
        const domain = parts[1];

        if (username === "") {

            showError(
                emailInput,
                "Enter characters before '@'."
            );

            return false;
        }

        if (domain === "") {

            showError(
                emailInput,
                "Enter a domain after '@'."
            );

            return false;
        }

        if (!domain.includes(".")) {

            showError(
                emailInput,
                "Domain must contain a valid extension."
            );

            return false;
        }

        if (domain.startsWith(".")) {

            showError(
                emailInput,
                "Domain cannot start with '.'."
            );

            return false;
        }

        if (domain.endsWith(".")) {

            showError(
                emailInput,
                "Domain cannot end with '.'."
            );

            return false;
        }

        if (!basicEmailPattern.test(email)) {

            showError(
                emailInput,
                "Please enter a valid email address."
            );

            return false;
        }

        const isAllowedDomain =
            allowedDomainEndings.some(
                ending =>
                    domain.endsWith(ending)
            );

        if (!isAllowedDomain) {

            showError(
                emailInput,
                "Allowed domains: .com, .in, .co.in, .org, .org.in, .net, .edu, .edu.in, .ac.in."
            );

            return false;
        }

        clearError(emailInput);

        return true;
    }


    // ============================================================
    // DUPLICATE EMAIL
    // ============================================================

    async function checkDuplicateEmail() {

        if (!validateEmailFormat()) {
            return false;
        }

        try {

            const response =
                await fetch(
                    `/admission/check-email/?email=${encodeURIComponent(
                        emailInput.value.trim()
                    )}`
                );

            const data =
                await response.json();

            if (data.exists) {

                showError(
                    emailInput,
                    "Email already exists."
                );

                return false;
            }

            clearError(emailInput);

            return true;

        } catch (err) {

            console.error(err);

            showError(
                emailInput,
                "Unable to verify email right now."
            );

            return false;
        }
    }


    emailInput.addEventListener(
        "input",
        validateEmailFormat
    );

    emailInput.addEventListener(
        "blur",
        async () => {
            await checkDuplicateEmail();
        }
    );


    // ============================================================
    // STUDENT PHONE VALIDATION
    // ============================================================

    function validatePhoneFormat() {

        const phone =
            getPhoneValue(phoneInput);

        if (phone === "") {

            showError(
                phoneInput,
                "Phone number is required."
            );

            return false;
        }

        if (!indianPhonePattern.test(phone)) {

            showError(
                phoneInput,
                "Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9."
            );

            return false;
        }

        clearError(phoneInput);

        return true;
    }


    // ============================================================
    // DUPLICATE STUDENT PHONE
    // ============================================================

    async function checkDuplicatePhone() {

        if (!validatePhoneFormat()) {
            return false;
        }

        const phone =
            getPhoneValue(phoneInput);

        try {

            const response =
                await fetch(
                    `/admission/check-phone/?phone=${encodeURIComponent(
                        phone
                    )}`
                );

            const data =
                await response.json();

            if (data.exists || data.guardian_exists) {
                showError(phoneInput,"Phone number already exists.");

                return false;
        }

            clearError(phoneInput);

            return true;

        } catch (err) {

            console.error(err);

            showError(
                phoneInput,
                "Unable to verify phone number right now."
            );

            return false;
        }
    }


    phoneInput.addEventListener(
        "input",
        () => {

            sanitizeIndianPhone(phoneInput);

            validatePhoneFormat();

            if (
                guardianPhoneInput &&
                guardianPhoneInput.value.trim() !== ""
            ) {

                validateGuardianPhoneFormat();
            }
        }
    );


    phoneInput.addEventListener(
        "focus",
        () => {
            validatePhoneFormat();
        }
    );


    phoneInput.addEventListener(
        "blur",
        async () => {
            await checkDuplicatePhone();
        }
    );


    attachPhoneKeyboardValidation(
        phoneInput
    );

    attachPhonePasteValidation(
        phoneInput,
        validatePhoneFormat
    );


    // ============================================================
    // GUARDIAN PHONE VALIDATION
    // ============================================================

    function validateGuardianPhoneFormat() {

        const phone =
            getPhoneValue(
                guardianPhoneInput
            );

        const studentPhone =
            getPhoneValue(
                phoneInput
            );

        if (phone === "") {

            showError(
                guardianPhoneInput,
                "Guardian phone number is required."
            );

            return false;
        }

        if (!indianPhonePattern.test(phone)) {

            showError(
                guardianPhoneInput,
                "Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9."
            );

            return false;
        }

        if (
            phone === studentPhone &&
            studentPhone !== ""
        ) {

            showError(
                guardianPhoneInput,
                "Guardian phone number cannot be the same as the student's phone number."
            );

            return false;
        }

        clearError(
            guardianPhoneInput
        );

        return true;
    }


    // ============================================================
    // DUPLICATE GUARDIAN PHONE
    // ============================================================

    async function checkDuplicateGuardianPhone() {

        if (!validateGuardianPhoneFormat()) {
            return false;
        }

        const phone =
            getPhoneValue(
                guardianPhoneInput
            );

        try {

            const response =
                await fetch(
                    `/admission/check-phone/?phone=${encodeURIComponent(
                        phone
                    )}`
                );

            const data =
                await response.json();

            if (data.guardian_exists || data.exists) {
                showError(guardianPhoneInput, "Guardian phone number already exists.");

                return false;
           }

            clearError(
                guardianPhoneInput
            );

            return true;

        } catch (err) {

            console.error(err);

            showError(
                guardianPhoneInput,
                "Unable to verify guardian phone right now."
            );

            return false;
        }
    }


    guardianPhoneInput.addEventListener(
        "input",
        () => {

            sanitizeIndianPhone(
                guardianPhoneInput
            );

            validateGuardianPhoneFormat();
        }
    );


    guardianPhoneInput.addEventListener(
        "focus",
        () => {
            validateGuardianPhoneFormat();
        }
    );


    guardianPhoneInput.addEventListener(
        "blur",
        async () => {
            await checkDuplicateGuardianPhone();
        }
    );


    attachPhoneKeyboardValidation(
        guardianPhoneInput
    );

    attachPhonePasteValidation(
        guardianPhoneInput,
        validateGuardianPhoneFormat
    );


    // ============================================================
    // DATE SETUP
    // ============================================================

    const today = new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    // ============================================================
    // FORMAT DATE -> YYYY-MM-DD
    // ============================================================

    function formatDate(date) {

        return (
            date.getFullYear() +
            "-" +
            String(
                date.getMonth() + 1
            ).padStart(2, "0") +
            "-" +
            String(
                date.getDate()
            ).padStart(2, "0")
        );
    }


    // ============================================================
    // TODAY DATE
    // ============================================================

    const todayString =
        formatDate(today);


    // ============================================================
    // PREVIOUS ONE MONTH DATE
    // ============================================================

    const previousMonthDate =
        new Date(today);

    previousMonthDate.setMonth(
        previousMonthDate.getMonth() - 1
    );

    /*
        Example:

        Today = 20-Aug-2026

        Accepted:
        20-Jul-2026
        21-Jul-2026
        ...
        20-Aug-2026

        Restricted:
        19-Jul-2026 and older
        21-Aug-2026 and future
    */

    const minimumStartDate =
        formatDate(previousMonthDate);


    // ============================================================
    // DOB
    // ============================================================

    if (dobInput) {

        dobInput.max =
            todayString;
    }


    // ============================================================
    // START / ADMISSION DATE
    // ============================================================

    if (admissionDateInput) {

        // ONLY PREVIOUS 1 MONTH -> TODAY
        admissionDateInput.min =
            minimumStartDate;

        admissionDateInput.max =
            todayString;

        // If existing value is outside allowed range,
        // automatically reset it to today.
        if (
            admissionDateInput.value &&
            (
                admissionDateInput.value <
                minimumStartDate ||
                admissionDateInput.value >
                todayString
            )
        ) {

            admissionDateInput.value =
                todayString;
        }

        // If empty, default to today
        if (!admissionDateInput.value) {

            admissionDateInput.value =
                todayString;
        }
    }


    // ============================================================
    // DATE PICKER
    // ============================================================

    function enablePicker(input) {

        if (!input) return;

        input.addEventListener(
            "click",
            () => {

                if (
                    typeof input.showPicker ===
                    "function"
                ) {

                    try {
                        input.showPicker();
                    } catch (err) {
                        // Browser may block showPicker
                    }
                }
            }
        );
    }


    enablePicker(dobInput);
    enablePicker(admissionDateInput);


    // ============================================================
    // CALCULATE AGE
    // ============================================================

    function calculateAge(dob) {

        let age =
            today.getFullYear() -
            dob.getFullYear();

        const month =
            today.getMonth() -
            dob.getMonth();

        if (
            month < 0 ||
            (
                month === 0 &&
                today.getDate() <
                dob.getDate()
            )
        ) {

            age--;
        }

        return age;
    }


    // ============================================================
    // DOB VALIDATION
    // ============================================================

    function validateDOB() {

        if (!dobInput) return true;

        if (dobInput.value === "") {

            showError(
                dobInput,
                "Date of birth is required."
            );

            return false;
        }

        const dob =
            new Date(
                dobInput.value +
                "T00:00:00"
            );

        if (dob > today) {

            showError(
                dobInput,
                "Date of birth cannot be in the future."
            );

            return false;
        }

        if (calculateAge(dob) < 18) {

            showError(
                dobInput,
                "Student must be at least 18 years old."
            );

            return false;
        }

        clearError(dobInput);

        return true;
    }


    // ============================================================
    // START / ADMISSION DATE VALIDATION
    // ============================================================

    function validateAdmissionDate() {

        if (!admissionDateInput) {
            return true;
        }

        if (admissionDateInput.value === "") {

            showError(
                admissionDateInput,
                "Admission date is required."
            );

            return false;
        }

        const selectedDate =
            new Date(
                admissionDateInput.value +
                "T00:00:00"
            );

        const minimumDate =
            new Date(
                minimumStartDate +
                "T00:00:00"
            );

        const maximumDate =
            new Date(
                todayString +
                "T00:00:00"
            );


        // --------------------------------------------------------
        // FUTURE DATE
        // --------------------------------------------------------

        if (selectedDate > maximumDate) {

            showError(
                admissionDateInput,
                "Admission date cannot be in the future."
            );

            return false;
        }


        // --------------------------------------------------------
        // OLDER THAN ONE MONTH
        // --------------------------------------------------------

        if (selectedDate < minimumDate) {

            showError(
                admissionDateInput,
                "Admission date must be within the previous 1 month."
            );

            return false;
        }


        clearError(
            admissionDateInput
        );

        return true;
    }


    if (dobInput) {

        dobInput.addEventListener(
            "change",
            validateDOB
        );

        dobInput.addEventListener(
            "blur",
            validateDOB
        );
    }


    if (admissionDateInput) {

        admissionDateInput.addEventListener(
            "change",
            validateAdmissionDate
        );

        admissionDateInput.addEventListener(
            "blur",
            validateAdmissionDate
        );
    }


    // ============================================================
    // GENDER VALIDATION
    // ============================================================

    function validateGender() {

        if (!genderInput) return true;

        if (
            genderInput.value.trim() === ""
        ) {

            showError(
                genderInput,
                "Please select a gender."
            );

            return false;
        }

        clearError(genderInput);

        return true;
    }


    // ============================================================
    // ADDRESS VALIDATION
    // ============================================================

    function validateAddress() {

        if (!addressInput) return true;

        if (
            addressInput.value.trim() === ""
        ) {

            showError(
                addressInput,
                "Address is required."
            );

            return false;
        }

        clearError(addressInput);

        return true;
    }


    // ============================================================
    // COURSE VALIDATION
    // ============================================================

    function validateCourse() {

        if (!courseInput) return true;

        if (courseInput.value === "") {

            showError(
                courseInput,
                "Please select a course."
            );

            return false;
        }

        clearError(courseInput);

        return true;
    }


    // ============================================================
    // BATCH VALIDATION
    // ============================================================

    function validateBatch() {

        if (!batchInput) return true;

        if (batchInput.value === "") {

            showError(
                batchInput,
                "Please select a batch."
            );

            return false;
        }

        clearError(batchInput);

        return true;
    }


    if (genderInput) {

        genderInput.addEventListener(
            "change",
            validateGender
        );

        genderInput.addEventListener(
            "blur",
            validateGender
        );
    }


    if (addressInput) {

        addressInput.addEventListener(
            "input",
            validateAddress
        );

        addressInput.addEventListener(
            "blur",
            validateAddress
        );
    }


    if (courseInput) {

        courseInput.addEventListener(
            "change",
            validateCourse
        );

        courseInput.addEventListener(
            "blur",
            validateCourse
        );
    }


    if (batchInput) {

        batchInput.addEventListener(
            "change",
            validateBatch
        );

        batchInput.addEventListener(
            "blur",
            validateBatch
        );
    }


    // ============================================================
    // PHOTO VALIDATION
    // ============================================================

    function validatePhoto() {

        if (!photoInput) return true;

        clearError(photoInput);

        if (
            !photoInput.files ||
            photoInput.files.length === 0
        ) {

            return true;
        }

        const file =
            photoInput.files[0];

        const allowed = [
            "image/jpeg",
            "image/jpg",
            "image/png"
        ];


        if (!allowed.includes(file.type)) {

            showError(
                photoInput,
                "Only JPG, JPEG and PNG are allowed."
            );

            photoInput.value = "";

            return false;
        }


        if (file.size > MAX_PHOTO_SIZE) {

            showError(
                photoInput,
                "Photo must be below 2MB."
            );

            photoInput.value = "";

            return false;
        }

        return true;
    }


    // ============================================================
    // SINGLE FILE UI
    // ============================================================

    function handleSingleFileChange(
        input,
        progressBar,
        progressText,
        removeBtn
    ) {

        clearError(input);

        if (
            !input.files ||
            input.files.length === 0
        ) {

            progressBar.style.width =
                "0%";

            progressText.textContent =
                "No file selected";

            removeBtn.style.display =
                "none";

            return;
        }


        const file =
            input.files[0];

        const allowed = [
            "image/jpeg",
            "image/jpg",
            "image/png"
        ];


        if (!allowed.includes(file.type)) {

            showError(
                input,
                "Only JPG, JPEG and PNG are allowed."
            );

            input.value = "";

            progressBar.style.width =
                "0%";

            progressText.textContent =
                "No file selected";

            removeBtn.style.display =
                "none";

            return;
        }


        if (file.size > MAX_PHOTO_SIZE) {

            showError(
                input,
                "Photo must be below 2MB."
            );

            input.value = "";

            progressBar.style.width =
                "0%";

            progressText.textContent =
                "No file selected";

            removeBtn.style.display =
                "none";

            return;
        }


        progressBar.style.width =
            "100%";

        progressText.textContent =
            file.name;

        removeBtn.style.display =
            "flex";
    }


    // ============================================================
    // DOCUMENT DATA TRANSFER
    // ============================================================

    let idProofFiles =
        new DataTransfer();

    let certificateFiles =
        new DataTransfer();


    const allowedExtensions = [
        "pdf",
        "doc",
        "docx"
    ];


    // ============================================================
    // DOCUMENT EXTENSION CHECK
    // ============================================================

    function isAllowedDocument(file) {

        const ext =
            file.name
                .split(".")
                .pop()
                .toLowerCase();

        return allowedExtensions.includes(ext);
    }


    // ============================================================
    // DOCUMENT UI
    // ============================================================

    function updateDocumentUI(
        store,
        progressBar,
        progressText,
        removeBtn
    ) {

        const fileCount =
            store.files.length;

        if (fileCount > 0) {

            removeBtn.style.display =
                "flex";

            progressBar.style.width =
                "100%";

            progressText.textContent =
                `${fileCount} file(s) selected`;

        } else {

            removeBtn.style.display =
                "none";

            progressBar.style.width =
                "0%";

            progressText.textContent =
                "No file selected";
        }
    }


    // ============================================================
    // MULTIPLE DOCUMENT FILE CHANGE
    // ============================================================

    function handleMultipleFileChange(
        input,
        store,
        progressBar,
        progressText,
        removeBtn
    ) {

        if (
            !input.files ||
            input.files.length === 0
        ) {

            input.files =
                store.files;

            updateDocumentUI(
                store,
                progressBar,
                progressText,
                removeBtn
            );

            return;
        }


        let hasInvalidFile =
            false;


        Array.from(input.files)
            .forEach(file => {

                if (!isAllowedDocument(file)) {

                    hasInvalidFile =
                        true;

                    return;
                }


                if (
                    file.size >
                    MAX_FILE_SIZE
                ) {

                    return;
                }


                const exists =
                    Array.from(
                        store.files
                    ).some(existingFile =>

                        existingFile.name ===
                            file.name &&

                        existingFile.size ===
                            file.size &&

                        existingFile.lastModified ===
                            file.lastModified
                    );


                if (!exists) {

                    store.items.add(file);
                }
            });


        input.files =
            store.files;


        updateDocumentUI(
            store,
            progressBar,
            progressText,
            removeBtn
        );


        if (hasInvalidFile) {

            showError(
                input,
                "Only PDF, DOC, and DOCX files are allowed."
            );

            return;
        }


        clearError(input);
    }


    // ============================================================
    // DOCUMENT VALIDATION
    // ============================================================

    function validateDocument(
        input,
        store
    ) {

        if (!input) return true;

        const invalidFile =
            Array.from(
                store.files
            ).find(
                file =>
                    !isAllowedDocument(file)
            );


        if (invalidFile) {

            showError(
                input,
                "Only PDF, DOC, and DOCX files are allowed."
            );

            return false;
        }


        const oversizedFile =
            Array.from(
                store.files
            ).find(
                file =>
                    file.size >
                    MAX_FILE_SIZE
            );


        if (oversizedFile) {

            showError(
                input,
                "Each file must be less than 5 MB."
            );

            return false;
        }


        clearError(input);

        return true;
    }


    // ============================================================
    // PHOTO CHANGE
    // ============================================================

    if (
        photoInput &&
        photoProgressBar &&
        photoProgressText &&
        removePhotoBtn
    ) {

        photoInput.addEventListener(
            "change",
            () => {

                handleSingleFileChange(
                    photoInput,
                    photoProgressBar,
                    photoProgressText,
                    removePhotoBtn
                );
            }
        );
    }


    // ============================================================
    // ID PROOF CHANGE
    // ============================================================

    if (
        idProofInput &&
        idProofProgressBar &&
        idProofProgressText &&
        removeIdProofBtn
    ) {

        idProofInput.addEventListener(
            "change",
            () => {

                handleMultipleFileChange(
                    idProofInput,
                    idProofFiles,
                    idProofProgressBar,
                    idProofProgressText,
                    removeIdProofBtn
                );
            }
        );
    }


    // ============================================================
    // CERTIFICATE CHANGE
    // ============================================================

    if (
        certificateInput &&
        certificateProgressBar &&
        certificateProgressText &&
        removeCertificateBtn
    ) {

        certificateInput.addEventListener(
            "change",
            () => {

                handleMultipleFileChange(
                    certificateInput,
                    certificateFiles,
                    certificateProgressBar,
                    certificateProgressText,
                    removeCertificateBtn
                );
            }
        );
    }


    // ============================================================
    // REMOVE PHOTO
    // ============================================================

    if (removePhotoBtn) {

        removePhotoBtn.addEventListener(
            "click",
            () => {

                photoInput.value = "";

                photoProgressBar.style.width =
                    "0%";

                photoProgressText.textContent =
                    "No file selected";

                removePhotoBtn.style.display =
                    "none";

                clearError(photoInput);
            }
        );
    }


    // ============================================================
    // REMOVE ID PROOF
    // ============================================================

    if (removeIdProofBtn) {

        removeIdProofBtn.addEventListener(
            "click",
            () => {

                idProofFiles =
                    new DataTransfer();

                idProofInput.value = "";

                idProofInput.files =
                    idProofFiles.files;

                updateDocumentUI(
                    idProofFiles,
                    idProofProgressBar,
                    idProofProgressText,
                    removeIdProofBtn
                );

                clearError(
                    idProofInput
                );
            }
        );
    }


    // ============================================================
    // REMOVE CERTIFICATE
    // ============================================================

    if (removeCertificateBtn) {

        removeCertificateBtn.addEventListener(
            "click",
            () => {

                certificateFiles =
                    new DataTransfer();

                certificateInput.value =
                    "";

                certificateInput.files =
                    certificateFiles.files;

                updateDocumentUI(
                    certificateFiles,
                    certificateProgressBar,
                    certificateProgressText,
                    removeCertificateBtn
                );

                clearError(
                    certificateInput
                );
            }
        );
    }


    // ============================================================
    // SERVER ERROR FIELD MAPPING
    // ============================================================

    const fieldNameToInput = {

        first_name:
            firstNameInput,

        last_name:
            lastNameInput,

        email:
            emailInput,

        phone_no:
            phoneInput,

        dob:
            dobInput,

        gender:
            genderInput,

        guardian_name:
            guardianNameInput,

        guardian_phone_no:
            guardianPhoneInput,

        address:
            addressInput,

        photo:
            photoInput,

        course_name:
            courseInput,

        batch:
            batchInput,

        start_date:
            admissionDateInput,

        id_proof:
            idProofInput,

        certificate:
            certificateInput
    };


    // ============================================================
    // SERVER ERROR DISPLAY
    // ============================================================

    function showServerErrors(errors) {

        if (!errors) return;

        Object.keys(errors)
            .forEach(fieldName => {

                const input =
                    fieldNameToInput[fieldName];

                if (!input) return;

                const raw =
                    errors[fieldName];

                let message;

                if (Array.isArray(raw)) {

                    message =
                        raw[0];

                } else if (
                    typeof raw === "object" &&
                    raw !== null
                ) {

                    message =
                        JSON.stringify(raw);

                } else {

                    message =
                        raw;
                }


                showError(
                    input,
                    message
                );
            });
    }


    // ============================================================
    // SUBMIT HANDLER
    // ============================================================

    let isSubmitting = false;


    form.addEventListener(
        "submit",
        async function (e) {

            e.preventDefault();


            if (isSubmitting) {
                return;
            }


            // ====================================================
            // NORMALIZE PHONE VALUES
            // ====================================================

            sanitizeIndianPhone(
                phoneInput
            );

            sanitizeIndianPhone(
                guardianPhoneInput
            );


            // ====================================================
            // CLEAR OLD ERRORS
            // ====================================================

            document
                .querySelectorAll(".error-input")
                .forEach(input => {

                    input.classList.remove(
                        "error-input"
                    );
                });


            document
                .querySelectorAll(".custom-error")
                .forEach(error => {

                    error.textContent = "";
                });


            // ====================================================
            // STEP 1 - SYNCHRONOUS VALIDATION
            // ====================================================

            let valid = true;


            if (
                !validateName(
                    firstNameInput,
                    "First Name"
                )
            ) {

                valid = false;
            }


            if (
                !validateName(
                    lastNameInput,
                    "Last Name"
                )
            ) {

                valid = false;
            }


            if (
                !validateName(
                    guardianNameInput,
                    "Guardian Name"
                )
            ) {

                valid = false;
            }


            if (!validateGender()) {

                valid = false;
            }


            if (!validateAddress()) {

                valid = false;
            }


            if (!validateDOB()) {

                valid = false;
            }


            // IMPORTANT:
            // Start date accepts ONLY
            // previous 1 month -> today

            if (
                !validateAdmissionDate()
            ) {

                valid = false;
            }


            if (!validateCourse()) {

                valid = false;
            }


            if (!validateBatch()) {

                valid = false;
            }


            if (!validatePhoto()) {

                valid = false;
            }


            if (
                !validateDocument(
                    idProofInput,
                    idProofFiles
                )
            ) {

                valid = false;
            }


            if (
                !validateDocument(
                    certificateInput,
                    certificateFiles
                )
            ) {

                valid = false;
            }


            // ====================================================
            // EMAIL
            // ====================================================

            if (!validateEmailFormat()) {

                valid = false;
            }


            // ====================================================
            // STUDENT PHONE
            // ====================================================

            if (!validatePhoneFormat()) {

                valid = false;
            }


            // ====================================================
            // GUARDIAN PHONE
            // ====================================================

            if (
                !validateGuardianPhoneFormat()
            ) {

                valid = false;
            }


            // ====================================================
            // FILE SIZE CHECK
            // ====================================================

            if (idProofInput) {

                for (
                    const file of
                    idProofInput.files
                ) {

                    if (
                        file.size >
                        MAX_FILE_SIZE
                    ) {

                        showError(
                            idProofInput,
                            "Each ID Proof file must be less than 5 MB."
                        );

                        valid = false;

                        break;
                    }
                }
            }


            if (certificateInput) {

                for (
                    const file of
                    certificateInput.files
                ) {

                    if (
                        file.size >
                        MAX_FILE_SIZE
                    ) {

                        showError(
                            certificateInput,
                            "Each Certificate file must be less than 5 MB."
                        );

                        valid = false;

                        break;
                    }
                }
            }


            // ====================================================
            // STOP IF SYNCHRONOUS VALIDATION FAILED
            // ====================================================

            if (!valid) {

                scrollToFirstError();

                return;
            }


            // ====================================================
            // STEP 2 - ASYNC DUPLICATE CHECKS
            // ====================================================

            isSubmitting = true;


            if (submitBtn) {

                submitBtn.disabled =
                    true;

                submitBtn.dataset.originalText =
                    submitBtn.innerHTML;

                submitBtn.innerHTML =
                    "Checking...";
            }


            const isEmailValid =
                await checkDuplicateEmail();


            const isPhoneValid =
                await checkDuplicatePhone();


            const isGuardianPhoneValid =
                await checkDuplicateGuardianPhone();


            // ====================================================
            // DUPLICATE CHECK FAILED
            // ====================================================

            if (
                !isEmailValid ||
                !isPhoneValid ||
                !isGuardianPhoneValid
            ) {

                isSubmitting = false;


                if (submitBtn) {

                    submitBtn.disabled =
                        false;

                    submitBtn.innerHTML =
                        submitBtn.dataset.originalText;
                }


                // Automatically scroll to
                // the first duplicate error.

                scrollToFirstError();

                return;
            }


            // ====================================================
            // STEP 3 - AJAX SUBMIT
            // ====================================================

            if (submitBtn) {

                submitBtn.innerHTML =
                    '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }


            try {

                const formData =
                    new FormData(form);


                const response =
                    await fetch(
                        form.action,
                        {
                            method: "POST",

                            body: formData,

                            headers: {
                                "X-Requested-With":
                                    "XMLHttpRequest"
                            }
                        }
                    );


                const data =
                    await response.json();


                // =================================================
                // SUCCESS
                // =================================================

                if (data.success) {

                    window.location.href =
                        data.redirect_url ||
                        form.action;

                    return;
                }


                // =================================================
                // SERVER VALIDATION ERROR
                // =================================================

                showServerErrors(
                    data.errors
                );


                isSubmitting = false;


                if (submitBtn) {

                    submitBtn.disabled =
                        false;

                    submitBtn.innerHTML =
                        submitBtn.dataset.originalText;
                }


                // Automatically scroll to
                // first server error

                scrollToFirstError();


            } catch (err) {

                console.error(err);


                isSubmitting = false;


                if (submitBtn) {

                    submitBtn.disabled =
                        false;

                    submitBtn.innerHTML =
                        submitBtn.dataset.originalText;
                }


                alert(
                    "Something went wrong while saving. Please try again."
                );
            }
        }
    );

});