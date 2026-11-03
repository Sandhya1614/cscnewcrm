from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib import messages
from django.utils import timezone
from django.db.models.functions import TruncMonth
from django.db.models import Q, Avg, Count, F, FloatField, ExpressionWrapper
from django.http import JsonResponse, HttpResponse, HttpResponseForbidden
from django.core.paginator import Paginator
from django.core.exceptions import PermissionDenied

from datetime import datetime, time, timedelta
from django.conf import settings

from openpyxl import Workbook
from functools import wraps

import csv
import re
import calendar
import os

from csc_crm.apps.leads.models import *
from csc_crm.apps.admissions.models import *
from csc_crm.apps.student_attendance.models import *

from .attendance_helpers import (
    get_long_absent_streaks, ongoing_batch_q, completed_batch_q, upcoming_batch_q
)
from .constants import (
    STAFF_LOGIN_TIME, STAFF_CHECKIN_GRACE_MINUTES,
    STAFF_TOTAL_WORKING_DAYS, LONG_ABSENT_CONSECUTIVE_DAYS,
)

from .models import *
from .forms import *

# ====================== SHARED NUMBER HELPERS (dashboard / overview / attendance) ======================
# Every attendance %, student count and graph value is calculated here ONCE so the
# Staff Dashboard, Staff Overview and Staff Attendance pages can never disagree.

def get_staff_attendance_summary(staff, year=None, month=None):
    """
    Attendance numbers of ONE staff member for ONE month (default: this month).

    Total Working Days is the official figure from settings (Requirement 05) and it
    is a MONTHLY figure, so the attendance records are counted for the same month -
    never "all records ever" against a one-month total.

    present / late / absent / leave are exact status counts (no overlap).
    Attendance % = (present + 0.5 x late) / official working days, max 100
    (the half-credit-for-late rule already used by every page of the project).
    """
    today = timezone.localdate()
    year = year or today.year
    month = month or today.month

    records = Attendance.objects.filter(
        staff=staff, date__year=year, date__month=month
    )

    present = records.filter(status='Present').count()
    late = records.filter(status='Late').count()
    absent = records.filter(status='Absent').count()
    leave = records.filter(status='Leave').count()

    working_days = STAFF_TOTAL_WORKING_DAYS
    score = present + (late * 0.5)

    percentage = (
        min(round((score / working_days) * 100), 100)
        if working_days > 0 else 0
    )

    return {
        'year': year,
        'month': month,
        'period': f"{calendar.month_name[month]} {year}",
        'total_working_days': working_days,
        'present_days': present,
        'late_days': late,
        'absent_days': absent,
        'leave_days': leave,
        'percentage': percentage,
    }


