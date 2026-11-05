from csc_crm.apps.staff.validators import clean_person_name
import re
from django import forms
from django.db.models import Q
from .models import *


class LeadCaptureForm(forms.ModelForm):

    class Meta:
        model = LeadCapture
        fields = '__all__'
        exclude = ['lead_id', 'created_at', 'updated_at']
        widgets = {
            'enquiry_date': forms.DateInput(attrs={
                'type': 'date',
                'id': 'enquiryDate',
            }),
            'next_followup_date': forms.DateInput(attrs={
                'type': 'date',
                'id': 'nextFollowUpDate',
            }),
            'phone_no': forms.TextInput(attrs={
                'id': 'phone_no',
                'placeholder': 'Enter 10-digit mobile number',
                'maxlength': '10',
                'inputmode': 'numeric',
                'autocomplete': 'off',
                'class': 'phone-input',
            }),
            'lead_name': forms.TextInput(attrs={
                'placeholder': 'Enter lead name',
                'id': 'id_lead_name',
                'maxlength': '20',
            }),
            'email': forms.TextInput(attrs={
                'id': 'email',
                'placeholder': 'Enter email address'
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Name rule: letters only, 20 characters max (the model column is wider
        # for old records, so the limit is applied here, on the form).
        self.fields['lead_name'].max_length = 20
        self.fields['lead_name'].widget.attrs['maxlength'] = '20'

        # Only active staff in these roles (BDE, Telecalling, Sales Executive,
        # Sales Lead). Matching is case-insensitive and covers the role-name
        # spellings used in the Staff model / admin.
        assignable_roles = [
            'BDE',
            'Telecalling', 'Telecall', 'Telecaller',
            'Sales Exec', 'Sales Executive',
            'Sales Exec Lead', 'Sales Lead',
        ]
        role_filter = Q()
        for role_name in assignable_roles:
            role_filter |= Q(role__role_name__iexact=role_name)

        self.fields['assigned_to'].queryset = Staff.objects.filter(
            role_filter,
            status='active'
        )

        # Show only the 10 digits in the input (the +91 is a fixed prefix in the UI)
        phone = self.initial.get('phone_no') or getattr(self.instance, 'phone_no', '')
        if phone and not self.is_bound:
            self.initial['phone_no'] = phone[-10:]

    def clean_lead_name(self):
        return clean_person_name(self.cleaned_data.get('lead_name'))

    def clean_phone_no(self):
        phone = (self.cleaned_data.get('phone_no') or '').strip().replace(' ', '')

        # Tolerate the legacy "+91" prefix, but the number itself must be
        # exactly 10 digits starting with 6, 7, 8 or 9.
        
        if not re.fullmatch(r'[6-9]\d{9}', phone):
            raise forms.ValidationError(
                'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.'
            )

        # Stored in the existing "93XXXXXXXX" format
        return f'{phone}'


# Call-log form
class CallLogForm(forms.ModelForm):
    class Meta:
        model = CallLog
        fields = [
            'lead', 'lead_name', 'call_type', 'call_date', 'call_time',
            'duration', 'duration_seconds', 'call_outcome', 'notes',
            'next_followup_date',
        ]

    def clean(self):
        cleaned = super().clean()

        # Link the call to a lead: use the selected one, otherwise try an exact name match
        name = (cleaned.get('lead_name') or '').strip()
        if not cleaned.get('lead') and name:
            matches = list(LeadCapture.objects.filter(lead_name__iexact=name)[:2])
            if len(matches) == 1:
                cleaned['lead'] = matches[0]

        if cleaned.get('lead'):
            cleaned['lead_name'] = cleaned['lead'].lead_name

        # A call that did not connect has no talk time
        if cleaned.get('call_type') == 'did_not_connect':
            cleaned['duration'] = 0
            cleaned['duration_seconds'] = 0
        else:
            cleaned['duration'] = cleaned.get('duration') or 0
            cleaned['duration_seconds'] = cleaned.get('duration_seconds') or 0
            if cleaned['duration_seconds'] > 59:
                self.add_error('duration_seconds', 'Seconds must be between 0 and 59.')

        return cleaned


# Lead Capture Target Form (Marketing)
class LeadCaptureTargetForm(forms.ModelForm):

    class Meta:
        model = LeadCaptureTarget
        fields = ['assigned_to', 'target_count', 'end_date']
        widgets = {
            'assigned_to': forms.Select(attrs={
                'id': 'id_target_assigned_to',
            }),
            'target_count': forms.NumberInput(attrs={
                'id': 'id_target_count',
                'placeholder': 'Enter lead target count',
                'min': 1,
            }),
            'end_date': forms.DateInput(attrs={
                'type': 'date',
                'id': 'id_target_end_date',
            }),
        }
        labels = {
            'assigned_to': 'Team Member',
            'target_count': 'Lead Target Count',
            'end_date': 'End Date',
        }

    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)

        # Only active Marketing team members
        queryset = Staff.objects.filter(
            department__dept_name='Marketing',
            status='active'
        )

        # Don't show the logged-in user's own name
        if user:
            staff = getattr(user, 'staff_profile', None)

            if staff:
                queryset = queryset.exclude(id=staff.id)

        self.fields['assigned_to'].queryset = queryset

    def clean_end_date(self):
        end_date = self.cleaned_data.get('end_date')
        today = timezone.localdate()

        if end_date and end_date < today:
            raise forms.ValidationError(
                'End date cannot be in the past.'
            )

        return end_date

    def clean_target_count(self):
        target_count = self.cleaned_data.get('target_count')

        if target_count is not None and target_count <= 0:
            raise forms.ValidationError(
                'Lead target count must be greater than 0.'
            )

        return target_count
    

# Lead Capture Target UPDATE Form (Marketing)
# Assignee cannot be changed here - only the target count and end date,
# since "achieved" progress is auto-calculated from captured leads.
class LeadCaptureTargetUpdateForm(forms.ModelForm):

    class Meta:
        model = LeadCaptureTarget
        fields = ['target_count', 'end_date']
        widgets = {
            'target_count': forms.NumberInput(attrs={
                'id': 'id_edit_target_count',
                'placeholder': 'Enter lead target count',
                'min': 1,
            }),
            'end_date': forms.DateInput(attrs={
                'type': 'date',
                'id': 'id_edit_target_end_date',
            }),
        }
        labels = {
            'target_count': 'Lead Target Count',
            'end_date': 'End Date',
        }

    def clean_target_count(self):
        target_count = self.cleaned_data.get('target_count')

        if target_count is not None and target_count <= 0:
            raise forms.ValidationError('Lead target count must be greater than 0.')

        return target_count


class LeadCaptureTargetProgressForm(forms.Form):
    """Team member self-reports how many leads they captured — no access
    to the full Lead Management page needed."""

    captured_count = forms.IntegerField(
        min_value=1,
        label='Leads Captured',
        widget=forms.NumberInput(attrs={
            'id': 'id_progress_count',
            'placeholder': 'How many leads did you capture?',
            'min': 1,
        }),
    )