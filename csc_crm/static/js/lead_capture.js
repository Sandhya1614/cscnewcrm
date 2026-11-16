// ============================================================
// LEAD MANAGEMENT - COMPLETE JAVASCRIPT
// ============================================================


// ============================================================
// ONLY LETTERS
// ============================================================

function onlyLetters(input) {

    if (!input) return;

    input.value = input.value.replace(/[^A-Za-z\s]/g, "");
}


// ============================================================
// LEAD NAME VALIDATION
// ============================================================

function validateForm() {

    const nameInput =
        document.getElementById("id_lead_name") ||
        document.getElementById("lead_name");

    if (!nameInput) {
        return true;
    }

    const nameError =
        document.getElementById("name_error");

    const name = nameInput.value.trim();

    if (!name) {

        if (nameError) {
            nameError.innerText = "Please enter a name.";
        }

        return false;
    }

    if (!/^[A-Za-z\s]+$/.test(name)) {

        if (nameError) {
            nameError.innerText =
                "Name should contain letters only.";
        }

        return false;
    }

    if (nameError) {
        nameError.innerText = "";
    }

    return true;
}


// ============================================================
// DOM READY
// ============================================================

document.addEventListener("DOMContentLoaded", function () {


    // ========================================================
    // FORM
    // ========================================================

    const form =
        document.getElementById("leadForm") ||
        document.querySelector("form");


    // ========================================================
    // INPUT ELEMENTS
    // ========================================================

    const phoneInput =
        document.getElementById("id_phone_no") ||
        document.getElementById("phone_no");

    const emailInput =
        document.getElementById("id_email") ||
        document.getElementById("email");

    const leadNameInput =
        document.getElementById("id_lead_name") ||
        document.getElementById("lead_name");

    const enquiryDate =
        document.getElementById("id_enquiry_date") ||
        document.getElementById("enquiry_date") ||
        document.getElementById("enquiryDate");

    const nextFollowupDate =
        document.getElementById("id_next_followup_date") ||
        document.getElementById("next_followup_date") ||
        document.getElementById("nextFollowUpDate");


    // ========================================================
    // ERROR ELEMENTS
    // ========================================================

    const phoneError =
        document.getElementById("phoneError") ||
        document.getElementById("phone-error");

    const emailError =
        document.getElementById("emailError") ||
        document.getElementById("email-error");


    // ========================================================
    // SUBMIT BUTTON
    // ========================================================

    const submitBtn =
        document.getElementById("submit-btn");


    // ========================================================
    // LEAD ID - EDIT PAGE
    // ========================================================

    const leadId =
        document.getElementById("leadId")?.value || "";


    // ========================================================
    // STORE INITIAL FORM DATA
    // ========================================================

    const initialFormData =
        form ? new FormData(form) : null;


    // ========================================================
    // TODAY'S DATE
    // ========================================================

    function getTodayDate() {

        const today = new Date();

        const year =
            today.getFullYear();

        const month =
            String(today.getMonth() + 1).padStart(2, "0");

        const day =
            String(today.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }


    const today = getTodayDate();


    // ========================================================
    // CALENDAR OPEN FUNCTION
    // ========================================================

    function openCalendar(input) {

        if (!input) {
            return;
        }

        // Browser native date picker
        if (typeof input.showPicker === "function") {

            try {
                input.showPicker();
            } catch (error) {
                // Ignore browser restriction errors
            }

        } else {

            // Fallback for browsers without showPicker()
            input.focus();
        }
    }


    // ========================================================
    // ENQUIRY DATE
    // FUTURE DATE NOT ALLOWED
    // ========================================================

    if (enquiryDate) {

        enquiryDate.setAttribute("max", today);


        // Calendar opens when input box is clicked
        enquiryDate.addEventListener("click", function () {

            openCalendar(this);

        });


        // Also open when focused
        enquiryDate.addEventListener("focus", function () {

            // Do not force-open repeatedly while typing
            if (document.activeElement === this) {
                openCalendar(this);
            }

        });


        enquiryDate.addEventListener("change", function () {

            if (
                this.value &&
                this.value > today
            ) {

                this.value = "";

                alert(
                    "Enquiry date cannot be a future date."
                );
            }

        });

    }


    // ========================================================
    // NEXT FOLLOW-UP DATE
    // TODAY + FUTURE ALLOWED
    // PAST DATE NOT ALLOWED
    // ========================================================

    if (nextFollowupDate) {

        nextFollowupDate.setAttribute("min", today);


        // Calendar opens when input box is clicked
        nextFollowupDate.addEventListener("click", function () {

            openCalendar(this);

        });


        // Also open when focused
        nextFollowupDate.addEventListener("focus", function () {

            if (document.activeElement === this) {
                openCalendar(this);
            }

        });


        nextFollowupDate.addEventListener("change", function () {

            if (
                this.value &&
                this.value < today
            ) {

                this.value = "";

                alert(
                    "Next follow-up date cannot be a past date."
                );
            }

        });

    }


    // ========================================================
    // EMAIL CONFIGURATION
    // ========================================================

    const allowedEmailDomainEndings = [
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


    const emailPattern =
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;


    // ========================================================
    // INDIAN MOBILE NUMBER
    // ========================================================
    //
    // The "+91" is a fixed prefix shown next to the box, so the user
    // only types the 10-digit number.
    //
    // Rules: exactly 10 digits, first digit 6 / 7 / 8 / 9
    //
    //   9876543210   VALID
    //   6987654321   VALID
    //   5987654321   INVALID (starts with 5)
    //   987654321    INVALID (9 digits)
    //
    // ========================================================

    const indianMobileRegex = /^[6-9]\d{9}$/;


    // ========================================================
    // LEAD NAME - LETTERS ONLY
    // ========================================================

    if (leadNameInput) {

        leadNameInput.addEventListener(
            "input",
            function () {

                this.value =
                    this.value.replace(
                        /[^A-Za-z\s]/g,
                        ""
                    );

            }
        );

    }


    // ========================================================
    // EMAIL VALIDATION
    // ========================================================

    function validateEmail() {

        if (!emailInput) {
            return true;
        }


        const email =
            emailInput.value
                .trim()
                .toLowerCase();


        // ----------------------------
        // REQUIRED
        // ----------------------------

        if (!email) {

            if (emailError) {
                emailError.innerText =
                    "Email is required.";
            }

            emailInput.classList.add(
                "error-input"
            );

            return false;
        }


        // ----------------------------
        // BASIC FORMAT
        // ----------------------------

        if (!emailPattern.test(email)) {

            if (emailError) {
                emailError.innerText =
                    "Please enter a valid email address.";
            }

            emailInput.classList.add(
                "error-input"
            );

            return false;
        }


        // ----------------------------
        // DOMAIN
        // ----------------------------

        const domain =
            email.substring(
                email.lastIndexOf("@") + 1
            );


        const validDomain =
            allowedEmailDomainEndings.some(
                ending => domain.endsWith(ending)
            );


        if (!validDomain) {

            if (emailError) {
                emailError.innerText =
                    "Please enter an email with a valid domain like .com, .in, .co.in, .org, .net, .edu, or .ac.in.";
            }

            emailInput.classList.add(
                "error-input"
            );

            return false;
        }


        // ----------------------------
        // VALID
        // ----------------------------

        if (emailError) {
            emailError.innerText = "";
        }

        emailInput.classList.remove(
            "error-input"
        );

        return true;
    }


    // ========================================================
    // PHONE CLEANING
    // ========================================================

    function cleanPhoneValue(value) {

        // Digits only
        value = value.replace(/\D/g, "");

        // Maximum 10 digits
        return value.substring(0, 10);
    }


    // ========================================================
    // PHONE VALIDATION
    // ========================================================

    function phoneMessage(value) {

        if (!value) {
            return "Phone number is required.";
        }

        if (!/^[6-9]/.test(value)) {
            return "Mobile number must start with 6, 7, 8, or 9.";
        }

        if (value.length !== 10) {
            return "Enter a valid 10-digit mobile number.";
        }

        return "";
    }

    function validatePhone() {

        if (!phoneInput) {
            return true;
        }

        const message = phoneMessage(phoneInput.value.trim());

        if (phoneError) {
            phoneError.innerText = message;
        }

        phoneInput.classList.toggle("error-input", message !== "");

        return message === "" && indianMobileRegex.test(phoneInput.value.trim());
    }


    // ========================================================
    // PHONE LIVE VALIDATION
    // ========================================================

    if (phoneInput) {

        phoneInput.setAttribute("maxlength", "10");
        phoneInput.setAttribute("inputmode", "numeric");

        // Edit page may still hold a stored "+91XXXXXXXXXX"
        phoneInput.value = cleanPhoneValue(phoneInput.value);

        phoneInput.addEventListener(
            "input",
            function () {

                this.value = cleanPhoneValue(this.value);

                if (phoneError) {
                    phoneError.innerText = phoneMessage(this.value);
                }

                this.classList.toggle(
                    "error-input",
                    phoneMessage(this.value) !== ""
                );

                window.toggleSubmitButton();

            }
        );


        // Digits only from the keyboard
        phoneInput.addEventListener(
            "keydown",
            function (e) {

                const allowedKeys = [
                    "Backspace", "Delete", "ArrowLeft", "ArrowRight",
                    "ArrowUp", "ArrowDown", "Tab", "Home", "End"
                ];

                if (allowedKeys.includes(e.key)) {
                    return;
                }

                if (e.key === "Enter") {
                    e.preventDefault();
                    return;
                }

                if (
                    (e.ctrlKey || e.metaKey) &&
                    ["a", "c", "v", "x"].includes(e.key.toLowerCase())
                ) {
                    return;
                }

                if (/^\d$/.test(e.key)) {

                    const hasSelection =
                        this.selectionStart !== this.selectionEnd;

                    if (this.value.length >= 10 && !hasSelection) {
                        e.preventDefault();
                    }

                    return;
                }

                e.preventDefault();

            }
        );


        // Paste: keep digits only (drops +91 / 91 / 0 prefix)
        phoneInput.addEventListener(
            "paste",
            function (e) {

                e.preventDefault();

                const pastedText =
                    (e.clipboardData || window.clipboardData).getData("text");

                this.value = cleanPhoneValue(pastedText);

                this.dispatchEvent(new Event("input", { bubbles: true }));

            }
        );

    }


    // ========================================================
    // EMAIL LIVE VALIDATION
    // ========================================================

    if (emailInput) {

        emailInput.addEventListener(
            "input",
            function () {

                // Lowercase
                this.value =
                    this.value.toLowerCase();


                // Remove spaces
                this.value =
                    this.value.replace(
                        /\s/g,
                        ""
                    );


                // Maximum length
                if (this.value.length > 254) {

                    this.value =
                        this.value.substring(
                            0,
                            254
                        );

                }


                validateEmail();

                window.toggleSubmitButton();

            }
        );

    }


    // ========================================================
    // DUPLICATE CHECK
    // ========================================================

    window.checkLeadExists =
        async function (field, value) {

            if (!value || !value.trim()) {
                return true;
            }


            try {

                const response =
                    await fetch(
                        `/leads/check-lead/?${field}=${encodeURIComponent(value)}&lead_id=${encodeURIComponent(leadId)}`
                    );


                if (!response.ok) {

                    console.error(
                        "Duplicate check failed:",
                        response.status
                    );

                    return false;
                }


                const data =
                    await response.json();


                // --------------------------------------------
                // EMAIL
                // --------------------------------------------

                if (
                    field === "email" &&
                    emailInput
                ) {

                    if (data.email_exists) {

                        if (emailError) {
                            emailError.innerText =
                                "This email already exists!";
                        }

                        emailInput.classList.add(
                            "error-input"
                        );

                        return false;

                    }

                    else {

                        if (emailError) {
                            emailError.innerText = "";
                        }

                        emailInput.classList.remove(
                            "error-input"
                        );

                    }

                }


                // --------------------------------------------
                // PHONE
                // --------------------------------------------

                if (
                    field === "phone" &&
                    phoneInput
                ) {

                    if (data.phone_exists) {

                        if (phoneError) {
                            phoneError.innerText =
                                "This phone number already exists!";
                        }

                        phoneInput.classList.add(
                            "error-input"
                        );

                        return false;

                    }

                    else {

                        if (phoneError) {
                            phoneError.innerText = "";
                        }

                        phoneInput.classList.remove(
                            "error-input"
                        );

                    }

                }


                window.toggleSubmitButton();

                return true;


            } catch (error) {

                console.error(
                    "Duplicate check error:",
                    error
                );

                return false;
            }

        };


    // ========================================================
    // EMAIL BLUR
    // ========================================================

    if (emailInput) {

        emailInput.addEventListener(
            "blur",
            async function () {

                if (!validateEmail()) {

                    window.toggleSubmitButton();

                    return;
                }


                await window.checkLeadExists(
                    "email",
                    this.value.trim().toLowerCase()
                );


                window.toggleSubmitButton();

            }
        );

    }


    // ========================================================
    // PHONE BLUR
    // ========================================================

    if (phoneInput) {

        phoneInput.addEventListener(
            "blur",
            async function () {

                if (!validatePhone()) {

                    window.toggleSubmitButton();

                    return;
                }


                await window.checkLeadExists(
                    "phone",
                    this.value.trim()
                );


                window.toggleSubmitButton();

            }
        );

    }


    // ========================================================
    // PREVENT ENTER SUBMISSION
    // ========================================================

    if (form) {

        form.addEventListener(
            "keydown",
            function (e) {

                if (e.key === "Enter") {

                    e.preventDefault();

                }

            }
        );

    }


    // ========================================================
    // CHECK FORM CHANGED
    // ========================================================

    function hasFormChanged() {

        // Create page
        if (!leadId) {
            return true;
        }


        // Edit page
        if (!initialFormData || !form) {
            return true;
        }


        const currentFormData =
            new FormData(form);


        const initialEntries =
            Array.from(
                initialFormData.entries()
            );


        for (const [key, value] of initialEntries) {

            if (
                currentFormData.get(key) !== value
            ) {

                return true;
            }

        }


        return false;
    }


    // ========================================================
    // SUBMIT BUTTON
    // ========================================================

    window.toggleSubmitButton =
        function () {

            if (!submitBtn) {
                return;
            }


            const hasErrors =
                (
                    phoneError &&
                    phoneError.innerText.trim() !== ""
                )
                ||
                (
                    emailError &&
                    emailError.innerText.trim() !== ""
                );


            const changed =
                hasFormChanged();


            // Edit page:
            // unchanged = disabled
            //
            // Create page:
            // enabled if no validation errors

            if (
                hasErrors ||
                !changed
            ) {

                submitBtn.disabled = true;

                submitBtn.style.opacity = "0.6";

                submitBtn.style.cursor = "not-allowed";

            }

            else {

                submitBtn.disabled = false;

                submitBtn.style.opacity = "1";

                submitBtn.style.cursor = "pointer";

            }

        };


    // ========================================================
    // FORM INPUT EVENT
    // ========================================================

    if (form) {

        form.addEventListener(
            "input",
            function () {

                window.toggleSubmitButton();

            }
        );

        form.addEventListener(
            "change",
            function () {

                window.toggleSubmitButton();

            }
        );

    }


    // ========================================================
    // FORM SUBMIT VALIDATION
    // ========================================================

    if (form) {

        form.addEventListener(
            "submit",
            async function (e) {

                let isValid = true;


                // --------------------------------------------
                // LEAD NAME
                // --------------------------------------------

                if (!validateForm()) {

                    e.preventDefault();

                    isValid = false;

                }


                // --------------------------------------------
                // PHONE
                // --------------------------------------------

                if (!validatePhone()) {

                    e.preventDefault();

                    isValid = false;

                }


                // --------------------------------------------
                // EMAIL
                // --------------------------------------------

                if (!validateEmail()) {

                    e.preventDefault();

                    isValid = false;

                }


                // --------------------------------------------
                // DUPLICATE EMAIL
                // --------------------------------------------

                if (
                    isValid &&
                    emailInput
                ) {

                    const emailAvailable =
                        await window.checkLeadExists(
                            "email",
                            emailInput.value.trim().toLowerCase()
                        );


                    if (!emailAvailable) {

                        e.preventDefault();

                        isValid = false;

                    }

                }


                // --------------------------------------------
                // DUPLICATE PHONE
                // --------------------------------------------

                if (
                    isValid &&
                    phoneInput
                ) {

                    const phoneAvailable =
                        await window.checkLeadExists(
                            "phone",
                            phoneInput.value.trim()
                        );


                    if (!phoneAvailable) {

                        e.preventDefault();

                        isValid = false;

                    }

                }


                // --------------------------------------------
                // ENQUIRY DATE
                // --------------------------------------------

                if (
                    enquiryDate &&
                    enquiryDate.value
                ) {

                    if (
                        enquiryDate.value > today
                    ) {

                        e.preventDefault();

                        alert(
                            "Enquiry date cannot be a future date."
                        );

                        isValid = false;

                    }

                }


                // --------------------------------------------
                // NEXT FOLLOW-UP DATE
                // --------------------------------------------

                if (
                    nextFollowupDate &&
                    nextFollowupDate.value
                ) {

                    if (
                        nextFollowupDate.value < today
                    ) {

                        e.preventDefault();

                        alert(
                            "Next follow-up date cannot be a past date."
                        );

                        isValid = false;

                    }

                }


                // --------------------------------------------
                // FINAL RESULT
                // --------------------------------------------

                if (!isValid) {

                    e.preventDefault();

                    window.toggleSubmitButton();

                    return false;

                }


                return true;

            }
        );

    }


    // ========================================================
    // INITIAL VALIDATION
    // ========================================================

    if (
        emailInput &&
        emailInput.value.trim()
    ) {

        validateEmail();

    }


    if (
        phoneInput &&
        phoneInput.value.trim()
    ) {

        validatePhone();

    }


    // ========================================================
    // INITIAL BUTTON STATE
    // ========================================================

    window.toggleSubmitButton();

});


// ============================================================
// CLEAR FORM
// ============================================================

function clearForm() {

    const form =
        document.getElementById("leadForm");


    if (!form) {
        return;
    }


    form.reset();


    // --------------------------------------------
    // Error messages
    // --------------------------------------------

    const errors = [
        document.getElementById("phoneError"),
        document.getElementById("phone-error"),
        document.getElementById("emailError"),
        document.getElementById("email-error")
    ];


    errors.forEach(error => {

        if (error) {
            error.innerText = "";
        }

    });


    // --------------------------------------------
    // Remove error styles
    // --------------------------------------------

    const inputs = [
        document.getElementById("id_phone_no"),
        document.getElementById("phone_no"),
        document.getElementById("id_email"),
        document.getElementById("email")
    ];


    inputs.forEach(input => {

        if (input) {

            input.classList.remove(
                "error-input"
            );

            input.style.border = "";

        }

    });


    // --------------------------------------------
    // Update submit button
    // --------------------------------------------

    if (
        typeof window.toggleSubmitButton ===
        "function"
    ) {

        window.toggleSubmitButton();

    }

}