def get_weekly_performance(staff, year, month):
    """
    Revenue graph data: {1: amount, ... 5: amount} for one staff member / month.

    Revenue = course fee of every ENROLLED admission of a student who came from a lead
    assigned to this staff member, put in the week (1-7, 8-14, 15-21, 22-28, 29-end)
    of the enrollment start date.
    """
    amounts = {week: 0 for week in range(1, 6)}

    lead_phones = list(
        LeadCapture.objects.filter(
            assigned_to=staff,
            initial_status="enrolled"
        ).values_list("phone_no", flat=True)
    )

    if not lead_phones:
        return amounts

    enrollments = Enrollment.objects.filter(
        admission__student__phone_no__in=lead_phones,
        admission__status="enrolled",
        start_date__year=year,
        start_date__month=month,
    ).select_related("admission__course_name")

    for enrollment in enrollments:
        week = min((enrollment.start_date.day - 1) // 7 + 1, 5)
        amounts[week] += enrollment.admission.course_name.course_fee or 0

    return amounts


def get_student_overview(enrollments):
    """
    Active / Completed / Long-Absent for a set of enrollments, counted in
    distinct STUDENTS (a student in two batches is still ONE student, so the
    three groups can never add up to more than the real number of students).

    * Long-Absent : a running batch where the latest N attendance records are all Absent
                    (takes priority - the student needs attention)
    * Active      : has a running batch and is not Long-Absent
    * Completed   : only finished batches, nothing running
    """
    enrollments = enrollments.exclude(admission__status='dropped')

    ongoing = enrollments.filter(ongoing_batch_q('batch__'))
    completed = enrollments.filter(completed_batch_q('batch__'))

    streaks = get_long_absent_streaks(ongoing)

    student_of_enrollment = dict(
        ongoing.values_list('id', 'admission__student_id')
    )

    ongoing_students = set(student_of_enrollment.values())
    long_absent_students = {
        student_of_enrollment[eid] for eid in streaks if eid in student_of_enrollment
    }
    active_students = ongoing_students - long_absent_students
    completed_students = set(
        completed.values_list('admission__student_id', flat=True)
    ) - ongoing_students

    return {
        'active': len(active_students),
        'completed': len(completed_students),
        'long_absent': len(long_absent_students),
        'streaks': streaks,
    }


def add_strength_total(batches):
    """
    Batch Strength (Requirement 02) - calculated here, in the staff module, from
    the real registrations, so the Admissions / Student Attendance modules are
    not touched.

    Every registered student adds one to the batch's strength total
    (3/30 -> 4/31) and every removal takes one away; a transfer moves it to the
    new batch.  strength total = batch base strength + registered students.
    """
    batches = list(batches)

    for batch in batches:
        batch.strength_total = batch.max_students + batch.enrolled_students
        batch.occupancy_percentage = (
            round(batch.enrolled_students * 100 / batch.strength_total, 1)
            if batch.strength_total else 0
        )

    return batches


def get_donut_values(active, completed, long_absent, total):
    """Percentages + cumulative degrees for the conic-gradient donuts."""
    if total > 0:
        active_pct = round(active / total * 100, 1)
        completed_pct = round(completed / total * 100, 1)
        long_absent_pct = round(long_absent / total * 100, 1)
    else:
        active_pct = completed_pct = long_absent_pct = 0

    active_deg = active_pct * 3.6
    completed_deg = active_deg + completed_pct * 3.6
    long_absent_deg = completed_deg + long_absent_pct * 3.6

    return (active_pct, completed_pct, long_absent_pct,
            active_deg, completed_deg, long_absent_deg)

# ============================= LEAD CAPTURE TARGET - ROLES =============================
MARKETING_TARGET_ROLES = [
    'Marketing Lead', 'Digital Marketing', 'Content Creator',   # marketing team
    'Admin', 'Manager', 'HR',                                   # view-only access
]                                                                    # who can VIEW the page
MARKETING_LEAD_ROLES = ['Marketing Lead']                          # who can ASSIGN/EDIT targets
DELETE_TARGET_ROLES = ['Marketing Lead']                           # who can DELETE targets
VIEW_ALL_TARGET_ROLES = ['Marketing Lead', 'Admin', 'Manager', 'HR']  # who can see ALL targets (not just their own)

# Marketing team members must stay inside Lead Capture Target only — they
# never get the full Lead Management pages (Lead Capture, Pipeline,
# Follow Up, Conversion Report, Call Log).
MARKETING_ONLY_ROLES = ['Marketing Lead', 'Digital Marketing', 'Content Creator']

# ============================ ROLE-BLOCK DECORATOR ============================

def block_roles(blocked_roles):
    """Deny access to the given roles, allow everyone else who's logged in.
    Used to keep the Marketing team out of the full Lead Management pages."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('staff_login')
            try:
                staff = request.user.staff_profile
            except Staff.DoesNotExist:
                messages.error(request, 'No staff profile found.')
                return redirect('staff_login')

            if staff.role.role_name in blocked_roles:
                raise PermissionDenied

            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


# ============================ LEADS MODULE - ROLE GUARD ============================
# Who may open which Leads pages.  Anyone else (including typing the URL by hand)
# gets the 403 Access Denied page.
LEAD_FULL_ROLES = ['Admin', 'Manager', 'Sales Exec Lead']                      # lead list / entry page
LEAD_ALL_ROLES = LEAD_FULL_ROLES + ['Sales Exec', 'HR']                        # pipeline, details, follow-up, report
LEAD_CALL_ROLES = LEAD_FULL_ROLES + ['Sales Exec']                             # call logs


def lead_roles_required(allowed_roles):
    """Logged-in staff whose role is in allowed_roles only; otherwise 403."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('staff_login')
            try:
                staff = request.user.staff_profile
            except Staff.DoesNotExist:
                messages.error(request, 'No staff profile found.')
                return redirect('staff_login')

            if not staff.role or staff.role.role_name not in allowed_roles:
                raise PermissionDenied

            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

# ============================ ROLE-BASED ACCESS DECORATOR ============================

def role_required(allowed_roles, marketing_only=False):
    """Only allow access if the logged-in user's Staff role is in allowed_roles.
    If marketing_only=True, staff must also belong to the Marketing department."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('staff_login')
            try:
                staff = request.user.staff_profile
            except Staff.DoesNotExist:
                messages.error(request, 'No staff profile found.')
                return redirect('staff_login')

            if staff.role.role_name not in allowed_roles:
                raise PermissionDenied
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

# Roles allowed to open Staff Management (page + CSV export)
STAFF_MANAGEMENT_ROLES = [
    'Admin',
    'Manager',
    'HR',
    'Sales Exec Lead',
    'Marketing Lead',
    'Developer',
]

# ============================ LOGIN / LOGOUT ============================

def staff_login(request):
    """Employee ID + Password login"""

    if request.user.is_authenticated:
        return redirect('staff_dashboard')

    if request.method == 'POST':
        employee_id = request.POST.get('employee_id', '').strip()
        password = request.POST.get('password', '')

        user = authenticate(request, username=employee_id, password=password)

        if user is not None:
            try:
                staff = user.staff_profile
            except Staff.DoesNotExist:
                messages.error(request, 'No staff profile linked to this account.')
                return render(request, 'staff/login.html')

            if staff.status != 'active':
                messages.error(request, 'Your account is not active. Contact admin.')
                return render(request, 'staff/login.html')

            auth_login(request, user)

            staff.last_login = timezone.now()
            staff.last_login_ip = request.META.get('REMOTE_ADDR')
            staff.save(update_fields=['last_login', 'last_login_ip'])

            messages.success(request, f"Welcome back, {staff.full_name()}!")
            return redirect('staff_dashboard')
        else:
            messages.error(request, 'Invalid Employee ID or Password.')

    return render(request, 'staff/login.html')


def staff_logout(request):
    """Logout current user"""
    auth_logout(request)
    messages.success(request, 'Logged out successfully.')
    return redirect('staff_login')


# ============================ LIST-VIEW ============================ 


@login_required(login_url='staff_login')
def staff_management(request):
    """Display all staff members with filters and role permissions matrix"""

    my_staff = getattr(request.user, 'staff_profile', None)
    my_role = my_staff.role.role_name if my_staff and my_staff.role else None

    allowed_roles = STAFF_MANAGEMENT_ROLES

    if my_role not in allowed_roles:
        raise PermissionDenied

    queryset = (
        Staff.objects
        .exclude(role__role_name='Admin')
        .select_related('role', 'department')
        .annotate(
            leads_assigned=Count('leadcapture'),

            closed_deals=Count(
                'leadcapture',
                filter=Q(leadcapture__initial_status='enrolled')
            )
        )
        .order_by('-created_at')
    )

    # Sales Exec Lead -> Sales department only (excluding own record)
    if my_role == 'Sales Exec Lead':
        queryset = queryset.filter(
            department__dept_name='Sales'
        ).exclude(id=my_staff.id)

    # Marketing Lead -> Marketing department only (excluding own record)
    elif my_role == 'Marketing Lead':
        queryset = queryset.filter(
            department__dept_name='Marketing'
        ).exclude(id=my_staff.id)

    # Admin, Manager, HR -> all departments, but excluding own record
    else:
        queryset = queryset.exclude(id=my_staff.id)

    # Apply filters
    department = request.GET.get('department')
    role = request.GET.get('role')
    status = request.GET.get('status')
    search = request.GET.get('search', '').strip()

    if department:
        queryset = queryset.filter(department_id=department)

    if role:
        queryset = queryset.filter(role_id = role)
    
    if status:
        queryset = queryset.filter(status = status)

    if search:
        queryset = queryset.filter(
            Q(first_name__icontains = search) |
            Q(last_name__icontains = search) |
            Q(email__icontains = search) |
            Q(employee_id__icontains = search)
        )
    # Pagination
    paginator = Paginator(queryset, 15)
    page_number = request.GET.get('page')
    staff_list = paginator.get_page(page_number)

    # Get all roles and departments for filters
    all_roles = StaffRole.objects.all()
    all_departments = Department.objects.all()

    # Role permission Matrix data
    permissions_matrix = [
        {
            'module':'Leads',
            'permission':{
                'admin': 'All',
                'manager': 'All',
                'sales_exec': 'Own',
                'telecaller': 'Own',
                'support': 'View',
                'hr': 'View',
                'trainer': 'View'
            }
        },
        {
            'module': 'Staff',
            'permission':{
                'admin':'All',
                'manager':'View',
                'sales_exec': 'None',
                'telecaller': 'None',
                'support': 'None',
                'hr': 'All',
                'trainer': 'None'
            }
        },
        {
            'module': 'Reports',
            'permission':{
                'admin':'All',
                'manager':'Team',
                'sales_exec':'Own',
                'telecaller': 'None',
                'support': 'None',
                'hr': 'HR',
                'trainer': 'None'
            }
        },
        {
            'module': 'Attendance',
            'permission': {
                'admin': 'All',
                'manager': 'View',
                'sales_exec':'Own',
                'telecaller':  'Own',
                'support': 'Own',
                'hr': 'All',
                'trainer': 'Own'
            }
        }
    ]

    # Filter form
    filter_form = StaffFilterForm(request.GET)

    context = {
        'page_title': 'Staff Management',
        'staff_list': staff_list,
        'filter_form': filter_form,
        'total_staff': queryset.count(),
        'roles': all_roles,
        'departments': all_departments,
        'permissions_matrix': permissions_matrix,
        'paginator': paginator,
        'page_obj': staff_list,
        'is_paginated': staff_list.has_other_pages(),
        'page_obj_number': staff_list.number,
        'search_query': search,
    }
    return render(request, 'staff/management.html', context)

# ========================== CREATE NEW STAFF ==============================
def _get_staff_roles_map():
    """{ staff_id (str): role_name } — JS ku Reporting Manager dropdown 
    filter panna use aagum."""
    return {
        str(s.id): s.role.role_name
        for s in Staff.objects.filter(status='active').select_related('role')
    }



@login_required(login_url='staff_login')
@role_required(['Admin', 'Manager'])
def add_staff(request):
    if request.method == 'POST':
        form = StaffForm(request.POST, request.FILES)

        if form.is_valid():
            documents = request.FILES.getlist('documents')

            if not documents:
                form.add_error(None, 'At least one document is required.')
                return render(request, 'staff/add_staff.html', {
                    'page_title': 'Add New Staff',
                    'form': form,
                    'staff_roles_map': _get_staff_roles_map(),
                })

            staff = form.save(commit=False)

            # ===== CREATE USER ACCOUNT FOR LOGIN =====
            password = form.cleaned_data.get('password')
            employee_id = form.cleaned_data.get('employee_id')
            email = form.cleaned_data.get('email')

            user = User.objects.create_user(
                username=employee_id,
                email=email,
                password=password
            )

            staff.user = user
            staff.save()

            for document in documents:
                StaffDocument.objects.create(
                    staff=staff,
                    document=document
                )

            messages.success(
                request,
                f"Staff member '{staff.full_name()}' added successfully!"
            )

            return redirect('overview', staff_id=staff.id)
    else:
        # Employee ID is entered manually - nothing is pre-filled
        form = StaffForm()

    context = {
        'page_title': 'Add New Staff',
        'form': form,
        'staff_roles_map': _get_staff_roles_map(),
    }
    return render(request, 'staff/add_staff.html', context)

# ============================= CHECK EMAIL EXISTING (FOR VALIDATION) ===============================

@login_required(login_url='staff_login')
def check_email(request):

    email = request.GET.get('email')
    staff_id = request.GET.get('staff_id') or None

    email_exists = Staff.objects.filter(
        email=email
    ).exclude(
        id=staff_id
    ).exists()

    return JsonResponse({
        'exists': email_exists
    })

# ======================= CHECK EMPLOYEE ID EXISTING (FOR VALIDATION) ====================

@login_required(login_url='staff_login')
def check_employee_id(request):
    """Live duplicate check for the manual Employee ID field."""
    employee_id = request.GET.get('employee_id', '').strip()
    staff_id = request.GET.get('staff_id')

    exists = False
    if employee_id:
        qs = Staff.objects.filter(employee_id__iexact=employee_id)
        if staff_id:
            qs = qs.exclude(id=staff_id)
        exists = qs.exists() or User.objects.filter(
            username__iexact=employee_id
        ).exclude(staff_profile__id=staff_id or 0).exists()

    return JsonResponse({'exists': exists})

# ======================= CHECK PHONE NO EXISTING (FOR VALIDATION) ====================

@login_required(login_url='staff_login')
def check_phone(request):

    phone = request.GET.get('phone','').strip()
    staff_id = request.GET.get('staff_id') or None

    phone_exists = Staff.objects.filter(
        phone = phone
    ).exclude(
        id=staff_id
    ).exists()

    return JsonResponse({
        'exists':phone_exists
    })

# ========================== UPDATING STAFF ===================================
@login_required(login_url='staff_login')
@role_required(['Admin', 'Manager'])
def edit_staff(request, id):

    staff = get_object_or_404(Staff, id=id)

    # =========================================================
    # REPORTING MANAGER DROPDOWN
    # =========================================================
    reporting_managers = Staff.objects.filter(
        status='active'
    ).exclude(
        id=staff.id
    ).select_related('role')

    if request.method == 'POST':

        form = EditStaffForm(
            request.POST,
            request.FILES,
            instance=staff
        )

        # IMPORTANT
        form.fields['reporting_manager'].queryset = reporting_managers

        if form.is_valid():

            staff = form.save(commit=False)

            # Password empty -> old password remains
            password = form.cleaned_data.get('password')

            staff.save()

            # The login account is the linked User (Staff has no password of its own)
            if staff.user:
                user = staff.user
                user.username = staff.employee_id      # Employee ID = login username
                user.email = staff.email

                if password:
                    user.set_password(password)

                user.save()

            messages.success(
                request,
                f'{staff.full_name()} updated successfully.'
            )

            return redirect('staff_management')

    else:

        form = EditStaffForm(instance=staff)

        # IMPORTANT
        form.fields['reporting_manager'].queryset = reporting_managers

    context = {
        'form': form,
        'staff': staff,
        'page_title': 'Edit Staff',

        # IMPORTANT FOR JS
        'staff_roles_map': _get_staff_roles_map(),

    }

    return render(
        request,
        'staff/edit_staff.html',
        context
    )
# ============================= STAFF DELETE ==================================

@login_required(login_url='staff_login')
@role_required(['Admin', 'Manager'])
def delete_staff(request, id):
    """Deleting staff member"""

    staff = get_object_or_404(Staff, id=id)

    if request.method == 'POST':
        staff.status = 'terminated'
        staff.save()
        messages.success(request, f"Staff member '{staff.full_name()}' terminated!")
        next_url = request.POST.get('next')

        if next_url:
            return redirect(next_url)

        return redirect('staff_management')
        
    context = {
        'page_title': 'Delete Staff',
        'staff': staff,
        'next_url': request.GET.get('next', ''),
    }

    return render(request, 'staff/confirm_delete.html', context)

# =========================== QUICK EDIT/AJAX ===================================

@login_required(login_url='staff_login')
@role_required(['Admin', 'Manager'])
def quick_edit_staff(request, id):
    """Quick edit via AJAX"""

    staff = get_object_or_404(Staff, id=id)

    if request.method == 'POST':
        form = StaffQuickEditForm(request.POST, instance=staff)
        if form.is_valid():
            form.save()

            # Check if it's an AJAX request
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': True,
                    'message': 'Updated Successfully'
                })
            else:
                messages.success(request, f"Staff '{staff.full_name}' updated successfully!")
        else:
            # Return JSON error response for AJAX
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'errors': form.errors
                })
    else:
        form = StaffQuickEditForm(instance=staff)

    context = {
        'page_title': f'Quick Edit - {staff.full_name}',
        'form': form,
        'staff': staff
    }

    return render(request, 'staff/quick_edit.html', context)

# ============================ EXPORT - STAFF LIST TO CSV ===============================

@login_required(login_url='staff_login')
def export_staff(request):
    """Export staff list as CSV"""

    my_staff = getattr(request.user, 'staff_profile', None)
    my_role = my_staff.role.role_name if my_staff and my_staff.role else None

    if my_role not in STAFF_MANAGEMENT_ROLES:
        raise PermissionDenied

    response = HttpResponse(content_type ='text/csv')
    response['Content-Disposition'] = 'attachement; filename="staff_list.csv"'

    writer = csv.writer(response)
    writer.writerow([
        'Employee ID', 'Name', 'Email', 'Phone', 'Role', 'Department',
        'Status', 'Monthly Target', 'Performance Rating', 'Date of Joining'
    ])

    # Get all staff (Admin's own record excluded — same as Staff Management list)
    staff_list = Staff.objects.exclude(role__role_name='Admin').select_related('role', 'department')

    # Sales Exec Lead -> Sales department only
    if my_role == 'Sales Exec Lead':
        staff_list = staff_list.filter(department__dept_name='Sales')

    # Marketing Lead -> Marketing department only
    elif my_role == 'Marketing Lead':
        staff_list = staff_list.filter(department__dept_name='Marketing')

    # Sales Exec, Digital Marketing, Content Creator, Developer -> own record only
    elif my_role in ['Sales Exec', 'Digital Marketing', 'Trainer', 'Content Creator', 'Developer']:
        staff_list = staff_list.filter(id=my_staff.id)

    # Admin, Manager, HR -> all staff (no filter)

    department = request.GET.get('department')
    role = request.GET.get('role')
    search = request.GET.get('search', '').strip()

    if department:
        staff_list = staff_list.filter(
            department_id=department
        )

    if role:
        staff_list = staff_list.filter(
            role_id=role
        )

    if search:
        staff_list = staff_list.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(email__icontains=search) |
            Q(employee_id__icontains=search)
        )

    for staff in staff_list:
        writer.writerow([
            staff.employee_id,
            staff.full_name(),
            staff.email,
            staff.phone,
            staff.role.get_role_name_display(),
            staff.department.get_dept_name_display(),
            staff.get_status_display(),
            staff.monthly_target,
            staff.performance_rating,
            staff.date_of_joining.strftime('%d-%m-%Y'),
        ])

    return response

# ===================================== STAFF OVERVIEW =========================

@login_required(login_url='staff_login')
def overview(request, staff_id=None):

    my_staff = request.user.staff_profile

    # Only Admin and Manager can access Overview
    if my_staff.role.role_name not in ['Admin', 'Manager']:
        raise PermissionDenied

    # === STAFF ===
    if staff_id:
        staff = get_object_or_404(Staff, id=staff_id)
    else:
        staff = Staff.objects.filter(status="active").first()

    my_staff = request.user.staff_profile

    if staff_id and my_staff.role.role_name not in ["Admin", "Manager"]:
        if staff.id != my_staff.id:
            raise PermissionDenied

    if not staff:
        return render(request, "staff/overview.html", {
            "error": "No active staff found."
        })

    # local date (not UTC) so the month changes at midnight IST
    today = timezone.localdate()

    # ---- performance graph: this month + last month ----
    if today.month == 1:
        last_year, last_month = today.year - 1, 12
    else:
        last_year, last_month = today.year, today.month - 1

    week_amounts = get_weekly_performance(staff, today.year, today.month)
    week_amounts_last = get_weekly_performance(staff, last_year, last_month)

    week_data_this = [week_amounts.get(i, 0) for i in range(1, 6)]
    week_data_last = [week_amounts_last.get(i, 0) for i in range(1, 6)]
    completed_amount = sum(week_data_this)

    # === KPI: LEADS ===
    leads = LeadCapture.objects.filter(assigned_to=staff)
    assigned_leads = leads.count()
    converted_leads = leads.filter(initial_status="enrolled").count()
    pending_leads = leads.filter(
        initial_status__in=["new", "contacted", "interested", "demo_scheduled"]
    ).count()
    recent_leads = leads.order_by("-created_at", "-id")[:5]

    # === TARGET PROGRESS ===
    target_amount = float(staff.monthly_target or 0)
    progress_percentage = (
        round((completed_amount / target_amount) * 100) if target_amount > 0 else 0
    )
    progress_percentage = min(progress_percentage, 100)

    # === ATTENDANCE (this month - same numbers as the Attendance page) ===
    today_attendance = Attendance.objects.filter(
        staff=staff, date=today
    ).order_by("-id").first()

    today_status = today_attendance.status if today_attendance else "Absent"
    is_present_today = today_status in ["Present", "Late"]

    att = get_staff_attendance_summary(staff)
    total_working_days = att['total_working_days']
    present_days = att['present_days']
    late_days = att['late_days']
    absent_days = att['absent_days']
    leave_days = att['leave_days']
    attendance_percentage = att['percentage']

    # === RATING ===
    rating = staff.performance_rating or 0

    # === SCHEDULE LIST ===
    schedules = TrainerSchedule.objects.filter(staff=staff).order_by("-date", "-time")

    # === WEEKLY TARGETS ===
    weekly_targets = [
        {"week_no": i, "completed_amount": week_amounts.get(i, 0)}
        for i in range(1, 6)
    ]

    # === CONTEXT ===
    context = {
        "staff": staff,

        "assigned_leads": assigned_leads,
        "converted_leads": converted_leads,
        "pending_leads": pending_leads,
        "recent_leads": recent_leads,

        "week_data_this": week_data_this,
        "week_data_last": week_data_last,
        "completed_amount": completed_amount,
        "progress_percentage": progress_percentage,
        "week_amounts": week_amounts,
        "weekly_targets": weekly_targets,

        "today_attendance": today_attendance,
        "today_status": today_status,
        "is_present_today": is_present_today,
        "total_working_days": total_working_days,
        "present_days": present_days,
        "late_days": late_days,
        "absent_days": absent_days,
        "leave_days": leave_days,
        "attendance_percentage": attendance_percentage,
        "attendance_period": att['period'],

        "rating": rating,
        "schedules": schedules,
    }

    return render(request, "staff/overview.html", context)
    
# ============================== EXPORT OVERVIEW CSV ==============================



@login_required(login_url='staff_login')
@role_required(['Admin', 'Manager'])
def staff_export(request, id):

    staff = get_object_or_404(Staff, id=id)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = (
        f'attachment; filename="{staff.employee_id}_report.csv"'
    )

    writer = csv.writer(response)

    
    # STAFF DETAILS
   
    writer.writerow(['STAFF DETAILS'])

    writer.writerow([
        'Employee ID',
        'Name',
        'Email',
        'Phone',
        'Role',
        'Department',
        'Status',
        'Monthly Target',
        'Performance Rating',
        'Date Of Joining'
    ])

    writer.writerow([
        staff.employee_id,
        staff.full_name(),
        staff.email,
        staff.phone,
        staff.role.get_role_name_display(),
        staff.department.get_dept_name_display(),
        staff.get_status_display(),
        staff.monthly_target,
        staff.performance_rating,
        staff.date_of_joining.strftime('%d-%m-%Y')
        if staff.date_of_joining else ''
    ])

    writer.writerow([])

    role_name = staff.role.role_name

    
    # SALES EXECUTIVE & TELECALLER
   
    if role_name in ['Sales Exec', 'Sales Exec Lead']:

        # same lead data the Staff Overview page shows
        leads = LeadCapture.objects.filter(
            assigned_to=staff
        ).order_by('-created_at')

        writer.writerow(['LEADS DATA'])

        writer.writerow([
            'Lead Name',
            'Phone',
            'Email',
            'Status',
            'Created At'
        ])

        for lead in leads:
            writer.writerow([
                lead.lead_name,
                lead.phone_no,
                lead.email or '',
                lead.get_initial_status_display(),
                lead.created_at.strftime('%d-%m-%Y %H:%M')
            ])

    
    # TRAINER
   
    elif role_name == 'Trainer':

        schedules = TrainerSchedule.objects.filter(
            staff=staff
        ).order_by('-date', '-time')

        writer.writerow(['TRAINING SCHEDULE'])

        writer.writerow([
            'Date',
            'Time',
            'Class / Meeting',
            'Topic',
            'Status'
        ])

        for schedule in schedules:
            writer.writerow([
                schedule.date.strftime('%d-%m-%Y'),
                schedule.time.strftime('%I:%M %p'),
                schedule.get_type_display(),
                schedule.topic,
                schedule.get_status_display(),
            ])

    return response
 
#============================================================Attendance page=======================================================================   

def auto_checkout_pending_attendance():

    today = timezone.localdate()
    current_time = timezone.localtime(timezone.now())

    # ==========================================================
    # TODAY - AUTO CHECKOUT AT 7:00 PM
    # ==========================================================
    if current_time.time() >= time(19, 0):

        today_pending_attendance = Attendance.objects.filter(
            log_in__isnull=False,
            log_out__isnull=True,
            date=today
        )

        for attendance in today_pending_attendance:

            auto_logout_time = timezone.make_aware(
                datetime.combine(
                    attendance.date,
                    time(19, 0)
                )
            )

            attendance.log_out = auto_logout_time

            worked_time = (
                attendance.log_out -
                attendance.log_in
            )

            attendance.total_hours = worked_time

            worked_hours = (
                worked_time.total_seconds() / 3600
            )

            if worked_hours < 4:
                attendance.status = "Absent"

            attendance.save()

    # ==========================================================
    # PREVIOUS DAYS - AUTO CHECKOUT AT 6:30 PM
    # ==========================================================
    pending_attendance = Attendance.objects.filter(
        log_in__isnull=False,
        log_out__isnull=True,
        date__lt=today
    )

    for attendance in pending_attendance:

        auto_logout_time = timezone.make_aware(
            datetime.combine(
                attendance.date,
                time(19, 0)
            )
        )

        attendance.log_out = auto_logout_time

        worked_time = (
            attendance.log_out -
            attendance.log_in
        )

        attendance.total_hours = worked_time

        worked_hours = (
            worked_time.total_seconds() / 3600
        )

        if worked_hours < 4:
            attendance.status = "Absent"

        attendance.save()

#======attendance=========
@login_required(login_url='staff_login')
def attendance_page(request, id):

    auto_checkout_pending_attendance()
    staff = get_object_or_404(Staff, id=id)

    # ================= ACCESS CONTROL =================
    my_staff = getattr(request.user, 'staff_profile', None)

    if (
        my_staff
        and my_staff.role
        and my_staff.role.role_name not in ["Admin", "Manager", "HR"]
        and staff.id != my_staff.id
    ):
        raise PermissionDenied
    
    if staff.role.role_name == "Admin":
        messages.error(request, "Attendance is not applicable for Admin.")
        return redirect("overview", staff_id=staff.id)  
    # ================= TODAY =================
    today = timezone.localdate()

    today_attendance = Attendance.objects.filter(staff=staff,date=today ).first()
    current_time = timezone.localtime(timezone.now())

    is_checkout_closed = current_time.time() >= time(19, 0)

    is_checkin_done = False
    is_checkout_done = False
    is_leave_or_absent = False

    if today_attendance:

        if today_attendance.log_in:
            is_checkin_done = True

        if today_attendance.log_out:
            is_checkout_done = True

        if today_attendance.status in ['Leave', 'Absent']:
            is_leave_or_absent = True

    today_status = today_attendance.status if today_attendance else 'Absent'
    
    show_checkout = False

    if (
       today_attendance and
       today_attendance.log_in and
       not today_attendance.log_out):

       show_checkout = True
    # ================= HISTORY =================
    attendance_data = Attendance.objects.filter( staff=staff).order_by('-date')

    filter_date = request.GET.get('date')
    month = request.GET.get('month')
    year = request.GET.get('year')

    if filter_date:
        attendance_data = attendance_data.filter(date=filter_date)

    if month:
        attendance_data = attendance_data.filter(date__month=month)

    if year:
        attendance_data = attendance_data.filter(date__year=year)

    # ================= COUNTS =================
    # Total Working Days is the official MONTHLY figure (Requirement 05), so the
    # cards always show ONE month: the month picked in the filter (or the month of
    # the picked date), otherwise the current month.
    summary_year, summary_month = today.year, today.month

    try:
        if filter_date:
            picked = datetime.strptime(filter_date, '%Y-%m-%d').date()
            summary_year, summary_month = picked.year, picked.month
        else:
            if year:
                summary_year = int(year)
            if month:
                summary_month = int(month)
    except (TypeError, ValueError):
        summary_year, summary_month = today.year, today.month

    if not 1 <= summary_month <= 12:
        summary_month = today.month

    att = get_staff_attendance_summary(staff, summary_year, summary_month)
    total_working_days = att['total_working_days']
    present_days = att['present_days']
    absent_days = att['absent_days']
    leave_days = att['leave_days']
    late_days = att['late_days']
    attendance_percentage = att['percentage']

# ================= PAGINATION =================
    paginator = Paginator(attendance_data, 6)

    page_number = request.GET.get("page")

    attendance_data = paginator.get_page(page_number)

    # ================= CONTEXT =================
    context = {
        'attendance_data': attendance_data,
        'total_working_days': total_working_days,
        'present_days': present_days,
        'absent_days': absent_days,
        'leave_days': leave_days,
        'late_days': late_days,
        'attendance_percentage': attendance_percentage,
        'attendance_period': att['period'],
        'today_status': today_status,
        'today_attendance': today_attendance,
        'show_checkout': show_checkout,
        'staff': staff,
        'active_attendance': Attendance.objects.filter(
        staff=staff,
        log_in__isnull=False,
        log_out__isnull=True
        ).order_by('-id').first(),

        'is_checkin_done': is_checkin_done,

        'is_checkout_done': is_checkout_done,

        'is_leave_or_absent': is_leave_or_absent,

        'is_checkout_closed': is_checkout_closed,
        
    }

    return render(request, 'staff/attendance.html', context)


#======================================== export atttendance btn ======================

@login_required(login_url='staff_login')
def export_attendance(request, id):

    staff = get_object_or_404(Staff, id=id)

    my_staff = getattr(request.user, 'staff_profile', None)
    if (
        not my_staff
        or not my_staff.role
        or (
            my_staff.role.role_name not in ["Admin", "Manager", "HR"]
            and staff.id != my_staff.id
        )
    ):
        raise PermissionDenied

    attendance_data = Attendance.objects.filter(staff=staff)

    filter_date = request.GET.get('date')
    month = request.GET.get('month')
    year = request.GET.get('year')

    if filter_date:
        attendance_data = attendance_data.filter(date=filter_date)

    if month:
        attendance_data = attendance_data.filter(date__month=month)

    if year:
        attendance_data = attendance_data.filter(date__year=year)

    attendance_data = attendance_data.order_by('-date')

    wb = Workbook()
    ws = wb.active
    ws.title = "Attendance"

    ws.append(["Date", "Log In", "Log Out", "Status", "Hours"])

    for a in attendance_data:
        ws.append([
            str(a.date),
            a.log_in.strftime("%I:%M %p") if a.log_in else "--",
            a.log_out.strftime("%I:%M %p") if a.log_out else "--",
            a.status,
            str(a.total_hours) if a.total_hours else "--"
        ])

    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

    response['Content-Disposition'] = f'attachment; filename=attendance_{staff.employee_id}.xlsx'

    wb.save(response)

    return response
#==========================================staff-checkin page===============================================
@login_required(login_url='staff_login')
def staff_checkin(request, id):

    auto_checkout_pending_attendance()

    staff = get_object_or_404(Staff, id=id)

    my_staff = getattr(request.user, 'staff_profile', None)
    if not my_staff or my_staff.id != staff.id:
        raise PermissionDenied

    today = timezone.localdate()
    current_time = timezone.localtime(timezone.now())
    is_checkout_closed = current_time.time() >= time(19, 0)

    today_attendance = Attendance.objects.filter(staff=staff, date=today).first()

    is_checkin_done = False
    is_checkout_done = False
    is_leave_or_absent = False

    if today_attendance:
        if today_attendance.log_in:
            is_checkin_done = True
        if today_attendance.log_out:
            is_checkout_done = True
        if today_attendance.status in ['Leave', 'Absent']:
            is_leave_or_absent = True

    if request.method == 'POST':

        # every redirect goes to the dashboard, where the toast is shown
        back_to_checkin = redirect('staff_dashboard')

        if staff.date_of_joining > today:
            messages.error(request, "Attendance cannot be marked before joining date.")
            return back_to_checkin

        if staff.role.role_name == "Admin":
            messages.error(request, "Attendance is not applicable for Admin.")
            return back_to_checkin

        action = request.POST.get('action')
        current_time = timezone.localtime(timezone.now())

        attendance, created = Attendance.objects.get_or_create(
            staff=staff,
            date=today
        )

        if action == 'checkin':
            if current_time.time() >= time(19, 0):
                messages.error(request, "Check-In is not allowed after 7:00 PM.")
                return back_to_checkin

            if attendance.log_in:
                messages.warning(request, "You have already checked in today.")
                return back_to_checkin

            attendance.log_in = current_time
            attendance.log_out = None
            attendance.total_hours = None
            # Scheduled login (9:00) + 30 min grace = 9:30.
            # 9:30:00 or earlier -> Present, after 9:30:00 -> Late.
            login_hour, login_minute = STAFF_LOGIN_TIME
            grace_limit = (
                datetime.combine(today, time(login_hour, login_minute))
                + timedelta(minutes=STAFF_CHECKIN_GRACE_MINUTES)
            ).time()
            attendance.status = 'Late' if current_time.time() > grace_limit else 'Present'
            attendance.save()

            if attendance.status == 'Late':
                messages.warning(request, "Checked in, but you are marked Late today.")
            else:
                messages.success(request, "Check-In completed successfully.")

        elif action == 'checkout':
            if not attendance.log_in:
                messages.warning(request, "Please check in first before checking out.")
                return back_to_checkin

            if attendance.log_out:
                messages.warning(request, "You have already checked out today.")
                return back_to_checkin

            if current_time.time() >= time(19, 0):
                messages.error(request, "Checkout is allowed only until 7:00 PM.")
                return back_to_checkin

            attendance.log_out = current_time
            worked_time = attendance.log_out - attendance.log_in
            attendance.total_hours = worked_time
            worked_hours = worked_time.total_seconds() / 3600
            if worked_hours < 4:
                attendance.status = 'Absent'
            attendance.save()

            if worked_hours < 4:
                messages.warning(request, "Checked out, but worked less than 4 hours. Marked Absent.")
            else:
                messages.success(request, "Check-Out completed successfully.")

        elif action == 'leave':
            attendance.status = 'Leave'
            attendance.log_in = None
            attendance.log_out = None
            attendance.total_hours = None
            attendance.save()
            messages.warning(request, "Leave marked successfully.")

        elif action == 'absent':
            attendance.status = 'Absent'
            attendance.log_in = None
            attendance.log_out = None
            attendance.total_hours = None
            attendance.save()
            messages.error(request, "Absent marked successfully.")

        return back_to_checkin

    active_attendance = Attendance.objects.filter(
        staff=staff, log_in__isnull=False, log_out__isnull=True
    ).order_by('-id').first()

    return render(request, 'staff/staff_checkin.html', {
        'active_attendance': active_attendance,
        'staff': staff,
        'is_checkin_done': is_checkin_done,
        'is_checkout_done': is_checkout_done,
        'is_leave_or_absent': is_leave_or_absent,
        'is_checkout_closed': is_checkout_closed,
    })
# ================================ DOCUMENT VIEWS ================================

def _detect_document_type(filename):
    """Auto-detect document type from filename keywords."""
    import os
    name = os.path.splitext(filename)[0].lower()
    if any(k in name for k in ['aadhaar', 'aadhar', 'uid']):
        return 'aadhaar', 'Aadhaar Card'
    if any(k in name for k in ['pan', 'pancard']):
        return 'pan', 'PAN Card'
    if 'passport' in name:
        return 'other', 'Passport'
    if any(k in name for k in ['resume', 'cv']):
        return 'resume', 'Resume'
    if any(k in name for k in ['offer', 'appointment']):
        return 'offer_letter', 'Offer Letter'
    if any(k in name for k in ['certificate', 'cert', 'degree', 'diploma']):
        return 'certificate', 'Certificate'
    return 'other', os.path.splitext(filename)[0].replace('_', ' ').replace('-', ' ').title()


def _ensure_legacy_document(staff):
    """If staff has a legacy documents field file, create a StaffDocument entry for it."""
    import os
    if not staff.documents:
        return
    # Check if already imported
    existing = StaffDocument.objects.filter(staff=staff, document=staff.documents.name)
    if existing.exists():
        return
    filename = os.path.basename(staff.documents.name)
    doc_type, doc_name = _detect_document_type(filename)
    StaffDocument.objects.create(
        staff=staff,
        document_name=doc_name,
        document_type=doc_type,
        document=staff.documents.name,
        status='pending',
    )


DOCUMENT_MANAGER_ROLES = ['Admin', 'Manager', 'HR']


def _can_access_staff_documents(request, staff):
    """Own documents, or Admin / Manager / HR for anyone."""
    my_staff = getattr(request.user, 'staff_profile', None)
    if not my_staff or not my_staff.role:
        return False
    return (
        my_staff.id == staff.id
        or my_staff.role.role_name in DOCUMENT_MANAGER_ROLES
    )


@login_required(login_url='staff_login')
def staff_documents(request, staff_id):
    """View documents for a specific staff member"""
    staff = get_object_or_404(Staff, id=staff_id)

    if not _can_access_staff_documents(request, staff):
        raise PermissionDenied

    documents = StaffDocument.objects.filter(staff=staff).order_by('-uploaded_at')

    if request.method == 'POST':
        uploaded_file = request.FILES.get('file')

        if uploaded_file:
            StaffDocument.objects.create(
                staff=staff,
                document=uploaded_file
            )

            messages.success(request, f"Document '{uploaded_file.name}' uploaded successfully!")
            return redirect('staff_documents', staff_id=staff.id)

        else:
            messages.error(request, 'Please select a file to upload.')

    context = {
        'staff': staff,
        'documents': documents,
        'total_count': documents.count(),
    }

    return render(request, 'staff/documents.html', context)

@login_required(login_url='staff_login')
def delete_document(request, doc_id):
    """Delete a staff document"""
    import os

    doc = get_object_or_404(StaffDocument, id=doc_id)

    if not _can_access_staff_documents(request, doc.staff):
        raise PermissionDenied

    staff_id = doc.staff.id

    # Get file name before deleting
    document_display_name = os.path.basename(doc.document.name) if doc.document else "Document"

    if request.method == 'POST':
        if doc.document:
            doc.document.delete(save=False)

        doc.delete()
        messages.success(request, f"Document '{document_display_name}' deleted.")

    return redirect('staff_documents', staff_id=staff_id)


@login_required(login_url='staff_login')
def update_document_status(request, doc_id):
    """Update document verification status"""
    doc = get_object_or_404(StaffDocument, id=doc_id)

    # verifying / rejecting a document is a manager action, never the owner's
    my_staff = getattr(request.user, 'staff_profile', None)
    if not my_staff or not my_staff.role or my_staff.role.role_name not in DOCUMENT_MANAGER_ROLES:
        raise PermissionDenied

    if request.method == 'POST':
        new_status = request.POST.get('status')
        if new_status in ['pending', 'verified', 'rejected']:
            doc.status = new_status
            doc.save()
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': True, 'status': new_status})
    return redirect('staff_documents', staff_id=doc.staff.id)

    
# ================================ Dashboard View ===================================


@login_required(login_url='staff_login')
def staff_dashboard(request):

    auto_checkout_pending_attendance()

    # ================================
    # STAFF DASHBOARD
    # ================================

    total_staff = Staff.objects.exclude(role__role_name='Admin').count()

    active_staff = Staff.objects.exclude(role__role_name='Admin').filter(status='active').count()

    on_leave = Staff.objects.exclude(role__role_name='Admin').filter(status='on_leave').count()

    terminate = Staff.objects.exclude(role__role_name='Admin').filter(status='terminated').count()

    inactive = Staff.objects.exclude(role__role_name='Admin').filter(status='inactive').count()

    recent_staff = Staff.objects.exclude(
        role__role_name='Admin'
    ).order_by('-created_at')[:5]

    # only active staff that actually have a rating
    average_rating = round(
        Staff.objects.exclude(role__role_name='Admin').filter(
            status='active',
            performance_rating__isnull=False
        ).aggregate(
            Avg('performance_rating')
        )['performance_rating__avg'] or 0,
        2
    )

    today = timezone.localdate()

    present = Attendance.objects.exclude(staff__role__role_name='Admin').filter(
        date=today,
        status='Present'
    ).count()

    late = Attendance.objects.exclude(staff__role__role_name='Admin').filter(
        date=today,
        status='Late'
    ).count()

    absent = Attendance.objects.exclude(staff__role__role_name='Admin').filter(
        date=today,
        status='Absent'
    ).count()

    leave = Attendance.objects.exclude(staff__role__role_name='Admin').filter(
        date=today,
        status='Leave'
    ).count()

    departments = Department.objects.annotate(
        total_staff=Count(
            'staff_members',
            filter=~Q(staff_members__role__role_name='Admin')
        )
    ).order_by('dept_name')

    total_attendance = present + late + absent + leave

    my_staff = getattr(request.user, 'staff_profile', None)

    # ================================
    # TRAINER - MY STUDENTS & BATCHES
    # ================================

    trainer_total_students = 0
    trainer_active_students = 0
    trainer_completed_students = 0
    trainer_long_absent_students = 0
    trainer_recent_students = []

    trainer_active_students_pct = 0
    trainer_completed_students_pct = 0
    trainer_long_absent_students_pct = 0

    trainer_active_students_deg = 0
    trainer_completed_students_deg = 0
    trainer_long_absent_students_deg = 0

    trainer_total_batches = 0
    trainer_ongoing_batches = 0
    trainer_upcoming_batches = 0
    trainer_completed_batches = 0
    trainer_batch_summary = Batch.objects.none()

    if my_staff and my_staff.role and my_staff.role.role_name == 'Trainer':

        trainer_enrollments = Enrollment.objects.filter(
            batch__trainer=my_staff
        ).exclude(admission__status='dropped')

        trainer_total_students = trainer_enrollments.values(
            'admission__student'
        ).distinct().count()

        trainer_overview = get_student_overview(trainer_enrollments)

        trainer_active_students = trainer_overview['active']
        trainer_completed_students = trainer_overview['completed']
        trainer_long_absent_students = trainer_overview['long_absent']

        trainer_recent_students = Student.objects.filter(
            admissions__enrollment__batch__trainer=my_staff
        ).distinct().order_by('-id')[:5]

        (
            trainer_active_students_pct,
            trainer_completed_students_pct,
            trainer_long_absent_students_pct,
            trainer_active_students_deg,
            trainer_completed_students_deg,
            trainer_long_absent_students_deg,
        ) = get_donut_values(
            trainer_active_students,
            trainer_completed_students,
            trainer_long_absent_students,
            trainer_total_students,
        )

        trainer_batches_qs = Batch.objects.filter(
            trainer=my_staff
        )

        trainer_total_batches = trainer_batches_qs.count()

        trainer_ongoing_batches = trainer_batches_qs.filter(
            status='Ongoing'
        ).count()

        trainer_upcoming_batches = trainer_batches_qs.filter(
            status='Upcoming'
        ).count()

        trainer_completed_batches = trainer_batches_qs.filter(
            status='Completed'
        ).count()

        # Batch strength = registered students / strength total.
        # The strength total grows and shrinks with registrations (3/30 -> 4/31).
        trainer_batch_summary = add_strength_total(
            trainer_batches_qs.select_related(
                'course',
                'trainer'
            ).annotate(
                enrolled_students=Count('enrollments')
            ).order_by(
                '-enrolled_students',
                'batch_name'
            )
        )

    # ============================================
    # MY DEPARTMENT ATTENDANCE
    # ============================================

    my_dept_present = 0
    my_dept_late = 0
    my_dept_absent = 0
    my_dept_leave = 0

    my_dept_attendance_percentage = 0
    my_department_name = None

    if my_staff and my_staff.department:

        my_department_name = my_staff.department.get_dept_name_display()

        my_dept_staff_ids = Staff.objects.exclude(
            role__role_name='Admin'
        ).filter(
            department=my_staff.department,
            status='active'
        ).values_list('id', flat=True)

        my_dept_present = Attendance.objects.filter(
            staff_id__in=my_dept_staff_ids,
            date=today,
            status='Present'
        ).count()

        my_dept_late = Attendance.objects.filter(
            staff_id__in=my_dept_staff_ids,
            date=today,
            status='Late'
        ).count()

        my_dept_absent = Attendance.objects.filter(
            staff_id__in=my_dept_staff_ids,
            date=today,
            status='Absent'
        ).count()

        my_dept_leave = Attendance.objects.filter(
            staff_id__in=my_dept_staff_ids,
            date=today,
            status='Leave'
        ).count()

        my_dept_total_staff = my_dept_staff_ids.count()

        my_dept_attendance_percentage = (
            round(
                (
                    (my_dept_present + my_dept_late)
                    / my_dept_total_staff
                ) * 100,
                1
            )
            if my_dept_total_staff > 0
            else 0
        )

    # ================================
    # MY ATTENDANCE
    # ================================

    # this month's numbers - identical to the Attendance and Overview pages
    if my_staff:

        my_att = get_staff_attendance_summary(my_staff)

        my_present_days = my_att['present_days']
        my_late_days = my_att['late_days']
        my_absent_days = my_att['absent_days']
        my_leave_days = my_att['leave_days']
        my_attendance_percentage = my_att['percentage']
        my_attendance_period = my_att['period']

    else:

        my_present_days = 0
        my_late_days = 0
        my_absent_days = 0
        my_leave_days = 0
        my_attendance_percentage = 0
        my_attendance_period = ''

    # ================================
    # CHECK-IN
    # ================================

    today_attendance_for_me = None
    today_status_for_me = 'Absent'
    show_checkout_for_me = False
    is_checkout_closed_for_me = True

    if my_staff:

        today_attendance_for_me = Attendance.objects.filter(
            staff=my_staff,
            date=today
        ).first()

        today_status_for_me = (
            today_attendance_for_me.status
            if today_attendance_for_me
            else 'Absent'
        )

        current_time = timezone.localtime(timezone.now())

        is_checkout_closed_for_me = (
            current_time.time() >= time(19, 0)
        )

        if (
            today_attendance_for_me
            and today_attendance_for_me.log_in
            and not today_attendance_for_me.log_out
        ):
            show_checkout_for_me = True

    is_checkin_done_for_me = bool(
        today_attendance_for_me
        and today_attendance_for_me.log_in
    )

    is_checkout_done_for_me = bool(
        today_attendance_for_me
        and today_attendance_for_me.log_out
    )

    is_leave_or_absent_for_me = bool(
        today_attendance_for_me
        and today_attendance_for_me.status in [
            'Leave',
            'Absent'
        ]
    )

    active_attendance_for_me = (
        today_attendance_for_me
        if (
            today_attendance_for_me
            and today_attendance_for_me.log_in
            and not today_attendance_for_me.log_out
        )
        else None
    )

    # today's attendance % = (present + late) of the staff who are expected today
    if total_attendance > 0 and active_staff > 0:

        attendance_percentage = min(
            round(
                ((present + late) / active_staff) * 100,
                1
            ),
            100
        )

    else:

        attendance_percentage = 0

    staff_status = {
        'Active': active_staff,
        'On Leave': on_leave,
        'Inactive': inactive,
        'Terminated': terminate,
    }

    roles = StaffRole.objects.exclude(
        role_name='Admin'
    ).annotate(
        total_staff=Count('staff_members')
    )

    # ================================
    # LEAD DASHBOARD
    # ================================

    total_leads = LeadCapture.objects.count()

    new_leads = LeadCapture.objects.filter(
        initial_status='new'
    ).count()

    contacted_leads = LeadCapture.objects.filter(
        initial_status='contacted'
    ).count()

    interested_leads = LeadCapture.objects.filter(
        initial_status='interested'
    ).count()

    demo_leads = LeadCapture.objects.filter(
        initial_status='demo_scheduled'
    ).count()

    enrolled_leads = LeadCapture.objects.filter(
        initial_status='enrolled'
    ).count()

    lost_leads = LeadCapture.objects.filter(
        initial_status='lost'
    ).count()

    # =====================================================
    # MY LEADS
    # =====================================================

    my_leads_qs = (
        LeadCapture.objects.filter(
            assigned_to=my_staff
        )
        if my_staff
        else LeadCapture.objects.none()
    )

    my_total_leads = my_leads_qs.count()

    my_new_leads = my_leads_qs.filter(
        initial_status='new'
    ).count()

    my_contacted_leads = my_leads_qs.filter(
        initial_status='contacted'
    ).count()

    my_interested_leads = my_leads_qs.filter(
        initial_status='interested'
    ).count()

    my_demo_leads = my_leads_qs.filter(
        initial_status='demo_scheduled'
    ).count()

    my_enrolled_leads = my_leads_qs.filter(
        initial_status='enrolled'
    ).count()

    my_lost_leads = my_leads_qs.filter(
        initial_status='lost'
    ).count()

    # Same follow-up rules as the Follow-Up page (leads app): a follow-up is
    # pending until it is marked completed, and finished (enrolled/lost) leads never count.
    my_pending_followups = my_leads_qs.filter(
        followup_completed=False
    ).exclude(
        initial_status__in=[
            'enrolled',
            'lost'
        ]
    )

    my_due_today = my_pending_followups.filter(
        next_followup_date=today
    ).count()

    my_overdue_count = my_pending_followups.filter(
        next_followup_date__lt=today
    ).count()

    if my_total_leads > 0:

        my_conversion_rate = round(
            (my_enrolled_leads / my_total_leads) * 100,
            1
        )

        my_new_leads_pct = round(
            (my_new_leads / my_total_leads) * 100,
            1
        )

        my_contacted_leads_pct = round(
            (my_contacted_leads / my_total_leads) * 100,
            1
        )

        my_interested_leads_pct = round(
            (my_interested_leads / my_total_leads) * 100,
            1
        )

        my_demo_leads_pct = round(
            (my_demo_leads / my_total_leads) * 100,
            1
        )

        my_enrolled_leads_pct = round(
            (my_enrolled_leads / my_total_leads) * 100,
            1
        )

        my_lost_leads_pct = round(
            (my_lost_leads / my_total_leads) * 100,
            1
        )

    else:

        my_conversion_rate = 0

        my_new_leads_pct = 0
        my_contacted_leads_pct = 0
        my_interested_leads_pct = 0
        my_demo_leads_pct = 0
        my_enrolled_leads_pct = 0
        my_lost_leads_pct = 0

    my_new_leads_deg = my_new_leads_pct * 3.6

    my_contacted_leads_deg = (
        my_new_leads_deg +
        (my_contacted_leads_pct * 3.6)
    )

    my_interested_leads_deg = (
        my_contacted_leads_deg +
        (my_interested_leads_pct * 3.6)
    )

    my_demo_leads_deg = (
        my_interested_leads_deg +
        (my_demo_leads_pct * 3.6)
    )

    my_enrolled_leads_deg = (
        my_demo_leads_deg +
        (my_enrolled_leads_pct * 3.6)
    )

    # ==========================================
    # LEAD PERCENTAGE
    # ==========================================

    if total_leads > 0:

        new_leads_pct = round(
            (new_leads / total_leads) * 100,
            1
        )

        contacted_leads_pct = round(
            (contacted_leads / total_leads) * 100,
            1
        )

        interested_leads_pct = round(
            (interested_leads / total_leads) * 100,
            1
        )

        demo_leads_pct = round(
            (demo_leads / total_leads) * 100,
            1
        )

        enrolled_leads_pct = round(
            (enrolled_leads / total_leads) * 100,
            1
        )

        lost_leads_pct = round(
            (lost_leads / total_leads) * 100,
            1
        )

    else:

        new_leads_pct = 0
        contacted_leads_pct = 0
        interested_leads_pct = 0
        demo_leads_pct = 0
        enrolled_leads_pct = 0
        lost_leads_pct = 0

    # ==========================================
    # LEAD DONUT DEGREES
    # ==========================================

    new_leads_deg = new_leads_pct * 3.6

    contacted_leads_deg = (
        new_leads_deg +
        (contacted_leads_pct * 3.6)
    )

    interested_leads_deg = (
        contacted_leads_deg +
        (interested_leads_pct * 3.6)
    )

    demo_leads_deg = (
        interested_leads_deg +
        (demo_leads_pct * 3.6)
    )

    enrolled_leads_deg = (
        demo_leads_deg +
        (enrolled_leads_pct * 3.6)
    )

    # ================================
    # CONVERSION RATE
    # ================================

    if total_leads > 0:

        conversion_rate = round(
            (enrolled_leads / total_leads) * 100,
            1
        )

    else:

        conversion_rate = 0

    # =====================================================
    # RECENT LEADS
    # =====================================================

    if (
        my_staff
        and my_staff.role
        and my_staff.role.role_name == 'Sales Exec'
    ):

        recent_leads = LeadCapture.objects.filter(
            assigned_to=my_staff
        ).select_related(
            'assigned_to'
        ).order_by(
            '-created_at', '-id'
        )[:5]

    else:

        # '-id' breaks ties: leads created in the same instant (same created_at)
        # must still come newest first
        recent_leads = LeadCapture.objects.select_related(
            'assigned_to'
        ).order_by(
            '-created_at', '-id'
        )[:5]

    # =====================================================
    # MARKETING - CAPTURE TARGET COUNTS
    # =====================================================

    my_targets_total = 0
    my_targets_completed = 0
    my_targets_active = 0
    my_targets_expired = 0

    my_capture_target = None
    my_captured_leads_count = 0

    marketing_team_targets_total = 0
    marketing_team_targets_completed = 0
    marketing_team_targets_active = 0
    marketing_team_targets_expired = 0

    marketing_team_captured_leads_count = 0

    marketing_team_target_count = 0
    marketing_team_achieved_count = 0
    marketing_team_progress_percent = 0

    if (
        my_staff
        and my_staff.role
        and my_staff.role.role_name in [
            'Marketing Lead',
            'Digital Marketing'
        ]
    ):

        my_targets_qs = LeadCaptureTarget.objects.filter(
            assigned_to=my_staff
        )

        my_targets_total = my_targets_qs.count()

        my_targets_completed = my_targets_qs.filter(
            is_completed=True
        ).count()

        my_targets_expired = my_targets_qs.filter(
            is_completed=False,
            end_date__lt=today
        ).count()

        my_targets_active = my_targets_qs.filter(
            is_completed=False,
            end_date__gte=today
        ).count()

        # My own current capture target
        my_capture_target = my_targets_qs.order_by(
            '-created_at'
        ).first()

        # =================================================
        # FIX:
        # LeadCapture has NO captured_by field.
        # Use assigned_to instead.
        # =================================================

        my_captured_leads_count = LeadCapture.objects.filter(
            assigned_to=my_staff
        ).count()

    if (my_staff and my_staff.role and my_staff.role.role_name == 'Marketing Lead'):

        marketing_team_targets_qs = LeadCaptureTarget.objects.filter(
            assigned_to__department__dept_name='Marketing'
        )

        marketing_team_target_count = (
            marketing_team_targets_qs.aggregate(
            total=Sum("target_count")
            )["total"] or 0
        )

        marketing_team_achieved_count = (
            marketing_team_targets_qs.aggregate(
            total=Sum("achieved_count")
            )["total"] or 0
        )

        if marketing_team_target_count > 0:
            marketing_team_progress_percent = round(
            (marketing_team_achieved_count / marketing_team_target_count) * 100
        )
        else:
            marketing_team_progress_percent = 0

        marketing_team_targets_total = (
            marketing_team_targets_qs.count()
        )

        marketing_team_targets_completed = (
            marketing_team_targets_qs.filter(
                is_completed=True
            ).count()
        )

        marketing_team_targets_expired = (
            marketing_team_targets_qs.filter(
                is_completed=False,
                end_date__lt=today
            ).count()
        )

        marketing_team_targets_active = (
            marketing_team_targets_qs.filter(
                is_completed=False,
                end_date__gte=today
            ).count()
        )

        # =================================================
        # FIX:
        # LeadCapture has NO captured_by field.
        # Use assigned_to__department instead.
        # =================================================

        marketing_team_captured_leads_count = (
            LeadCapture.objects.filter(
                assigned_to__department__dept_name='Marketing'
            ).count()
        )

    # =====================================================
    # TODAY'S FOLLOW-UPS
    # =====================================================

    # Same follow-up rules as the Follow-Up page (leads app)
    pending_followups = LeadCapture.objects.filter(
        followup_completed=False
    ).exclude(
        initial_status__in=[
            'enrolled',
            'lost'
        ]
    )

    today_followups = pending_followups.filter(
        next_followup_date=today
    )

    # =====================================================
    # FOLLOW-UP SUMMARY
    # =====================================================

    due_today = today_followups.count()

    overdue_count = pending_followups.filter(
        next_followup_date__lt=today
    ).count()

    completed_today = LeadCapture.objects.filter(
        followup_completed=True,
        followup_completed_at__date=today
    ).count()

    # =====================================================
    # LEAD SOURCE SUMMARY
    # =====================================================

    lead_sources = LeadCapture.objects.values(
        'lead_source'
    ).annotate(
        total=Count('id')
    ).order_by('-total')

    # =====================================================
    # COURSE INTEREST SUMMARY
    # =====================================================

    course_interseted = LeadCapture.objects.values(
        'course_interested'
    ).annotate(
        total=Count('id')
    ).order_by('-total')

    # =====================================================
    # ASSIGNED STAFF SUMMARY
    # =====================================================

    assigned_staff = LeadCapture.objects.values(
        'assigned_to__first_name',
        'assigned_to__last_name'
    ).annotate(
        total_leads=Count('id')
    ).order_by('-total_leads')

    # ================================
    # STUDENT DASHBOARD
    # ================================

    total_students = Student.objects.count()

    # Active / Completed / Long-Absent are separate groups of distinct students,
    # all taken from the real enrollment + attendance records (Requirement 01).
    all_enrollments = Enrollment.objects.all()

    student_overview = get_student_overview(all_enrollments)

    active_students = student_overview['active']
    completed_students = student_overview['completed']
    long_absent_students = student_overview['long_absent']
    long_absent_streaks = student_overview['streaks']

    long_absent_list = [
        {
            'name': e.student.first_name + ' ' + e.student.last_name,
            'batch': e.batch.batch_name if e.batch else '',
            'days': long_absent_streaks[e.id],
        }
        for e in Enrollment.objects.filter(
            id__in=long_absent_streaks.keys()
        ).select_related('admission__student', 'batch')
    ]
    long_absent_list.sort(key=lambda x: -x['days'])
    long_absent_list = long_absent_list[:5]

    recent_students = Student.objects.order_by(
        '-id'
    )[:5]

    (
        active_students_pct,
        completed_students_pct,
        long_absent_students_pct,
        active_students_deg,
        completed_students_deg,
        long_absent_students_deg,
    ) = get_donut_values(
        active_students,
        completed_students,
        long_absent_students,
        total_students,
    )

    # ================================
    # BATCH DASHBOARD
    # ================================

    # Same Batch records the Admission / Batches section works with, classified
    # by dates + status (the same rule as Batch.display_status), so a batch
    # whose start date has arrived is Ongoing, a future one is Upcoming, and
    # one marked Completed (or past its end date) is Completed straight away.
    # Cancelled batches are not counted in any bucket.
    dash_batches = Batch.objects.exclude(status='Cancelled')

    ongoing_batches = dash_batches.filter(ongoing_batch_q()).count()
    upcoming_batches = dash_batches.filter(upcoming_batch_q()).count()
    completed_batches = dash_batches.filter(completed_batch_q()).count()

    # Total = the three buckets, so the chips always add up.
    total_batches = ongoing_batches + upcoming_batches + completed_batches

    # Batch strength (Requirement 02): registered students / strength total.
    # The strength total is dynamic - it changes with every registration,
    # transfer or removal (3/30 -> 4/31) - it is not a fixed 30.
    # Only the five most recently added batches are listed.
    batch_summary = add_strength_total(
        dash_batches.select_related(
            'course',
            'trainer'
        ).annotate(
            enrolled_students=Count('enrollments')
        ).order_by(
            '-created_at',
            '-id'
        )[:5]
    )

    for b in batch_summary:
        if b.status == 'Completed' or (b.end_date and b.end_date < timezone.localdate()):
            b.dash_status = 'Completed'
        elif b.start_date and b.start_date > timezone.localdate():
            b.dash_status = 'Upcoming'
        else:
            b.dash_status = 'Ongoing'

    # ================================
    # CONTEXT
    # ================================

    context = {

        # Staff Module

        'total_staff': total_staff,
        'active_staff': active_staff,
        'on_leave': on_leave,
        'terminated': terminate,
        'inactive': inactive,
        'recent_staff': recent_staff,
        'average_rating': average_rating,
        'present': present,
        'late': late,
        'absent': absent,
        'leave': leave,
        'departments': departments,
        'attendance_percentage': attendance_percentage,
        'staff_status': staff_status,
        'roles': roles,

        # Leads Module

        'total_leads': total_leads,
        'new_leads': new_leads,
        'contacted_leads': contacted_leads,
        'interested_leads': interested_leads,
        'demo_leads': demo_leads,
        'enrolled_leads': enrolled_leads,
        'lost_leads': lost_leads,
        'conversion_rate': conversion_rate,
        'recent_leads': recent_leads,
        'today_followups': today_followups,
        'due_today': due_today,
        'overdue_count': overdue_count,
        'completed_today': completed_today,
        'lead_sources': lead_sources,
        'course_interseted': course_interseted,
        'assigned_staff': assigned_staff,

        'new_leads_pct': new_leads_pct,
        'contacted_leads_pct': contacted_leads_pct,
        'interested_leads_pct': interested_leads_pct,
        'demo_leads_pct': demo_leads_pct,
        'enrolled_leads_pct': enrolled_leads_pct,
        'lost_leads_pct': lost_leads_pct,

        'new_leads_deg': new_leads_deg,
        'contacted_leads_deg': contacted_leads_deg,
        'interested_leads_deg': interested_leads_deg,
        'demo_leads_deg': demo_leads_deg,
        'enrolled_leads_deg': enrolled_leads_deg,

        # Student Module

        'total_students': total_students,
        'active_students': active_students,
        'completed_students': completed_students,
        'long_absent_students': long_absent_students,
        'long_absent_list': long_absent_list,
        'LONG_ABSENT_DAYS': LONG_ABSENT_CONSECUTIVE_DAYS,
        'recent_students': recent_students,

        'active_students_pct': active_students_pct,
        'completed_students_pct': completed_students_pct,
        'long_absent_students_pct': long_absent_students_pct,

        'active_students_deg': active_students_deg,
        'completed_students_deg': completed_students_deg,
        'long_absent_students_deg': long_absent_students_deg,

        # Batch Module

        'total_batches': total_batches,
        'ongoing_batches': ongoing_batches,
        'upcoming_batches': upcoming_batches,
        'completed_batches': completed_batches,
        'batch_summary': batch_summary,

        # My Attendance
        'my_present_days': my_present_days,
        'my_late_days': my_late_days,
        'my_absent_days': my_absent_days,
        'my_leave_days': my_leave_days,
        'my_attendance_percentage': my_attendance_percentage,
        'my_attendance_period': my_attendance_period,

        # Check-in

        'today_attendance': today_attendance_for_me,
        'today_status_for_me': today_status_for_me,
        'show_checkout_for_me': show_checkout_for_me,
        'is_checkin_done_for_me': is_checkin_done_for_me,
        'is_checkout_done_for_me': is_checkout_done_for_me,
        'is_leave_or_absent_for_me': is_leave_or_absent_for_me,
        'active_attendance_for_me': active_attendance_for_me,
        'is_checkout_closed_for_me': is_checkout_closed_for_me,

        # My Department Attendance

        'my_dept_present': my_dept_present,
        'my_dept_late': my_dept_late,
        'my_dept_absent': my_dept_absent,
        'my_dept_leave': my_dept_leave,
        'my_dept_attendance_percentage':
            my_dept_attendance_percentage,
        'my_department_name': my_department_name,

        # Sales Exec Own Leads

        'my_total_leads': my_total_leads,
        'my_new_leads': my_new_leads,
        'my_contacted_leads': my_contacted_leads,
        'my_interested_leads': my_interested_leads,
        'my_demo_leads': my_demo_leads,
        'my_enrolled_leads': my_enrolled_leads,
        'my_lost_leads': my_lost_leads,
        'my_due_today': my_due_today,
        'my_overdue_count': my_overdue_count,
        'my_conversion_rate': my_conversion_rate,

        'my_new_leads_pct': my_new_leads_pct,
        'my_contacted_leads_pct': my_contacted_leads_pct,
        'my_interested_leads_pct': my_interested_leads_pct,
        'my_demo_leads_pct': my_demo_leads_pct,
        'my_enrolled_leads_pct': my_enrolled_leads_pct,
        'my_lost_leads_pct': my_lost_leads_pct,

        'my_new_leads_deg': my_new_leads_deg,
        'my_contacted_leads_deg': my_contacted_leads_deg,
        'my_interested_leads_deg': my_interested_leads_deg,
        'my_demo_leads_deg': my_demo_leads_deg,
        'my_enrolled_leads_deg': my_enrolled_leads_deg,

        # Trainer

        'trainer_total_students': trainer_total_students,
        'trainer_active_students': trainer_active_students,
        'trainer_completed_students': trainer_completed_students,
        'trainer_long_absent_students': trainer_long_absent_students,
        'trainer_recent_students': trainer_recent_students,

        'trainer_active_students_pct':
            trainer_active_students_pct,
        'trainer_completed_students_pct':
            trainer_completed_students_pct,
        'trainer_long_absent_students_pct':
            trainer_long_absent_students_pct,

        'trainer_active_students_deg':
            trainer_active_students_deg,
        'trainer_completed_students_deg':
            trainer_completed_students_deg,
        'trainer_long_absent_students_deg':
            trainer_long_absent_students_deg,

        'trainer_total_batches': trainer_total_batches,
        'trainer_ongoing_batches': trainer_ongoing_batches,
        'trainer_upcoming_batches': trainer_upcoming_batches,
        'trainer_completed_batches': trainer_completed_batches,
        'trainer_batch_summary': trainer_batch_summary,

        # Marketing

        'my_targets_total': my_targets_total,
        'my_targets_completed': my_targets_completed,
        'my_targets_active': my_targets_active,
        'my_targets_expired': my_targets_expired,
        'my_capture_target': my_capture_target,
        'my_captured_leads_count': my_captured_leads_count,

        # Marketing Lead - Team Targets

        'marketing_team_targets_total':
            marketing_team_targets_total,
        'marketing_team_targets_completed':
            marketing_team_targets_completed,
        'marketing_team_targets_active':
            marketing_team_targets_active,
        'marketing_team_targets_expired':
            marketing_team_targets_expired,
        'marketing_team_captured_leads_count':
            marketing_team_captured_leads_count,

        'marketing_team_target_count': marketing_team_target_count,
        'marketing_team_achieved_count': marketing_team_achieved_count,
        'marketing_team_progress_percent': marketing_team_progress_percent,
    }

    return render(
        request,
        'staff/dashboard.html',
        context
    )
 
# ================================ MY PROFILE ================================

@login_required(login_url='staff_login')
def staff_profile(request, staff_id):
    """View and edit a staff member's own profile page"""

    auto_checkout_pending_attendance()

    staff = get_object_or_404(Staff, id=staff_id)

    if request.user.staff_profile.id != staff.id:
        raise PermissionDenied

    # Handle Edit Profile form submission
    if request.method == 'POST':
        form = staffProfileForm(request.POST, request.FILES, instance=staff)
        if form.is_valid():
            form.save()
            messages.success(request, 'Profile updated successfully!')
            return redirect('staff_profile', staff_id=staff.id)
        else:
            messages.error(request, 'Please correct the errors below.')
    else:
        form = staffProfileForm(instance=staff)

    # Attendance this month - same numbers and the same official Total Working
    # Days as the Attendance / Overview / Dashboard pages (Requirement 05).
    att = get_staff_attendance_summary(staff)
    days_present = att['present_days'] + att['late_days']
    working_days = att['total_working_days']

    # Leave balance (days not marked Absent/Present in month, rough calc)
    leave_days = att['leave_days']
    # Simple leave balance: assume 15 days annual / 12 months
    leave_balance = max(0, 15 - leave_days)

    # Tasks completed (converted leads as proxy)
    tasks_completed = Lead.objects.filter(staff=staff, status='converted').count()
    tasks_total = Lead.objects.filter(staff=staff).count()

    # Documents uploaded for this staff
    documents = StaffDocument.objects.filter(staff=staff)

    # ── RECENT ACTIVITY FEED ──────────────────────────────────────────
    from datetime import datetime as _dt
    activity_feed = []

    # 1) Check-ins: Attendance records where status is Present/Late and log_in exists
    checkins = Attendance.objects.filter(
        staff=staff,
        status__in=['Present', 'Late'],
        log_in__isnull=False
    ).order_by('-log_in')[:10]
    for att in checkins:
        activity_feed.append({
            'type': 'checkin',
            'icon': 'fa-right-to-bracket',
            'color': 'green',
            'title': 'Checked In' if att.status == 'Present' else 'Checked In (Late)',
            'detail': att.log_in.strftime('%d %b %Y, %I:%M %p'),
            'timestamp': att.log_in,
        })

    # 2) Document uploads: each StaffDocument with filename as designation
    for doc in documents.order_by('-uploaded_at')[:10]:

        if doc.document:
            raw_name = os.path.basename(doc.document.public_id)
        else:
            raw_name = "Document"

        doc_label = raw_name.replace("_", " ").replace("-", " ").title()
        activity_feed.append({
            'type': 'document',
            'icon': 'fa-file-arrow-up',
            'color': 'blue',
            'title': f'Uploaded {doc_label}',
            'detail': doc.uploaded_at.strftime('%d %b %Y, %I:%M %p'),
            'timestamp': doc.uploaded_at,
        })

    # 3) Profile updates: staff updated_at (if different from created_at)
    if staff.updated_at and abs((staff.updated_at - staff.created_at).total_seconds()) > 60:
        activity_feed.append({
            'type': 'profile',
            'icon': 'fa-user-pen',
            'color': 'yellow',
            'title': 'Profile Updated',
            'detail': staff.updated_at.strftime('%d %b %Y, %I:%M %p'),
            'timestamp': staff.updated_at,
        })


    # Sort all by timestamp descending, keep latest 10
    activity_feed.sort(key=lambda x: x['timestamp'], reverse=True)
    activity_feed = activity_feed[:10]

    # Humanize timestamps
    _now = timezone.now()
    for item in activity_feed:
        diff = _now - item['timestamp']
        if diff.days == 0:
            item['when'] = 'Today'
        elif diff.days == 1:
            item['when'] = 'Yesterday'
        elif diff.days < 7:
            item['when'] = f"{diff.days} Days Ago"
        elif diff.days < 30:
            item['when'] = f"{diff.days // 7} Week{'s' if diff.days // 7 > 1 else ''} Ago"
        else:
            item['when'] = item['timestamp'].strftime('%d %b %Y')
    # ─────────────────────────────────────────────────────────────────
    context = {
        'staff': staff,
        'form': form,
        'days_present': days_present,
        'working_days': working_days,
        'leave_balance': leave_balance,
        'tasks_completed': tasks_completed,
        'tasks_total': tasks_total,
        'documents': documents,
        'activity_feed': activity_feed,
    }
    return render(request, 'staff/staff_profile.html', context)


# ================== STAFF-SCOPED LEAD LIST (Staff Overview -> Recent Leads -> View All) ==================
@login_required(login_url='staff_login')
@role_required(['Admin', 'Manager'])
def staff_assigned_leads(request, staff_id):
    """
    Shows ONLY the leads assigned to one staff member (Requirement 04).
    Opened from Staff Overview -> Recent Leads -> "View All", so the staff
    member being viewed (staff_id) stays in the URL.
    """
    staff = get_object_or_404(Staff, id=staff_id)

    leads = LeadCapture.objects.filter(assigned_to=staff).order_by('-created_at', '-id')

    search_query = request.GET.get('search', '').strip()
    status = request.GET.get('status', '').strip()

    if search_query:
        leads = leads.filter(
            Q(lead_name__icontains=search_query) |
            Q(email__icontains=search_query) |
            Q(phone_no__icontains=search_query) |
            Q(lead_id__icontains=search_query)
        )

    valid_statuses = [value for value, _ in LeadCapture.STATUS_CHOICES]
    if status in valid_statuses:
        leads = leads.filter(initial_status=status)
    else:
        status = ''

    paginator = Paginator(leads, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    context = {
        'staff': staff,
        'leads': page_obj,
        'page_obj': page_obj,
        'total_leads': paginator.count,
        'search_query': search_query,
        'selected_status': status,
        'status_choices': LeadCapture.STATUS_CHOICES,
    }

    return render(request, 'staff/staff_assigned_leads.html', context)