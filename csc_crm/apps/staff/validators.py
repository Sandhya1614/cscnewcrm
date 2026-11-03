"""
Shared validators used across the CSC-CRM project.

PHONE NUMBER RULE (Requirement 07)
----------------------------------
* Exactly 10 digits
* First digit must be 6, 7, 8 or 9
* No "+91" prefix (numbers are stored and entered without it)

Every form / model that has a phone or mobile field must use
``validate_indian_mobile`` (or ``clean_indian_mobile`` inside a form's
``clean_<field>`` method) so the rule stays identical everywhere.
"""

import re

from django.core.exceptions import ValidationError

INDIAN_MOBILE_REGEX = re.compile(r'^[6-9]\d{9}$')

# --- messages (kept in one place so the JS side can mirror them) ---
MSG_DIGITS_ONLY = "Phone number must contain digits only (do not enter +91 or any symbols)."
MSG_LENGTH = "Phone number must be exactly 10 digits."
MSG_START_DIGIT = "Phone number must start with 6, 7, 8 or 9."


def get_phone_error(value):
    """Return an error message for an invalid phone number, else None."""
    value = (value or '').strip()

    if not value.isascii() or not value.isdigit():
        return MSG_DIGITS_ONLY

    if len(value) != 10:
        return MSG_LENGTH

    if value[0] not in '6789':
        return MSG_START_DIGIT

    return None


def validate_indian_mobile(value):
    """Django validator - usable in ``validators=[...]`` on model/form fields."""
    error = get_phone_error(value)
    if error:
        raise ValidationError(error, code='invalid_phone')


def clean_indian_mobile(value, required=True):
    """
    Helper for ``clean_<field>`` methods.

    Strips whitespace, validates and returns the clean 10-digit string.
    Empty values are returned unchanged when ``required`` is False.
    """
    value = (value or '').strip()

    if not value:
        if required:
            raise ValidationError("Phone number is required.", code='required')
        return value

    validate_indian_mobile(value)
    return value


def strip_country_code(value):
    """
    Convert a legacy "+91XXXXXXXXXX" value to "XXXXXXXXXX".
    Used by the one-time data migrations; leaves anything else untouched.
    """
    if value and value.startswith('+91') and len(value) == 13:
        return value[3:]
    return value


# ---------------------------------------------------------------------------
# NAME RULE: letters only (single spaces between words), at most 20 characters.
# Used by Staff, Student and Lead name fields so the rule is identical
# everywhere.  The JS side mirrors it with maxlength="20" + a letters-only filter.
# ---------------------------------------------------------------------------
NAME_MAX_LENGTH = 20
NAME_REGEX = re.compile(r'^[A-Za-z]+(?: [A-Za-z]+)*$')
MSG_NAME_LETTERS = "Name must contain letters only (no numbers or symbols)."
MSG_NAME_LENGTH = "Name must be 20 characters or fewer."


def get_name_error(value):
    """Return an error message for an invalid name, else None."""
    value = (value or '').strip()

    if not value:
        return "Name is required."

    if len(value) > NAME_MAX_LENGTH:
        return MSG_NAME_LENGTH

    if not NAME_REGEX.match(value):
        return MSG_NAME_LETTERS

    return None


def validate_person_name(value):
    """Django validator - usable in ``validators=[...]`` on model/form fields."""
    error = get_name_error(value)
    if error:
        raise ValidationError(error, code='invalid_name')


def clean_person_name(value):
    """Helper for ``clean_<field>`` methods: returns the stripped, valid name."""
    value = (value or '').strip()
    validate_person_name(value)
    return value
