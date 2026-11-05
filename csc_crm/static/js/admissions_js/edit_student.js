/* ==========================================
        EDIT STUDENT JS
========================================== */

document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("studentForm");

    /*=========================================
            ERROR HELPERS
    =========================================*/

    function showError(input, errorEl, message) {
        if (input) input.classList.add("error-input");
        if (errorEl) errorEl.innerText = message;
    }

    function clearError(input, errorEl) {
        if (input) input.classList.remove("error-input");
        if (errorEl) errorEl.innerText = "";
    }

    /*=========================================
            VALIDATORS
    =========================================*/

    function validateName(input, error, message) {

        input.value = input.value.replace(/[^A-Za-z ]/g, "");

        if (input.value.trim() === "") {
            showError(input, error, message);
            return false;
        }

        clearError(input, error);
        return true;
    }

    function validatePhone(input, error) {

        const phone = input.value.replace(/\D/g, "");
        input.value = phone;

        if (phone.length !== 10) {
            showError(input, error, "Phone number must contain exactly 10 digits.");
            return false;
        }

        if (!/^[6-9]/.test(phone)) {
            showError(input, error, "Phone number must start with 6, 7, 8 or 9.");
            return false;
        }

        clearError(input, error);
        return true;
    }

    function validateEmail(input, error) {

        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!pattern.test(input.value.trim())) {
            showError(input, error, "Enter a valid email address.");
            return false;
        }

        clearError(input, error);
        return true;
    }

    function validateDOB(input, error) {

        if (!input.value) {
            showError(input, error, "Date of birth is required.");
            return false;
        }

        const dob = new Date(input.value);
        const today = new Date();

        if (dob >= today) {
            showError(input, error, "Future date is not allowed.");
            return false;
        }

        let age = today.getFullYear() - dob.getFullYear();
        const month = today.getMonth() - dob.getMonth();

        if (month < 0 || (month === 0 && today.getDate() < dob.getDate())) {
            age--;
        }

        if (age < 18) {
            showError(input, error, "Student must be at least 18 years old.");
            return false;
        }

        clearError(input, error);
        return true;
    }

    function validateRequired(input, error, message) {

        if (!input.value.trim()) {
            showError(input, error, message);
            return false;
        }

        clearError(input, error);
        return true;
    }

    function validateAddress(input, error) {

        if (input.value.trim().length < 10) {
            showError(input, error, "Enter complete address.");
            return false;
        }

        clearError(input, error);
        return true;
    }

    /*=========================================
            FIELD REFERENCES
    =========================================*/

    const f = {
        firstName:  [document.getElementById("first_name"),  document.getElementById("firstNameError")],
        lastName:   [document.getElementById("last_name"),   document.getElementById("lastNameError")],
        email:      [document.getElementById("email"),       document.getElementById("emailError")],
        phone:      [document.getElementById("phone_no"),    document.getElementById("phoneError")],
        dob:        [document.getElementById("dob"),         document.getElementById("dobError")],
        gender:     [document.getElementById("gender"),      document.getElementById("genderError")],
        guardian:   [document.getElementById("guardian_name"), document.getElementById("guardianNameError")],
        guardianPh: [document.getElementById("guardian_phone_no"), document.getElementById("guardianPhoneError")],
        education:  [document.getElementById("educational_qualification"), document.getElementById("educationalQualificationError")],
        address:    [document.getElementById("address"),     document.getElementById("addressError")],
        course:     [document.getElementById("id_course"),   document.getElementById("courseError")],
        batch:      [document.getElementById("id_batch"),    document.getElementById("batchError")],
        startDate:  [document.getElementById("start_date"),  document.getElementById("startDateError")]
    };

    const checks = {
        firstName:  () => validateName(...f.firstName, "First name is required."),
        lastName:   () => validateName(...f.lastName, "Last name is required."),
        email:      () => validateEmail(...f.email),
        phone:      () => validatePhone(...f.phone),
        dob:        () => validateDOB(...f.dob),
        gender:     () => validateRequired(...f.gender, "Please select gender."),
        guardian:   () => validateName(...f.guardian, "Guardian name is required."),
        guardianPh: () => validatePhone(...f.guardianPh),
        education:  () => validateRequired(...f.education, "Educational qualification is required."),
        address:    () => validateAddress(...f.address),
        course:     () => validateRequired(...f.course, "Please select a course."),
        batch:      () => validateRequired(...f.batch, "Please select a batch."),
        startDate:  () => validateRequired(...f.startDate, "Admission date is required.")
    };

    // real-time validation
    Object.keys(checks).forEach(key => {
        const input = f[key][0];
        if (!input) return;
        const eventName = input.tagName === "SELECT" || input.type === "date" ? "change" : "input";
        input.addEventListener(eventName, checks[key]);
    });

    /*=========================================
            COURSE DETAILS (duration / fee)
    =========================================*/

    const courseSelect = document.getElementById("id_course");
    const durationInput = document.getElementById("duration");
    const feeInput = document.getElementById("fee");

    function updateCourseDetails() {

        if (!courseSelect || !durationInput || !feeInput) return;

        const option = courseSelect.options[courseSelect.selectedIndex];

        durationInput.value = option.dataset.duration || "";
        feeInput.value = option.dataset.fee || "";
    }

    if (courseSelect) {
        courseSelect.addEventListener("change", updateCourseDetails);
        updateCourseDetails();
    }

    /*=========================================
            FORM SUBMIT — block save if invalid
    =========================================*/

    if (form) {

        form.addEventListener("submit", function (e) {

            // run every check (no short-circuit) so all errors show at once
            const results = Object.keys(checks).map(key => f[key][0] ? checks[key]() : true);

            if (results.includes(false)) {

                e.preventDefault();

                const firstError = form.querySelector(".error-input");
                if (firstError) {
                    firstError.scrollIntoView({ behavior: "smooth", block: "center" });
                    firstError.focus();
                }
            }
        });
    }

});